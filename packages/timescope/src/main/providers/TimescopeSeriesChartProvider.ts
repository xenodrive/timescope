import type { TimescopeRange } from '#src/core/range';
import type { TimescopeChartLink, TimescopeChartMark, TimescopeChartType } from '#src/core/types';
import { unwrapFn } from '#src/core/utils';
import {
  TimescopeSeriesProvider,
  type TimescopeSeriesProviderOptions,
} from '#src/main/providers/TimescopeSeriesProvider';
import { Decimal } from '@kikuchan/decimal';
import type { TimescopeDataSeries } from '../TimescopeDataSeries';

const stylePresetLookup: Partial<
  Record<
    TimescopeChartType,
    {
      marks?: TimescopeChartMark<false>[];
      links?: TimescopeChartLink<false>[];
    }
  >
> = {
  lines: { links: [{ draw: 'line' }] },
  'lines:filled': { links: [{ draw: 'area' }, { draw: 'line' }] },
  curves: { links: [{ draw: 'curve' }] },
  'curves:filled': { links: [{ draw: 'curve-area' }, { draw: 'curve' }] },
  'steps-start': { links: [{ draw: 'step-start' }] },
  'steps-start:filled': { links: [{ draw: 'step-area-start' }, { draw: 'step-start' }] },
  steps: { links: [{ draw: 'step' }] },
  'steps:filled': { links: [{ draw: 'step-area' }, { draw: 'step' }] },
  'steps-end': { links: [{ draw: 'step-end' }] },
  'steps-end:filled': { links: [{ draw: 'step-area-end' }, { draw: 'step-end' }] },
  points: { marks: [{ draw: 'circle' }] },
  linespoints: { links: [{ draw: 'line' }], marks: [{ draw: 'circle' }] },
  'linespoints:filled': { links: [{ draw: 'area' }, { draw: 'line' }], marks: [{ draw: 'circle' }] },
  curvespoints: { links: [{ draw: 'curve' }], marks: [{ draw: 'circle' }] },
  'curvespoints:filled': { links: [{ draw: 'curve-area' }, { draw: 'curve' }], marks: [{ draw: 'circle' }] },
  'stepspoints-start': { links: [{ draw: 'step-start' }], marks: [{ draw: 'circle' }] },
  'stepspoints-start:filled': {
    links: [{ draw: 'step-area-start' }, { draw: 'step-start' }],
    marks: [{ draw: 'circle' }],
  },
  stepspoints: { links: [{ draw: 'step' }], marks: [{ draw: 'circle' }] },
  'stepspoints:filled': { links: [{ draw: 'step-area' }, { draw: 'step' }], marks: [{ draw: 'circle' }] },
  'stepspoints-end': { links: [{ draw: 'step-end' }], marks: [{ draw: 'circle' }] },
  'stepspoints-end:filled': { links: [{ draw: 'step-area-end' }, { draw: 'step-end' }], marks: [{ draw: 'circle' }] },
  impulses: { marks: [{ draw: 'line', using: ['value', '_zero'] }] },
  impulsespoints: { marks: [{ draw: 'line', using: ['value', '_zero'] }, { draw: 'circle' }] },
  bars: { marks: [{ draw: 'bar', using: ['value', '_zero'], style: { fillColor: 'transparent' } }] },
  'bars:filled': { marks: [{ draw: 'bar', using: ['value', '_zero'] }] },
};

function stylePreset(k: TimescopeChartType): {
  marks?: TimescopeChartMark<false>[];
  links?: TimescopeChartLink<false>[];
} {
  return stylePresetLookup[k] ?? {};
}

export function createScaleY(
  {
    pmin,
    pmax,
    nmin,
    nmax,
    zero,
  }: {
    pmin: Decimal | null | undefined;
    pmax: Decimal | null | undefined;
    nmin: Decimal | null | undefined;
    nmax: Decimal | null | undefined;
    zero: Decimal | null | undefined;
  },
  scale: 'log' | 'linear' | undefined,
) {
  let amp: Decimal;
  let base: Decimal;
  if (scale === 'log') {
    // log
    amp = pmax?.log(10) ?? Decimal(0);
    base = pmin?.log(10) ?? Decimal(0);

    if (!amp && !base) return () => NaN;
  } else {
    // linear
    zero = zero || (pmin && nmin ? Decimal(0) : null);

    amp = [pmax, nmin, zero].filter(Boolean).toSorted((a, b) => b!.abs().cmp(a!.abs()))[0]!;
    base = zero ?? [pmin, nmax, zero].filter(Boolean).toSorted((a, b) => a!.abs().cmp(b!.abs()))[0]!;
  }

  if (!amp || !base || amp?.isZero()) return (v: Decimal | null) => (v?.sign().number() ?? 0) * 0.5;

  const scaleFactor = amp.abs().sub(base.abs());
  if (scaleFactor.isZero()) {
    return (v: Decimal | null) => (v?.sign().number() ?? 0) * 0.5;
  }

  if (scale === 'log') {
    return (v: Decimal | null): number => {
      if (!v || !v?.isPositive()) return NaN;

      return v?.log(10).sub(base!).div(scaleFactor).number() ?? NaN;
    };
  } else {
    return (v: Decimal | null): number => v?.sub(base!).div(scaleFactor).number() ?? 0;
  }
}

function createFloating(
  {
    pmin,
    pmax,
    nmin,
    nmax,
    zero,
  }: {
    pmin: Decimal | null | undefined;
    pmax: Decimal | null | undefined;
    nmin: Decimal | null | undefined;
    nmax: Decimal | null | undefined;
    zero: Decimal | null | undefined;
  },
  scale: 'log' | 'linear' | undefined,
) {
  let amp: Decimal | undefined;
  let base: Decimal | undefined;
  if (scale === 'log') {
    amp = pmax?.log(10) ?? Decimal(0);
    base = pmin?.log(10) ?? Decimal(0);
  } else {
    zero = zero || (pmin && nmin ? Decimal(0) : null);
    amp = [pmax, nmin, zero].filter((x): x is Decimal => x != null).toSorted((a, b) => b.abs().cmp(a.abs()))[0];
    base =
      zero ?? [pmin, nmax, zero].filter((x): x is Decimal => x != null).toSorted((a, b) => a.abs().cmp(b.abs()))[0];
  }
  if (!amp || !base || amp.isZero()) return 0;
  return base.sign().number();
}

function timeInRange(time: Record<string, Decimal>, range: TimescopeRange<Decimal | undefined>) {
  return range[0] && range[1] && time._minTime?.le(range[1]) && range[0]?.le(time._maxTime);
}

export class TimescopeSeriesChartProvider<O extends TimescopeSeriesProviderOptions> extends TimescopeSeriesProvider<
  { data: any; meta: any },
  O
> {
  marks;
  links;

  constructor(options: O) {
    super(options);

    const style =
      typeof options.series.options.chart === 'string'
        ? stylePreset(options.series.options.chart)
        : (options.series.options.chart ?? {});

    this.marks = style.marks;
    this.links = style.links;
  }

  async transform(series: TimescopeDataSeries, range: TimescopeRange<Decimal>, resolution: Decimal) {
    let data = series.data;
    const domainRange = series.domain.dataRange;
    const meta = {
      resolution,
      time: range[0]!,
      links: unwrapFn(this.links, { resolution })?.map((link) => ({
        ...link,
        style: unwrapFn(link.style, null as any) ?? {},
      })),
      color: this.options.series.color ?? '',
      minmax: [0, 0],

      start_t: Date.now(),
      scaleY: 1,
      baseY: 0,
      floating: 0,
    };

    const scaleY = domainRange ? createScaleY(domainRange, series.domain.scale) : () => NaN;

    const prev = series.domain.prevDataRange;
    if (prev && (!prev.pmin || !prev.nmax) && (prev.pmin || prev.nmax) && domainRange) {
      const a = scaleY(prev.pmax || prev.nmin!) || 0;
      const b = scaleY(prev.pmin || prev.nmax!) || 0;

      if (a != b) {
        meta.baseY = b;
        meta.scaleY = 1 / Math.abs(a - b);
        meta.floating = 10;
      }
    }

    let ymin = Infinity;
    let ymax = -Infinity;
    data = data?.map((data) => {
      const obj = {
        data: data.data ?? {},
        time: data.time,
        value: data.value,
        resolution,
      };

      const point: {
        x: Record<string, number>;
        y: Record<string, number>;
      } = { x: {}, y: {} };

      for (const key in data.time) {
        point.x[key] = data.time[key].sub(range[0]!).div(resolution).number();
      }
      for (const key in data.value) {
        point.y[key] = scaleY(data.value[key]);

        if (!timeInRange(data.time, range)) continue;

        if (ymin > point.y[key]) ymin = point.y[key];
        if (ymax < point.y[key]) ymax = point.y[key];
      }

      const marks = unwrapFn(this.marks, obj);
      return {
        ...data, // { time, value, data? }

        point,

        marks:
          marks?.map((mark) => {
            return { ...mark, style: unwrapFn(mark.style, obj) ?? {} };
          }) ?? [],
      };
    });

    meta.minmax = [ymin, ymax];

    return {
      data,
      meta,
    };
  }
}
