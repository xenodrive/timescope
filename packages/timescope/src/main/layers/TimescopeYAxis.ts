import { Decimal } from '#src/core/decimal';
import type { TimescopeRange } from '#src/core/range';
import { TimescopeLayerDataBase } from '#src/main/layers/TimescopeLayerData';
import { normalizeRound, roundMantissa, roundParts, roundLabel } from '#src/main/round';
import type { TimescopeDomain } from '#src/main/TimescopeDomain';
import type { TimescopeYAxisData } from '#src/renderer/types';

export type TimescopeYAxisDataOptions = {
  domain: TimescopeDomain;
};

function linearTickValues(lower: Decimal, upper: Decimal, digits: number | undefined): Decimal[] {
  const minimumStep = digits === undefined ? undefined : Decimal(1).shift10(-digits);
  const exponent = upper.sub(lower).divExact(4).order();
  const candidateFor = (step: Decimal) => {
    const first = lower.ceilBy(step);
    const count = first.gt(upper) ? 0n : upper.sub(first).divFloor(step).integer() + 1n;
    const error = count > 5n ? count - 5n : 5n - count;
    return { step, first, count, error };
  };
  let selected = candidateFor(minimumStep ?? Decimal(1).shift10(exponent - 1n));

  for (const offset of [-1n, 0n, 1n]) {
    for (const factor of [1, 2, 5]) {
      const step = Decimal(factor).shift10(exponent + offset);
      // Fixed decimal labels must distinguish adjacent ticks without rounding collisions.
      if (minimumStep && step.lt(minimumStep)) continue;
      const candidate = candidateFor(step);
      if (
        candidate.error < selected.error ||
        (candidate.error === selected.error && candidate.count > selected.count)
      ) {
        selected = candidate;
      }
    }
  }

  const values: Decimal[] = [];
  for (let value = selected.first; value.le(upper); value = value.add(selected.step)) values.push(value);
  return values;
}

function logarithmicTickValues(
  lower: Decimal,
  upper: Decimal,
  digits: number | undefined,
  fallbackDigits = digits,
): Decimal[] {
  const lowerExponent = lower.order();
  const upperExponent = upper.order();
  const minimumExponent = digits === undefined ? lowerExponent : BigInt(-digits);

  if (upperExponent - lowerExponent <= 3n) {
    const powers: Decimal[] = [];
    const multiples: Decimal[] = [];
    // This branch visits at most four decades, regardless of their magnitude.
    for (let exponent = lowerExponent; exponent <= upperExponent; exponent++) {
      if (exponent < minimumExponent) continue;
      for (const factor of [1, 2, 5]) {
        const value = Decimal(factor).shift10(exponent);
        if (value.lt(lower) || value.gt(upper)) continue;
        multiples.push(value);
        if (factor === 1) powers.push(value);
      }
    }
    if (multiples.length < 3) return linearTickValues(lower, upper, fallbackDigits);
    if (powers.length >= 3 && Math.abs(powers.length - 5) < Math.abs(multiples.length - 5)) return powers;
    return multiples;
  }

  // Select an exponent stride before generating ticks, even for thousands of decades.
  const firstExponent = lower.eq(Decimal(1).shift10(lowerExponent)) ? lowerExponent : lowerExponent + 1n;
  const start = firstExponent > minimumExponent ? firstExponent : minimumExponent;
  if (start > upperExponent) return [];
  const candidateFor = (stride: bigint) => {
    const first = Decimal(start).ceilBy(stride).integer();
    const count = first > upperExponent ? 0n : (upperExponent - first) / stride + 1n;
    const error = count > 5n ? count - 5n : 5n - count;
    return { stride, first, count, error };
  };
  let selected = candidateFor(1n);
  const order = Decimal(upperExponent - start + 1n)
    .divExact(4)
    .order();
  for (const offset of [-1n, 0n, 1n]) {
    for (const factor of [1, 2, 5]) {
      const stride = Decimal(factor).shift10(order + offset);
      if (stride.lt(1)) continue;
      const candidate = candidateFor(stride.integer());
      if (
        candidate.error < selected.error ||
        (candidate.error === selected.error && candidate.count > selected.count)
      ) {
        selected = candidate;
      }
    }
  }
  const values: Decimal[] = [];
  for (let exponent = selected.first; exponent <= upperExponent; exponent += selected.stride) {
    values.push(Decimal(1).shift10(exponent));
  }
  return values;
}

export class TimescopeYAxis extends TimescopeLayerDataBase<TimescopeYAxisData, TimescopeYAxisDataOptions> {
  static isEnabled(domain: TimescopeDomain) {
    return Boolean(domain.axis);
  }

  constructor(options: TimescopeYAxisDataOptions) {
    super(options);
    this.onDispose(options.domain.on('change', () => this.changed()));
  }

  async loadData(range: TimescopeRange<Decimal>, resolution: Decimal): Promise<TimescopeYAxisData> {
    const domain = this.options.domain;
    const { projection, wire } = domain.createProjection();
    const options = domain.axis;
    const configured = typeof options === 'object' ? options : undefined;
    const round = normalizeRound(configured?.round);
    const values: Decimal[] = [];

    if (domain.dataRange && projection.mode !== 'empty') {
      const [lower, upper] = domain.dataRange;
      const magnitude = lower.abs().gt(upper.abs()) ? lower.abs() : upper.abs();
      const tickDigits =
        round.digits === undefined
          ? undefined
          : round.mode === 'decimal' || magnitude.isZero()
            ? round.digits
            : Number(BigInt(round.digits) - magnitude.order());
      if (tickDigits !== undefined && !Number.isSafeInteger(tickDigits))
        throw new RangeError('Axis round digits are out of range');
      if (lower.eq(upper)) {
        // A constant-domain label must still describe the actual value, not a rounded neighbor.
        if (roundParts(lower, round).roundedValue.eq(lower)) values.push(lower);
      } else if (domain.scale === 'log') {
        values.push(
          ...logarithmicTickValues(lower, upper, round.mode === 'decimal' ? tickDigits : undefined, tickDigits),
        );
      } else {
        values.push(...linearTickValues(lower, upper, tickDigits));
      }
    }

    const digits =
      round.digits ??
      values.reduce((digits, value) => Math.max(digits, roundMantissa(value, round.mode).rescale().digits), 0);
    const ticks = values
      .toSorted((a, b) => a.cmp(b))
      .map((value) => ({
        value: projection.normalize(value),
        text: roundLabel(roundParts(value, { ...round, digits }), round.label),
        zero: value.isZero(),
      }))
      .filter((tick) => Number.isFinite(tick.value));

    return {
      data: {
        id: domain.uid,
        side: options === 'right' || configured?.side === 'right' ? 'right' : 'left',
        label: configured?.label ?? domain.name,
        unit: domain.unit || undefined,
        color: configured?.color,
        font: configured?.font,
        ticks,
      },
      meta: {
        time: range[0],
        resolution,
        projection: wire,
      },
    };
  }
}
