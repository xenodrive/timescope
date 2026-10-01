import { Decimal } from '#src/core/decimal';
import type { TimescopeCommittableMessageSync } from '#src/core/TimescopeCommittable';
import { TimescopeViewport } from '#src/renderer/TimescopeViewport';
import { afterEach, describe, expect, it, onTestFinished, vi } from 'vitest';

describe('kinetic scrolling', () => {
  afterEach(() => vi.useRealTimers());

  it('clears the animation state when momentum is interrupted before release', () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const viewport = new TimescopeViewport({ time: 0, zoom: 0 });
    onTestFinished(() => viewport.dispose());
    viewport.setAxisLength([500, 500]);

    viewport.dragStart();
    vi.advanceTimersByTime(20);
    viewport.dragUpdate(400, -100);
    vi.advanceTimersByTime(20);
    viewport.dragUpdate(300, -100);
    viewport.dragEnd();
    vi.advanceTimersByTime(100);
    expect(viewport.animating).toBe(true);
    const interrupted = viewport.current.time!;

    viewport.dragStart();
    expect(viewport.animating).toBe(false);
    expect(viewport.dragging).toBe(true);
    vi.advanceTimersByTime(600);
    expect(viewport.current.time!.eq(interrupted)).toBe(true);
    expect(viewport.animating).toBe(false);
  });

  it('resists overscroll and returns to the time boundary after release', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const viewport = new TimescopeViewport({ time: 100, timeRange: [Decimal(0), Decimal(100)], zoom: 0 });
    onTestFinished(() => viewport.dispose());
    viewport.setAxisLength([500, 500]);

    viewport.dragStart();
    vi.advanceTimersByTime(20);
    viewport.dragUpdate(400, -100);
    vi.advanceTimersByTime(20);
    viewport.dragUpdate(300, -100);

    const extension = viewport.current.time!.sub(100).number();
    expect(extension).toBeGreaterThan(0);
    expect(extension).toBeLessThan(200);

    viewport.dragEnd();
    await vi.advanceTimersByTimeAsync(2000);
    expect(viewport.current.time?.eq(100)).toBe(true);
  });

  it('makes overscroll depend on total pull rather than pointer event frequency', () => {
    const createViewport = () => {
      const viewport = new TimescopeViewport({
        time: 100,
        timeRange: [Decimal(0), Decimal(100)],
        zoom: 0,
      });
      viewport.setAxisLength([500, 500]);
      onTestFinished(() => viewport.dispose());
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
    onTestFinished(() => viewport.dispose());
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

describe('kinetic zooming', () => {
  const viewports: TimescopeViewport[] = [];

  afterEach(() => {
    viewports.splice(0).forEach((viewport) => viewport.dispose());
    vi.useRealTimers();
  });

  function setup(zoomRange?: [number, number]) {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const viewport = new TimescopeViewport({
      time: 0,
      timeRange: [Decimal(-10000), Decimal(10000)],
      zoom: 0,
      zoomRange,
    });
    viewports.push(viewport);
    viewport.setAxisLength([500, 500]);
    viewport.dragStart();
    viewport.pinchStart(450, 550);
    return viewport;
  }

  function move(viewport: TimescopeViewport, zoom: number) {
    vi.advanceTimersByTime(40);
    const halfSpan = 50 * 2 ** zoom;
    viewport.pinchUpdate(500 - halfSpan, 500 + halfSpan);
  }

  it.each([-1, 1])('continues zooming in direction %s and slows to a stop', (direction) => {
    const viewport = setup();
    move(viewport, direction * 0.1);
    move(viewport, direction * 0.2);
    const released = viewport.current.zoom.number();
    viewport.pinchEnd();

    expect((viewport.committing.zoom.number() - released) * direction).toBeGreaterThan(0);
    vi.advanceTimersByTime(100);
    const first = viewport.current.zoom.number();
    vi.advanceTimersByTime(100);
    const second = viewport.current.zoom.number();
    expect((first - released) * direction).toBeGreaterThan((second - first) * direction);
    expect((second - first) * direction).toBeGreaterThan(0);
    vi.advanceTimersByTime(400);
    expect(viewport.current.zoom.eq(viewport.committing.zoom)).toBe(true);
  });

  it('does not coast after pausing before release', () => {
    const viewport = setup();
    move(viewport, 0.2);
    vi.advanceTimersByTime(150);
    const released = viewport.current.zoom;
    viewport.pinchEnd();
    expect(viewport.committing.zoom.eq(released)).toBe(true);
  });

  it.each([-1, 1])('stops at zoom boundary %s without overshooting', (direction) => {
    const viewport = setup([-0.5, 0.5]);
    move(viewport, direction * 0.2);
    viewport.pinchEnd();
    expect(viewport.committing.zoom.number()).toBe(direction * 0.5);
    for (let i = 0; i < 6; i++) {
      vi.advanceTimersByTime(100);
      expect(Math.abs(viewport.current.zoom.number())).toBeLessThanOrEqual(0.5);
    }
  });

  it('interrupts momentum and resets velocity when another pinch starts', () => {
    const viewport = setup();
    move(viewport, 0.2);
    viewport.pinchEnd();
    vi.advanceTimersByTime(100);
    const interrupted = viewport.current.zoom;
    viewport.pinchStart(450, 550);
    vi.advanceTimersByTime(600);
    expect(viewport.current.zoom.eq(interrupted)).toBe(true);
    viewport.pinchEnd();
    expect(viewport.committing.zoom.eq(interrupted)).toBe(true);
  });

  it('allows one-finger dragging during zoom momentum', () => {
    const viewport = setup();
    move(viewport, 0.2);
    viewport.pinchEnd();
    const targetZoom = viewport.committing.zoom;
    vi.advanceTimersByTime(20);
    viewport.dragUpdate(550, 10);
    vi.advanceTimersByTime(20);
    viewport.dragUpdate(560, 10);
    const releasedTime = viewport.current.time!;
    viewport.dragEnd();
    expect(viewport.committing.time!.lt(releasedTime)).toBe(true);
    expect(viewport.committing.zoom.eq(targetZoom)).toBe(true);
    vi.advanceTimersByTime(600);
    expect(viewport.current.zoom.eq(targetZoom)).toBe(true);
    expect(viewport.dragging).toBe(false);
  });
});
