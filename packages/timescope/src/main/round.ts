import { Decimal } from '#src/core/decimal';

export type TimescopeRoundMode = 'decimal' | 'pow10';
export type TimescopeRoundLabel = 'decimal' | 'e' | 'pow10';
export type TimescopeRoundContext = {
  mode: TimescopeRoundMode;
  value: Decimal;
  roundedValue: Decimal;
  mantissa: string;
  base: 10;
  exponent: bigint;
};
export type TimescopeRound =
  | TimescopeRoundLabel
  | number
  | {
      mode?: TimescopeRoundMode;
      digits?: number;
      label?: TimescopeRoundLabel | ((context: TimescopeRoundContext) => string);
    };

export function normalizeRound(input?: TimescopeRound) {
  const options =
    typeof input === 'number'
      ? { digits: input }
      : typeof input === 'string'
        ? { label: input, digits: 2 }
        : (input ?? {});
  const labelMode = typeof options.label === 'string' ? (options.label === 'decimal' ? 'decimal' : 'pow10') : undefined;
  const mode = options.mode ?? labelMode ?? 'decimal';
  if (labelMode !== undefined && labelMode !== mode) throw new TypeError('Round mode and label must agree');
  const digits = options.digits;
  if (digits !== undefined && (!Number.isSafeInteger(digits) || (mode === 'pow10' && digits < 0))) {
    throw new RangeError('Round digits must be a safe integer, and nonnegative for pow10');
  }
  return { mode, digits, label: options.label ?? mode };
}

export type ResolvedRound = ReturnType<typeof normalizeRound>;

export function roundMantissa(value: Decimal, mode: TimescopeRoundMode): Decimal {
  return mode === 'pow10' && !value.isZero() ? value.shift10(-value.order()) : value;
}

export function roundParts(value: Decimal, options: ResolvedRound): TimescopeRoundContext {
  let exponent = options.mode === 'pow10' && !value.isZero() ? value.order() : 0n;
  let mantissa = value.shift10(-exponent);
  if (options.digits !== undefined) mantissa = mantissa.round(options.digits);
  if (options.mode === 'pow10' && mantissa.abs().ge(10)) {
    mantissa = mantissa.shift10(-1);
    exponent++;
  }
  return {
    mode: options.mode,
    value,
    roundedValue: mantissa.shift10(exponent),
    mantissa: options.digits === undefined ? mantissa.toString() : mantissa.toFixed(Math.max(0, options.digits)),
    base: 10,
    exponent,
  };
}

export function roundLabel(parts: TimescopeRoundContext, label: ResolvedRound['label']): string {
  if (typeof label === 'function') return label(parts);
  if (label === 'decimal') return parts.mantissa;
  if (label === 'e') return `${parts.mantissa}e${parts.exponent}`;
  const superscripts: Record<string, string> = {
    '-': '⁻',
    '0': '⁰',
    '1': '¹',
    '2': '²',
    '3': '³',
    '4': '⁴',
    '5': '⁵',
    '6': '⁶',
    '7': '⁷',
    '8': '⁸',
    '9': '⁹',
  };
  return `${parts.mantissa}×10${[...parts.exponent.toString()].map((char) => superscripts[char]).join('')}`;
}
