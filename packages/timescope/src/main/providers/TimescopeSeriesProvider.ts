import type { TimescopeRange } from '#src/core/range';
import type { TimescopeDataSeries } from '#src/main/TimescopeDataSeries';
import { TimescopeDataProvider } from '#src/main/providers/TimescopeDataProvider';
import type { Decimal } from '@kikuchan/decimal';

export type TimescopeSeriesProviderOptions = {
  series: TimescopeDataSeries;
};

export abstract class TimescopeSeriesProvider<
  D,
  O extends TimescopeSeriesProviderOptions,
> extends TimescopeDataProvider<D, O> {
  constructor(options: O) {
    super(options);
  }

  async loadData(range: TimescopeRange<Decimal>, resolution: Decimal): Promise<D> {
    return await this.transform(this.options.series, range, resolution);
  }

  abstract transform(series: TimescopeDataSeries, range: TimescopeRange<Decimal>, resolution: Decimal): Promise<D>;
}
