import { Decimal } from '#src/core/decimal';
import { TimescopeObservable } from '#src/core/event';
import type { TimescopeRange } from '#src/core/range';
import { zoomFor } from '#src/core/zoom';
import type { TimescopeRenderingContext } from '#src/worker/types';

type DataLike = object & {};

export type TimescopeDataCacheOptions<V> = {
  loader: (opts: {
    range: TimescopeRange<Decimal>;
    resolution: Decimal;
    time: Decimal | null;
    zoom: number;
  }) => Promise<V>;
  name: string;
  instantResolution?: Decimal | undefined;
  instantWidth?: number;
  immediate?: boolean;
};

export class TimescopeDataCache<V extends DataLike = any> extends TimescopeObservable<'datachanged'> {
  #data = undefined as unknown as V;

  #loader;

  #name: string;

  #instantResolution?: Decimal | undefined;
  #instantWidth: number | undefined;
  #immediate?: boolean;

  constructor(opts: TimescopeDataCacheOptions<V>) {
    super();

    this.#loader = opts.loader;
    this.#name = opts.name;

    this.#immediate = opts.immediate;
    this.#instantResolution = opts.instantResolution;
    this.#instantWidth = opts.instantWidth;
  }

  updateOptions(opts: TimescopeDataCacheOptions<V>) {
    this.#loader = opts.loader;
    this.#name = opts.name;
  }

  #dirty = false;

  update(timescope: TimescopeRenderingContext) {
    if (!this.#immediate && (timescope.timeAxis.animating || timescope.timeAxis.editing)) return;

    if (!this.#dirty) return;
    this.#dirty = false;

    const { time } = timescope.timeAxis.value;

    if (this.#instantWidth) {
      const t = timescope.timeAxis.committing.time ?? timescope.timeAxis.now;
      const resolution = this.#instantResolution ?? timescope.timeAxis.committing.resolution;
      const delta = resolution.mul(this.#instantWidth / 2);
      const instantRange = [t.sub(delta), t.add(delta)] as TimescopeRange<Decimal>;

      this.#update(time, instantRange, resolution); // TODO:
    } else if (this.#immediate) {
      const resolution = timescope.timeAxis.current.resolution ?? 0;
      this.#update(time, timescope.timeAxis.current.range, resolution);
    } else {
      const resolution = timescope.timeAxis.committing.resolution ?? 0;
      this.#update(time, timescope.timeAxis.committing.range, resolution);
    }
  }

  #update(time: Decimal | null, range: TimescopeRange<Decimal>, resolution: Decimal) {
    const revision = this.revision;
    this.#loader({ time, zoom: zoomFor(resolution), range, resolution }).then((data) => {
      if (!data) return;
      if (this.revision === revision) {
        this.#data = data;
        this.changed();
        this.dispatchEvent('datachanged');
      }
    });
  }

  get data() {
    return this.#data;
  }

  invalidate() {
    this.#dirty = true;
  }

  get name() {
    return this.#name;
  }
}
