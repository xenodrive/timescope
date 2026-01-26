import type { TimescopeSeriesChartProviderData } from '#src/bridge/protocol';
import { TimescopeObservable } from '#src/core/event';
import { TimescopeCommittable } from '#src/core/TimescopeCommittable';
import type { TimescopeRenderingContext } from './types';

function findMinMax(caches: TimescopeSeriesChartProviderData[]): [min: number, max: number] {
  let min = Infinity;
  let max = -Infinity;

  // XXX: TODO:
  for (const { meta } of caches) {
    if (!meta || !meta.minmax) continue;

    min = Math.min(meta.minmax[0], min);
    max = Math.max(meta.minmax[1], max);
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

  #minNumber: number | undefined = undefined;
  #maxNumber: number | undefined = undefined;

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

    this.#min.on('change', () => {
      this.#minNumber = this.#min.current?.number();
      this.changed();
    });
    this.#max.on('change', () => {
      this.#maxNumber = this.#max.current?.number();
      this.changed();
    });
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
    this.setScale(
      ...findMinMax(
        this.seriesKeys.map(
          (k) => (timescope.dataCaches[`series:${k}:chart`].data ?? []) as TimescopeSeriesChartProviderData,
        ),
      ),
    );
  }

  get y0() {
    return this.y(0);
  }

  get bottom() {
    return this.height - this.paddingY[1];
  }

  get top() {
    return this.paddingY[0];
  }

  y(value: number | null | undefined, floating: number = 0) {
    const H = this.chartHeight;
    if (value == null || isNaN(value)) return NaN;

    const max = this.#maxNumber;
    const min = this.#minNumber;
    if (min == null || max == null || min === max) return NaN;

    const C = floating;

    const b = C / H;
    const a = (min + (1 - b) * (max - min)) / max;

    return this.bottom - H * ((value * a - min) / (max - min) + b * Math.sign(floating));
  }
}
