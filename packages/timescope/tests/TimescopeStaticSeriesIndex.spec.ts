import { createChunk, createChunkList } from '#src/core/chunk';
import { Decimal } from '#src/core/decimal';
import { TimescopeStaticSeriesIndex } from '#src/main/reducers/TimescopeStaticSeriesIndex';
import { TimescopeDataSeries, type TimescopeSeriesPoint } from '#src/main/TimescopeDataSeries';
import { chunkStoreForDataSource, createDataSource } from '#src/main/TimescopeDataSource';
import { TimescopeDomain } from '#src/main/TimescopeDomain';
import { TimescopeViewRegistry } from '#src/main/TimescopeView';
import { describe, expect, it, vi } from 'vitest';

function point(time: number, value: number): TimescopeSeriesPoint {
  const t = Decimal(time);
  return {
    times: { time: t },
    values: { value: Decimal(value) },
    data: { time, value },
    range: [t, t, '[]'],
  };
}

function chunk(start: number, end: number, resolution: number) {
  return createChunk({
    id: `test:${start}:${end}:${resolution}`,
    seq: 0n,
    range: [Decimal(start), Decimal(end)],
    resolution: Decimal(resolution),
    zoom: 0,
  });
}

describe('static series index', () => {
  it('generates exact aggregate fields and R-7 percentiles', () => {
    const index = new TimescopeStaticSeriesIndex(
      Array.from({ length: 100 }, (_, index) => point(index, index + 1)),
      true,
    );

    const rows = index.query(chunk(0, 100, 100));
    expect(rows).toHaveLength(1);
    expect(rows[0].times.time.eq(50)).toBe(true);
    expect(rows[0].range[0].eq(0)).toBe(true);
    expect(rows[0].range[1].eq(100)).toBe(true);
    expect(rows[0].values.value?.eq('50.5')).toBe(true);
    expect(rows[0].values['value#first']?.eq(1)).toBe(true);
    expect(rows[0].values['value#last']?.eq(100)).toBe(true);
    expect(rows[0].values['value#min']?.eq(1)).toBe(true);
    expect(rows[0].values['value#max']?.eq(100)).toBe(true);
    expect(rows[0].values['value#p50']?.eq('50.5')).toBe(true);
    expect(rows[0].values['value#p90']?.eq('90.1')).toBe(true);
    expect(rows[0].values['value#p95']?.eq('95.05')).toBe(true);
    expect(rows[0].data).toBeUndefined();
  });

  it('preserves singleton time and exposes every aggregate alias', () => {
    const source = point(2, 7);
    const rows = new TimescopeStaticSeriesIndex([source], true).query(chunk(0, 10, 1));

    expect(rows).toHaveLength(1);
    expect(rows[0].times).toBe(source.times);
    for (const suffix of ['first', 'last', 'min', 'max', 'p50', 'p90', 'p95']) {
      expect(rows[0].values[`value#${suffix}`]?.eq(7)).toBe(true);
    }
    expect(rows[0].values).not.toHaveProperty('value#avg');
  });

  it('returns two aggregate buckets of context on each side', () => {
    const index = new TimescopeStaticSeriesIndex(
      [point(-1.5, -3), point(-0.5, -1), point(0.2, 1), point(0.8, 3), point(1.2, 5), point(2.2, 7), point(3.2, 9)],
      true,
    );

    const rows = index.query(chunk(0, 2, 1));
    expect(rows.map((row) => row.range[0].number())).toEqual([-1.5, -0.5, 0, 1.2, 2.2, 3.2]);
    expect(rows[2].values.value?.eq(2)).toBe(true);
  });

  it('returns two raw context rows on each side', () => {
    const points = [-2, -1, 0.5, 1.5, 2, 3].map((time) => point(time, time));

    expect(new TimescopeStaticSeriesIndex(points).query(chunk(0, 2, 1))).toEqual(points);
  });

  it('ignores null values while retaining zero in aggregate statistics', () => {
    const points = [point(0, 0), point(2, 10)];
    points.splice(1, 0, {
      times: { time: Decimal(1) },
      values: { value: null },
      data: {},
      range: [Decimal(1), Decimal(1), '[]'],
    });

    const [row] = new TimescopeStaticSeriesIndex(points, true).query(chunk(0, 3, 3));
    expect(row.values.value?.eq(5)).toBe(true);
    expect(row.values['value#first']?.eq(0)).toBe(true);
    expect(row.values['value#last']?.eq(10)).toBe(true);
    expect(row.values['value#p50']?.eq(5)).toBe(true);
  });

  it('keeps interval rows raw while selecting the requested range and context', () => {
    const interval = (start: number, end: number, value: number): TimescopeSeriesPoint => ({
      times: { start: Decimal(start), end: Decimal(end) },
      values: { value: Decimal(value) },
      data: {},
      range: [Decimal(start), Decimal(end), '[)'],
    });
    const points = [
      interval(-4, -3, -2),
      interval(-2, -1, -1),
      interval(0, 3, 1),
      interval(4, 5, 2),
      interval(6, 7, 3),
    ];

    const rows = new TimescopeStaticSeriesIndex(points).query(chunk(1, 2, 1));
    expect(rows).toEqual(points);
    expect(rows[1].values).not.toHaveProperty('value#avg');
  });

  it('retains context whose local coordinate exceeds the safe integer range', () => {
    const resolution = Decimal('1e-300');
    const nearTime = resolution.mul('0.5');
    const near: TimescopeSeriesPoint = {
      times: { time: nearTime },
      values: { value: Decimal(1) },
      data: {},
      range: [nearTime, nearTime, '[]'],
    };
    const far = point(-1e100, 0);

    const rows = new TimescopeStaticSeriesIndex([far, near], true).query(
      createChunk({
        id: 'extreme',
        seq: 0n,
        range: [Decimal(0), resolution],
        resolution,
        zoom: 0,
      }),
    );

    expect(rows).toHaveLength(2);
    expect(rows[0].times.time.eq(far.times.time)).toBe(true);
    expect(rows[1].times.time.sub(0).div(resolution, 3).number()).toBe(0.5);
  });

  it('indexes a large source once and keeps loaded tiles proportional to the view', async () => {
    const count = 100_000;
    const timeAccessor = vi.fn((row: Record<string, any>) => row.time as number);
    const parser = vi.fn((rows: unknown) => rows as { time: number; value: number }[]);
    const sourceParser = vi.fn((rows: unknown) => rows as { time: number; value: number }[]);
    const source = createDataSource({
      data: Array.from({ length: count }, (_, index) => ({ time: index / 10, value: index })),
      chunkSize: 32,
      decoder: (data: unknown) => sourceParser(data) as { time: number; value: number }[],
      reducer: 'min-max-avg',
    });
    const series = new TimescopeDataSeries({
      sources: { source },
      domain: new TimescopeDomain(),
      options: {
        data: {
          source: 'source',
        },
        chart: 'lines',
      },
    });
    const loadView = async (start: number, end: number) => {
      const range = [Decimal(start), Decimal(end)] as [Decimal, Decimal];
      const descriptors = createChunkList(range, Decimal(1), series.chunkSize, series.chunkOffset).filter(
        (descriptor) => descriptor.range[0]!.lt(range[1]) && descriptor.range[1]!.gt(range[0]),
      );
      const store = chunkStoreForDataSource(series.source);
      return Promise.all(descriptors.map((descriptor) => store.loadChunk(descriptor)));
    };

    const firstChunks = await loadView(0, 32);

    expect(parser).not.toHaveBeenCalled();
    expect(sourceParser).toHaveBeenCalledOnce();
    expect(timeAccessor).not.toHaveBeenCalled();
    expect(firstChunks.flatMap((loaded) => loaded.data ?? []).length).toBeLessThanOrEqual(36);

    const secondChunks = await loadView(64, 96);
    expect(parser).not.toHaveBeenCalled();
    expect(sourceParser).toHaveBeenCalledOnce();
    expect(timeAccessor).not.toHaveBeenCalled();

    source.invalidate();
    const refreshedChunks = await loadView(64, 96);
    expect(refreshedChunks[0]).not.toBe(secondChunks[0]);
    expect(sourceParser).toHaveBeenCalledOnce();
    expect(timeAccessor).not.toHaveBeenCalled();
    series.dispose();
  });
});
