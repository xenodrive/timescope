import { Decimal } from '#src/core/decimal';
import type { TimescopeCommittableMessageSync } from '#src/core/TimescopeCommittable';
import { TimescopeViewport } from '#src/renderer/TimescopeViewport';
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('TimescopeViewport kinetic scrolling', () => {
  afterEach(() => vi.useRealTimers());

  it('limits drag overscroll and commits kinetic motion', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const viewport = new TimescopeViewport({ time: 100, timeRange: [Decimal(0), Decimal(100)], zoom: 0 });
    const sync: TimescopeCommittableMessageSync<null>[] = [];
    viewport.on('sync', (event) => {
      if (event.value.time) sync.push(event.value.time);
    });
    viewport.setAxisLength([500, 500]);

    viewport.dragStart();
    vi.advanceTimersByTime(20);
    viewport.dragUpdate(400, -100);
    vi.advanceTimersByTime(20);
    viewport.dragUpdate(300, -100);

    const extension = viewport.current.time!.sub(100).number();
    expect(extension).toBe(100);

    viewport.dragEnd();
    await Promise.resolve();
    await Promise.resolve();
    const commit = sync.findLast((message) => message.type === 'commit');
    expect(commit?.type).toBe('commit');
    if (commit?.type !== 'commit') return;

    expect(commit.targetValue?.eq(100)).toBe(true);
    expect(commit.animation).toBe('out');
    const firstExtension = 50;
    const secondExtension = 100;
    const kineticDistance = (secondExtension - firstExtension) / 20 / 0.005;
    expect(commit.tangent).toBeCloseTo(1.5 * (1 - kineticDistance / secondExtension));
  });

  it('makes overscroll depend on total pull rather than pointer event frequency', () => {
    const createViewport = () => {
      const viewport = new TimescopeViewport({
        time: 100,
        timeRange: [Decimal(0), Decimal(100)],
        zoom: 0,
      });
      viewport.setAxisLength([500, 500]);
      viewport.dragStart();
      return viewport;
    };
    const singleUpdate = createViewport();
    const splitUpdate = createViewport();

    singleUpdate.dragUpdate(300, -200);
    splitUpdate.dragUpdate(400, -100);
    splitUpdate.dragUpdate(300, -100);

    expect(singleUpdate.current.time!.eq(splitUpdate.current.time!)).toBe(true);
    singleUpdate.dragCancel();
    splitUpdate.dragCancel();
  });

  it('commits a live-time boundary as null', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const viewport = new TimescopeViewport({ time: null, zoom: 0 });
    const sync: TimescopeCommittableMessageSync<null>[] = [];
    viewport.on('sync', (event) => {
      if (event.value.time) sync.push(event.value.time);
    });
    viewport.setAxisLength([500, 500]);

    viewport.dragStart();
    vi.advanceTimersByTime(20);
    viewport.dragUpdate(400, -100);
    vi.advanceTimersByTime(20);
    viewport.dragUpdate(300, -100);
    viewport.dragEnd();
    await Promise.resolve();
    await Promise.resolve();

    const commit = sync.findLast((message) => message.type === 'commit');
    expect(commit?.type === 'commit' && commit.targetValue).toBeNull();
  });
});
