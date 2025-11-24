import { Decimal, type NumberLike } from '#src/core/decimal';

export type Range<T> = [T, T];
export type TimeRange<T = Decimal | undefined> = Range<T>;
export type TimeRangeInput = Range<NumberLike | undefined | null>;
export type FixedRange = Range<Decimal>;
