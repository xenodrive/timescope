import { Decimal } from '#src/core/decimal';
import { TimescopeDataCache } from '#src/renderer/TimescopeDataCache';
import { TimescopeViewport } from '#src/renderer/TimescopeViewport';
import type { TimescopeRenderingContext } from '#src/renderer/types';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { deferred } from '../helpers/deferred';

const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const dispose of cleanups.splice(0)) dispose();
});

function context() {
  const timeAxis = new TimescopeViewport({ time: 10, zoom: 0 });
  timeAxis.setAxisLength([10, 10]);
  cleanups.push(() => timeAxis.dispose());
  return { timeAxis } as TimescopeRenderingContext;
}

const request = {
  time: Decimal(10),
  zoom: 0,
  range: [Decimal(0), Decimal(20)] as [Decimal, Decimal],
  xOrigin: Decimal(0),
  resolution: Decimal(1),
};

describe('cache publication', () => {
  it('preserves displayed data when a pending refresh becomes invalid', async () => {
    const pending = deferred<{ id: string }>();
    const loader = vi.fn().mockResolvedValueOnce({ id: 'active' }).mockReturnValueOnce(pending.promise);
    const cache = new TimescopeDataCache<{ id: string }>({ name: 'chart', loader });
    cleanups.push(() => cache.dispose());
    await cache.prepare(request);
    cache.invalidate();
    cache.update(context());
    await vi.waitFor(() => expect(loader).toHaveBeenCalledTimes(2));
    cache.reset();
    pending.resolve({ id: 'stale' });
    await pending.promise;
    // Drain the loader's publication callback, rather than checking before it could run.
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(cache.data).toEqual({ id: 'active' });
  });

  it('publishes independent loads without waiting for the slowest cache', async () => {
    const fast = deferred<{ id: string }>();
    const slow = deferred<{ id: string }>();
    const chart = new TimescopeDataCache({ name: 'chart', loader: () => fast.promise });
    const tooltip = new TimescopeDataCache({ name: 'tooltip', loader: () => slow.promise });
    cleanups.push(
      () => chart.dispose(),
      () => tooltip.dispose(),
    );
    const view = context();
    chart.invalidate();
    tooltip.invalidate();
    chart.update(view);
    tooltip.update(view);
    fast.resolve({ id: 'chart' });
    await vi.waitFor(() => expect(chart.data).toEqual({ id: 'chart' }));
    expect(tooltip.data).toBeUndefined();
    slow.resolve({ id: 'tooltip' });
    await vi.waitFor(() => expect(tooltip.data).toEqual({ id: 'tooltip' }));
  });

  it('does not publish or load after disposal, even when a pending request resolves', async () => {
    const pending = deferred<{ id: string }>();
    const loader = vi.fn(() => pending.promise);
    const cache = new TimescopeDataCache({ name: 'chart', loader });
    cleanups.push(() => cache.dispose());
    const changed = vi.fn();
    cache.on('datachanged', changed);
    const view = context();
    cache.invalidate();
    cache.update(view);
    await vi.waitFor(() => expect(loader).toHaveBeenCalledOnce());
    cache.dispose();
    pending.resolve({ id: 'late' });
    await pending.promise;
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    cache.invalidate();
    cache.update(view);
    expect(cache.data).toBeUndefined();
    expect(changed).not.toHaveBeenCalled();
    expect(loader).toHaveBeenCalledOnce();
  });
});
