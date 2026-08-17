import { createChunk } from '#src/core/chunk';
import { Decimal } from '#src/core/decimal';
import { createDataSource, TimescopeDataSourceBase, type TimescopeDataSource } from '#src/main/TimescopeDataSource';
import { TimescopeChunkStore } from '#src/main/TimescopeChunkStore';
import { describe, expect, it, vi } from 'vitest';

function chunk(start: number, end: number, resolution: number, id = `${start}:${end}:${resolution}`) {
  return createChunk({
    id,
    seq: 0n,
    range: [Decimal(start), Decimal(end)],
    resolution: Decimal(resolution),
    zoom: 0,
  });
}

const context = { expiresAt() {}, expiresIn() {} };

describe('createDataSource', () => {
  it('passes structural source instances through by identity', () => {
    class Source extends TimescopeDataSourceBase<{ time: number; value: number }> {
      async query() {
        return [];
      }
    }
    const source: TimescopeDataSource = new Source();
    expect(createDataSource(source)).toBe(source);
  });

  it('classifies data and plain URLs as snapshots and template URLs as chunked', async () => {
    const fetchMock = vi.fn(async (url: string) => new Response(JSON.stringify([{ time: 1, value: url.length }])));
    vi.stubGlobal('fetch', fetchMock);
    const data = createDataSource({ data: [{ time: 1, value: 2 }] });
    const plain = createDataSource({ url: '/all.json' });
    const template = createDataSource('/data/{start}/{end}.json');

    await data.query(chunk(0, 10, 1), context);
    await data.query(chunk(10, 20, 1), context);
    const plainRows = await plain.query(chunk(0, 10, 1), context);
    await plain.query(chunk(10, 20, 1), context);
    await template.query(chunk(0, 10, 1), context);
    await template.query(chunk(10, 20, 1), context);

    expect(plainRows[0].values).not.toHaveProperty('value#avg');
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(['/all.json', '/data/0/10.json', '/data/10/20.json']);
    vi.unstubAllGlobals();
  });

  it('defaults loaders to chunked and supports acquire-once snapshot loaders', async () => {
    const chunkedLoader = vi.fn(async () => [{ time: 1, value: 2 }]);
    const snapshotLoader = vi.fn(async () => [
      { time: 1, value: 2 },
      { time: 11, value: 4 },
    ]);
    const chunked = createDataSource({ loader: chunkedLoader });
    const snapshot = createDataSource({ loader: snapshotLoader, chunked: false });

    await chunked.query(chunk(0, 10, 1), context);
    await chunked.query(chunk(0, 10, 1), context);
    expect(chunkedLoader).toHaveBeenCalledTimes(2);
    expect(await snapshot.query(chunk(0, 10, 1), context)).toHaveLength(2);
    expect(await snapshot.query(chunk(10, 20, 1), context)).toHaveLength(2);
    expect((await snapshot.query(chunk(0, 20, 20), context))[0].values).not.toHaveProperty('value#avg');
    expect(snapshotLoader).toHaveBeenCalledOnce();
  });

  it('uses raw rows by default and only reduces snapshots when requested', async () => {
    const input = [
      { time: 1, value: 2 },
      { time: 2, value: 4 },
    ];
    const defaultSource = createDataSource({ data: input });
    const reduced = createDataSource({ data: input, reducer: 'min-max-avg' });
    const raw = createDataSource({ data: input, reducer: 'null' });

    const [aggregate] = await reduced.query(chunk(0, 10, 10), context);
    expect(aggregate.values.value?.eq(3)).toBe(true);
    expect(aggregate.values['value#avg']?.eq(3)).toBe(true);
    expect(aggregate.values['value#min']?.eq(2)).toBe(true);
    expect(await defaultSource.query(chunk(0, 10, 10), context)).toHaveLength(2);
    expect(await raw.query(chunk(0, 10, 10), context)).toHaveLength(2);
    expect(() => createDataSource({ data: input, reducer: null } as never)).toThrow("reducer: 'null'");
    expect(() => createDataSource({ data: input, reducer: ['null'] } as never)).toThrow("reducer: 'null'");
  });

  it('supports percentile snapshots and forbids reducers on chunked sources', async () => {
    const source = createDataSource({
      data: Array.from({ length: 100 }, (_, index) => ({ time: index, value: index + 1 })),
      reducer: { type: 'percentiles', values: [0.95], primary: 0.95 },
    });
    const [row] = await source.query(chunk(0, 100, 100), context);
    expect(row.values['value#p95']?.eq('95.05')).toBe(true);
    expect(row.values.value?.eq('95.05')).toBe(true);
    expect(row.values).not.toHaveProperty('value#p50');
    expect(() => createDataSource({ loader: async () => [], reducer: 'min-max-avg' } as never)).toThrow(
      'Chunked sources cannot specify a reducer',
    );
  });

  it('mutates data snapshots and emits conservative ranged invalidation', async () => {
    const source = createDataSource({ data: [{ time: 1, value: 1 }] });
    const invalidations: unknown[] = [];
    const changed = vi.fn();
    source.on('invalidate', (event) => invalidations.push(event.value));
    source.on('change', changed);

    await source.append([{ time: 5, value: 5 }]);
    await source.replace([0, 2], [{ time: 1.5, value: 2 }]);

    const rows = await source.query(chunk(0, 10, 1), context);
    expect(rows.flatMap((row) => Object.values(row.values)).some((value) => value?.eq(5))).toBe(true);
    await vi.waitFor(() => expect(invalidations).toHaveLength(2));
    expect(changed).toHaveBeenCalledTimes(2);
    expect(source.revision).toBe(2);
    expect(
      (invalidations[1] as { range: [Decimal | undefined, Decimal | undefined] }).range.map((value) => value?.number()),
    ).toEqual([undefined, 5]);
  });

  it('tracks point context independently from nearer interval rows', async () => {
    const source = createDataSource({
      data: [
        { times: { start: 5, end: 6 }, value: 1 },
        { time: 20, value: 2 },
      ],
    });
    let invalidation: { range?: [Decimal | undefined, Decimal | undefined] } | undefined;
    source.on('invalidate', (event) => (invalidation = event.value));

    await source.append({ time: 10, value: 3 });
    await vi.waitFor(() => expect(invalidation).toBeDefined());

    expect(invalidation!.range!.map((value) => value?.number())).toEqual([undefined, 20]);
  });

  it('keeps the newest snapshot when invalidated acquisitions resolve out of order', async () => {
    const requests: ((rows: { time: number; value: number }[]) => void)[] = [];
    const source = createDataSource({
      loader: () => new Promise((resolve) => requests.push(resolve)),
      chunked: false,
      reducer: 'null',
    });
    const stale = source.query(chunk(0, 10, 1), context);
    await vi.waitFor(() => expect(requests).toHaveLength(1));
    source.invalidate();
    const fresh = source.query(chunk(0, 10, 1), context);
    await vi.waitFor(() => expect(requests).toHaveLength(2));

    requests[1]([{ time: 2, value: 2 }]);
    expect((await fresh).some((row) => row.values.value?.eq(2))).toBe(true);
    requests[0]([{ time: 1, value: 1 }]);
    await expect(stale).rejects.toThrow('Stale snapshot acquisition');
    expect((await source.query(chunk(0, 10, 1), context)).some((row) => row.values.value?.eq(2))).toBe(true);
  });

  it('rejects stale in-flight runtime results after source revision changes', async () => {
    let resolve!: (rows: { time: number; value: number }[]) => void;
    const source = createDataSource({ loader: () => new Promise((done) => (resolve = done)) });
    const runtime = new TimescopeChunkStore(source);
    const pending = runtime.loadChunk(chunk(0, 10, 1));
    source.invalidate([Decimal(0), Decimal(10)]);
    resolve([{ time: 1, value: 1 }]);
    await expect(pending).rejects.toThrow('Stale source result');
  });

  it('peeks resolved runtime chunks without triggering a source load', async () => {
    const loader = vi.fn(async () => [{ time: 1, value: 2 }]);
    const source = createDataSource({ loader });
    const runtime = new TimescopeChunkStore(source);
    const descriptor = chunk(0, 10, 1);

    expect(runtime.peekChunk(descriptor)).toBeUndefined();
    expect(loader).not.toHaveBeenCalled();

    const loaded = await runtime.loadChunk(descriptor);
    expect(runtime.peekChunk(descriptor)).toBe(loaded);
    expect(loader).toHaveBeenCalledOnce();

    source.invalidate();
    expect(runtime.peekChunk(descriptor)).toBeUndefined();
    expect(loader).toHaveBeenCalledOnce();
  });

  it('invalidates the full runtime cache when synchronous revisions skip ahead', async () => {
    const loader = vi.fn(async (descriptor) => [{ time: descriptor.range[0]!, value: 1 }]);
    const source = createDataSource({ loader });
    const runtime = new TimescopeChunkStore(source);
    const first = chunk(0, 10, 1);
    const second = chunk(20, 30, 1);
    await runtime.loadChunk(first);
    await runtime.loadChunk(second);

    source.invalidate([Decimal(0), Decimal(10)]);
    source.invalidate([Decimal(20), Decimal(30)]);
    await runtime.loadChunk(first);
    await runtime.loadChunk(second);

    expect(loader).toHaveBeenCalledTimes(4);
  });

  it('keeps nonintersecting chunks synchronously available after ranged invalidation', async () => {
    const loader = vi.fn(async (descriptor) => [{ time: descriptor.range[0]!, value: 1 }]);
    const source = createDataSource({ loader });
    const runtime = new TimescopeChunkStore(source);
    const affected = chunk(0, 10, 1);
    const unaffected = chunk(20, 30, 1);
    await runtime.loadChunk(affected);
    const loaded = await runtime.loadChunk(unaffected);

    source.invalidate([Decimal(0), Decimal(10)]);

    expect(runtime.peekChunk(affected)).toBeUndefined();
    expect(runtime.peekChunk(unaffected)).toBe(loaded);
  });

  it('rejects multiple acquisition and transform options', () => {
    expect(() => createDataSource({ data: [], url: '/data.json' } as never)).toThrow(
      'A source must specify exactly one',
    );
    expect(() =>
      createDataSource({ data: [], decoder: () => [], mappings: { times: {}, values: {} } } as never),
    ).toThrow('A decoder cannot be combined with mappings');
  });
});
