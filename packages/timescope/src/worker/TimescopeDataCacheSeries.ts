import type { TimescopeSeriesProviderData, TimescopeSeriesProviderMeta } from '#src/bridge/protocol';
import { TimescopeCommittable } from '#src/core/TimescopeCommittable';
import { TimescopeDataCache, type TimescopeDataCacheOptions } from '#src/worker/TimescopeDataCache';
import { Decimal } from '@kikuchan/decimal';

export class TimescopeDataCacheSeries<
  V extends TimescopeSeriesProviderData = TimescopeSeriesProviderData,
  M extends TimescopeSeriesProviderMeta = TimescopeSeriesProviderMeta,
> extends TimescopeDataCache<V, M> {
  #amp = new TimescopeCommittable<null>({ initialValue: null });
  #base = new TimescopeCommittable<null>({ initialValue: null });

  constructor(options: TimescopeDataCacheOptions<V[]>) {
    super(options);

    this.#amp.on('change', () => this.changed());
    this.#base.on('change', () => this.changed());
  }

  updateMeta(meta: M) {
    const { pmin, pmax, nmin, nmax, scale } = meta;
    let zero = meta.zero;

    if (!pmin && !pmax && !nmin && !nmax && !zero) return;

    let amp: Decimal;
    let base: Decimal;
    if (meta.scale === 'log') {
      // log
      amp = pmax?.log(10) ?? Decimal(0);
      base = pmin?.log(10) ?? Decimal(0);

      if (!amp && !base) return;
    } else {
      // linear
      zero = zero || (pmin && nmin ? Decimal(0) : null);

      amp = [pmax, nmin, zero].filter((x) => x).toSorted((a, b) => b!.abs().cmp(a!.abs()))[0]!;
      base = zero ?? [pmin, nmax, zero].filter((x) => x).toSorted((a, b) => a!.abs().cmp(b!.abs()))[0]!;
    }

    if (amp && !amp?.isZero())
      this.#amp.setValue(amp, this.#amp.committed ? { animation: 'linear', duration: 200 } : false);
    if (base) this.#base.setValue(base, this.#base.committed ? { animation: 'linear', duration: 200 } : false);

    super.updateMeta(meta);
  }

  #scaleY(key: 'current' | 'candidate') {
    if (!this.#amp[key] || !this.#base[key] || this.#amp[key]?.isZero())
      return (v: Decimal | null) => (v?.sign().number() ?? 0) * 0.5;

    const scale = this.#amp[key].abs().sub(this.#base[key].abs());
    if (scale.isZero()) {
      return (v: Decimal | null) => (v?.sign().number() ?? 0) * 0.5;
    }

    if (this.meta.scale === 'log') {
      return (v: Decimal | null): number => {
        if (!v || !v?.isPositive()) return NaN;

        return v?.log(10).sub(this.#base[key]!).div(scale).number() ?? NaN;
      };
    } else {
      return (v: Decimal | null): number => v?.sub(this.#base[key]!).div(scale).number() ?? 0;
    }
  }

  get scaleY() {
    return this.#scaleY('current');
  }

  get scaleYcommitting() {
    return this.#scaleY('candidate');
  }

  get floating() {
    if (!this.#amp.current || !this.#base.current) return 0;
    return this.#base.current.sign().number();
  }
}
