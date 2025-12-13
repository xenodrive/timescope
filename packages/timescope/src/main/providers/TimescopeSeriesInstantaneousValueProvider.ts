import type {
  TimescopeDataChunkWire,
  TimescopeLoadMetaOptions,
  TimescopeSeriesInstantaneousValueProviderData,
  TimescopeSeriesInstantaneousValueProviderMeta,
} from '#src/bridge/protocol';
import type { TimescopeDataChunkResult } from '#src/core/chunk';
import type { Decimal } from '#src/core/decimal';
import type { TimescopeOptions } from '#src/core/types';
import { parseUsing } from '#src/core/using';
import { unwrapFn } from '#src/core/utils';
import type { TimescopeDataSeriesChunkResult } from '#src/main/TimescopeDataSeries';
import {
  TimescopeSeriesProvider,
  type TimescopeSeriesProviderOptions,
} from '#src/main/providers/TimescopeSeriesProvider';

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
  T extends TimescopeSeriesInstantaneousValueProviderData,
  M extends TimescopeSeriesInstantaneousValueProviderMeta,
  O extends TimescopeSeriesProviderOptions,
> extends TimescopeSeriesProvider<T, M, O> {
  #instantaneous;
  #tooltip;

  constructor(options: O) {
    super(options);

    this.#instantaneous = parseInstantaneous(options.series.options.data.instantaneous);
    this.#tooltip = parseTooltip(options.series.options.tooltip);
  }

  async transform(chunk: TimescopeDataSeriesChunkResult): Promise<TimescopeDataChunkWire<T[]>> {
    const { name, unit, digits } = this.options.series;

    const format = this.#tooltip.format;
    const using = parseUsing(unwrapFn(this.#instantaneous.using, chunk as TimescopeDataChunkResult<any>))[0];

    const data = chunk.data?.flatMap((data) => {
      if (!this.#instantaneous) return [];

      const time = data.time[using[1]];
      const value = data.value[using[0]];

      return [
        {
          time: { time },
          value: { value },

          text: format({ time, value, unit, digits, name }),
        },
      ];
    });

    return {
      ...chunk,
      data,
    } as TimescopeDataChunkWire<T[]>;
  }

  async loadMeta(_opts: TimescopeLoadMetaOptions): Promise<M> {
    const color = this.options.series.color;
    const dataRange = this.options.series.dataRange;

    return {
      ...dataRange,
      scale: this.options.series.options.data.scale,
      color,
    } as M;
  }
}
