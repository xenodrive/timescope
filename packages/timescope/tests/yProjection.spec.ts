import { describe, expect, it } from 'vitest';
import { Decimal } from '../src/core/decimal';
import { computeYProjectionToAnchor, createYProjection } from '../src/main/yProjection';

const extent = (lower: string | number, upper: string | number): [Decimal, Decimal] => [Decimal(lower), Decimal(upper)];

describe('createYProjection', () => {
  it('normalizes a positive extent without converting its raw values to numbers', () => {
    const projection = createYProjection(extent(10, 30), undefined);

    expect(projection.mode).toBe('floating-positive');
    expect(projection.extent).toEqual([0, 1]);
    expect(projection.floating).toBe(20);
    expect(projection.numericZero).toBe(-0.5);
    expect(projection.normalize(Decimal(20))).toBe(0.5);
  });

  it('normalizes a negative extent in increasing order', () => {
    const projection = createYProjection(extent(-30, -10), 'linear', 12);

    expect(projection.mode).toBe('floating-negative');
    expect(projection.floating).toBe(-12);
    expect(projection.extent).toEqual([-1, 0]);
    expect(projection.numericZero).toBe(0.5);
    expect(projection.normalize(Decimal(-30))).toBe(-1);
    expect(projection.normalize(Decimal(-20))).toBe(-0.5);
    expect(projection.normalize(Decimal(-10))).toBe(0);
  });

  it('uses the largest absolute bound for a mixed extent', () => {
    const projection = createYProjection(extent(-5, 10), 'linear');

    expect(projection.mode).toBe('zero-inclusive');
    expect(projection.extent).toEqual([-0.5, 1]);
    expect(projection.floating).toBe(0);
    expect(projection.normalize(Decimal(-5))).toBe(-0.5);
    expect(projection.normalize(Decimal(5))).toBe(0.5);
  });

  it('forces a one-sided extent to be zero-inclusive for a symmetric scale', () => {
    const projection = createYProjection(extent(2, 10), 'linear-symmetric');

    expect(projection.mode).toBe('zero-inclusive');
    expect(projection.extent).toEqual([0, 1]);
    expect(projection.normalize(Decimal(2))).toBe(0.2);
    expect(projection.normalize(Decimal(10))).toBe(1);
  });

  it('handles empty and all-zero extents', () => {
    const empty = createYProjection(null, 'linear');
    const zero = createYProjection(extent(0, 0), 'linear');

    expect(empty.mode).toBe('empty');
    expect(empty.extent).toBeNull();
    expect(empty.normalize(Decimal(0))).toBeNaN();
    expect(zero.mode).toBe('zero-only');
    expect(zero.extent).toEqual([0, 0]);
    expect(zero.normalize(Decimal(0))).toBe(0);
  });

  it.each([
    [5, 20],
    [-5, -20],
  ])('normalizes the nonzero constant %s to the midpoint', (value, floating) => {
    const projection = createYProjection(extent(value, value), 'linear');

    expect(projection.mode).toBe('constant');
    expect(projection.extent).toEqual(value < 0 ? [-0.5, -0.5] : [0.5, 0.5]);
    expect(projection.floating).toBe(floating);
    expect(projection.normalize(Decimal(value))).toBe(value < 0 ? -0.5 : 0.5);
    expect(projection.normalize(Decimal(value + 1))).toBeNaN();
  });

  it.each([
    ['0.01', '0.1', '0.031622776601683793', 0.5],
    ['0.1', '10', '1', 0.5],
    ['10', '1000', '100', 0.5],
  ])('normalizes logarithmic extents %s to %s', (lower, upper, value, expected) => {
    const projection = createYProjection(extent(lower, upper), 'log');

    expect(projection.mode).toBe('floating-positive');
    expect(projection.extent).toEqual([0, 1]);
    expect(projection.numericZero).toBeNull();
    expect(projection.normalize(Decimal(value))).toBeCloseTo(expected, 15);
    expect(projection.normalize(Decimal(0))).toBeNaN();
    expect(projection.normalize(Decimal(-1))).toBeNaN();
  });

  it('preserves a tiny span at a huge base', () => {
    const lower = Decimal('1000000000000000000000000000000');
    const middle = Decimal('1000000000000000000000000000000.0000000001');
    const upper = Decimal('1000000000000000000000000000000.0000000002');
    const projection = createYProjection([lower, upper], 'linear');

    expect(lower.number()).toBe(middle.number());
    expect(middle.number()).toBe(upper.number());
    expect((middle.number() - lower.number()) / (upper.number() - lower.number())).toBeNaN();
    expect(projection.extent).toEqual([0, 1]);
    expect(projection.normalize(lower)).toBe(0);
    expect(projection.normalize(middle)).toBe(0.5);
    expect(projection.normalize(upper)).toBe(1);
  });

  it('rejects a logarithmic extent without positive values', () => {
    expect(createYProjection(extent(0, 0), 'log').mode).toBe('empty');
    expect(createYProjection(extent(-10, -1), 'log').mode).toBe('empty');
  });
});

describe('computeYProjectionToAnchor', () => {
  it('maps a new linear normalized basis into a fixed anchor', () => {
    const previous = createYProjection(extent(10, 20), 'linear');
    const next = createYProjection(extent(12, 16), 'linear');

    expect(computeYProjectionToAnchor(next, previous.basis!)).toEqual({ scale: 0.4, offset: 0.2 });
  });

  it('computes coefficients at a huge base with Decimal arithmetic', () => {
    const base = '1000000000000000000000000000000';
    const previous = createYProjection(extent(base, `${base}.0000000010`), 'linear');
    const next = createYProjection(extent(`${base}.0000000002`, `${base}.0000000004`), 'linear');

    expect(computeYProjectionToAnchor(next, previous.basis!)).toEqual({ scale: 0.2, offset: 0.2 });
  });

  it('maps compatible logarithmic and degenerate bases and rejects incompatible families', () => {
    const previousLog = createYProjection(extent('0.1', '1000'), 'log');
    const nextLog = createYProjection(extent(1, 100), 'log');
    const linear = createYProjection(extent(1, 100), 'linear');
    const constant = createYProjection(extent(2, 2), 'linear');

    expect(computeYProjectionToAnchor(nextLog, previousLog.basis!)).toEqual({ scale: 0.5, offset: 0.25 });
    expect(computeYProjectionToAnchor(linear, previousLog.basis!)).toBeNull();
    expect(computeYProjectionToAnchor(constant, linear.basis!)?.scale).toBe(0);
    expect(computeYProjectionToAnchor(constant, linear.basis!)?.offset).toBeCloseTo(1 / 99, 15);
    expect(computeYProjectionToAnchor(linear, constant.basis!)).toBeNull();
  });
});
