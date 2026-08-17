import { Decimal, DecimalSafe, type NumberLike } from '#src/core/decimal';
import type { IntervalBound } from '#src/core/interval';
import { parseTimeLike, type TimeLike } from '#src/core/time';
import { createGetter } from '#src/core/utils';

export type TimescopeValueLike = NumberLike | null;

export type TimescopeDataRowInput = (
  { time: TimeLike<never>; times?: never } | { time?: never; times: Record<string, TimeLike<never>> }
) &
  ({ value: TimescopeValueLike; values?: never } | { value?: never; values: Record<string, TimescopeValueLike> }) & {
    data?: unknown;
  };

export type TimescopeDataRow = {
  times: Record<string, Decimal>;
  values: Record<string, Decimal | null>;
  data: unknown;
  /** Internal temporal support. This is not exposed to representation callbacks. */
  range: readonly [Decimal, Decimal, IntervalBound];
};

export type TimescopeMappings = {
  times: Record<string, string>;
  values: Record<string, string>;
};

export function compileMappings(mappings: TimescopeMappings) {
  const times = Object.entries(mappings.times).map(([key, path]) => [key, createGetter(path)] as const);
  const values = Object.entries(mappings.values).map(([key, path]) => [key, createGetter(path)] as const);
  return (record: Record<string, unknown>): TimescopeDataRowInput => ({
    times: Object.fromEntries(times.map(([key, get]) => [key, get(record) as TimeLike<never>])),
    values: Object.fromEntries(values.map(([key, get]) => [key, get(record) as TimescopeValueLike])),
  });
}

export function normalizeDataRow(input: TimescopeDataRowInput): TimescopeDataRow {
  const timesInput = input.times ?? { time: input.time! };
  const valuesInput = input.values ?? { value: input.value! };
  const times = Object.fromEntries(
    Object.entries(timesInput).map(([key, value]) => [key, parseTimeLike<never>(value)]),
  );
  const values = Object.fromEntries(
    Object.entries(valuesInput)
      .map(([key, value]) => [key, DecimalSafe(value)] as const)
      .filter((entry): entry is [string, Decimal | null] => entry[1] !== undefined),
  );
  const timeValues = Object.values(times);
  if (!timeValues.length) throw new Error('A data row must contain at least one time field');
  const [start, end] = Decimal.minmax(...timeValues);
  return {
    times,
    values,
    data: input.data,
    range: [start!, end!, start!.eq(end!) ? '[]' : '[)'],
  };
}

export function normalizeDataRows(input: unknown, mappings?: TimescopeMappings) {
  if (!Array.isArray(input)) throw new Error('A source must return an array of data rows');
  const map = mappings ? compileMappings(mappings) : (row: TimescopeDataRowInput) => row;
  return input.map((row) => normalizeDataRow(map(row as never)));
}
