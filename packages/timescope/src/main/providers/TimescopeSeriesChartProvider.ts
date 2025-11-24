import type {
  TimescopeDataChunkWire,
  TimescopeLoadMetaOptions,
  TimescopeSeriesChartProviderData,
  TimescopeSeriesChartProviderMeta,
} from '#src/bridge/protocol';
import type { TimescopeChartLink, TimescopeChartMark, TimescopeChartType } from '#src/core/types';
import { unwrapFn } from '#src/core/utils';
import {
  TimescopeSeriesProvider,
  type TimescopeSeriesProviderOptions,
} from '#src/main/providers/TimescopeSeriesProvider';
import type { TimescopeDataSeriesChunkResult } from '#src/main/TimescopeDataSeries';

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
  impulses: { marks: [{ draw: 'line', using: ['value', 'zero'] }] },
  impulsespoints: { marks: [{ draw: 'line', using: ['value', 'zero'] }, { draw: 'circle' }] },
  boxes: { marks: [{ draw: 'box', using: ['value', 'zero'], style: { fillColor: 'transparent' } }] },
  'boxes:filled': { marks: [{ draw: 'box', using: ['value', 'zero'] }] },
};

function stylePreset(k: TimescopeChartType): {
  marks?: TimescopeChartMark<false>[];
  links?: TimescopeChartLink<false>[];
} {
  return stylePresetLookup[k] ?? {};
}

export class TimescopeSeriesChartProvider<
  T extends TimescopeSeriesChartProviderData,
  M extends TimescopeSeriesChartProviderMeta,
  O extends TimescopeSeriesProviderOptions,
> extends TimescopeSeriesProvider<T, M, O> {
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

  async transform(chunk: TimescopeDataSeriesChunkResult): Promise<TimescopeDataChunkWire<T[]>> {
    const data = chunk.data?.map((data) => {
      const obj = {
        resolution: chunk.resolution,
        data: data.data ?? {},
        time: data.time,
        value: data.value,
      };
      const marks = unwrapFn(this.marks, obj);
      return {
        ...data, // { time, value, data? }

        marks:
          marks?.map((mark) => {
            return { ...mark, style: unwrapFn(mark.style, obj) ?? {} };
          }) ?? [],
      };
    });

    return {
      ...chunk,
      data,
    } as TimescopeDataChunkWire<T[]>;
  }

  async loadMeta({ resolution }: TimescopeLoadMetaOptions): Promise<M> {
    const links =
      unwrapFn(this.links, { resolution })?.map((link) => ({
        ...link,
        style: unwrapFn(link.style, null as any) ?? {},
      })) ?? [];

    const color = this.options.series.color;
    const dataRange = this.options.series.dataRange;

    return {
      links,
      color,
      ...dataRange,
    } as M;
  }
}
