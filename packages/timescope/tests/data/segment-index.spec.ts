import { createChunk } from '#src/core/chunk';
import { Decimal } from '#src/core/decimal';
import { TimescopeAggregateSeriesIndex } from '#src/main/reducers/TimescopeAggregateSeriesIndex';
import { TimescopeSegmentSeriesIndex } from '#src/main/reducers/TimescopeSegmentSeriesIndex';
import { normalizeDataRows, type TimescopeDataRow } from '#src/main/TimescopeData';
import { createDataSource } from '#src/main/TimescopeDataSource';
import { describe, expect, expectTypeOf, it } from 'vitest';

function chunk(start: number, end: number, resolution: number) {
  return createChunk({
    id: 'test',
    seq: 0n,
    zoom: 0,
    range: [Decimal(start), Decimal(end)],
    resolution: Decimal(resolution),
  });
}
const serialize = (rows: readonly TimescopeDataRow[]) =>
  rows.map((row) => ({
    times: Object.fromEntries(Object.entries(row.times).map(([key, value]) => [key, value.rescale().toString()])),
    values: Object.fromEntries(
      Object.entries(row.values).map(([key, value]) => [key, value?.rescale().toString() ?? null]),
    ),
    range: [row.range[0].rescale().toString(), row.range[1].rescale().toString(), row.range[2]],
    data: row.data,
  }));

describe('append-only segment index', () => {
  it('matches aggregate-tree queries through growth, duplicate times, gaps and changing resolution', () => {
    const segment = new TimescopeSegmentSeriesIndex();
    const reference = new TimescopeAggregateSeriesIndex();
    for (let batch = 0; batch < 12; batch++) {
      const rows = normalizeDataRows(
        Array.from({ length: 37 }, (_, i) => {
          const index = batch * 37 + i;
          return {
            time: Math.floor(index / 3) * 0.3,
            values: { value: index % 7 ? Math.sin(index) : null, other: index % 5 ? index : null },
          };
        }),
      );
      segment.append(rows);
      reference.append(rows);
      for (const resolution of [0.01, 0.3, 1, 3.7, 100]) {
        for (const start of [-50, 0, 0.1, 10, 30, 1000]) {
          const request = chunk(start, start + 7.3, resolution);
          expect(serialize(segment.query(request))).toEqual(serialize(reference.query(request)));
          expect(serialize(segment.query(request, true))).toEqual(serialize(reference.queryRaw(request)));
        }
      }
    }
  });

  it('rejects a whole invalid batch before mutation and exposes append without replace', async () => {
    const source = createDataSource({
      data: [{ time: 1, value: 1 }],
      type: 'point-aggregate',
    });
    expectTypeOf(source).not.toHaveProperty('replace');
    expect(source).not.toHaveProperty('replace');
    await expect(
      source.append([
        { time: 3, value: 3 },
        { time: 2, value: 2 },
      ]),
    ).rejects.toThrow('nondecreasing');
    await source.append({ time: 1, value: 5 });
    expect(
      (await source.query({ range: [Decimal(0), Decimal(10)], resolution: Decimal(10) }))[0].values.value?.number(),
    ).toBe(3);
    const index = new TimescopeSegmentSeriesIndex(normalizeDataRows([{ time: 1, value: 1 }]));
    expect(() =>
      index.append(
        normalizeDataRows([
          { time: 2, value: 2 },
          { times: { start: 3, end: 4 }, value: 3 },
        ]),
      ),
    ).toThrow('point');
    expect(index.size).toBe(1);
    source.dispose?.();
  });

  it('retains precision and distant context at extreme resolutions', () => {
    const base = Decimal('1e30');
    const rows = normalizeDataRows(
      Array.from({ length: 9 }, (_, i) => ({
        time: base.add(Decimal('1e-20').mul(i)),
        value: base.add(Decimal('1e-10').mul(i)),
      })),
    );
    const request = createChunk({
      id: 'tiny',
      seq: 0n,
      zoom: 0,
      range: [base.add('4e-20'), base.add('6e-20')],
      resolution: Decimal('1e-30'),
    });
    expect(serialize(new TimescopeSegmentSeriesIndex(rows).query(request))).toEqual(
      serialize(new TimescopeAggregateSeriesIndex(rows).query(request)),
    );
  });
});
