import { Decimal } from '#src/core/decimal';
import { createDataLoader } from '#src/main/TimescopeDataLoader';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => vi.unstubAllGlobals());

describe('acquisition without chunk ownership', () => {
  it('loads arbitrary ranges and resolutions without caching or adding chunk metadata', async () => {
    const acquire = vi.fn(async () => [{ time: 1, value: 2 }]);
    const loader = createDataLoader({ loader: acquire });
    const request = { range: [Decimal('0.13'), Decimal('2.78')] as [Decimal, Decimal], resolution: Decimal('0.07') };
    const [first, second] = await Promise.all([loader.load(request), loader.load(request)]);
    expect(acquire).toHaveBeenCalledTimes(2);
    expect(acquire).toHaveBeenCalledWith(request);
    expect(first).not.toBe(second);
    expect(first[0].values.value?.number()).toBe(2);
  });

  it('decodes responses and maps snapshots on every explicit load', async () => {
    let value = 1;
    const loader = createDataLoader({
      loader: () => new Response(JSON.stringify([{ t: 0, v: value++ }])),
      chunked: false,
      mappings: { times: { time: 't' }, values: { value: 'v' } },
    });
    expect((await loader.load())[0].values.value?.number()).toBe(1);
    expect((await loader.load())[0].values.value?.number()).toBe(2);
    expect(loader.ranged).toBe(false);
  });

  it('supports reusable normalized loaders without normalizing rows twice', async () => {
    const inner = createDataLoader({ data: [{ times: { start: 0, end: 10 }, value: 2, data: { label: 'event' } }] });
    const outer = createDataLoader({ loader: inner, chunked: false });
    const [row] = await outer.load();
    expect(row.range.map(String).slice(0, 2)).toEqual(['0', '10']);
    expect(row.data).toEqual({ label: 'event' });
  });

  it('resolves URL templates from acquisition conditions', async () => {
    const fetcher = vi.fn(async () => new Response('[]'));
    vi.stubGlobal('fetch', fetcher);
    const loader = createDataLoader({ url: '/{zoom}/{start}/{end}/{resolution}' });
    await loader.load({ range: [Decimal('1.5'), Decimal('7.3')], resolution: Decimal('0.25') });
    expect(fetcher).toHaveBeenCalledWith('/2/1.5/7.3/0.25');
  });

  it('allows retry after failed acquisition and decode', async () => {
    const decoder = vi
      .fn()
      .mockRejectedValueOnce(new Error('decode'))
      .mockResolvedValue([{ time: 0, value: 3 }]);
    const loader = createDataLoader({ data: {}, decoder });
    await expect(loader.load()).rejects.toThrow('decode');
    expect((await loader.load())[0].values.value?.number()).toBe(3);
  });
});
