import type { TimescopeSeriesProviderMeta } from '#src/bridge/protocol';
import { TimescopeObservable } from '#src/core/event';
import { TimescopeCommittable } from '#src/core/TimescopeCommittable';
import type { TimescopeDataCacheSeries } from './TimescopeDataCacheSeries';
import type { TimescopeRenderingContext } from './types';

function findMinMax(caches: TimescopeDataCacheSeries<any, TimescopeSeriesProviderMeta>[]): [min: number, max: number] {
  let min = Infinity;
  let max = -Infinity;

  for (const { meta, scaleYcommitting } of caches) {
    if (!scaleYcommitting) continue;

    const values = [meta.pmin, meta.pmax, meta.nmin, meta.nmax, meta.zero]
      .map(scaleYcommitting)
      .filter((x) => !isNaN(x));

    min = Math.min(...values, min);
    max = Math.max(...values, max);
  }

  if (isFinite(min) && isFinite(max)) {
    return [min, max];
  }

  return [-1, 1];
}

export type TimescopeTrackOptions = {
  id: string;
  oy: number;
  height?: number;
  symmetric?: boolean;
  labelHeight?: number;

  seriesKeys: string[];
};

export class TimescopeTrack extends TimescopeObservable {
  id: string;

  height: number;
  symmetric: boolean;
  oy: number = 0;

  paddingY = [15, 15];
  labelHeight = 0;

  seriesKeys: string[];

  constructor(opts: TimescopeTrackOptions) {
    super();
    this.id = opts.id;
    this.oy = opts.oy ?? 0;
    this.height = opts.height ?? 0;
    this.symmetric = opts.symmetric ?? false;
    this.labelHeight = 0; // opts.labelHeight ?? 0; // TODO: XXX: delete

    const p = Math.max(0, Math.min(this.height - 36, 18));
    this.paddingY = [p, p];

    this.seriesKeys = opts.seriesKeys;

    this.#min.on('change', () => this.changed());
    this.#max.on('change', () => this.changed());
  }

  get chartHeight() {
    return this.height - this.paddingY[0] - this.paddingY[1];
  }

  #min = new TimescopeCommittable<null>({ initialValue: null });
  #max = new TimescopeCommittable<null>({ initialValue: null });

  setScale(min: number, max: number) {
    if (min === max) return;
    this.#min.setValue(min, this.#min.current ? { animation: 'linear', duration: 200 } : false);
    this.#max.setValue(max, this.#max.current ? { animation: 'linear', duration: 200 } : false);
  }

  adjustScaleBySeriesChart(timescope: TimescopeRenderingContext) {
    this.setScale(...findMinMax(this.seriesKeys.map((k) => timescope.dataCaches[`series:${k}:chart`] as any)));
  }

  get y0() {
    return this.y(0);
  }

  get bottom() {
    return this.height - this.paddingY[1];
  }

  y(value: number | null | undefined, floating: number = 0) {
    const H = this.chartHeight;
    if (value == null || isNaN(value)) return NaN;
    if (!this.#min.current || !this.#max.current) return NaN;
    if (this.#max.current.eq(this.#min.current)) return NaN;

    const C = floating ? 10 : 0;

    const max = this.#max.current.number();
    const min = this.#min.current.number();
    if (min === max) return NaN;

    const b = C / H;
    const a = (min + (1 - b) * (max - min)) / max;

    return this.bottom - H * ((value * a - min) / (max - min) + b * Math.sign(floating));
  }
}
