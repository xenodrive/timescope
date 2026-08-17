import type { TimescopeRange } from '#src/core/range';
import type { TimescopeDataSeries } from '#src/main/TimescopeDataSeries';
import { TimescopeDataLoaderBase } from '#src/main/TimescopeDataLoader';
import type { TimescopeViewRegistry } from '#src/main/TimescopeView';
import type { Decimal } from '@kikuchan/decimal';

export type TimescopeSeriesDataLoaderOptions = {
  series: TimescopeDataSeries;
  viewContext?: TimescopeViewRegistry;
};

export abstract class TimescopeSeriesDataLoader<
  D,
  O extends TimescopeSeriesDataLoaderOptions,
> extends TimescopeDataLoaderBase<D, O> {
  constructor(options: O) {
    super(options);
    this.onDispose(options.series.domain.on('change', () => this.changed()));
  }

  async loadData(range: TimescopeRange<Decimal>, resolution: Decimal, xOrigin: Decimal = range[0]): Promise<D> {
    return await this.transform(this.options.series, range, resolution, xOrigin);
  }

  abstract transform(
    series: TimescopeDataSeries,
    range: TimescopeRange<Decimal>,
    resolution: Decimal,
    xOrigin: Decimal,
  ): Promise<D>;
}
