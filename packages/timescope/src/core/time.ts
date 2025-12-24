import { Decimal, isDecimal, type NumberLike } from '#src/core/decimal';
import { type TimescopeRange } from '#src/core/range';

export type TimeLike<N extends null | undefined = null> = string | Date | NumberLike | N;
export type TimeUnit = 's' | 'ms' | 'us' | 'ns';

export const NOW: null = null;
export const UNBOUNDED: undefined = undefined;

/** @internal */
export function parseTimeLike(v: null): null;
export function parseTimeLike(v: undefined): undefined;
export function parseTimeLike<N extends null | undefined>(v: TimeLike<N>): Decimal | N;
export function parseTimeLike<N extends null | undefined>(v: TimeLike<N>): Decimal | N {
  if (v == null) return v;
  if (isDecimal(v)) return v;
  if (typeof v === 'string') {
    const t = Date.parse(v);
    if (Number.isNaN(t)) throw new Error('Parse error as Date');
    return Decimal(t / 1000);
  }
  if (v instanceof Date) return Decimal(v.getTime() / 1000);

  return Decimal(v as NumberLike);
}

export function parseTimeDomainLike<N extends null | undefined>(
  v: TimescopeRange<TimeLike | N>,
): TimescopeRange<Decimal | N> {
  return v.map(parseTimeLike) as TimescopeRange<Decimal | N>;
}
