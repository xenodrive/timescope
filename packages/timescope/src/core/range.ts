import { Decimal, type NumberLike } from '#src/core/decimal';

export type TimescopeRange<T> = [T, T];
export type TimeRange<T = Decimal | undefined> = TimescopeRange<T>;
export type TimeRangeInput = TimescopeRange<NumberLike | undefined | null>;
export type FixedRange = TimescopeRange<Decimal>;
