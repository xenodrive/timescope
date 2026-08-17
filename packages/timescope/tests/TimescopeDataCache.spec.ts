import { Decimal, type DecimalInstance } from '@kikuchan/decimal';
import { describe, expect, it, vi } from 'vitest';
import {
  TimescopeDataCache,
  type TimescopeDataCacheFrameView,
  type TimescopeDataCacheOptions,
} from '../src/worker/TimescopeDataCache';
import type { TimescopeRenderingContext } from '../src/worker/types';

type Data = { id: string };
type LoadRequest = Parameters<TimescopeDataCacheOptions<Data>['loader']>[0];

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function renderingContext({
  editing = false,
  animating = false,
  time = Decimal(10),
  resolution = Decimal(2),
  range = [Decimal(0), Decimal(20)],
  candidateRange = range,
  committingTime = time,
  cursorTime = time,
}: {
  editing?: boolean;
  animating?: boolean;
  time?: DecimalInstance | null;
  resolution?: DecimalInstance;
  range?: [DecimalInstance, DecimalInstance];
  candidateRange?: [DecimalInstance, DecimalInstance];
  committingTime?: DecimalInstance | null;
  cursorTime?: DecimalInstance | null;
} = {}) {
  return {
    timeAxis: {
      editing,
      animating,
      value: { time },
      current: { resolution, range },
      candidate: { time, zoom: { number: () => 0 }, resolution, range: candidateRange },
      committing: { time: committingTime, resolution },
      cursor: { time: cursorTime },
      now: Decimal(30),
    },
  } as unknown as TimescopeRenderingContext;
}

function frameView(): TimescopeDataCacheFrameView {
  return {
    time: Decimal(10),
    playbackTime: Decimal(10),
    zoom: 0,
    resolution: Decimal(2),
    range: [Decimal(0), Decimal(20)],
    currentRange: [Decimal(0), Decimal(20)],
  } as unknown as TimescopeDataCacheFrameView;
}

describe('TimescopeDataCache', () => {
  it('publishes an in-flight response before loading the latest coalesced update', async () => {
    const first = deferred<Data>();
    const latest = deferred<Data>();
    const loader = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(latest.promise);
    const cache = new TimescopeDataCache({ name: 'cache', loader });
    const latestRange: [DecimalInstance, DecimalInstance] = [Decimal(40), Decimal(60)];

    cache.invalidate();
    cache.update(renderingContext({ range: [Decimal(0), Decimal(20)] }));
    cache.invalidate();
    cache.update(renderingContext({ range: [Decimal(20), Decimal(40)] }));
    cache.invalidate();
    cache.update(renderingContext({ range: latestRange }));

    await vi.waitFor(() => expect(loader).toHaveBeenCalledOnce());
    first.resolve({ id: 'old' });
    await vi.waitFor(() => expect(loader).toHaveBeenCalledTimes(2));
    expect(cache.data).toEqual({ id: 'old' });
    const request = loader.mock.calls[1]![0] as LoadRequest;
    expect(request.range.every((value, index) => value.eq(latestRange[index]))).toBe(true);

    latest.resolve({ id: 'latest' });
    await vi.waitFor(() => expect(cache.data).toEqual({ id: 'latest' }));
    expect(cache.data).toEqual({ id: 'latest' });
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('keeps active data and rejects an in-flight response superseded by reset', async () => {
    const pending = deferred<Data>();
    const cache = new TimescopeDataCache({
      name: 'cache',
      loader: vi.fn().mockResolvedValueOnce({ id: 'active' }).mockReturnValueOnce(pending.promise),
    });

    cache.invalidate();
    await cache.prepare({
      time: Decimal(10),
      zoom: 0,
      range: [Decimal(0), Decimal(20)],
      xOrigin: Decimal(0),
      resolution: Decimal(1),
    });
    cache.invalidate();
    cache.update(renderingContext());
    await vi.waitFor(() => expect(cache.data).toEqual({ id: 'active' }));
    cache.reset();
    pending.resolve({ id: 'stale' });
    await Promise.resolve();
    await Promise.resolve();

    expect(cache.data).toEqual({ id: 'active' });
  });

  it('updates an immediate cache while editing or animating and defers a non-immediate cache', async () => {
    const immediateLoader = vi.fn(async () => ({ id: 'immediate' }));
    const deferredLoader = vi.fn(async () => ({ id: 'deferred' }));
    const immediate = new TimescopeDataCache({ name: 'immediate', loader: immediateLoader, immediate: true });
    const deferred = new TimescopeDataCache({ name: 'deferred', loader: deferredLoader });
    const context = renderingContext({ editing: true });

    immediate.invalidate();
    deferred.invalidate();
    immediate.update(context);
    deferred.update(context);

    await vi.waitFor(() => expect(immediate.data).toEqual({ id: 'immediate' }));
    expect(immediateLoader).toHaveBeenCalledOnce();
    expect(deferredLoader).not.toHaveBeenCalled();

    immediate.invalidate();
    immediate.update(renderingContext({ animating: true }));
    deferred.update(renderingContext({ animating: true }));
    await vi.waitFor(() => expect(immediateLoader).toHaveBeenCalledTimes(2));
    expect(deferredLoader).not.toHaveBeenCalled();

    deferred.update(renderingContext());
    await vi.waitFor(() => expect(deferred.data).toEqual({ id: 'deferred' }));
  });

  it('loads transition coverage for an immediate cache without changing its resolution', async () => {
    const loader = vi.fn(async (_request: LoadRequest) => ({ id: 'transition' }));
    const cache = new TimescopeDataCache({ name: 'immediate', loader, immediate: true });
    const resolution = Decimal('0.25');

    cache.invalidate();
    cache.update(
      renderingContext({
        animating: true,
        resolution,
        range: [Decimal(0), Decimal(20)],
        candidateRange: [Decimal(40), Decimal(60)],
      }),
    );

    await vi.waitFor(() => expect(loader).toHaveBeenCalledOnce());
    const request = loader.mock.calls[0]![0];
    expect(request.range).toEqual([Decimal(0), Decimal(60)]);
    expect(request.xOrigin).toEqual(Decimal(0));
    expect(request.resolution).toBe(resolution);
  });

  it('updates every option and preserves Decimal loader values', async () => {
    const oldLoader = vi.fn(async () => ({ id: 'old' }));
    const loader = vi.fn(async (_request: LoadRequest) => ({ id: 'new' }));
    const cache = new TimescopeDataCache<Data>({ name: 'old', loader: oldLoader });
    const time = Decimal('10.5');
    const cursorTime = Decimal(12);
    const instantResolution = Decimal('0.25');
    const options: TimescopeDataCacheOptions<Data> = {
      name: 'new',
      loader,
      immediate: true,
      instantResolution,
      instantWidth: 4,
    };

    cache.updateOptions(options);
    cache.invalidate();
    cache.update(renderingContext({ editing: true, time, committingTime: Decimal(20), cursorTime }));
    await vi.waitFor(() => expect(cache.data).toEqual({ id: 'new' }));

    expect(cache.name).toBe('new');
    expect(oldLoader).not.toHaveBeenCalled();
    expect(loader).toHaveBeenCalledOnce();
    const request = loader.mock.calls[0]![0];
    expect(request.time).toBe(cursorTime);
    expect(request.resolution).toBe(instantResolution);
    expect(request.fallbackResolution?.eq(2)).toBe(true);
    expect(request.loadMissing).toBe(false);
    expect(request.range[0].eq(Decimal('11.5'))).toBe(true);
    expect(request.range[1].eq(Decimal('12.5'))).toBe(true);

    cache.invalidate();
    cache.update(renderingContext({ time, cursorTime }));
    await vi.waitFor(() => expect(loader).toHaveBeenCalledTimes(2));
    expect(loader.mock.calls[1]![0].loadMissing).toBe(true);
  });

  it('does not publish or start more requests after disposal', async () => {
    const pending = deferred<Data>();
    const loader = vi.fn(() => pending.promise);
    const cache = new TimescopeDataCache({ name: 'cache', loader });
    const dataChanged = vi.fn();
    cache.on('datachanged', dataChanged);

    cache.invalidate();
    cache.update(renderingContext());
    cache.dispose();
    pending.resolve({ id: 'late' });
    await pending.promise;

    cache.invalidate();
    cache.update(renderingContext());
    expect(cache.data).toBeUndefined();
    expect(dataChanged).not.toHaveBeenCalled();
    expect(loader).toHaveBeenCalledOnce();
  });

  it('publishes independent caches without waiting for each other', async () => {
    const chartResult = deferred<Data>();
    const tooltipResult = deferred<Data>();
    const chart = new TimescopeDataCache<Data>({ name: 'chart', loader: () => chartResult.promise });
    const tooltip = new TimescopeDataCache<Data>({ name: 'tooltip', loader: () => tooltipResult.promise });

    chart.invalidate();
    tooltip.invalidate();
    chart.update(renderingContext());
    tooltip.update(renderingContext());

    chartResult.resolve({ id: 'chart' });
    await vi.waitFor(() => expect(chart.data).toEqual({ id: 'chart' }));
    expect(tooltip.data).toBeUndefined();

    tooltipResult.resolve({ id: 'tooltip' });
    await vi.waitFor(() => expect(tooltip.data).toEqual({ id: 'tooltip' }));
  });

  it('does not reload data immediately after explicit preparation', async () => {
    const loader = vi.fn(async () => ({ id: 'prepared' }));
    const cache = new TimescopeDataCache({ name: 'cache', loader });
    const range = [Decimal(0), Decimal(20)] as unknown as Parameters<typeof cache.prepare>[0]['range'];

    cache.invalidate();
    await cache.prepare({ time: Decimal(10), zoom: 0, range, xOrigin: range[0], resolution: Decimal(1) });
    cache.update(renderingContext({ range }));

    expect(loader).toHaveBeenCalledOnce();
    expect(cache.data).toEqual({ id: 'prepared' });
  });

  it('keeps staged data hidden until atomic activation is announced', async () => {
    const normal = deferred<Data>();
    const staged = deferred<Data>();
    const loader = vi
      .fn()
      .mockResolvedValueOnce({ id: 'active' })
      .mockReturnValueOnce(normal.promise)
      .mockReturnValueOnce(staged.promise);
    const cache = new TimescopeDataCache({
      name: 'cache',
      loader,
      prepare: (data) => ({ id: `prepared-${data.id}` }),
    });
    const request = {
      time: Decimal(10),
      zoom: 0,
      range: [Decimal(0), Decimal(20)],
      xOrigin: Decimal(0),
      resolution: Decimal(1),
    } as unknown as LoadRequest;
    await cache.prepare(request);
    const revision = cache.revision;
    const changed = vi.fn();
    const dataChanged = vi.fn();
    cache.on('change', changed);
    cache.on('datachanged', dataChanged);

    cache.invalidate();
    cache.update(renderingContext());
    await vi.waitFor(() => expect(loader).toHaveBeenCalledTimes(2));
    cache.beginFrame();
    const ready = cache.stageTarget(frameView());
    await vi.waitFor(() => expect(loader).toHaveBeenCalledTimes(3));
    staged.resolve({ id: 'staged' });
    await expect(ready).resolves.toBe(true);

    expect(cache.data).toEqual({ id: 'prepared-active' });
    expect(cache.stagedData).toEqual({ id: 'prepared-staged' });
    expect(cache.revision).toBe(revision);
    expect(changed).not.toHaveBeenCalled();
    expect(dataChanged).not.toHaveBeenCalled();

    expect(cache.readyStaged()).toBe(true);
    expect(cache.data).toEqual({ id: 'prepared-active' });
    expect(cache.readyData).toEqual({ id: 'prepared-staged' });
    expect(cache.activateReady()).toBe(true);
    expect(cache.data).toEqual({ id: 'prepared-staged' });
    expect(cache.revision).toBe(revision);
    normal.resolve({ id: 'normal' });
    await Promise.resolve();
    expect(cache.data).toEqual({ id: 'prepared-staged' });
    cache.announceActivation();
    await Promise.resolve();
    expect(cache.revision).toBe(revision + 1);
    expect(changed).toHaveBeenCalledOnce();
    expect(dataChanged).toHaveBeenCalledOnce();
  });

  it('discards staged and ready refreshes when invalidated without clearing active data', async () => {
    const staged = deferred<Data>();
    const cache = new TimescopeDataCache<Data>({
      name: 'cache',
      loader: vi.fn().mockResolvedValueOnce({ id: 'active' }).mockReturnValueOnce(staged.promise),
    });
    const request = {
      time: Decimal(10),
      zoom: 0,
      range: [Decimal(0), Decimal(20)],
      xOrigin: Decimal(0),
      resolution: Decimal(1),
    } as unknown as LoadRequest;
    await cache.prepare(request);
    cache.beginFrame();
    const ready = cache.stageTarget(frameView());
    staged.resolve({ id: 'staged' });
    await expect(ready).resolves.toBe(true);
    expect(cache.readyStaged()).toBe(true);

    cache.invalidate();

    expect(cache.data).toEqual({ id: 'active' });
    expect(cache.stagedData).toBeUndefined();
    expect(cache.readyData).toBeUndefined();
    expect(cache.activateReady()).toBe(false);
  });

  it('keeps a normal load running while aborting frame staging', async () => {
    const normal = deferred<Data>();
    const staged = deferred<Data>();
    const loader = vi
      .fn()
      .mockResolvedValueOnce({ id: 'active' })
      .mockReturnValueOnce(normal.promise)
      .mockReturnValueOnce(staged.promise);
    const cache = new TimescopeDataCache({ name: 'cache', loader });
    const request = {
      time: Decimal(10),
      zoom: 0,
      range: [Decimal(0), Decimal(20)],
      xOrigin: Decimal(0),
      resolution: Decimal(1),
    } as unknown as LoadRequest;
    await cache.prepare(request);
    cache.invalidate();
    cache.update(renderingContext());
    await vi.waitFor(() => expect(loader).toHaveBeenCalledTimes(2));

    cache.beginFrame();
    const ready = cache.stageTarget(frameView());
    await vi.waitFor(() => expect(loader).toHaveBeenCalledTimes(3));
    cache.abortFrame();
    cache.update(renderingContext());
    normal.resolve({ id: 'normal' });
    staged.resolve({ id: 'staged' });

    await expect(ready).resolves.toBe(false);
    await vi.waitFor(() => expect(cache.data).toEqual({ id: 'normal' }));
    expect(loader).toHaveBeenCalledTimes(3);
    expect(cache.stagedData).toBeUndefined();
  });

  it('prepares current responses before publication and mutates committed data in place', async () => {
    const source = { id: 'source' };
    const prepare = vi.fn((data: Data) => {
      data.id = 'prepared';
      return data;
    });
    const cache = new TimescopeDataCache<Data>({ name: 'cache', loader: async () => source, prepare });

    cache.invalidate();
    cache.update(renderingContext());
    await vi.waitFor(() => expect(cache.data).toBe(source));
    expect(cache.data.id).toBe('prepared');

    const revision = cache.revision;
    expect(
      cache.mutateData((data) => {
        data.id = 'mutated';
        return true;
      }),
    ).toBe(true);
    expect(cache.data).toBe(source);
    expect(cache.data.id).toBe('mutated');
    expect(cache.revision).toBe(revision + 1);
  });
});
