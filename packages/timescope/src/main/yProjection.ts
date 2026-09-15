import { Decimal } from '#src/core/decimal';

export type YProjectionMode =
  | 'zero-inclusive'
  | 'floating-positive'
  | 'floating-negative'
  | 'zero-only'
  | 'constant'
  | 'empty';

export type YProjectionScale = 'linear' | 'log' | 'linear-symmetric' | undefined;
export type YProjectionFamily = 'linear' | 'log';

export type YProjectionBasis = {
  family: YProjectionFamily;
  origin: Decimal;
  span: Decimal;
};

export type YProjection = {
  mode: YProjectionMode;
  scale: Exclude<YProjectionScale, undefined>;
  extent: [number, number] | null;
  gap: number;
  floating: number;
  numericZero: number | null;
  basis: YProjectionBasis | null;
  project: (value: Decimal | null | undefined) => Decimal | null;
  normalize: (value: Decimal | null | undefined) => number;
};

export type YProjectionAffine = {
  scale: number;
  offset: number;
};

const ZERO = Decimal(0);

function finiteExtent(lower: Decimal, upper: Decimal): [number, number] {
  const extent: [number, number] = [lower.number(), upper.number()];
  if (!extent.every(Number.isFinite)) {
    throw new RangeError('Normalized Y projection extent must be finite');
  }
  return extent;
}

function finiteOrNull(value: Decimal) {
  const number = value.number();
  return Number.isFinite(number) ? number : null;
}

function emptyProjection(scale: Exclude<YProjectionScale, undefined>, gap: number): YProjection {
  return {
    mode: 'empty',
    scale,
    extent: null,
    gap,
    floating: 0,
    numericZero: null,
    basis: null,
    project: () => null,
    normalize: () => NaN,
  };
}

export function createYProjection(
  effectiveExtent: [Decimal, Decimal] | null,
  scale: YProjectionScale,
  gap = 20,
  previousBasis?: YProjectionBasis | null,
): YProjection {
  const resolvedScale = scale ?? 'linear';
  if (!effectiveExtent) return emptyProjection(resolvedScale, gap);

  const [lower, upper] = effectiveExtent;
  if (lower.gt(upper)) return emptyProjection(resolvedScale, gap);

  if (resolvedScale === 'log' && (!lower.isPositive() || !upper.isPositive())) {
    return emptyProjection(resolvedScale, gap);
  }

  if (lower.eq(upper) && (resolvedScale !== 'linear-symmetric' || lower.isZero())) {
    const family = resolvedScale === 'log' ? 'log' : 'linear';
    const origin = family === 'log' ? lower.log(10) : lower;
    // A constant display has zero screen scale, not a singular data basis.
    // Keep value differences available for interrupted and expanding transitions.
    const span = previousBasis?.family === family && !previousBasis.span.isZero() ? previousBasis.span : Decimal(1);
    const project = (value: Decimal | null | undefined) => {
      if (!value || (family === 'log' && !value.isPositive())) return null;
      return (family === 'log' ? value.log(10) : value).sub(origin).div(span);
    };
    return {
      mode: lower.isZero() ? 'zero-only' : 'constant',
      scale: resolvedScale,
      extent: [0, 0],
      gap,
      floating: lower.isZero() ? 0 : lower.isPositive() ? gap : -gap,
      numericZero: lower.isZero() ? 0 : null,
      basis: { family, origin, span },
      project,
      normalize: (value) => project(value)?.number() ?? NaN,
    };
  }

  if (resolvedScale === 'log') {
    const origin = lower.log(10);
    const span = upper.log(10).sub(origin);
    const project = (value: Decimal | null | undefined) =>
      value?.isPositive() ? value.log(10).sub(origin).div(span) : null;
    return {
      mode: 'floating-positive',
      scale: resolvedScale,
      extent: [0, 1],
      gap,
      floating: gap,
      numericZero: null,
      basis: { family: 'log', origin, span },
      project,
      normalize: (value) => project(value)?.number() ?? NaN,
    };
  }

  if (resolvedScale === 'linear-symmetric' || (lower.le(ZERO) && upper.ge(ZERO))) {
    const amplitude = lower.abs().gt(upper.abs()) ? lower.abs() : upper.abs();
    const normalizedLower = lower.isPositive() ? ZERO : lower.div(amplitude);
    const normalizedUpper = upper.isNegative() ? ZERO : upper.div(amplitude);
    const project = (value: Decimal | null | undefined) => value?.div(amplitude) ?? null;
    return {
      mode: 'zero-inclusive',
      scale: resolvedScale,
      extent: finiteExtent(normalizedLower, normalizedUpper),
      gap,
      floating: 0,
      numericZero: 0,
      basis: { family: 'linear', origin: ZERO, span: amplitude },
      project,
      normalize: (value) => project(value)?.number() ?? NaN,
    };
  }

  const span = upper.sub(lower);
  const positive = lower.isPositive();
  if (!positive) {
    const project = (value: Decimal | null | undefined) => value?.sub(upper).div(span) ?? null;
    return {
      mode: 'floating-negative',
      scale: resolvedScale,
      extent: [-1, 0],
      gap,
      floating: -gap,
      numericZero: finiteOrNull(upper.neg().div(span)),
      basis: { family: 'linear', origin: upper, span },
      project,
      normalize: (value) => project(value)?.number() ?? NaN,
    };
  }
  const project = (value: Decimal | null | undefined) => value?.sub(lower).div(span) ?? null;
  return {
    mode: 'floating-positive',
    scale: resolvedScale,
    extent: [0, 1],
    gap,
    floating: gap,
    numericZero: finiteOrNull(lower.neg().div(span)),
    basis: { family: 'linear', origin: lower, span },
    project,
    normalize: (value) => project(value)?.number() ?? NaN,
  };
}

export function computeYProjectionToAnchor(
  projection: YProjection,
  anchor: YProjectionBasis,
): YProjectionAffine | null {
  const basis = projection.basis;
  if (!basis || basis.family !== anchor.family || anchor.span.isZero()) {
    return null;
  }

  const scale = basis.span.div(anchor.span).number();
  const offset = basis.origin.sub(anchor.origin).div(anchor.span).number();
  if (!Number.isFinite(scale) || !Number.isFinite(offset)) return null;
  return { scale, offset };
}
