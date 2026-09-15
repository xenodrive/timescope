import { Decimal } from '#src/core/decimal';
import { computeYProjectionToAnchor, createYProjection } from '#src/main/yProjection';
import { describe, expect, it } from 'vitest';

const extent = (lower: string | number, upper: string | number): [Decimal, Decimal] => [Decimal(lower), Decimal(upper)];

describe('value projection', () => {
  it.each([
    [10, 30],
    [-30, -10],
    [-5, 10],
  ] as const)('preserves ordering and linear distances in [%s, %s]', (lower, upper) => {
    const projection = createYProjection(extent(lower, upper), 'linear');
    const start = projection.normalize(Decimal(lower));
    const end = projection.normalize(Decimal(upper));
    expect(end).toBeGreaterThan(start);
    for (const fraction of [0.25, 0.5, 0.75]) {
      const value = Decimal(lower).add(Decimal(upper).sub(lower).mul(fraction));
      expect(projection.normalize(value)).toBeCloseTo(start + (end - start) * fraction, 12);
    }
  });

  it.each([
    ['0.01', '1'],
    ['1', '100'],
    ['10', '1000'],
  ])('preserves logarithmic distances in [%s, %s]', (lower, upper) => {
    const projection = createYProjection(extent(lower, upper), 'log');
    const middle = Decimal(lower).mul(upper).sqrt();
    expect(projection.normalize(Decimal(upper))).toBeGreaterThan(projection.normalize(Decimal(lower)));
    expect(projection.normalize(middle)).toBeCloseTo(
      (projection.normalize(Decimal(lower)) + projection.normalize(Decimal(upper))) / 2,
      12,
    );
    expect(projection.normalize(Decimal(0))).toBeNaN();
    expect(projection.normalize(Decimal(-1))).toBeNaN();
  });

  it.each([-5, 0, 5])('represents the constant value %s with a finite coordinate', (value) => {
    const projection = createYProjection(extent(value, value), 'linear');
    expect(Number.isFinite(projection.normalize(Decimal(value)))).toBe(true);
  });

  it('does not project missing data or logarithmic extents without positive values', () => {
    expect(createYProjection(null, 'linear').normalize(Decimal(0))).toBeNaN();
    expect(createYProjection(extent(-10, -1), 'log').normalize(Decimal(-5))).toBeNaN();
  });

  it.each(['linear', 'log'] as const)('maps the same value to the same anchor after a %s range change', (scale) => {
    const previous = createYProjection(extent(10, 100), scale);
    const next = createYProjection(extent(20, 50), scale);
    const affine = computeYProjectionToAnchor(next, previous.basis!);
    expect(affine).not.toBeNull();
    for (const value of [20, 30, 50]) {
      expect(next.normalize(Decimal(value)) * affine!.scale + affine!.offset).toBeCloseTo(
        previous.normalize(Decimal(value)),
        12,
      );
    }
  });

  it('preserves tiny differences and rebases them at a huge absolute value', () => {
    const base = Decimal('1e30');
    const step = Decimal('1e-10');
    const previous = createYProjection([base, base.add(step.mul(4))], 'linear');
    const next = createYProjection([base.add(step), base.add(step.mul(3))], 'linear');
    const affine = computeYProjectionToAnchor(next, previous.basis!);
    expect(affine).not.toBeNull();
    const coordinates = [0, 1, 2, 3, 4].map((i) => previous.normalize(base.add(step.mul(i))));
    for (let i = 1; i < coordinates.length; i++) expect(coordinates[i]).toBeGreaterThan(coordinates[i - 1]);
    for (const i of [1, 2, 3]) {
      expect(next.normalize(base.add(step.mul(i))) * affine!.scale + affine!.offset).toBeCloseTo(coordinates[i], 12);
    }
  });

  it('rejects an affine conversion between linear and logarithmic scales', () => {
    const linear = createYProjection(extent(1, 100), 'linear');
    const log = createYProjection(extent(1, 100), 'log');
    expect(computeYProjectionToAnchor(linear, log.basis!)).toBeNull();
    expect(computeYProjectionToAnchor(log, linear.basis!)).toBeNull();
  });
});
