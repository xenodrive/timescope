import type { TimescopeFrameViewMessage } from '#src/bridge/protocol';
import { Decimal } from '#src/core/decimal';
import { TimescopeObservable } from '#src/core/event';
import type { TimescopeRange } from '#src/core/range';
import { zoomFor } from '#src/core/zoom';
import type { TimescopeRenderingContext } from '#src/renderer/types';

type DataLike = object & {};

export type TimescopeDataCacheRequest = {
  range: TimescopeRange<Decimal>;
  xOrigin: Decimal;
  resolution: Decimal;
  fallbackResolution?: Decimal;
  loadMissing?: boolean;
  time: Decimal | null;
  zoom: number;
};

export type TimescopeDataCacheFrameView = TimescopeFrameViewMessage;

function unionRange(a: TimescopeRange<Decimal>, b: TimescopeRange<Decimal>): TimescopeRange<Decimal> {
  return [a[0].lt(b[0]) ? a[0] : b[0], a[1].gt(b[1]) ? a[1] : b[1]];
}

export type TimescopeDataCacheOptions<V> = {
  loader: (opts: TimescopeDataCacheRequest) => Promise<V>;
  prepare?: (data: V, staging?: boolean) => V | undefined;
  name: string;
  instantResolution?: Decimal | undefined;
  instantWidth?: number;
  immediate?: boolean;
};

export class TimescopeDataCache<V extends DataLike = any> extends TimescopeObservable<'datachanged'> {
  #data = undefined as unknown as V;
  #ready = undefined as unknown as V;
  #staged = undefined as unknown as V;
  #stageGeneration = 0;

  #loader;
  #prepare;

  #name: string;

  #instantResolution?: Decimal | undefined;
  #instantWidth: number | undefined;
  #immediate?: boolean;

  #disposed = false;

  constructor(opts: TimescopeDataCacheOptions<V>) {
    super();

    this.#loader = opts.loader;
    this.#prepare = opts.prepare;
    this.#name = opts.name;

    this.#immediate = opts.immediate;
    this.#instantResolution = opts.instantResolution;
    this.#instantWidth = opts.instantWidth;
  }

  updateOptions(opts: TimescopeDataCacheOptions<V>) {
    this.#loader = opts.loader;
    this.#prepare = opts.prepare;
    this.#name = opts.name;
    this.#immediate = opts.immediate;
    this.#instantResolution = opts.instantResolution;
    this.#instantWidth = opts.instantWidth;
    this.reset();
  }

  #dirty = false;
  #loading = false;
  #loadingRequestId: number | undefined;
  #pending: TimescopeDataCacheRequest | undefined;
  #requestId = 0;

  update(timescope: TimescopeRenderingContext) {
    if (this.#disposed) return;
    if (!this.#immediate && (timescope.timeAxis.editing || timescope.timeAxis.animating)) return;
    if (!this.#dirty) return;
    this.#dirty = false;

    const { time } = timescope.timeAxis.value;

    if (this.#instantWidth) {
      const cursorTime = timescope.timeAxis.cursor.time;
      const t = cursorTime ?? timescope.timeAxis.now;
      const currentResolution = timescope.timeAxis.current.resolution;
      const resolution = this.#instantResolution ?? currentResolution;
      const delta = resolution.mul(this.#instantWidth / 2);
      const instantRange = [t.sub(delta), t.add(delta)] as TimescopeRange<Decimal>;

      this.#update(cursorTime, instantRange, instantRange[0], resolution, {
        fallbackResolution: currentResolution,
        loadMissing: !timescope.timeAxis.editing && !timescope.timeAxis.animating,
      });
    } else if (this.#immediate) {
      const current = timescope.timeAxis.current;
      const resolution = current.resolution ?? 0;
      const range = unionRange(current.range, timescope.timeAxis.candidate.range);
      this.#update(time, range, current.range[0], resolution);
    } else {
      const current = timescope.timeAxis.current;
      const resolution = current.resolution ?? 0;
      this.#update(time, current.range, current.range[0], resolution);
    }
  }

  #update(
    time: Decimal | null,
    range: TimescopeRange<Decimal>,
    xOrigin: Decimal,
    resolution: Decimal,
    options: Pick<TimescopeDataCacheRequest, 'fallbackResolution' | 'loadMissing'> = {},
  ) {
    this.#pending = { time, zoom: zoomFor(resolution), range, xOrigin, resolution, ...options };
    this.#loadPending();
  }

  #loadPending() {
    if (this.#disposed || this.#loading || !this.#pending) return;
    const request = this.#pending;
    this.#pending = undefined;
    this.#loading = true;
    const requestId = ++this.#requestId;
    this.#loadingRequestId = requestId;

    Promise.resolve()
      .then(() => this.#loader(request))
      .then(
        (data) => this.#complete(requestId, data),
        () => this.#complete(requestId),
      );
  }

  #complete(requestId: number, data?: V) {
    if (requestId !== this.#requestId) {
      if (this.#loadingRequestId === requestId) {
        this.#loading = false;
        this.#loadingRequestId = undefined;
        this.#loadPending();
      }
      return;
    }
    this.#loading = false;
    this.#loadingRequestId = undefined;
    if (this.#disposed) {
      this.#pending = undefined;
      return;
    }
    if (data) {
      const prepared = this.#prepare ? this.#prepare(data) : data;
      if (prepared) {
        this.#data = prepared;
        this.changed();
        this.dispatchEvent('datachanged');
      }
    }
    this.#loadPending();
  }

  async prepare(request: TimescopeDataCacheRequest) {
    this.#dirty = false;
    this.#pending = undefined;
    this.#loading = false;
    this.#loadingRequestId = undefined;
    const requestId = ++this.#requestId;
    const data = await this.#loader(request);
    if (this.#disposed || requestId !== this.#requestId || !data) return false;
    const prepared = this.#prepare ? this.#prepare(data) : data;
    if (!prepared) return false;
    this.#data = prepared;
    this.changed();
    this.dispatchEvent('datachanged');
    return true;
  }

  beginFrame() {
    if (this.#disposed) return;
    this.#stageGeneration++;
    this.#staged = undefined as unknown as V;
  }

  async #stage(request: TimescopeDataCacheRequest) {
    const stageGeneration = this.#stageGeneration;
    const data = await this.#loader(request);
    if (this.#disposed || stageGeneration !== this.#stageGeneration || !data) {
      return false;
    }
    const prepared = this.#prepare ? this.#prepare(data, true) : data;
    if (!prepared) return false;
    this.#staged = prepared;
    return true;
  }

  stageTarget(target: TimescopeDataCacheFrameView) {
    if (this.#instantWidth) {
      const time = target.time ?? target.playbackTime;
      const resolution = this.#instantResolution ?? target.resolution;
      const delta = resolution.mul(this.#instantWidth / 2);
      const range = [time.sub(delta), time.add(delta)] as TimescopeRange<Decimal>;
      return this.#stage({
        time: target.time,
        zoom: zoomFor(resolution),
        range,
        xOrigin: range[0],
        resolution,
        fallbackResolution: target.resolution,
        loadMissing: true,
      });
    }

    const range = unionRange(target.currentRange, target.range);
    return this.#stage({
      time: target.time,
      zoom: target.zoom,
      range,
      xOrigin: range[0],
      resolution: target.resolution,
    });
  }

  get data() {
    return this.#data;
  }

  get stagedData() {
    return this.#staged;
  }

  get readyData() {
    return this.#ready;
  }

  get immediate() {
    return !!this.#immediate;
  }

  get dirty() {
    return this.#dirty;
  }

  mutateData(mutator: (data: V) => boolean) {
    if (!this.#data || this.#disposed || !mutator(this.#data)) return false;
    this.changed();
    return true;
  }

  readyStaged() {
    if (!this.#staged || this.#disposed) return false;
    this.#ready = this.#staged;
    this.#staged = undefined as unknown as V;
    return true;
  }

  activateReady() {
    if (!this.#ready || this.#disposed) return false;
    this.#pending = undefined;
    this.#loading = false;
    this.#loadingRequestId = undefined;
    this.#requestId++;
    this.#data = this.#ready;
    this.#ready = undefined as unknown as V;
    return true;
  }

  discardReady() {
    this.#ready = undefined as unknown as V;
  }

  announceActivation() {
    if (this.#disposed) return;
    this.changed();
    this.dispatchEvent('datachanged');
  }

  abortFrame() {
    if (this.#disposed) return;
    this.#stageGeneration++;
    this.#staged = undefined as unknown as V;
  }

  invalidate() {
    if (this.#disposed) return;
    this.#dirty = true;
    this.#stageGeneration++;
    this.#staged = undefined as unknown as V;
    this.#ready = undefined as unknown as V;
  }

  reset() {
    if (this.#disposed) return;
    this.invalidate();
    this.#pending = undefined;
    this.#requestId++;
  }

  dispose() {
    this.#disposed = true;
    this.#dirty = false;
    this.#pending = undefined;
    this.#requestId++;
    this.#loadingRequestId = undefined;
    this.#stageGeneration++;
    this.#staged = undefined as unknown as V;
  }

  get name() {
    return this.#name;
  }
}
