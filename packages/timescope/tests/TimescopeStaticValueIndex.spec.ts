import { Decimal } from '#src/core/decimal';
import { TimescopeStaticValueIndex } from '#src/main/reducers/TimescopeStaticValueIndex';
import { describe, expect, it } from 'vitest';

describe('TimescopeStaticValueIndex', () => {
  it('computes exact range statistics and R-7 percentiles', () => {
    const index = new TimescopeStaticValueIndex(Array.from({ length: 100 }, (_, value) => Decimal(value + 1)));
    const aggregate = index.aggregate(0, 100);

    expect(aggregate.first?.eq(1)).toBe(true);
    expect(aggregate.last?.eq(100)).toBe(true);
    expect(aggregate.min?.eq(1)).toBe(true);
    expect(aggregate.max?.eq(100)).toBe(true);
    expect(aggregate.p50?.eq('50.5')).toBe(true);
    expect(aggregate.p90?.eq('90.1')).toBe(true);
    expect(aggregate.p95?.eq('95.05')).toBe(true);
  });

  it('excludes nulls and preserves chronological first and last values', () => {
    const index = new TimescopeStaticValueIndex([Decimal(5), null, Decimal(-1), Decimal(10), null]);
    const aggregate = index.aggregate(0, 5);

    expect(aggregate.first?.eq(5)).toBe(true);
    expect(aggregate.last?.eq(10)).toBe(true);
    expect(aggregate.min?.eq(-1)).toBe(true);
    expect(aggregate.max?.eq(10)).toBe(true);
    expect(aggregate.p50?.eq(5)).toBe(true);
  });

  it('returns null statistics for an all-null range', () => {
    const aggregate = new TimescopeStaticValueIndex([null, Decimal(1), null]).aggregate(0, 1);
    expect(Object.values(aggregate).every((value) => value === null)).toBe(true);
  });

  it('matches a sorting oracle across random ranges', () => {
    let state = 0x12345678;
    const random = () => (state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 0x100000000;
    const values = Array.from({ length: 500 }, () =>
      random() < 0.15 ? null : Decimal(Math.floor(random() * 41) - 20),
    );
    const index = new TimescopeStaticValueIndex(values);
    const percentile = (sorted: Decimal[], numerator: number, denominator: number) => {
      const position = (sorted.length - 1) * numerator;
      const lower = Math.floor(position / denominator);
      const remainder = position % denominator;
      return sorted[lower].add(
        sorted[Math.ceil(position / denominator)].sub(sorted[lower]).mul(remainder).div(denominator),
      );
    };

    for (let query = 0; query < 200; query++) {
      const left = Math.floor(random() * values.length);
      const right = left + 1 + Math.floor(random() * (values.length - left));
      const chronological = values.slice(left, right).filter((value): value is Decimal => value != null);
      const sorted = chronological.toSorted((a, b) => a.cmp(b));
      const aggregate = index.aggregate(left, right);
      if (!sorted.length) {
        expect(Object.values(aggregate).every((value) => value === null)).toBe(true);
        continue;
      }

      expect(aggregate.first?.eq(chronological[0])).toBe(true);
      expect(aggregate.last?.eq(chronological.at(-1)!)).toBe(true);
      expect(aggregate.min?.eq(sorted[0])).toBe(true);
      expect(aggregate.max?.eq(sorted.at(-1)!)).toBe(true);
      expect(aggregate.p50?.eq(percentile(sorted, 1, 2))).toBe(true);
      expect(aggregate.p90?.eq(percentile(sorted, 9, 10))).toBe(true);
      expect(aggregate.p95?.eq(percentile(sorted, 19, 20))).toBe(true);
    }
  });
});
