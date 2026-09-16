import type { DecimalInstance } from '@kikuchan/decimal';
import { Decimal } from '@kikuchan/decimal';
export * from '@kikuchan/decimal';

export type NumberLike = string | bigint | number | DecimalInstance;

/** Significant digits needed to preserve 18 digits relative to a local value span. */
export function precisionForSpan(value: Decimal, span: Decimal): number {
  if (value.isZero() || span.isZero()) return 18;
  const extra = value.abs().order() - span.abs().order();
  const precision = 18 + Number(extra > 0n ? extra : 0n);
  if (!Number.isSafeInteger(precision)) throw new RangeError('Required decimal precision is out of range');
  return precision;
}

/** Compute log10(value / origin) without subtracting rounded, nearly equal logarithms. */
export function log10Ratio(value: Decimal, origin: Decimal): Decimal {
  if (value.eq(origin)) return Decimal(0);
  const precision = precisionForSpan(origin, value.sub(origin));
  return value.div(origin, precision).log(10, 18);
}

export function DecimalSafe(v: NumberLike | null | undefined) {
  if (typeof v === 'number' && isNaN(v)) return null;
  if (typeof v === 'number' && !isFinite(v)) return null;
  try {
    return Decimal(v);
  } catch {
    return null;
  }
}
