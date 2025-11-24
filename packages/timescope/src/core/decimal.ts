import type { DecimalInstance } from '@kikuchan/decimal';
import { Decimal } from '@kikuchan/decimal';
export * from '@kikuchan/decimal';

export type NumberLike = string | bigint | number | DecimalInstance;

export function DecimalSafe(v: NumberLike | null | undefined) {
  if (typeof v === 'number' && isNaN(v)) return null;
  if (typeof v === 'number' && !isFinite(v)) return null;
  try {
    return Decimal(v);
  } catch {
    return null;
  }
}
