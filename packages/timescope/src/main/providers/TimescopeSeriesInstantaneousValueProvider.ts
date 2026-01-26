import type { TimescopeSeriesInstantaneousValueProviderData } from '#src/bridge/protocol';
import type { TimescopeChunk } from '#src/core/chunk';
import type { Decimal } from '#src/core/decimal';
import type { TimescopeRange } from '#src/core/range';
import type { TimescopeOptions } from '#src/core/types';
import { parseUsing } from '#src/core/using';
import { unwrapFn } from '#src/core/utils';
import type { TimescopeDataSeries } from '#src/main/TimescopeDataSeries';
import {
  TimescopeSeriesProvider,
  type TimescopeSeriesProviderOptions,
} from '#src/main/providers/TimescopeSeriesProvider';
import { createScaleY } from './TimescopeSeriesChartProvider';

type TimescopeDataSeriesInput = NonNullable<TimescopeOptions['series']>[string];

function parseInstantaneous(instantaneous: TimescopeDataSeriesInput['data']['instantaneous']) {
  if (!instantaneous) {
    return {
      using: 'value',
      zoom: undefined,
    };
  }

  return {
    using: instantaneous.using ?? 'value',
    zoom: instantaneous.zoom,
  };
}

function parseTooltip(opts: TimescopeDataSeriesInput['tooltip']) {
  const format = ({
    name,
    unit,
    digits,
    value,
  }: {
    time: Decimal;
    value: Decimal | null;
    name: string;
    unit: string;
    digits: number;
  }) => {
    if (value == null) return 'No data';
    const items = [];
    if (name) items.push(name);
    items.push(value.toFixed(digits));
    if (unit) items.push(unit);

    return items.join(' ');
  };

  if (typeof opts === 'boolean' || !opts) return { format };
  return {
    ...opts,
    format: opts.format ?? format,
  };
}

export class TimescopeSeriesInstantaneousValueProvider<
  O extends TimescopeSeriesProviderOptions,
> extends TimescopeSeriesProvider<TimescopeSeriesInstantaneousValueProviderData, O> {
  #instantaneous;
  #tooltip;

  constructor(options: O) {
    super(options);

    this.#instantaneous = parseInstantaneous(options.series.options.data.instantaneous);
    this.#tooltip = parseTooltip(options.series.options.tooltip);
  }

  async transform(
    series: TimescopeDataSeries,
    range: TimescopeRange<Decimal>,
    resolution: Decimal,
  ): Promise<TimescopeSeriesInstantaneousValueProviderData> {
    const { data: src, name } = series;
    const { unit, digits } = series.domain;

    const format = this.#tooltip.format;
    const using = parseUsing(
      unwrapFn(this.#instantaneous.using, { range, resolution, data: src } as TimescopeChunk<any>),
    )[0];

    const domainRange = series.domain.dataRange;
    const scaleY = domainRange ? createScaleY(domainRange, series.domain.scale) : () => NaN;

    const data = src.flatMap((data) => {
      if (!this.#instantaneous) return [];

      const time = data.time[using[1]];
      const value = data.value[using[0]];
      const y = scaleY(data.value[using[0]]);

      return [
        {
          time: { time },
          value: { value },
          point: { y },

          text: format({ time, value, unit, digits, name }),
        },
      ];
    });

    return {
      data: data,
      meta: {
        time: range[0]!,
        resolution,
        color: this.options.series.color ?? '',
      },
    };
  }
}
