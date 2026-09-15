import { Decimal } from '#src/core/decimal';
import { parseTimeDomainLike, parseTimeLike } from '#src/core/time';
import { describe, expect, it } from 'vitest';

describe('time inputs', () => {
  it('preserves fractional seconds and explicit offsets', () => {
    expect(parseTimeLike<never>('1970-01-01T00:00:00.123456789Z').toString()).toBe('0.123456789');
    expect(parseTimeLike<never>('1970-01-01T09:00:00.123456789+09:00').toString()).toBe('0.123456789');
    expect(parseTimeLike<never>('1969-12-31T23:59:59.999999999Z').toString()).toBe('-0.000000001');
  });

  it('interprets dates and datetimes without offsets in local time', () => {
    expect(parseTimeLike<never>('2026-09-01').eq(Decimal(new Date(2026, 8, 1).getTime() / 1000))).toBe(true);
    expect(
      parseTimeLike<never>('2026-09-01T12:34:56').eq(Decimal(new Date(2026, 8, 1, 12, 34, 56).getTime() / 1000)),
    ).toBe(true);
  });

  it.each(['invalid', '2026-02-30', '2026-09-01T25:00:00Z'])('rejects %s', (value) => {
    expect(() => parseTimeLike(value)).toThrow();
  });

  it('preserves non-string inputs and range sentinels', () => {
    const value = Decimal('0.123456789');
    expect(parseTimeLike(value)).toBe(value);
    expect(parseTimeLike<never>(123).toString()).toBe('123');
    expect(parseTimeLike<never>(123n).toString()).toBe('123');
    expect(parseTimeLike<never>(new Date(123)).toString()).toBe('0.123');
    expect(parseTimeDomainLike([undefined, null])).toEqual([undefined, null]);
  });
});
