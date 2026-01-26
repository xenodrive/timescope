import { Decimal, isDecimal, type NumberLike } from '#src/core/decimal';
import { TimescopeObservable } from '#src/core/event';
import type { TimescopeRange } from '#src/core/range';
import type { TimescopeDomainOptions } from '#src/core/types';
import type { TimescopeDataSeries } from '#src/main/TimescopeDataSeries';

type DomainRangeInput =
  | NumberLike
  | TimescopeRange<NumberLike | undefined>
  | { expand?: boolean; shrink?: boolean; default?: NumberLike | TimescopeRange<NumberLike | undefined> };

type ParsedDomainRange = {
  expand: boolean;
  shrink: boolean;
  default: TimescopeRange<Decimal | undefined>;
};

const DECIMAL_ZERO = Decimal(0);

function isNumberLike(v: unknown): v is NumberLike {
  if (isDecimal(v)) return true;
  if (typeof v === 'number' || typeof v === 'string' || typeof v === 'bigint') return true;
  return false;
}

function parseDomainRange(range: DomainRangeInput | undefined, expand?: boolean, shrink?: boolean): ParsedDomainRange {
  const rangeExpand = typeof expand === 'boolean' ? expand : undefined;
  const rangeShrink = typeof shrink === 'boolean' ? shrink : undefined;

  if (range == null) {
    return {
      expand: rangeExpand ?? false,
      shrink: rangeShrink ?? false,
      default: [Decimal(0), undefined] as TimescopeRange<Decimal | undefined>,
    };
  }

  if (Array.isArray(range)) {
    return {
      expand: rangeExpand ?? false,
      shrink: rangeShrink ?? false,
      default: range.map(Decimal) as TimescopeRange<Decimal | undefined>,
    };
  }

  if (typeof range === 'number' || isNumberLike(range)) {
    return {
      expand: rangeExpand ?? false,
      shrink: rangeShrink ?? false,
      default: [Decimal(0), Decimal(range)] as TimescopeRange<Decimal | undefined>,
    };
  }

  const rangeObj = range as {
    expand?: boolean;
    shrink?: boolean;
    default?: NumberLike | TimescopeRange<NumberLike | undefined>;
  };
  const expandValue = rangeExpand ?? rangeObj.expand ?? false;
  const shrinkValue = rangeShrink ?? rangeObj.shrink ?? false;
  if (rangeObj.default != null && !Array.isArray(rangeObj.default)) {
    return {
      expand: expandValue,
      shrink: shrinkValue,
      default: [Decimal(0), Decimal(rangeObj.default)] as TimescopeRange<Decimal | undefined>,
    };
  }

  return {
    expand: expandValue,
    shrink: shrinkValue,
    default: (rangeObj.default ?? [0, undefined]).map(Decimal) as TimescopeRange<Decimal | undefined>,
  };
}

type DomainMinMax = {
  pmin: Decimal | null | undefined;
  pmax: Decimal | null | undefined;
  nmin: Decimal | null | undefined;
  nmax: Decimal | null | undefined;
  zero: Decimal | null | undefined;
};

export class TimescopeDomain extends TimescopeObservable {
  #options: TimescopeDomainOptions;
  #range: ParsedDomainRange;
  #series: TimescopeDataSeries[] = [];
  #minmax: DomainMinMax | null = null;
  #prevMinMax: DomainMinMax | null = null;

  constructor(options: TimescopeDomainOptions = {}) {
    super();
    this.#options = options;
    this.#range = parseDomainRange(options.range as DomainRangeInput | undefined, options.expand, options.shrink);
  }

  updateOptions(options: TimescopeDomainOptions) {
    this.#options = options;
    this.#range = parseDomainRange(options.range as DomainRangeInput | undefined, options.expand, options.shrink);
    this.recompute();
  }

  addSeries(series: TimescopeDataSeries) {
    if (this.#series.includes(series)) return;
    this.#series.push(series);
    series.on('change', () => {
      this.recompute();
    });
    this.recompute();
  }

  recompute() {
    const { expand, shrink, default: defaultRange } = this.#range;
    const expandU = expand || defaultRange[1] === undefined;
    const expandL = expand || defaultRange[0] === undefined;

    let { pmin, pmax, nmin, nmax, zero } = shrink || !this.#minmax ? ({} as DomainMinMax) : this.#minmax;

    const classify = (values: (Decimal | undefined | null)[], force: boolean = false) => {
      const [$pmin, $pmax] = Decimal.minmax(...values.filter((v) => v?.isPositive()), pmin, pmax);
      const [$nmin, $nmax] = Decimal.minmax(...values.filter((v) => v?.isNegative()), nmin, nmax);
      const $zero = zero || (values.some((v) => v?.isZero()) && DECIMAL_ZERO) || null;

      return [
        force || expandU ? $pmax : pmax,
        force || expandL ? $pmin : pmin,
        force || expandL ? $zero : zero,
        force || expandL ? $nmax : nmax,
        force || expandU ? $nmin : nmin,
      ];
    };

    [pmax, pmin, zero, nmax, nmin] = classify(defaultRange, true);

    if (expandU || expandL) {
      for (const series of this.#series) {
        const viewRange = series.viewRange;
        if (!viewRange) continue;

        const minmax = series.computeMinMax(viewRange);
        if (!minmax) continue;
        [pmax, pmin, zero, nmax, nmin] = classify(
          [minmax.pmin, minmax.pmax, minmax.zero, minmax.nmax, minmax.nmin],
          false,
        );
      }
    }

    if (!pmin && !nmax && !zero && !pmax && !nmin) return;

    const next = { pmin, pmax, nmin, nmax, zero };
    this.#prevMinMax = this.#minmax;
    this.#minmax = next;

    this.changed();
  }

  get prevDataRange() {
    return this.#prevMinMax;
  }

  get dataRange() {
    return this.#minmax;
  }

  get scale() {
    return this.#options.scale;
  }

  get unit() {
    return this.#options.unit ?? '';
  }

  get digits() {
    return this.#options.digits ?? 1;
  }
}
