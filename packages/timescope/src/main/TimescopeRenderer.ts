import type {
  InteractionInfoWire,
  RenderEngineCommands,
  RendererCommands,
  TimescopeDataLoadMessage,
  TimescopeEventMessage,
  TimescopeFrameCaptureMessage,
  TimescopeSyncMessage,
  TimescopeViewportChangedMessage,
} from '#src/bridge/protocol';
import type { RenderCall, RenderNotify } from '#src/bridge/rpc';
import { TimescopeEvent, TimescopeObservable } from '#src/core/event';
import { mergeOptions } from '#src/core/options';
import { resolutionFor } from '#src/core/zoom';
import { resolveDocumentFonts, resolveFonts } from '#src/main/font';
import type { TimescopeFont } from '#src/main/font';
import type { InteractionInfo } from '#src/main/interaction';
import type { TimescopeLayerData, TimescopeLayerDataClass } from '#src/main/layers/TimescopeLayerData';
import { TimescopeSeriesChart } from '#src/main/layers/TimescopeSeriesChart';
import { TimescopeSeriesTooltip } from '#src/main/layers/TimescopeSeriesTooltip';
import { TimescopeTimeAxis } from '#src/main/layers/TimescopeTimeAxis';
import { TimescopeYAxis } from '#src/main/layers/TimescopeYAxis';
import type { TimescopeDomainOptions, TimescopeOptions } from '#src/main/options';
import { createDataSeries, type TimescopeDataSeries } from '#src/main/TimescopeDataSeries';
import { createDataSource, type TimescopeDataSource } from '#src/main/TimescopeDataSource';
import { TimescopeDomain } from '#src/main/TimescopeDomain';
import { TimescopeViewRegistry } from '#src/main/TimescopeView';
import type { TimescopeDataCacheOptionsWire, TimescopeRenderEngineOptions } from '#src/renderer/types';
import { Decimal } from '@kikuchan/decimal';

// Each renderer holds one reference per distinct Source, regardless of aliases.
const sourceReferences = new WeakMap<TimescopeDataSource<any>, number>();
function retainSource(source: TimescopeDataSource<any>) {
  sourceReferences.set(source, (sourceReferences.get(source) ?? 0) + 1);
}
function releaseSource(source: TimescopeDataSource<any>) {
  const count = sourceReferences.get(source)! - 1;
  if (count > 0) sourceReferences.set(source, count);
  else {
    sourceReferences.delete(source);
    source.dispose?.();
  }
}

const colorPresets = ['#080', '#800', '#008', '#880', '#088', '#808'];

const defaultRendererOptions: TimescopeOptions = {
  style: undefined,
  cursor: true,

  sources: undefined,
  series: undefined,
  tracks: undefined,
  selection: undefined,
};

export type TimescopeRendererOptions = {
  canvas: HTMLCanvasElement;
  fonts?: (string | TimescopeFont)[];
};

type LayerDataMapping = [string, TimescopeLayerDataClass, object, TimescopeDataCacheOptionsWire];

function interactionForEngine(info: InteractionInfo): InteractionInfoWire {
  const pointer = (value: InteractionInfo['latest']) => ({
    pointerId: value.pointerId,
    latest: { x: value.latest.x, y: value.latest.y },
    last: { x: value.last.x, y: value.last.y },
    delta: { x: value.delta.x, y: value.delta.y },
    anchor: { x: value.anchor.x, y: value.anchor.y },
    pressed: value.pressed,
  });
  return {
    type: info.type,
    state: info.state,
    latest: pointer(info.latest),
    buttons: info.buttons.map(pointer),
    shiftKey: info.shiftKey,
  };
}

export type TimescopeRendererConnection = {
  call: RenderCall<RenderEngineCommands>;
  notify: RenderNotify<RenderEngineCommands>;
  dispose: () => void;
};

export abstract class TimescopeRenderer extends TimescopeObservable<
  TimescopeEvent<'sync', TimescopeSyncMessage> | TimescopeEvent<'renderer:event', unknown>
> {
  #connection?: TimescopeRendererConnection;
  #disposed = false;
  protected readonly callbacks: RendererCommands;
  protected get documentFontsAreLocal(): boolean {
    return false;
  }

  protected call: RenderCall<RenderEngineCommands> = (command, payload) => {
    if (!this.#connection || this.#disposed) return Promise.reject(new DOMException('Renderer disposed', 'AbortError'));
    const result = this.#connection.call(command, payload);
    // Report failures without creating unhandled rejections.
    void result.catch((error) => {
      if (!this.#disposed) console.error(`Render engine ${command} failed`, error);
    });
    return result;
  };

  protected notify: RenderNotify<RenderEngineCommands> = (command, payload) => {
    if (!this.#connection || this.#disposed) return Promise.reject(new DOMException('Renderer disposed', 'AbortError'));
    const result = this.#connection.notify(command, payload);
    void result.catch((error) => {
      if (!this.#disposed) console.error(`Render engine ${command} failed`, error);
    });
    return result;
  };

  protected attach(connection: TimescopeRendererConnection, fonts?: (string | TimescopeFont)[]) {
    this.#connection = connection;
    void this.setFonts(fonts).catch((error) => {
      if (!this.#disposed) console.error('Failed to initialize fonts', error);
    });
  }

  #sources: Record<string, TimescopeDataSource<any>> = {};
  #series: Record<string, TimescopeDataSeries> = {};
  #layerData: Record<string, TimescopeLayerData> = {};
  #views = new TimescopeViewRegistry();
  #domainsByName: Record<string, TimescopeDomain> = {};
  #domainsBySeries: Record<string, TimescopeDomain> = {};

  #useDocumentFonts = false;
  #documentFontCleanup: (() => void)[] = [];
  #documentFontWatchersActive = false;
  #documentFontsRefreshHandle: ReturnType<typeof setTimeout> | null = null;

  #colorIdx = 0;
  #preparingFrame = false;
  #pendingViewport?: [TimescopeViewportChangedMessage, 'changed' | 'changing' | 'prepare'];

  #updateViewport(msg: TimescopeViewportChangedMessage, phase: 'changed' | 'changing' | 'prepare') {
    if (this.#preparingFrame) {
      this.#pendingViewport = [msg, phase];
      return false;
    }
    this.#views.update({ ...msg.viewport, phase });
    return true;
  }

  #waitForTargets() {
    return Promise.all([...new Set(Object.values(this.#layerData))].map((data) => data.waitForTarget?.()));
  }

  protected constructor() {
    super();

    this.callbacks = {
      sync: (value: TimescopeSyncMessage) => {
        this.dispatchEvent(new TimescopeEvent('sync', value, this.uid));
      },

      'renderer:event': (msg: TimescopeEventMessage) => {
        this.dispatchEvent(new TimescopeEvent('renderer:event', msg.value, msg.uid));
      },

      'viewport:changed': (msg: TimescopeViewportChangedMessage) => {
        this.#updateViewport(msg, 'changed');
      },

      'viewport:changing': (msg: TimescopeViewportChangedMessage) => {
        this.#updateViewport(msg, 'changing');
      },

      'viewport:prepare': async (msg: TimescopeViewportChangedMessage & { settled?: boolean }) => {
        try {
          if (!this.#updateViewport(msg, 'prepare')) return { ok: true };
          if (msg.settled) await this.#waitForTargets();
          return { ok: true };
        } catch (error) {
          return { ok: false, message: error instanceof Error ? error.message : String(error) };
        }
      },

      'data:load': async (msg: TimescopeDataLoadMessage) => {
        return await this.#layerData[msg.key]?.loadData(msg.range, msg.resolution, msg.xOrigin, {
          fallbackResolution: msg.fallbackResolution,
          loadMissing: msg.loadMissing,
        });
      },
    };
  }

  async setFonts(fonts?: (string | TimescopeFont)[]) {
    if (this.#disposed) return;
    if (fonts) {
      this.#useDocumentFonts = false;
      this.#disableDocumentFontWatchers();
      const resolved = await resolveFonts(fonts);
      if (!this.#disposed) await this.call('fonts', resolved);
      return;
    }

    this.#useDocumentFonts = true;
    this.#enableDocumentFontWatchers();
    await this.#refreshDocumentFonts();
  }

  [Symbol.dispose]() {
    this.dispose();
  }

  dispose() {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#disableDocumentFontWatchers();
    for (const data of new Set(Object.values(this.#layerData))) data.dispose?.();
    for (const series of Object.values(this.#series)) series.dispose();
    for (const source of new Set(Object.values(this.#sources))) releaseSource(source);
    this.#sources = {};
    this.#layerData = {};
    this.#series = {};
    this.#connection?.dispose();
    this.#connection = undefined;
    super.dispose();
  }

  setOptions(options: TimescopeOptions) {
    this.#options = {};
    this.updateOptions({ ...defaultRendererOptions, ...options });
  }

  #options: TimescopeOptions = {};

  #resolveDomain(
    ref: string | TimescopeDomainOptions | undefined,
    seriesKey: string,
    seriesName?: string,
  ): TimescopeDomain {
    if (typeof ref === 'string') {
      const named = this.#domainsByName[ref];
      if (!named) throw new Error(`Unknown domain: ${ref}`);
      return named;
    }
    const options = ref && typeof ref === 'object' ? ref : {};
    const existing = this.#domainsBySeries[seriesKey];
    if (existing) {
      existing.updateOptions(options, seriesName ?? seriesKey);
      return existing;
    }
    return (this.#domainsBySeries[seriesKey] = new TimescopeDomain(options, seriesName ?? seriesKey));
  }

  updateOptions(options: TimescopeOptions) {
    if (this.#disposed) return;
    const { sources, ...otherOptions } = options;
    const previousSourceOptions = this.#options.sources;
    mergeOptions(this.#options, otherOptions);
    if ('sources' in options) {
      this.#options.sources = sources === undefined ? undefined : { ...(this.#options.sources ?? {}), ...sources };
    }

    const optionsForWorker: TimescopeRenderEngineOptions = {};
    if ('showFps' in options) optionsForWorker.showFps = options.showFps;
    if ('cursor' in options) optionsForWorker.cursor = options.cursor;
    if ('style' in options) optionsForWorker.background = this.#options.style?.background ?? '#fff';
    if ('selection' in options) optionsForWorker.selection = options.selection;

    let changed = false;
    const releasedSources: TimescopeDataSource<any>[] = [];
    let domainsChanged = false;
    if ('sources' in options) {
      const next: Record<string, TimescopeDataSource<any>> = {};
      const created: TimescopeDataSource<any>[] = [];
      try {
        for (const [key, value] of Object.entries(this.#options.sources ?? {})) {
          next[key] = sources && Object.hasOwn(sources, key) ? createDataSource(value) : this.#sources[key];
          if (next[key] !== this.#sources[key]) changed = true;
          if (sources && Object.hasOwn(sources, key) && next[key] !== value) created.push(next[key]);
        }
      } catch (error) {
        for (const source of created) source.dispose?.();
        this.#options.sources = previousSourceOptions;
        throw error;
      }
      const before = new Set(Object.values(this.#sources));
      const after = new Set(Object.values(next));
      // Acquire all new references before releasing any old ones (including alias moves).
      for (const source of after) if (!before.has(source)) retainSource(source);
      for (const source of before) if (!after.has(source)) releasedSources.push(source);
      if (Object.keys(next).length !== Object.keys(this.#sources).length) changed = true;
      this.#sources = next;
    }

    try {
      if ('domains' in options) {
        const next = this.#options.domains ?? {};
        const nextKeys = new Set(Object.keys(next));
        for (const key of nextKeys) {
          const opts = next[key]!;
          const existing = this.#domainsByName[key];
          if (existing) {
            existing.updateOptions(opts, key);
          } else {
            this.#domainsByName[key] = new TimescopeDomain(opts, key);
          }
        }
        for (const key of Object.keys(this.#domainsByName)) {
          if (!nextKeys.has(key)) delete this.#domainsByName[key];
        }
        domainsChanged = true;
      }

      if (changed || 'series' in options || 'tracks' in options || domainsChanged) {
        const sourcesChanged = changed;
        for (const [seriesKey, opts] of Object.entries(this.#options.series ?? {})) {
          if (
            !this.#series[seriesKey] ||
            sourcesChanged ||
            domainsChanged ||
            Object.hasOwn(options.series ?? {}, seriesKey)
          ) {
            if (!opts.data.color) {
              opts.data.color = colorPresets[this.#colorIdx++];
              this.#colorIdx = this.#colorIdx % colorPresets.length;
            }
            changed = true;
            const ds = createDataSeries({
              sources: this.#sources,
              options: opts,
              domain: this.#resolveDomain(opts.data.domain, seriesKey, opts.data.name),
            });
            this.#series[seriesKey]?.dispose();
            this.#series[seriesKey] = ds;
          }
        }
        const seriesKeys = new Set(Object.keys(this.#options.series ?? {}));
        for (const key of Object.keys(this.#series)) {
          if (!seriesKeys.has(key)) {
            this.#series[key].dispose();
            delete this.#series[key];
            changed = true;
          }
        }
        for (const key of Object.keys(this.#domainsBySeries)) {
          if (!seriesKeys.has(key)) delete this.#domainsBySeries[key];
        }

        if ('tracks' in options) changed = true;

        if (changed || domainsChanged || 'series' in options || 'tracks' in options) {
          const mappings: LayerDataMapping[] = [];
          for (const [trackKey, track] of Object.entries(this.#options.tracks ?? { default: {} })) {
            if (!TimescopeTimeAxis.isEnabled(track.timeAxis)) continue;
            mappings.push([
              `tracks:${trackKey}:timeAxis`,
              TimescopeTimeAxis,
              {
                timeAxis: track.timeAxis,
                viewContext: this.#views,
              },
              { immediate: true },
            ]);
          }

          const tracks = Object.keys(this.#options.tracks ?? { default: {} });
          const defaultTrack = tracks[0] ?? 'default';
          const yAxes = new Set<string>();
          for (const [seriesKey, series] of Object.entries(this.#series)) {
            const opts = {
              series,
              viewContext: this.#views,
            };
            const source = this.#sources[series.options.data.source];
            if (TimescopeSeriesChart.isEnabled(series)) {
              mappings.push([
                `series:${seriesKey}:chart`,
                TimescopeSeriesChart,
                opts,
                source.immediate ? { immediate: true } : {},
              ]);
            }

            const instantaneous = series.options.data.instantaneous;
            if (TimescopeSeriesTooltip.isEnabled(series)) {
              const instantaneousOptions = instantaneous === false ? undefined : instantaneous;
              mappings.push([
                `series:${seriesKey}:tooltip`,
                TimescopeSeriesTooltip,
                opts,
                {
                  immediate: true,
                  instantResolution:
                    Decimal(instantaneousOptions?.resolution) ??
                    (instantaneousOptions?.zoom !== undefined ? resolutionFor(instantaneousOptions.zoom) : undefined),
                  // Functions cannot cross the renderer bridge; the tooltip expands this range on the main thread.
                  instantWidth: typeof series.chunkSize === 'number' ? series.chunkSize : 1,
                },
              ]);
            }

            if (TimescopeYAxis.isEnabled(series.domain)) {
              const track = series.options.track ?? defaultTrack;
              const key = `tracks:${track}:domains:${series.domain.uid}:yAxis`;
              if (!yAxes.has(key)) {
                mappings.push([key, TimescopeYAxis, { domain: series.domain }, { immediate: true }]);
                yAxes.add(key);
              }
            }
          }

          optionsForWorker.dataCacheOptions = {};

          const old = { ...this.#layerData };
          for (const [key, ctor, opts, cacheOpts] of mappings) {
            old[key]?.dispose?.();
            this.#layerData[key] = new ctor(opts);
            delete old[key];

            this.#layerData[key].on('change', () => {
              if (!this.#disposed) this.notify('data:changed', key);
            });

            if (cacheOpts) optionsForWorker.dataCacheOptions[key] = cacheOpts;
            this.#layerData[key].changed();
          }
          Object.keys(old).forEach((key) => {
            old[key]?.dispose?.();
            delete this.#layerData[key];
          });
        }
      }

      if ('series' in options) {
        if (this.#options.series === undefined) {
          optionsForWorker.series = undefined;
        } else {
          const seriesForWorker: NonNullable<TimescopeRenderEngineOptions['series']> = {};
          for (const [key, series] of Object.entries(this.#options.series)) {
            const seriesOptions: (typeof seriesForWorker)[string] = {};
            if (series.track !== undefined) seriesOptions.track = series.track;
            if (series.tooltip === false || series.data.instantaneous === false) seriesOptions.tooltip = false;
            seriesForWorker[key] = seriesOptions;
          }
          optionsForWorker.series = seriesForWorker;
        }
      }
      if ('tracks' in options) {
        if (this.#options.tracks === undefined) {
          optionsForWorker.tracks = undefined;
        } else {
          const tracksForWorker: NonNullable<TimescopeRenderEngineOptions['tracks']> = {};
          for (const [key, track] of Object.entries(this.#options.tracks)) {
            const trackOptions: (typeof tracksForWorker)[string] = {};
            if (track.height !== undefined) trackOptions.height = track.height;
            if (track.symmetric !== undefined) trackOptions.symmetric = track.symmetric;
            if (typeof track.timeAxis === 'object') {
              trackOptions.timeAxis = {
                axis: track.timeAxis.axis,
                ticks: track.timeAxis.ticks,
                labels: track.timeAxis.labels,
              };
            } else if (track.timeAxis !== undefined) {
              trackOptions.timeAxis = track.timeAxis;
            }
            tracksForWorker[key] = trackOptions;
          }
          optionsForWorker.tracks = tracksForWorker;
        }
      }
      this.call('options:update', optionsForWorker);
    } finally {
      for (const source of releasedSources) releaseSource(source);
    }
  }

  resize(size: Parameters<RenderEngineCommands['resize']>[0]) {
    this.call('resize', size);
  }

  redraw() {
    this.call('redraw', undefined);
  }

  onPointerEvent(info: InteractionInfo) {
    this.call('pointer', interactionForEngine(info));
  }

  async pointerStyle(info: InteractionInfo) {
    return await this.call('cursor', interactionForEngine(info));
  }

  sync(opts: TimescopeSyncMessage, origin?: string) {
    if (origin && origin === this.uid) return;
    this.call('sync', opts);
  }

  latchFrame() {
    this.call('frame:latch', undefined);
  }

  async prepareFrame(target: TimescopeFrameCaptureMessage, signal: AbortSignal) {
    this.#preparingFrame = true;
    try {
      signal.throwIfAborted();
      const captured = await this.call('frame:capture', target);
      if (!captured.ok) return captured;
      signal.throwIfAborted();
      const view = captured.view;
      this.#views.update({ ...view.viewport, phase: 'prepare' });
      let rejectAbort: ((reason: unknown) => void) | undefined;
      const abort = new Promise<never>((_, reject) => {
        rejectAbort = reject;
      });
      const onAbort = () => rejectAbort?.(signal.reason);
      signal.addEventListener('abort', onAbort, { once: true });
      try {
        await Promise.race([this.#waitForTargets(), abort]);
      } finally {
        signal.removeEventListener('abort', onAbort);
      }
      signal.throwIfAborted();
      const result = await this.call('frame:prepare', view);
      signal.throwIfAborted();
      return result;
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) } as const;
    } finally {
      this.#preparingFrame = false;
      const pending = this.#pendingViewport;
      this.#pendingViewport = undefined;
      if (pending) this.#updateViewport(...pending);
    }
  }

  async commitFrame() {
    return await this.call('frame:commit', undefined);
  }

  abortFrame() {
    for (const data of new Set(Object.values(this.#layerData))) data.cancelTargetWaiters?.();
    this.call('frame:abort', undefined);
  }

  #enableDocumentFontWatchers() {
    if (!this.#useDocumentFonts || this.#documentFontWatchersActive) return;
    if (typeof document === 'undefined') return;

    this.#documentFontWatchersActive = true;
    const cleanups: (() => void)[] = [];

    const fonts = (document as any).fonts as FontFaceSet | undefined;
    if (fonts && typeof fonts.addEventListener === 'function') {
      const onFontEvent = () => this.#scheduleDocumentFontsRefresh();
      fonts.addEventListener('loadingdone', onFontEvent);
      fonts.addEventListener('loadingerror', onFontEvent);
      fonts.addEventListener('loading', onFontEvent);
      cleanups.push(() => {
        fonts.removeEventListener('loadingdone', onFontEvent);
        fonts.removeEventListener('loadingerror', onFontEvent);
        fonts.removeEventListener('loading', onFontEvent);
      });
    }

    if (typeof MutationObserver !== 'undefined') {
      const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          if (mutation.type === 'childList') {
            const nodes = [...Array.from(mutation.addedNodes ?? []), ...Array.from(mutation.removedNodes ?? [])];
            if (nodes.some((node) => isStyleSheetNode(node))) {
              this.#scheduleDocumentFontsRefresh();
              return;
            }
          }

          if (mutation.type === 'attributes' && isStyleSheetNode(mutation.target)) {
            this.#scheduleDocumentFontsRefresh();
            return;
          }
        }
      });

      try {
        const target = document.head ?? document.documentElement ?? document;
        observer.observe(target, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['rel', 'href'],
        });
        cleanups.push(() => observer.disconnect());
      } catch {
        observer.disconnect();
      }
    }

    this.#documentFontCleanup = cleanups;
  }

  #disableDocumentFontWatchers() {
    if (!this.#documentFontWatchersActive) return;
    this.#documentFontWatchersActive = false;
    for (const dispose of this.#documentFontCleanup) {
      try {
        dispose();
      } catch {
        // ignore
      }
    }
    this.#documentFontCleanup = [];
    if (this.#documentFontsRefreshHandle != null) {
      clearTimeout(this.#documentFontsRefreshHandle);
      this.#documentFontsRefreshHandle = null;
    }
  }

  #scheduleDocumentFontsRefresh() {
    if (!this.#useDocumentFonts) return;
    if (this.#documentFontsRefreshHandle != null) return;
    this.#documentFontsRefreshHandle = setTimeout(() => {
      this.#documentFontsRefreshHandle = null;
      void this.#refreshDocumentFonts();
    }, 0);
  }

  async #refreshDocumentFonts() {
    if (!this.#useDocumentFonts || this.#disposed) return;
    try {
      if (this.documentFontsAreLocal) {
        await this.call('fonts', undefined);
        return;
      }
      const resolvedFonts = await resolveDocumentFonts();
      if (!this.#disposed && this.#useDocumentFonts)
        await this.call('fonts', resolvedFonts.length ? resolvedFonts : undefined);
    } catch (error) {
      if (!this.#disposed) console.error('Failed to resolve document fonts', error);
    }
  }

  invalidateSources(sources?: string[]) {
    if (!sources) sources = Object.keys(this.#sources);
    for (const source of sources) {
      this.#sources[source]?.invalidate();
    }

    this.call('reload', undefined);
  }
}

function isStyleSheetNode(node: Node): boolean {
  if (typeof HTMLStyleElement !== 'undefined' && node instanceof HTMLStyleElement) return true;
  if (typeof HTMLLinkElement !== 'undefined' && node instanceof HTMLLinkElement) {
    return node.rel?.toLowerCase() === 'stylesheet';
  }
  return false;
}
