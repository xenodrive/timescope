import { TimescopeObservable, type Un } from '#src/core/event';
import type { TimescopeRange } from '#src/core/range';
import type { TimescopeDataSeries } from '#src/main/TimescopeDataSeries';
import type { TimescopeViewRegistry } from '#src/main/TimescopeView';
import type { Decimal } from '@kikuchan/decimal';

export type TimescopeDataLoadOptions = {
  fallbackResolution?: Decimal;
  loadMissing?: boolean;
};

export interface TimescopeDataLoader<D = any, _O = any> extends TimescopeObservable {
  loadData(
    range: TimescopeRange<Decimal>,
    resolution: Decimal,
    xOrigin?: Decimal,
    options?: TimescopeDataLoadOptions,
  ): Promise<D>;
  waitForTarget?(): Promise<void>;
  cancelTargetWaiters?(): void;
  dispose?(): void;
}

export type TimescopeDataLoaderClass = new (options: any) => TimescopeDataLoader;

export abstract class TimescopeDataLoaderBase<D = any, O = any> extends TimescopeObservable {
  options: O;
  #unsubs: Un[] = [];

  constructor(options: O) {
    super();
    this.options = options;
  }

  abstract loadData(
    range: TimescopeRange<Decimal>,
    resolution: Decimal,
    xOrigin?: Decimal,
    options?: TimescopeDataLoadOptions,
  ): Promise<D> | undefined;
  waitForTarget?(): Promise<void>;
  cancelTargetWaiters?(): void;

  protected onDispose(unsub: Un) {
    if (unsub) this.#unsubs.push(unsub);
  }

  dispose() {
    for (const unsub of this.#unsubs) unsub?.();
    this.#unsubs = [];
  }
}

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
