import { TimescopeEvent, TimescopeObservable } from '#src/core/event';
import { mergeOptions } from '#src/core/options';
import { resolutionFor } from '#src/core/zoom';
import { resolveDocumentFonts, resolveFonts } from '#src/main/font';
import type { TimescopeDataLoader, TimescopeDataLoaderClass } from '#src/main/loaders/TimescopeDataLoader';
import { TimescopeSeriesChart } from '#src/main/loaders/TimescopeSeriesChart';
import { TimescopeSeriesTooltip } from '#src/main/loaders/TimescopeSeriesTooltip';
import { TimescopeTimeAxis } from '#src/main/loaders/TimescopeTimeAxis';
import { TimescopeYAxis } from '#src/main/loaders/TimescopeYAxis';
import type { TimescopeDomainOptions, TimescopeOptions } from '#src/main/options';
import { createDataSeries, type TimescopeDataSeries } from '#src/main/TimescopeDataSeries';
import { createDataSource, type TimescopeDataSource } from '#src/main/TimescopeDataSource';
import { TimescopeDomain } from '#src/main/TimescopeDomain';
import { TimescopeViewRegistry } from '#src/main/TimescopeView';
import type {
  InteractionInfo,
  InteractionInfoWire,
  RenderCall,
  RenderEngineCommands,
  RendererCommands,
  TimescopeDataCacheOptionsWire,
  TimescopeDataLoadMessage,
  TimescopeEventMessage,
  TimescopeFont,
  TimescopeFrameCaptureMessage,
  TimescopeRenderEngineOptions,
  TimescopeSyncMessage,
  TimescopeViewportChangedMessage,
} from '#src/renderer/types';
import { Decimal } from '@kikuchan/decimal';

function deepEqual(a: any, b: any) {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (typeof a === 'function') return a.toString() === b.toString();
  if (a && b && typeof a === 'object') {
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    if (aKeys.length !== bKeys.length) return false;
    for (const key of aKeys) {
      if (!deepEqual(a[key], b[key])) return false;
    }
    return true;
  }
  return false;
}

function cloneForComparison(value: any, transfer?: Transferable[], seen: WeakSet<object> = new WeakSet()): any {
  if (value == null) return value;

  const valueType = typeof value;
  if (valueType === 'string' || valueType === 'number' || valueType === 'boolean' || valueType === 'bigint') {
    return value;
  }

  if (valueType === 'undefined' || valueType === 'symbol') {
    return undefined;
  }

  if (valueType === 'function') {
    return value.toString();
  }

  if (value instanceof Date || value instanceof RegExp || ArrayBuffer.isView(value) || value instanceof ArrayBuffer) {
    return value;
  }

  if (transfer?.includes(value)) {
    return value;
  }

  if (seen.has(value)) {
    throw new TypeError('Cannot serialize circular reference');
  }

  seen.add(value);

  if (typeof value.toJSON === 'function') {
    const jsonValue = value.toJSON();
    if (jsonValue !== value) {
      const result = cloneForComparison(jsonValue, transfer, seen);
      seen.delete(value);
      return result;
    }
  }

  if (Array.isArray(value)) {
    const result = new Array(value.length);
    for (let index = 0; index < value.length; index++) {
      const entry = cloneForComparison(value[index], transfer, seen);
      result[index] = entry;
    }
    seen.delete(value);
    return result;
  }

  if (value instanceof Date || value instanceof RegExp || ArrayBuffer.isView(value) || value instanceof ArrayBuffer) {
    seen.delete(value);
    return value;
  }

  const result: Record<string, unknown> = {};
  for (const key of Object.keys(value)) {
    const entry = cloneForComparison(value[key], transfer, seen);
    result[key] = entry;
  }

  seen.delete(value);
  return result;
}

function cloneSourceForComparison(value: any) {
  if (Array.isArray(value)) return value;
  if (
    value &&
    typeof value === 'object' &&
    typeof value.query === 'function' &&
    typeof value.invalidate === 'function'
  ) {
    return value;
  }
  if (!value || typeof value !== 'object' || !('data' in value)) return cloneForComparison(value);
  const { data, ...options } = value;
  return { ...cloneForComparison(options), data };
}

function materialize<S, D extends object>(
  src: Record<string, S> | undefined,
  dst: Record<string, D & { _src?: S }> | undefined,
  fn: (src: S, key: string) => D,
  snapshot: (src: S) => S = cloneForComparison,
  force = false,
) {
  if (src == null) src = {};
  if (dst == null) dst = {};

  const populated: string[] = [];
  const old = { ...dst };
  for (const k in src) {
    if (force || !old[k] || (old[k] !== src[k] && !deepEqual(old[k]?._src, src[k]))) {
      (old[k] as { dispose?: () => void } | undefined)?.dispose?.();
      dst[k] = fn(src[k], k);
      if (dst[k] !== src[k]) {
        dst[k]._src = snapshot(src[k]);
        populated.push(k);
      }
    }
    delete old[k];
  }

  Object.keys(old).forEach((key) => {
    (old[key] as { dispose?: () => void }).dispose?.();
    delete dst[key];
  });
}

const colorPresets = ['#080', '#800', '#008', '#880', '#088', '#808'];

const defaultRendererOptions: TimescopeOptions = {
  style: undefined,
  indicator: true,
  padding: [5, 5, 5, 5],

  sources: undefined,
  series: undefined,
  tracks: undefined,
  selection: undefined,
};

export type TimescopeRendererOptions = {
  canvas: HTMLCanvasElement;
  fonts?: (string | TimescopeFont)[];
};

type DataLoaderMapping = [string, TimescopeDataLoaderClass, object, TimescopeDataCacheOptionsWire];

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
    // Commands used as notifications still report failures without creating unhandled rejections.
    void result.catch((error) => {
      if (!this.#disposed) console.error(`Render engine ${command} failed`, error);
    });
    return result;
  };

  protected attach(connection: TimescopeRendererConnection, fonts?: (string | TimescopeFont)[]) {
    this.#connection = connection;
    void this.setFonts(fonts);
  }

  #sources: Record<string, TimescopeDataSource<any>> = {};
  #series: Record<string, TimescopeDataSeries> = {};
  #dataLoaders: Record<string, TimescopeDataLoader> = {};
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
    return Promise.all([...new Set(Object.values(this.#dataLoaders))].map((loader) => loader.waitForTarget?.()));
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
        return await this.#dataLoaders[msg.key]?.loadData(msg.range, msg.resolution, msg.xOrigin, {
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
    for (const loader of new Set(Object.values(this.#dataLoaders))) loader.dispose?.();
    for (const series of Object.values(this.#series)) series.dispose();
    this.#dataLoaders = {};
    this.#series = {};
    this.#connection?.dispose();
    this.#connection = undefined;
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
    const { sources, ...otherOptions } = options;
    mergeOptions(this.#options, otherOptions);
    if ('sources' in options) {
      this.#options.sources = sources === undefined ? undefined : { ...(this.#options.sources ?? {}), ...sources };
    }

    const optionsForWorker: TimescopeRenderEngineOptions = {};
    if ('showFps' in options) optionsForWorker.showFps = options.showFps;
    if ('padding' in options) optionsForWorker.padding = options.padding;
    if ('indicator' in options) optionsForWorker.indicator = options.indicator;
    if ('style' in options) optionsForWorker.background = this.#options.style?.background ?? '#fff';
    if ('selection' in options) optionsForWorker.selection = options.selection;

    let changed = false;
    let domainsChanged = false;
    if ('sources' in options) {
      materialize(
        this.#options.sources,
        this.#sources,
        (value) => {
          changed = true;
          return createDataSource(value);
        },
        cloneSourceForComparison,
      );
    }

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
      materialize(
        this.#options.series,
        this.#series,
        (opts, seriesKey) => {
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
          return ds;
        },
        cloneForComparison,
        sourcesChanged || domainsChanged,
      );
      const seriesKeys = new Set(Object.keys(this.#options.series ?? {}));
      for (const key of Object.keys(this.#domainsBySeries)) {
        if (!seriesKeys.has(key)) delete this.#domainsBySeries[key];
      }

      if ('tracks' in options) changed = true;

      if (changed || domainsChanged || 'series' in options || 'tracks' in options) {
        const mappings: DataLoaderMapping[] = [];
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
                instantWidth: series.chunkSize,
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

        const old = { ...this.#dataLoaders };
        for (const [key, ctor, opts, cacheOpts] of mappings) {
          old[key]?.dispose?.();
          this.#dataLoaders[key] = new ctor(opts);
          delete old[key];

          this.#dataLoaders[key].on('change', () => {
            if (!this.#disposed) this.call('data:changed', key);
          });

          if (cacheOpts) optionsForWorker.dataCacheOptions[key] = cacheOpts;
          this.#dataLoaders[key].changed();
        }
        Object.keys(old).forEach((key) => {
          old[key]?.dispose?.();
          delete this.#dataLoaders[key];
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
    for (const loader of new Set(Object.values(this.#dataLoaders))) loader.cancelTargetWaiters?.();
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
      console.error('Failed to resolve document fonts', error);
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
