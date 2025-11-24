import type {
  InteractionInfo,
  ProviderLoadChunkMessage,
  TimescopeDataCacheOptionsWire,
  TimescopeEventMessage,
  TimescopeFont,
  TimescopeLoadMetaMessage,
  TimescopeOptionsForWorker,
  TimescopeSyncMessage,
  TimescopeViewChangedMessage,
  WorkerCommands,
} from '#src/bridge/protocol';
import { defineCalls, listenCalls } from '#src/bridge/rpc';
import { TimescopeEvent, TimescopeObservable } from '#src/core/event';
import type { TimescopeOptions } from '#src/core/types';
import { mergeOptions } from '#src/core/utils';
import { resolveDocumentFonts, resolveFonts } from '#src/main/font';
import type { TimescopeDataProviderLike } from '#src/main/providers/TimescopeDataProvider';
import { TimescopeSeriesChartProvider } from '#src/main/providers/TimescopeSeriesChartProvider';
import { TimescopeSeriesInstantaneousValueProvider } from '#src/main/providers/TimescopeSeriesInstantaneousValueProvider';
import { TimescopeTimeAxisProvider } from '#src/main/providers/TimescopeTimeAxisProvider';
import { createDataSeries, type TimescopeDataSeries } from '#src/main/TimescopeDataSeries';
import { createDataSource, TimescopeDataSource } from '#src/main/TimescopeDataSource';
import TimescopeWorker from '../worker/index.ts?worker&inline';

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

function materialize<S, D extends object>(
  src: Record<string, S> | undefined,
  dst: Record<string, D & { _src?: S }> | undefined,
  fn: (src: S) => D,
) {
  if (src == null) src = {};
  if (dst == null) dst = {};

  const populated: string[] = [];
  const old = { ...dst };
  for (const k in src) {
    if (!old[k] || (old[k] !== src[k] && !deepEqual(old[k]?._src, src[k]))) {
      dst[k] = fn(src[k]);
      if (dst[k] !== src[k]) {
        dst[k]._src = cloneForComparison(src[k]);
        populated.push(k);
      }
    }
    delete old[k];
  }

  Object.keys(old).forEach((key) => delete dst[key]);
}

const colorPresets = ['#080', '#800', '#008', '#880', '#088', '#808'];

const defaultRendererOptions: TimescopeOptionsForWorker = {
  indicator: true,
  padding: [5, 5, 5, 5],

  sources: undefined,
  series: undefined,
  tracks: undefined,
  selection: undefined,
};

type TimescopeWorkerRendererOptions = {
  canvas: HTMLCanvasElement;
  fonts?: (string | TimescopeFont)[];
};

export class TimescopeWorkerRenderer extends TimescopeObservable<
  | TimescopeEvent<'sync', TimescopeSyncMessage>
  | TimescopeEvent<'renderer:event', unknown>
  | TimescopeEvent<'viewchanged', TimescopeViewChangedMessage>
> {
  #worker;

  call;

  #sources: Record<string, TimescopeDataSource<unknown>> = {};
  #series: Record<string, TimescopeDataSeries> = {};
  #providers: Record<string, TimescopeDataProviderLike<unknown[]>> = {};

  #useDocumentFonts = false;
  #documentFontCleanup: (() => void)[] = [];
  #documentFontWatchersActive = false;
  #documentFontsRefreshHandle: ReturnType<typeof setTimeout> | null = null;

  #colorIdx = 0;

  constructor(opts: TimescopeWorkerRendererOptions) {
    super();

    this.#worker = new TimescopeWorker();
    this.call = defineCalls<WorkerCommands>(this.#worker);

    const mainCommands = {
      sync: (value: TimescopeSyncMessage) => {
        this.dispatchEvent(new TimescopeEvent('sync', value, this.uid));
      },

      'renderer:event': async (msg: TimescopeEventMessage) => {
        this.dispatchEvent(new TimescopeEvent('renderer:event', msg.value, msg.uid));
      },

      'provider:loadChunk': async ({ key, chunk }: ProviderLoadChunkMessage) => {
        return await this.#providers[key]?.loadChunk(chunk);
      },

      'provider:loadMeta': async ({ key, zoom, resolution }: TimescopeLoadMetaMessage) => {
        return await this.#providers[key].loadMeta({ zoom, resolution });
      },

      'view:changed': async (msg: TimescopeViewChangedMessage) => {
        this.dispatchEvent(new TimescopeEvent('viewchanged', msg, this.uid));

        for (const k in this.#series) {
          this.#series[k].updateDataRange(msg.range, msg.zoom);
        }

        return true;
      },
    };

    listenCalls(this.#worker, mainCommands);

    const offcanvas = opts.canvas.transferControlToOffscreen();
    this.call('init', { canvas: offcanvas }, { transfer: [offcanvas] });

    this.setFonts(opts.fonts);
  }

  async setFonts(fonts?: (string | TimescopeFont)[]) {
    if (fonts) {
      this.#useDocumentFonts = false;
      this.#disableDocumentFontWatchers();
      const resolved = await resolveFonts(fonts);
      this.call('fonts', resolved);
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
    this.#disableDocumentFontWatchers();
    this.#worker.terminate();
  }

  setOptions(options: TimescopeOptions) {
    this.#options = {};
    this.updateOptions({ ...defaultRendererOptions, ...options });
  }

  #options: TimescopeOptions = {};

  updateOptions(options: TimescopeOptions) {
    mergeOptions(this.#options, options);

    const optionsForWorker: TimescopeOptionsForWorker = { ...options };

    let changed = false;
    if ('sources' in options) {
      materialize(this.#options.sources, this.#sources, (value) => {
        changed = true;
        return createDataSource(value);
      });
    }

    if (changed || 'series' in options || 'tracks' in options) {
      materialize(this.#options.series, this.#series, (opts) => {
        if (!opts.data.color) {
          opts.data.color = colorPresets[this.#colorIdx++];
          this.#colorIdx = this.#colorIdx % colorPresets.length;
        }
        changed = true;
        const ds = createDataSeries({
          sources: this.#sources,
          options: opts,
        });
        return ds;
      });

      if ('tracks' in options) changed = true;

      if (changed) {
        const mappings = [
          ...Object.entries(this.#options.tracks ?? { default: {} })
            .filter(([, v]) => v.timeAxis !== false)
            .map(([k, v]) => [
              `tracks:${k}:timeAxis`,
              TimescopeTimeAxisProvider,
              {
                timeAxis: v.timeAxis,
              },
              {
                immediate: true,
              },
            ]),

          ...Object.entries(this.#series).flatMap(([k, series]) => {
            const opts = {
              series,
              options: this.#options,
            };
            const cacheOpts = {
              zoomLevels: series.zoomLevels,
              chunkSize: series.chunkSize,
            };
            return [
              [`series:${k}:chart`, TimescopeSeriesChartProvider, opts, cacheOpts],
              [
                `series:${k}:instantaneous`,
                TimescopeSeriesInstantaneousValueProvider,
                opts,
                { ...cacheOpts, instantValue: true, instantZoomLevel: series.options.data.instantaneous?.zoom },
              ],
            ];
          }),
        ] as [string, TimescopeDataProviderLike, object, TimescopeDataCacheOptionsWire][];

        optionsForWorker.dataCacheOptions = {};

        // materialize providers
        const old = { ...this.#providers };
        for (const [key, ctor, opts, cacheOpts] of mappings) {
          this.#providers[key] = new ctor(opts);
          delete old[key];

          if (cacheOpts) optionsForWorker.dataCacheOptions[key] = cacheOpts;
        }
        Object.keys(old).forEach((key) => delete this.#providers[key]);
      }
    }

    this.call('options:update', optionsForWorker);
  }

  resize(size: Parameters<WorkerCommands['resize']>[0]) {
    this.call('resize', size);
  }

  onPointerEvent(info: InteractionInfo) {
    this.call('pointer', info);
  }

  async pointerStyle(info: InteractionInfo) {
    return await this.call('cursor', info, { rpc: true });
  }

  sync(opts: TimescopeSyncMessage, origin?: string) {
    if (origin && origin === this.uid) return;
    this.call('sync', opts);
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
    if (!this.#useDocumentFonts) return;
    try {
      const resolvedFonts = await resolveDocumentFonts();
      this.call('fonts', resolvedFonts.length ? resolvedFonts : undefined);
    } catch (error) {
      console.error('Failed to resolve document fonts', error);
    }
  }

  invalidateSources(sources?: string[]) {
    if (!sources) sources = Object.keys(this.#sources);
    for (const source of sources) {
      this.#sources[source]?.expireChunks();
    }

    this.call('reload', null);
  }
}

function isStyleSheetNode(node: Node): boolean {
  if (typeof HTMLStyleElement !== 'undefined' && node instanceof HTMLStyleElement) return true;
  if (typeof HTMLLinkElement !== 'undefined' && node instanceof HTMLLinkElement) {
    return node.rel?.toLowerCase() === 'stylesheet';
  }
  return false;
}
