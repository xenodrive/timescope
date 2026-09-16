import { createChunk } from '#src/core/chunk';
import { Decimal } from '#src/core/decimal';
import { createDataSource } from '#src/main/TimescopeDataSource';
import { describe, expect, it } from 'vitest';

const chunk = createChunk({ id: 'bucket', seq: 0n, range: [Decimal(0), Decimal(4)], resolution: Decimal(4), zoom: 0 });
const context = { expiresAt() {}, expiresIn() {} };

describe.each(['min-max-avg', 'percentiles'] as const)('%s snapshot reduction', (reducer) => {
  it('assigns points and context just below bucket boundaries to the preceding bucket', async () => {
    const epsilon = Decimal('1e-30');
    const times = [
      Decimal(-3).sub(epsilon),
      Decimal(-3),
      epsilon.neg(),
      Decimal(0),
      Decimal(3).sub(epsilon),
      Decimal(3),
      Decimal(6).sub(epsilon),
    ];
    const source = createDataSource({ data: times.map((time, i) => ({ time, value: i + 1 })), reducer });
    const target = createChunk({
      id: 'boundary',
      seq: 0n,
      range: [Decimal(0), Decimal(6)],
      resolution: Decimal(3),
      zoom: 0,
    });
    const rows = await source.query(target, context);
    expect(rows.map((row) => row.values.value?.number())).toEqual([1, 2.5, 4.5, 6.5]);
    expect(rows.slice(1).map((row) => row.range[0].number())).toEqual([-3, 0, 3]);
    expect(rows.slice(1).map((row) => row.times.time.number())).toEqual([-1.5, 1.5, 4.5]);
  });

  it('excludes nulls, retains zero, and preserves chronological first and last', async () => {
    const source = createDataSource({
      data: [
        { time: 0, value: 8 },
        { time: 1, value: null },
        { time: 2, value: 0 },
        { time: 3, value: 4 },
      ],
      reducer,
    });
    const rows = await source.query(chunk, context);
    expect(rows).toHaveLength(1);
    const values = rows[0].values;
    for (const [key, expected] of Object.entries({
      value: 4,
      'value#min': 0,
      'value#max': 8,
      'value#first': 8,
      'value#last': 4,
    })) {
      expect(values[key]?.eq(expected), key).toBe(true);
    }
  });

  it('preserves a singleton timestamp and value', async () => {
    const source = createDataSource({ data: [{ time: Decimal('0.00000000000000000001'), value: 7 }], reducer });
    const [row] = await source.query(chunk, context);
    expect(row.times.time.eq('0.00000000000000000001')).toBe(true);
    expect(row.values.value?.eq(7)).toBe(true);
  });

  it('keeps overlapping intervals raw rather than aggregating them with points', async () => {
    const source = createDataSource({
      data: [
        { times: { start: -10, end: 10 }, value: 100 },
        { time: 1, value: 2 },
        { time: 2, value: 4 },
      ],
      reducer,
    });
    const rows = await source.query(chunk, context);
    const interval = rows.find((row) => row.times.start);
    expect(interval?.times.start.eq(-10)).toBe(true);
    expect(interval?.times.end.eq(10)).toBe(true);
    expect(interval?.values.value?.eq(100)).toBe(true);
    expect(rows.find((row) => !row.times.start)?.values.value?.eq(3)).toBe(true);
  });
});
