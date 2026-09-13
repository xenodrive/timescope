import { Decimal, type NumberLike } from '#src/core/decimal';
import { LRUCache } from './cache';

const ZOOM_BASE = 2;

export type TimescopeResolutionSnap = 'nearest' | 'floor' | 'ceil';
export type TimescopeResolutionContext = { resolution: Decimal; resolutions: readonly Decimal[] };
export type TimescopeResolutionResolver = NumberLike | ((context: TimescopeResolutionContext) => NumberLike);
export type TimescopeDataResolution =
  | TimescopeResolutionSnap
  | TimescopeResolutionResolver
  | {
      resolve?: TimescopeResolutionResolver;
      snap?: TimescopeResolutionSnap;
    };

export type ZoomLike = NumberLike;

const cacheR2Z = new LRUCache<string, number>({
  maxSize: 10,
});
const cacheZ2R = new LRUCache<number, Decimal>({
  maxSize: 10,
});

export function zoomFor(resolution: Decimal): number {
  const key = resolution.toString();
  return cacheR2Z.set(key, cacheR2Z.get(key) ?? -resolution.log(ZOOM_BASE).number());
}

export function resolutionFor(zoom: number): Decimal {
  const key = zoom;
  return cacheZ2R.set(key, cacheZ2R.get(key) ?? Decimal(ZOOM_BASE).pow(-zoom, BigInt(Math.floor(zoom))));
}

export function createZoomLevels(minZ: number, maxZ: number, step: number = 0.5) {
  const result = [];
  for (let z = minZ; z <= maxZ; z += step) {
    result.push(z);
  }
  return result;
}

export function getConstraintedResolution(
  resolution: Decimal,
  resolutions: readonly Decimal[] | undefined,
  snap: TimescopeResolutionSnap = 'nearest',
): Decimal {
  if (!resolutions || resolutions.length === 0) {
    const zoom = zoomFor(resolution);
    if (snap === 'floor') return resolutionFor(Math.ceil(zoom));
    if (snap === 'ceil') return resolutionFor(Math.floor(zoom));
    return resolutionFor(Math.round(zoom));
  }
  if (snap !== 'nearest') {
    let match: Decimal | undefined;
    let fallback = resolutions[0];
    for (const candidate of resolutions) {
      if (snap === 'ceil') {
        if (candidate.gt(fallback)) fallback = candidate;
        if (candidate.ge(resolution) && (!match || candidate.lt(match))) match = candidate;
      } else {
        if (candidate.lt(fallback)) fallback = candidate;
        if (candidate.le(resolution) && (!match || candidate.gt(match))) match = candidate;
      }
    }
    return match ?? fallback;
  }
  const z = zoomFor(resolution);
  return resolutions.reduce((prev, curr) => {
    const zp = zoomFor(prev);
    const zc = zoomFor(curr);
    return Math.abs(z - zc) < Math.abs(z - zp) ? curr : prev;
  });
}
