import type { TimescopeDataChunkWire } from '#src/bridge/protocol';
import type { TimescopeDataChunkDesc } from '#src/core/chunk';
import { createChunkList } from '#src/core/chunk';
import config from '#src/core/config';
import { Decimal } from '#src/core/decimal';
import { TimescopeObservable } from '#src/core/event';
import type { FixedRange, Range } from '#src/core/range';
import { getConstraintedZoom, resolutionFor } from '#src/core/zoom';
import { bisectRange } from '#src/worker/bisect';
import type { TimescopeRenderingContext } from '#src/worker/types';

function minRangeValue(current: Decimal | undefined, candidate: Decimal | undefined): Decimal | undefined {
  if (candidate === undefined) return current;
  if (current === undefined) return candidate;
  return candidate.lt(current) ? candidate : current;
}

function maxRangeValue(current: Decimal | undefined, candidate: Decimal | undefined): Decimal | undefined {
  if (candidate === undefined) return current;
  if (current === undefined) return candidate;
  return current.gt(candidate) ? current : candidate;
}

function shouldKeep(a: Range<Decimal | undefined>, b: Range<Decimal | undefined>): boolean {
  return (!a[0] || !b[1] || a[0].le(b[1])) && (!b[0] || !a[1] || b[0].le(a[1]));
}

export type TimescopeDataCacheOptions<V> = {
  loader: (chunk: TimescopeDataChunkDesc) => Promise<TimescopeDataChunkWire<V>>;

  instantValue?: boolean;
  instantZoomLevel?: number;
  immediate?: boolean;

  chunkSize?: number;
  zoomLevels?: readonly number[];

  name: string;
};

export class TimescopeDataCache<
  V extends { time: Record<string, Decimal> } = any,
  M extends Record<string, unknown> = any,
> extends TimescopeObservable<'metachanged' | 'datachanged'> {
  #chunksInView: Record<string, TimescopeDataChunkDesc & { _loading?: boolean }> = {};
  #data = [] as V[];

  #loader;

  #instantValue: boolean;
  #instantZoomLevel: number | undefined;
  #immediate: boolean;
  #chunkSize: number;
  #zoomLevels: readonly number[] | undefined;

  #meta: M = {} as M;

  #name: string;

  constructor(opts: TimescopeDataCacheOptions<V[]>) {
    super();

    this.#loader = opts.loader;
    this.#instantValue = opts.instantValue ?? false;
    this.#instantZoomLevel = opts.instantZoomLevel;
    this.#immediate = opts.immediate ?? false;

    this.#zoomLevels = opts.zoomLevels;
    this.#chunkSize = opts.chunkSize === null ? 0 : (opts.chunkSize ?? config.defaultChunkSize);

    this.#name = opts.name;
  }

  updateOptions(opts: TimescopeDataCacheOptions<V[]>) {
    this.#loader = opts.loader;
    this.#instantValue = opts.instantValue ?? false;
    this.#instantZoomLevel = opts.instantZoomLevel;
    this.#immediate = opts.immediate ?? false;

    this.#zoomLevels = opts.zoomLevels;
    this.#chunkSize = opts.chunkSize === null ? 0 : (opts.chunkSize ?? config.defaultChunkSize);

    this.#name = opts.name;
  }

  #mergeChunk(chunk: TimescopeDataChunkWire<V[]>, data: V[] | undefined) {
    if (!(chunk.id in this.#chunksInView)) return;
    if (!data) return;

    try {
      this.#data = this.#mergeData(chunk.range, this.#data, data) ?? this.#data;
    } catch (e) {
      console.error(e);
    }

    this.changed();
    this.dispatchEvent('datachanged'); // XXX: depends on revision
  }

  #dirty = false;
  #purgeChunks(timescope: TimescopeRenderingContext, activeChunks: TimescopeDataChunkDesc[]) {
    const purgeChunks = { ...this.#chunksInView };
    for (const chunk of activeChunks) delete purgeChunks[chunk.id];
    for (const id in purgeChunks) {
      this.#dirty = true;
      delete this.#chunksInView[id];
    }

    if (!timescope.timeAxis.animating && !timescope.timeAxis.editing && this.#dirty) {
      this.#dirty = false;
      this.#data = this.#purgeData(Object.values(this.#chunksInView), this.#data) ?? this.#data;
      this.changed();
      this.dispatchEvent('datachanged'); // XXX: depends on revision
    }
  }

  #mergeData(range: Range<Decimal | undefined>, orig: V[], data: V[]) {
    const [l, r] = bisectRange(orig, range, (o) => o.time._minTime ?? o.time.time);
    const combined = [
      ...orig.slice(0, l),
      ...data.filter((entry) => entry.time._minTime ?? entry.time.time),
      ...orig.slice(r),
    ];
    return combined.toSorted((a, b) => {
      const aTime = a.time._minTime ?? a.time.time;
      const bTime = b.time._maxTime ?? b.time.time;
      if (aTime == null || bTime == null) return 0;
      if (aTime.lt(bTime)) return -1;
      if (aTime.gt(bTime)) return 1;
      return 0;
    }) as V[];
  }

  #window: [Decimal, Decimal] = [Decimal(0), Decimal(0)];

  get window() {
    return this.#window;
  }

  #purgeData(activeChunks: TimescopeDataChunkWire<V[]>[], orig: V[]): V[] | void {
    const [min, max] = activeChunks.reduce(
      (acc, chunk) => {
        const start = chunk.range[0];
        const end = chunk.range[1];
        return [minRangeValue(acc[0], start), maxRangeValue(acc[1], end)] as [Decimal | undefined, Decimal | undefined];
      },
      [undefined, undefined] as [Decimal | undefined, Decimal | undefined],
    );
    if (!min || !max) return orig;
    const window: FixedRange = [min, max];

    this.#window = window;

    return orig.filter((x) => shouldKeep([x.time._minTime ?? x.time.time, x.time._maxTime ?? x.time.time], window));
  }

  /** for debug */
  /*
  renderCache(ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D, timescope: TimescopeRenderingContext) {
    const height = timescope.chart.height;
    for (const chunk of Object.values(this.#chunksInView)) {
      const [l, r] = timescope.timeAxis.p(chunk.range);

      ctx.fillStyle = chunk.seq % 2n ? 'rgba(192, 192, 192, 0.1)' : 'rgba(192, 192, 192, 0.3)';
      ctx.fillRect(l, 0, r - l, height);

      ctx.fillStyle = 'black';
      ctx.textAlign = 'start';
      ctx.textBaseline = 'top';
      ctx.fillText(String(chunk.id), l + 5, 8);

      if (!chunk._loading) continue;

      ctx.fillStyle = 'rgba(255, 0, 0, 0.2)';
      ctx.fillRect(l, 0, r - l, height);
    }
  }
  */

  #listRequiredChunks(range: Range<Decimal | undefined>, zoom: number) {
    // Constraints to the defined zoom levels or integer
    zoom = getConstraintedZoom(zoom, this.#zoomLevels);
    const chunks = createChunkList(range, zoom, this.#chunkSize);

    return chunks.map((chunk) => this.#chunksInView[chunk.id] ?? chunk);
  }

  update(timescope: TimescopeRenderingContext) {
    if (this.#instantValue) {
      const t = timescope.timeAxis.committing.time ?? timescope.timeAxis.now;
      const instantZoom = this.#instantZoomLevel ?? timescope.timeAxis.committing.zoom.number(); // TODO:
      const delta = resolutionFor(instantZoom).mul(this.#chunkSize).div(2);
      const instantRange = [t.sub(delta), t.add(delta)] as Range<Decimal>;

      this.#update(timescope, instantRange, instantZoom);
    } else if (this.#immediate) {
      const zoomValue = timescope.timeAxis.current.zoom?.number() ?? 0;
      this.#update(timescope, timescope.timeAxis.current.range, zoomValue);
    } else {
      const zoomValue = timescope.timeAxis.committing.zoom?.number() ?? 0;
      this.#update(timescope, timescope.timeAxis.committing.range, zoomValue);
    }
  }

  #update(timescope: TimescopeRenderingContext, range: Range<Decimal>, zoom: number): void {
    const chunks = this.#listRequiredChunks(range, zoom);

    const t = Date.now();

    chunks.forEach((chunk) => {
      if (this.#chunksInView[chunk.id] && t <= chunk.expires!) return;
      this.#chunksInView[chunk.id] = chunk;
      this.#dirty = true;
      chunk.expires = Infinity;

      chunk._loading = true;
      this.#loader(chunk).then((result) => {
        chunk._loading = false;
        chunk.expires = result?.expires ?? chunk.expires;

        this.#mergeChunk(result, result.data);
      });
    });

    this.#purgeChunks(timescope, chunks);
  }

  get data() {
    return this.#data;
  }

  invalidate() {
    this.#chunksInView = {};
    this.#dirty = true;
  }

  get meta() {
    return this.#meta;
  }

  updateMeta(meta: M) {
    this.#meta = meta;

    this.changed();
    this.dispatchEvent('metachanged');
  }

  get name() {
    return this.#name;
  }
}
