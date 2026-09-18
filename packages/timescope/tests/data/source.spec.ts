import { createChunk } from '#src/core/chunk';
import { Decimal } from '#src/core/decimal';
import { createDataLoader, type TimescopeLoadRequest } from '#src/main/TimescopeDataLoader';
import {
  createDataSource,
  chunkStoreForDataSource,
  TimescopeDataSourceBase,
  type TimescopeDataSourceQuery,
} from '#src/main/TimescopeDataSource';
import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { deferred } from '../helpers/deferred';

afterEach(() => vi.unstubAllGlobals());
function chunk(start: number, end: number, resolution = 1, id = `${start}:${end}:${resolution}`) {
  return createChunk({ id, seq: 0n, range: [Decimal(start), Decimal(end)], resolution: Decimal(resolution), zoom: 0 });
}
function request(start: number, end: number, resolution = 1): TimescopeDataSourceQuery {
  return { range: [Decimal(start), Decimal(end)], resolution: Decimal(resolution) };
}

describe('data sources', () => {
  it('passes custom sources through by identity', () => {
    class Source extends TimescopeDataSourceBase {
      async query() {
        return [];
      }
    }
    const source = new Source();
    expect(createDataSource(source)).toBe(source);
  });

  it('shares snapshot acquisition but acquires each range query, without mutation methods', async () => {
    const snapshot = vi.fn(async () => [{ time: 1, value: 2 }]);
    const range = vi.fn(async () => [{ time: 1, value: 3 }]);
    const a = createDataSource({ loader: snapshot, chunked: false });
    const b = createDataSource({ loader: range });
    expectTypeOf(a).not.toHaveProperty('append');
    expectTypeOf(a).not.toHaveProperty('replace');
    expect(a).not.toHaveProperty('append');
    expect(a).not.toHaveProperty('replace');
    await a.query(request(0, 10));
    await a.query(request(10, 20));
    await Promise.all([b.query(request(0, 10)), b.query(request(0, 10))]);
    expect(snapshot).toHaveBeenCalledOnce();
    expect(range).toHaveBeenCalledTimes(2);
    expect(Object.keys(range.mock.calls[0])).toHaveLength(1);
  });

  it('finds long overlapping intervals and preserves raw point values', async () => {
    const source = createDataSource({
      data: [
        { times: { start: -1000, end: 1000 }, value: 999 },
        ...Array.from({ length: 100 }, (_, time) => ({ time, value: time })),
        { times: { start: 40, end: 60 }, value: 777 },
      ],
    });
    const rows = await source.query(request(50, 51));
    expect(rows.some((row) => row.values.value?.eq(999))).toBe(true);
    expect(rows.some((row) => row.values.value?.eq(777))).toBe(true);
    expect(rows.some((row) => row.times.time?.eq(50))).toBe(true);
    expect(rows.every((row) => !('value#avg' in row.values))).toBe(true);
    expect(rows.length).toBeLessThan(10);
  });

  it('exposes tiling hints without restricting arbitrary range/resolution queries', async () => {
    const acquire = vi.fn(async () => []);
    const range = createDataSource({ loader: acquire, resolutions: [1, 10], chunkOrigin: 3, chunkSize: 8 });
    const snapshot = createDataSource({ data: [], resolutions: [1, 10] });
    const aggregate = createDataSource({ type: 'point-aggregate', data: [], resolutions: [1, 10] });
    expect(range.resolutions?.map(Number)).toEqual([1, 10]);
    expect(range.chunkOrigin.number()).toBe(3);
    expect(range.chunkSize).toBe(8);
    expect(snapshot.resolutions).toBeUndefined();
    expect(aggregate.resolutions).toBeUndefined();
    await expect(range.query(request(0.13, 10.27, 2))).resolves.toEqual([]);
    expect(acquire).toHaveBeenCalledWith(request(0.13, 10.27, 2));
    await expect(snapshot.query(request(0, 10, 2))).resolves.toEqual([]);
  });

  it('caches only through the shared display store, and strips chunk identity from source queries', async () => {
    const acquire = vi.fn(async () => [{ time: 1, value: 2 }]);
    const loader = createDataLoader({ loader: acquire });
    const source = createDataSource({ loader });
    const target = chunk(0, 10);
    const store = chunkStoreForDataSource(source);
    const query = vi.spyOn(source, 'query');
    const [a, b] = await Promise.all([store.loadChunk(target), store.loadChunk(target)]);
    expect(a).toBe(b);
    expect(query).toHaveBeenCalledExactlyOnceWith(request(0, 10));
    const rows = await source.query(request(0, 10));
    expect(rows).not.toBe(a.data);
    expect(acquire).toHaveBeenCalledTimes(2);
    expect(store.peekChunk(target)).toBe(a);
    expect(source).not.toHaveProperty('chunkStore');
    source.invalidate([0, 10]);
    expect(store.peekChunk(target)).toBeUndefined();
    await store.loadChunk(target);
    expect(acquire).toHaveBeenCalledTimes(3);
  });

  it('invalidates the live tail across resolutions while retaining historical chunks', async () => {
    const acquire = vi.fn(async (request: TimescopeLoadRequest) => [{ time: request.range[0], value: 1 }]);
    const source = createDataSource({ loader: acquire });
    const store = chunkStoreForDataSource(source);
    const old = chunk(0, 10);
    const fine = chunk(20, 30);
    const coarse = chunk(0, 100, 10);
    const historical = await store.loadChunk(old);
    await store.loadChunk(fine);
    await store.loadChunk(coarse);
    source.invalidate([25, undefined]);
    expect(await store.loadChunk(old)).toBe(historical);
    await store.loadChunk(fine);
    await store.loadChunk(coarse);
    expect(acquire).toHaveBeenCalledTimes(5);
  });

  it('performs repeated direct acquisitions without retaining their results', async () => {
    const acquire = vi.fn(async (request: TimescopeLoadRequest) => [
      { time: request.range[0], value: request.resolution },
    ]);
    const source = createDataSource({ loader: acquire });
    const a = await source.query(request(0, 10));
    const b = await source.query(request(20, 30));
    const c = await source.query(request(20, 30, 2));
    expect(a[0].times.time.number()).toBe(0);
    expect(b[0].times.time.number()).toBe(20);
    expect(c[0].values.value?.number()).toBe(2);
    await source.query(request(0, 10));
    expect(acquire).toHaveBeenCalledTimes(4);
  });

  it('rejects affected in-flight loads but preserves unrelated in-flight loads', async () => {
    const pending = new Map<string, ReturnType<typeof deferred<{ time: number; value: number }[]>>>();
    const source = createDataSource({
      loader: (request) => {
        const result = deferred<{ time: number; value: number }[]>();
        pending.set(String(request.range[0]), result);
        return result.promise;
      },
    });
    const store = chunkStoreForDataSource(source);
    const affected = store.loadChunk(chunk(0, 10));
    const unaffected = store.loadChunk(chunk(20, 30));
    const rejected = expect(affected).rejects.toThrow('Stale');
    source.invalidate([0, 10]);
    pending.get('0')!.resolve([{ time: 1, value: 1 }]);
    pending.get('20')!.resolve([{ time: 21, value: 2 }]);
    await rejected;
    expect((await unaffected).data![0].values.value?.number()).toBe(2);
  });

  it('reacquires a snapshot once and rejects stale results after invalidation', async () => {
    const first = deferred<{ time: number; value: number }[]>();
    const second = deferred<{ time: number; value: number }[]>();
    const acquire = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const source = createDataSource({ loader: acquire, chunked: false });
    const stale = source.query(request(0, 10));
    const rejected = expect(stale).rejects.toThrow('Stale');
    source.invalidate([5, undefined]);
    const fresh = source.query(request(0, 10));
    second.resolve([{ time: 2, value: 2 }]);
    expect((await fresh)[0].values.value?.number()).toBe(2);
    first.resolve([{ time: 1, value: 1 }]);
    await rejected;
    expect((await source.query(request(10, 20)))[0].values.value?.number()).toBe(2);
    expect(acquire).toHaveBeenCalledTimes(2);
  });

  it('retries failed snapshots and releases pending loads on disposal', async () => {
    const pending = deferred<{ time: number; value: number }[]>();
    const acquire = vi.fn().mockRejectedValueOnce(new Error('network')).mockReturnValueOnce(pending.promise);
    const source = createDataSource({ loader: acquire, chunked: false });
    await expect(source.query(request(0, 10))).rejects.toThrow('network');
    const result = source.query(request(0, 10));
    const rejected = expect(result).rejects.toThrow();
    source.dispose?.();
    pending.resolve([{ time: 1, value: 1 }]);
    await rejected;
    await expect(source.query(request(0, 10))).rejects.toThrow('disposed');
  });

  it('evicts query results without discarding the snapshot index', async () => {
    const acquire = vi.fn(async () => [{ time: 1, value: 2 }]);
    const source = createDataSource({ loader: acquire, chunked: false, cacheSize: 1 });
    const store = chunkStoreForDataSource(source);
    await store.loadChunk(chunk(0, 10));
    await store.loadChunk(chunk(20, 30));
    expect(store.peekChunk(chunk(0, 10))).toBeUndefined();
    await store.loadChunk(chunk(0, 10));
    expect(acquire).toHaveBeenCalledOnce();
  });

  it('retains appended points until explicit invalidation reloads the whole snapshot', async () => {
    const source = createDataSource({
      type: 'point-aggregate',
      data: [0, 10, 20, 30].map((time) => ({ time, value: time })),
    });
    const store = chunkStoreForDataSource(source);
    const old = chunk(0, 5);
    const tail = chunk(25, 35);
    const historical = await store.loadChunk(old);
    await store.loadChunk(tail);
    await source.append({ time: 40, value: 40 });
    expect(store.peekChunk(old)).toBe(historical);
    expect(store.peekChunk(tail)).toBeUndefined();
    expect((await store.loadChunk(tail)).data!.some((row) => row.times.time.eq(40))).toBe(true);
    source.invalidate([40, undefined]);
    expect(source.invalidation?.range).toBeUndefined();
    expect(store.peekChunk(old)).toBeUndefined();
    expect((await store.loadChunk(tail)).data!.some((row) => row.times.time.eq(40))).toBe(false);
    expect(source).not.toHaveProperty('replace');
  });

  it('selects a configured percentile as the primary output', async () => {
    const source = createDataSource({
      type: 'point-percentile',
      data: Array.from({ length: 100 }, (_, time) => ({ time, value: time + 1 })),
      percentiles: { values: [0.95], primary: 0.95 },
    });
    const [row] = await source.query(request(0, 100, 100));
    expect(row.values.value?.eq('95.05')).toBe(true);
    expect(row.values).not.toHaveProperty('value#p50');
  });

  it.each(['point-aggregate', 'point-percentile'] as const)(
    'anchors %s buckets to the origin for arbitrary ranges',
    async (type) => {
      const data = Array.from({ length: 20 }, (_, i) => ({ time: -1 + i * 0.25, value: i }));
      const source =
        type === 'point-aggregate'
          ? createDataSource({ type, data, chunkOrigin: 0.25 })
          : createDataSource({ type, data, chunkOrigin: 0.25 });
      const first = await source.query(request(0.3, 2.7, 1));
      const shifted = await source.query(request(0.6, 2.9, 1));
      expect(first).toEqual(shifted);
      const bucket = first.find((row) => row.range[0].eq(0.25))!;
      expect(bucket.range[1].eq(1.25)).toBe(true);
      expect(bucket.times.time.eq(0.75)).toBe(true);
      expect(bucket.values.value?.number()).toBe(6.5);
      // A very narrow request still returns the entire intersecting bucket, not a partial average/percentile.
      const narrow = await source.query(request(0.8, 0.81, 1));
      expect(narrow.find((row) => row.range[0].eq(0.25))).toEqual(bucket);
    },
  );

  it.each(['simple', 'point-aggregate', 'point-percentile'] as const)(
    'validates arbitrary %s queries',
    async (type) => {
      const source =
        type === 'point-aggregate'
          ? createDataSource({ type, data: [] })
          : type === 'point-percentile'
            ? createDataSource({ type, data: [] })
            : createDataSource({ data: [] });
      await expect(source.query(request(2, 1))).rejects.toThrow('ordered');
      await expect(source.query(request(0, 1, 0))).rejects.toThrow('positive');
    },
  );

  it.each([
    { data: [], url: '/all' },
    { data: [], decoder: () => [], mappings: { times: {}, values: {} } },
    { loader: async () => [], type: 'point-aggregate' },
    { url: '/{start}', type: 'point-percentile' },
    { data: [], type: 'invalid' },
    { data: [], reducer: 'null' },
  ])('rejects incompatible options %j', (options) => {
    expect(() => createDataSource(options as never)).toThrow();
  });
});
