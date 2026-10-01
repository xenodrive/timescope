import { Decimal } from '#src/core/decimal';
import { normalizeRound, roundParts, roundLabel, type TimescopeRound } from '#src/main/round';
import { describe, expect, it } from 'vitest';

describe('number rounding and labels', () => {
  it.each<{ value: string; round?: TimescopeRound; expected: string }>([
    { value: '0.23781', expected: '0.23781' },
    { value: '1.2', round: 'decimal', expected: '1.20' },
    { value: '1.2', round: 0, expected: '1' },
    { value: '-12.345', round: 2, expected: '-12.35' },
    { value: '12345.6789', round: 'e', expected: '1.23e4' },
    { value: '-0.000123456', round: 'pow10', expected: '-1.23×10⁻⁴' },
    { value: '9.9999', round: 'e', expected: '1.00e1' },
    { value: '0', round: 'pow10', expected: '0.00×10⁰' },
    { value: '1.2345e1000', round: 'e', expected: '1.23e1000' },
    { value: '1.2345e-1000', round: 'pow10', expected: '1.23×10⁻¹⁰⁰⁰' },
    { value: '12345.6789', round: { label: 'e' }, expected: '1.23456789e4' },
    { value: '12345.6789', round: { mode: 'pow10', digits: 0 }, expected: '1×10⁴' },
    { value: '12345', round: -2, expected: '12300' },
  ])('formats $value as $expected', ({ value, round, expected }) => {
    const source = Decimal(value);
    const options = normalizeRound(round);
    const parts = roundParts(source, options);
    expect(roundLabel(parts, options.label)).toBe(expected);
    expect(Decimal(parts.mantissa).shift10(parts.exponent).eq(parts.roundedValue)).toBe(true);
    expect(source.eq(value)).toBe(true);
    expect(parts.value.eq(value)).toBe(true);
  });

  it('passes rounded parts, not an already assembled string, to a label callback', () => {
    const options = normalizeRound({
      mode: 'pow10',
      digits: 2,
      label: ({ mode, mantissa, base, exponent, value, roundedValue }) => {
        expect(mode).toBe('pow10');
        expect(value.eq('999.9')).toBe(true);
        expect(roundedValue.eq(1000)).toBe(true);
        return `${mantissa} * ${base}^${exponent}`;
      },
    });
    expect(roundLabel(roundParts(Decimal('999.9'), options), options.label)).toBe('1.00 * 10^3');
  });

  it.each<TimescopeRound>([
    { mode: 'decimal', label: 'e' },
    { mode: 'pow10', label: 'decimal' },
    { digits: 1.5 },
    { digits: Infinity },
    { mode: 'pow10', digits: -1 },
  ])('rejects incompatible or invalid settings %j', (round) => {
    expect(() => normalizeRound(round)).toThrow();
  });
});
