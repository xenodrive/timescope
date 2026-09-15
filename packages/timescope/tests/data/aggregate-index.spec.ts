import { createChunk } from '#src/core/chunk';
import { Decimal } from '#src/core/decimal';
import { TimescopeAggregateSeriesIndex } from '#src/main/reducers/TimescopeAggregateSeriesIndex';
import type { TimescopeDataRow } from '#src/main/TimescopeData';
import { describe, expect, it } from 'vitest';

function point(time: number, values: Record<string, number | null> = { value: time }): TimescopeDataRow {
  const t = Decimal(time);
  return {
    times: { time: t },
    values: Object.fromEntries(
      Object.entries(values).map(([key, value]) => [key, value === null ? null : Decimal(value)]),
    ),
    data: { time },
    range: [t, t, '[]'],
  };
}

function interval(start: number, end: number): TimescopeDataRow {
  return {
    times: { start: Decimal(start), end: Decimal(end) },
    values: { value: Decimal(start) },
    data: { start, end },
    range: [Decimal(start), Decimal(end), '[)'],
  };
}

function chunk(start: number, end: number, resolution: number) {
  return createChunk({
    id: 'test',
    seq: 0n,
    range: [Decimal(start), Decimal(end)],
    resolution: Decimal(resolution),
    zoom: 0,
  });
}

function supportsIntersect(row: TimescopeDataRow, start: number, end: number) {
  if (row.range[0].eq(row.range[1])) return row.range[0].ge(start) && row.range[0].lt(end);
  return row.range[0].lt(end) && row.range[1].gt(start);
}

function sortedRows(entries: readonly { row: TimescopeDataRow; ordinal: number }[]) {
  return entries.toSorted((a, b) => a.row.range[0].cmp(b.row.range[0]) || a.ordinal - b.ordinal).map(({ row }) => row);
}

function oracleAggregate(entries: readonly { row: TimescopeDataRow; ordinal: number }[], start: number, end: number) {
  const values = sortedRows(entries)
    .filter((row) => row.range[0].eq(row.range[1]) && row.range[0].ge(start) && row.range[0].lt(end))
    .map((row) => row.values.value)
    .filter((value): value is Decimal => value !== null);
  if (!values.length) return;
  const sum = values.reduce((total, value) => total.add(value), Decimal(0));
  return {
    avg: sum.div(values.length),
    first: values[0],
    last: values.at(-1)!,
    min: values.reduce((current, value) => Decimal.min(current, value)!),
    max: values.reduce((current, value) => Decimal.max(current, value)!),
  };
}

describe('mutable aggregate series index', () => {
  it('aggregates each field independently, excluding nulls and retaining zero', () => {
    const index = new TimescopeAggregateSeriesIndex([
      point(0, { value: 0, other: null }),
      point(1, { value: null, other: 8 }),
      point(2, { value: 10, other: 4 }),
    ]);

    const aggregate = index.aggregate([Decimal(0), Decimal(3)]);
    expect(aggregate.value.avg?.eq(5)).toBe(true);
    expect(aggregate.value.min?.eq(0)).toBe(true);
    expect(aggregate.value.max?.eq(10)).toBe(true);
    expect(aggregate.value.first?.eq(0)).toBe(true);
    expect(aggregate.value.last?.eq(10)).toBe(true);
    expect(aggregate.other.avg?.eq(6)).toBe(true);
  });

  it('emits null aliases when a value field is null throughout a bucket', () => {
    const index = new TimescopeAggregateSeriesIndex([point(0, { value: null }), point(1, { value: null })]);
    const [row] = index.query(chunk(0, 2, 2));

    expect(row.values).toEqual({
      value: null,
      'value#avg': null,
      'value#min': null,
      'value#max': null,
      'value#first': null,
      'value#last': null,
    });
  });

  it('includes intervals that start outside but overlap the requested range', () => {
    const rows = [interval(-20, 50), point(-2), point(2), point(8), point(12), interval(20, 21)];
    const index = new TimescopeAggregateSeriesIndex(rows);

    expect(index.raw([Decimal(5), Decimal(10)], false)).toEqual([rows[0], rows[3]]);
    expect(index.raw([Decimal(5), Decimal(10)])).toEqual(rows);
  });

  it('returns two aggregate context buckets per side and only supported output aliases', () => {
    const span = interval(0.5, 1.5);
    const index = new TimescopeAggregateSeriesIndex([
      point(-1.5, { value: -3 }),
      point(-0.5, { value: -1 }),
      point(0.2, { value: 1 }),
      point(0.8, { value: 3 }),
      span,
      point(1.2, { value: 5 }),
      point(2.2, { value: 7 }),
      point(3.2, { value: 9 }),
    ]);
    const rows = index.query(chunk(0, 2, 1));
    const points = rows.filter((row) => row.range[0].eq(row.range[1]) || row.data === undefined);

    expect(points.map((row) => row.range[0].number())).toEqual([-1.5, -0.5, 0, 1.2, 2.2, 3.2]);
    expect(points[2].values.value?.eq(2)).toBe(true);
    expect(Object.keys(points[2].values).toSorted()).toEqual([
      'value',
      'value#avg',
      'value#first',
      'value#last',
      'value#max',
      'value#min',
    ]);
    expect(rows).toContain(span);
  });

  it('skips duplicate points while selecting distinct context buckets', () => {
    const index = new TimescopeAggregateSeriesIndex([
      ...Array.from({ length: 1000 }, () => point(-1.5)),
      point(-0.5),
      point(0.5),
      ...Array.from({ length: 1000 }, () => point(1.5)),
      point(2.5),
    ]);
    const rows = index.query(chunk(0, 1, 1)).filter((row) => row.range[0].eq(row.range[1]) || row.data === undefined);

    expect(rows.map((row) => row.range[0].number())).toEqual([-2, -0.5, 0.5, 1, 2.5]);
    expect(rows[0].values['value#avg']?.eq(-1.5)).toBe(true);
    expect(rows[3].values['value#avg']?.eq(1.5)).toBe(true);
  });

  it('retains distant context without converting its bucket coordinate to a safe integer', () => {
    const resolution = Decimal(2).pow(-55);
    const center = Decimal('1.5');
    const index = new TimescopeAggregateSeriesIndex([point(1), point(2)]);
    const rows = index.query(
      createChunk({
        id: 'high-zoom',
        seq: 0n,
        range: [center, center.add(resolution.mul(256))],
        resolution,
        zoom: 55,
      }),
    );

    expect(rows.map((row) => row.times.time.number())).toEqual([1, 2]);
  });

  it('returns overlapping intervals and two interval context rows on each side', () => {
    const overlapping = interval(-100, 100);
    const farBefore = interval(-4, -3);
    const before = interval(-2, -1);
    const after = interval(20, 21);
    const farAfter = interval(22, 23);
    const index = new TimescopeAggregateSeriesIndex([
      overlapping,
      point(-50),
      farBefore,
      before,
      ...Array.from({ length: 1000 }, (_, time) => point(time)),
      after,
      farAfter,
    ]);

    const rows = index.query(chunk(0, 10, 10));
    const intervals = rows.filter((row) => row.data && typeof row.data === 'object' && 'start' in row.data);

    expect(intervals).toEqual([overlapping, farBefore, before, after, farAfter]);
  });

  it('matches an array oracle after repeated appends and range replacements', () => {
    let state = 0x5eed1234;
    const random = () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 0x1_0000_0000;
    };
    let ordinal = 0;
    let oracle: { row: TimescopeDataRow; ordinal: number }[] = [];
    const index = new TimescopeAggregateSeriesIndex();
    const makeRow = () => {
      const start = Math.floor(random() * 1200) - 600;
      return random() < 0.2
        ? interval(start, start + 1 + Math.floor(random() * 100))
        : point(start, { value: Math.floor(random() * 201) - 100 });
    };
    const append = (count: number) => {
      const rows = Array.from({ length: count }, makeRow);
      index.append(rows);
      oracle.push(...rows.map((row) => ({ row, ordinal: ordinal++ })));
    };
    append(2400);

    for (let mutation = 0; mutation < 80; mutation++) {
      if (mutation % 3) {
        append(1 + Math.floor(random() * 20));
      } else {
        const start = Math.floor(random() * 1000) - 500;
        const end = start + 10 + Math.floor(random() * 180);
        const replacements = Array.from({ length: Math.floor(random() * 12) }, makeRow);
        index.replaceRange([Decimal(start), Decimal(end)], replacements);
        oracle = oracle.filter(({ row }) => !supportsIntersect(row, start, end));
        oracle.push(...replacements.map((row) => ({ row, ordinal: ordinal++ })));
      }

      for (let query = 0; query < 4; query++) {
        const start = Math.floor(random() * 1200) - 600;
        const end = start + 1 + Math.floor(random() * 120);
        const expectedRows = sortedRows(oracle.filter(({ row }) => supportsIntersect(row, start, end)));
        expect(index.raw([Decimal(start), Decimal(end)], false)).toEqual(expectedRows);

        const expected = oracleAggregate(oracle, start, end);
        const actual = index.aggregate([Decimal(start), Decimal(end)]).value;
        expect(Boolean(actual)).toBe(Boolean(expected));
        if (expected) {
          expect(actual.avg?.eq(expected.avg)).toBe(true);
          expect(actual.first?.eq(expected.first)).toBe(true);
          expect(actual.last?.eq(expected.last)).toBe(true);
          expect(actual.min?.eq(expected.min)).toBe(true);
          expect(actual.max?.eq(expected.max)).toBe(true);
        }
      }
    }

    index.replaceRange([Decimal(-10_000), Decimal(10_000)], [point(1), point(2)]);
    expect(index.raw()).toEqual([point(1), point(2)]);
  });

  it('retains aggregate context at extreme resolutions', () => {
    const tiny = Decimal('1e-100');
    const nearTime = tiny.mul('0.5');
    const near: TimescopeDataRow = {
      times: { time: nearTime },
      values: { value: Decimal(1) },
      data: {},
      range: [nearTime, nearTime, '[]'],
    };
    const index = new TimescopeAggregateSeriesIndex([point(-1e100), near]);
    const rows = index.query(
      createChunk({ id: 'tiny', seq: 0n, range: [Decimal(0), tiny], resolution: tiny, zoom: 0 }),
    );
    expect(rows).toHaveLength(2);
    expect(rows[0].times.time.eq(-1e100)).toBe(true);
    expect(rows[1].times.time.eq(nearTime)).toBe(true);
  });
});
