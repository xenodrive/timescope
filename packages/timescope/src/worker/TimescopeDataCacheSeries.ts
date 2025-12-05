import type { TimescopeSeriesProviderData, TimescopeSeriesProviderMeta } from '#src/bridge/protocol';
import { TimescopeCommittable } from '#src/core/TimescopeCommittable';
import { TimescopeDataCache, type TimescopeDataCacheOptions } from '#src/worker/TimescopeDataCache';
import { Decimal } from '@kikuchan/decimal';

export class TimescopeDataCacheSeries<
  V extends TimescopeSeriesProviderData = TimescopeSeriesProviderData,
  M extends TimescopeSeriesProviderMeta = TimescopeSeriesProviderMeta,
> extends TimescopeDataCache<V, M> {
  #min = new TimescopeCommittable({ initialValue: null });
  #max = new TimescopeCommittable({ initialValue: null });
  #meta?: M;

  #update() {
    const min = this.#min.current;
    const max = this.#max.current;
    if (!this.#meta || min == null || max == null) return;
    const amp = Decimal.max(min.abs(), max.abs());
    super.updateMeta({ ...(this.#meta ?? {}), min, max, amp } as M);
  }

  constructor(options: TimescopeDataCacheOptions<V[]>) {
    super(options);

    this.#min.on('change', () => this.#update());
    this.#max.on('change', () => this.#update());
  }

  updateMeta(meta: M) {
    this.#meta = meta;
    if (meta.min) this.#min.setValue(meta.min, this.#min.committed ? { animation: 'linear', duration: 200 } : false);
    if (meta.max) this.#max.setValue(meta.max, this.#max.committed ? { animation: 'linear', duration: 200 } : false);
    this.#update();
  }
}
