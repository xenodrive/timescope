import { Decimal } from '#src/core/decimal';
import type { TimescopeRange } from '#src/core/range';

export function bisectLeft<T>(data: T[], needle: Decimal, valueFn: (o: T) => Decimal | null | undefined): number {
  let l = 0;
  let r = data.length;

  while (l < r) {
    const m = (l + r) >> 1;
    const current = valueFn(data[m]);
    if (current != null && Decimal(current).lt(needle)) {
      l = m + 1;
    } else {
      r = m;
    }
  }

  return l;
}

export function bisectRight<T>(data: T[], needle: Decimal, valueFn: (o: T) => Decimal | null | undefined): number {
  let l = 0;
  let r = data.length;

  while (l < r) {
    const m = (l + r) >> 1;
    const current = valueFn(data[m]);
    if (current != null && Decimal(current).le(needle)) {
      l = m + 1;
    } else {
      r = m;
    }
  }

  return l;
}

export function bisectRange<T>(
  data: T[],
  [lt, rt]: TimescopeRange<Decimal | undefined>,
  valueFn: (o: T) => Decimal | null | undefined,
): [number, number] {
  const l = lt === undefined ? 0 : bisectLeft(data, lt, valueFn);
  const r = rt === undefined ? data.length : bisectLeft(data, rt, valueFn);

  if (l < r) {
    return [l, r];
  }

  return [0, 0];
}
