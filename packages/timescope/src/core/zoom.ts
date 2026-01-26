import config from '#src/core/config';
import { Decimal, type NumberLike } from '#src/core/decimal';
import { LRUCache } from './cache';

export type ZoomLike = NumberLike;

const cacheR2Z = new LRUCache<string, number>({
  maxSize: 10,
});
const cacheZ2R = new LRUCache<number, Decimal>({
  maxSize: 10,
});

export function zoomFor(resolution: Decimal): number {
  const key = resolution.toString();
  return cacheR2Z.set(key, cacheR2Z.get(key) ?? -resolution.log(config.base).number());
}

export function resolutionFor(zoom: number): Decimal {
  const key = zoom;
  return cacheZ2R.set(key, cacheZ2R.get(key) ?? Decimal(config.base).pow(-zoom, BigInt(Math.floor(zoom))));
}

export function createZoomLevels(minZ: number, maxZ: number, step: number = 0.5) {
  const result = [];
  for (let z = minZ; z <= maxZ; z += step) {
    result.push(z);
  }
  return result;
}

export function getConstraintedResolution(resolution: Decimal, resolutions: readonly Decimal[] | undefined): Decimal {
  if (!resolutions || resolutions?.length === 0) return resolutionFor(Math.round(zoomFor(resolution)));
  const z = zoomFor(resolution);
  return resolutions.reduce((prev, curr) => {
    const zp = zoomFor(prev);
    const zc = zoomFor(curr);
    return Math.abs(z - zc) < Math.abs(z - zp) ? curr : prev;
  });
}
