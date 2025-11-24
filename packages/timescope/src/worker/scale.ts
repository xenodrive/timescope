import { Decimal } from '#src/core/decimal';

// normalize to [0, 1]
export function createScaleY(
  symmetric: boolean,
  logScale: boolean,
  meta: { min: Decimal | null; max: Decimal | null; amp: Decimal | null },
) {
  const { min, max, amp } = meta;

  if (!logScale) {
    if (!amp || !min || !max || amp.eq(0) || min.eq(max)) return null;

    return symmetric
      ? (v: Decimal | null) => v?.div(amp).number() // v / amp
      : (v: Decimal | null) => v?.sub(min).div(max.sub(min)).number(); // (v - min) / (max - min)
  } else {
    const minLog10 = min && min.isPositive() && min?.log(10);
    const maxLog10 = max && max.isPositive() && max?.log(10);
    if (!minLog10 || !maxLog10 || maxLog10.eq(minLog10)) return null;

    const denom = maxLog10.sub(minLog10);

    return (v: Decimal | null) => {
      if (!v) return null;

      if (v.isZero()) return undefined;
      if (v.isNegative()) return undefined;

      return v.log(10).sub(minLog10).div(denom).number();
    };
  }
}
