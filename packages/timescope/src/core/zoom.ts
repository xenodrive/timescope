import config from '#src/core/config';
import { Decimal, type NumberLike } from '#src/core/decimal';

export type ZoomLike = NumberLike;

const cache = {
  z: 0,
  r: Decimal(1),
};

export function zoomFor(resolution: Decimal): number {
  if (cache.r.eq(resolution)) return cache.z!;
  return -resolution.log(config.base).number();
}

export function resolutionFor(zoom: number): Decimal {
  if (cache.z === zoom) return cache.r;
  cache.z = zoom;
  cache.r = Decimal(config.base).pow(-zoom, BigInt(Math.floor(zoom))); // TODO: precision for base-2
  return cache.r;
}

export function createZoomLevels(minZ: number, maxZ: number, step: number = 0.5) {
  const result = [];
  for (let z = minZ; z <= maxZ; z += step) {
    result.push(z);
  }
  return result;
}

export function getConstraintedZoom(zoom: number, zoomLevels: readonly number[] | undefined) {
  return zoomLevels
    ? zoomLevels.reduce((prev, curr) => (Math.abs(curr - zoom) < Math.abs(prev - zoom) ? curr : prev), zoomLevels[0])
    : Number(Decimal(zoom).floorBy(config.chunkStep).toFixed(2));
}
