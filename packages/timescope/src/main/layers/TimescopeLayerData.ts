import { TimescopeObservable, type Un } from '#src/core/event';
import type { TimescopeRange } from '#src/core/range';
import type { TimescopeDataSeries } from '#src/main/TimescopeDataSeries';
import type { TimescopeViewRegistry } from '#src/main/TimescopeView';
import type { Decimal } from '@kikuchan/decimal';

export type TimescopeLayerDataLoadOptions = {
  fallbackResolution?: Decimal;
  loadMissing?: boolean;
};

/** Prepares and updates the display data consumed by a renderer layer. */
export interface TimescopeLayerData<D = any> extends TimescopeObservable {
  loadData(
    range: TimescopeRange<Decimal>,
    resolution: Decimal,
    xOrigin?: Decimal,
    options?: TimescopeLayerDataLoadOptions,
  ): Promise<D> | undefined;
  waitForTarget?(): Promise<void>;
  cancelTargetWaiters?(): void;
}

export type TimescopeLayerDataClass = new (options: any) => TimescopeLayerData;

export abstract class TimescopeLayerDataBase<D = any, O = any>
  extends TimescopeObservable
  implements TimescopeLayerData<D>
{
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
    options?: TimescopeLayerDataLoadOptions,
  ): Promise<D> | undefined;
  waitForTarget?(): Promise<void>;
  cancelTargetWaiters?(): void;

  protected onDispose(unsub: Un) {
    if (unsub) this.#unsubs.push(unsub);
  }

  dispose() {
    for (const unsub of this.#unsubs) unsub?.();
    this.#unsubs = [];
    super.dispose();
  }
}

export type TimescopeSeriesLayerDataOptions = {
  series: TimescopeDataSeries;
  viewContext?: TimescopeViewRegistry;
};

export abstract class TimescopeSeriesLayerData<
  D,
  O extends TimescopeSeriesLayerDataOptions,
> extends TimescopeLayerDataBase<D, O> {
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
