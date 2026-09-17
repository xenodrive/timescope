import type { Decimal } from '#src/core/decimal';
import type { TimeUnit } from '#src/core/time';
import type { TextStyleOptions } from '#src/main/chart';

export type CalendarLevel = 'subsecond' | 'second' | 'minute' | 'hour' | 'day' | 'month' | 'year' | 'relative';
export type TimeFormatFuncOptions = {
  time: Decimal;
  unit: TimeUnit;
  level: CalendarLevel;
  digits: number;
  stride?: bigint;
};
export type TimeFormatFunc = (opts: TimeFormatFuncOptions) => string | undefined;
export type TimeFormatLabelerOptions = {
  year: bigint;
  quarter: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: bigint;
  subseconds: Decimal;
  time: Decimal;
  week: number;
  digits: number;
};
export type TimeFormatLabeler = {
  year?: (opts: TimeFormatLabelerOptions) => string;
  month?: (opts: TimeFormatLabelerOptions) => string;
  quarter?: (opts: TimeFormatLabelerOptions) => string;
  date?: (opts: TimeFormatLabelerOptions) => string;
  minutes?: (opts: TimeFormatLabelerOptions) => string;
  seconds?: (opts: TimeFormatLabelerOptions) => string;
};
export type TimescopeTimeAxisOptions = {
  timeZone?: string;
  axis?: false | { color?: string };
  ticks?: false | { color?: string };
  labels?: false | TextStyleOptions;
  relative?: boolean;
  timeFormat?: TimeFormatFunc | TimeFormatLabeler;
  timeUnit?: TimeUnit;
};
export type TickLabel = {
  time: { time: Decimal; _minTime?: Decimal; _maxTime?: Decimal };
  text?: string;
  tick?: boolean;
  major?: boolean;
};
/** Generated tick metadata. Label formatting belongs to LayerData. */
export type TimeAxisTick = Omit<TickLabel, 'text'> & { format?: TimeFormatFuncOptions & { timeZone?: string } };

const UNIT_EXPONENTS: Record<TimeUnit, bigint> = { s: 0n, ms: 3n, us: 6n, ns: 9n };
export function scaleTimeUnit(value: Decimal, from: TimeUnit, to: TimeUnit): Decimal {
  return from === to ? value : value.shift10(UNIT_EXPONENTS[to] - UNIT_EXPONENTS[from]);
}
