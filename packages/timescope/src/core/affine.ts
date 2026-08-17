export type Affine = {
  scale: number;
  offset: number;
};

export const IDENTITY_AFFINE: Affine = { scale: 1, offset: 0 };

export function affine(scale: number, offset: number): Affine {
  return { scale, offset };
}

export function applyAffine(transform: Affine, value: number) {
  return value * transform.scale + transform.offset;
}

export function composeAffine(outer: Affine, inner: Affine): Affine {
  return {
    scale: outer.scale * inner.scale,
    offset: outer.scale * inner.offset + outer.offset,
  };
}

export function invertAffine(transform: Affine): Affine | null {
  if (transform.scale === 0 || !isFinite(transform.scale) || !isFinite(transform.offset)) return null;
  return {
    scale: 1 / transform.scale,
    offset: -transform.offset / transform.scale,
  };
}

export function affineTransition(from: Affine | null | undefined, to: Affine | null | undefined): Affine {
  if (!from || !to) return IDENTITY_AFFINE;
  const inverseTo = invertAffine(to);
  if (!inverseTo) return IDENTITY_AFFINE;
  const transition = composeAffine(inverseTo, from);
  if (!isFinite(transition.scale) || !isFinite(transition.offset)) return IDENTITY_AFFINE;
  return transition;
}
