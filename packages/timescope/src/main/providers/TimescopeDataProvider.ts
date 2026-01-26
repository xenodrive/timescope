import type { TimescopeRange } from '#src/core/range';
import type { Decimal } from '@kikuchan/decimal';

export interface TimescopeDataProviderLike<D = any, O = any> {
  new (options: O): this;

  loadData(range: TimescopeRange<Decimal>, resolution: Decimal): Promise<D>;
}

export abstract class TimescopeDataProvider<D = any, O = any> {
  options: O;

  constructor(options: O) {
    this.options = options;
  }

  abstract loadData(range: TimescopeRange<Decimal>, resolution: Decimal): Promise<D> | undefined;
}
