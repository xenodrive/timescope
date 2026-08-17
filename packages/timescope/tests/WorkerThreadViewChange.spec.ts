import type { WorkerMessage, WorkerMessagePort } from '#src/bridge/rpc';
import { Decimal } from '#src/core/decimal';
import { createTimescopeWorkerThread } from '#src/worker/WorkerThread';
import { TimescopeRenderer } from '#src/worker/renderer/TimescopeRenderer';
import type { TimescopeRenderingContext } from '#src/worker/types';
import { afterEach, describe, expect, it, vi } from 'vitest';

class TestPort {
  messages: any[] = [];
  #listeners = new Set<(event: MessageEvent) => void | Promise<void>>();

  postMessage(message: any) {
    this.messages.push(structuredClone(message));
  }

  addEventListener(_type: string, listener: EventListenerOrEventListenerObject) {
    this.#listeners.add(listener as (event: MessageEvent) => void | Promise<void>);
  }

  removeEventListener(_type: string, listener: EventListenerOrEventListenerObject) {
    this.#listeners.delete(listener as (event: MessageEvent) => void | Promise<void>);
  }

  async dispatch(message: WorkerMessage<any, any>) {
    await Promise.all([...this.#listeners].map((listener) => listener({ data: message } as MessageEvent)));
    for (let i = 0; i < 5; i++) await Promise.resolve();
  }
}

class SnapshotRenderer extends TimescopeRenderer {
  frames: (string | undefined)[][] = [];
  centers: number[] = [];
  widths: number[] = [];

  render(timescope: TimescopeRenderingContext) {
    this.frames.push(['a', 'b'].map((key) => (timescope.dataCaches[key]?.data as { id?: string } | undefined)?.id));
    const range = timescope.timeAxis.current.range;
    this.centers.push(range[0].add(range[1]).div(2).number());
    this.widths.push(timescope.size.width);
  }
}

function canvas() {
  const target = { save() {}, restore() {}, reset() {}, scale() {} } as unknown as OffscreenCanvasRenderingContext2D;
  const context = new Proxy(target, {
    get(target, key) {
      if (key in target) return target[key as keyof typeof target];
      return () => {};
    },
  });
  const canvas = { width: 100, height: 100, getContext: () => context } as unknown as OffscreenCanvas;
  Object.defineProperty(target, 'canvas', { value: canvas });
  return canvas;
}

async function flushMicrotasks() {
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

afterEach(() => vi.useRealTimers());

describe('worker view changes', () => {
  it('renders active cache snapshots while atomically staging the next frame', async () => {
    const port = new TestPort();
    const frames: (() => void)[] = [];
    const renderer = new SnapshotRenderer();
    createTimescopeWorkerThread(port as unknown as WorkerMessagePort, undefined, (callback) => frames.push(callback), [
      renderer,
    ]);
    let seq = 0;
    const dispatch = (command: string, payload: unknown, type: 'event' | 'rpc' = 'event') =>
      port.dispatch({ type, command, seq: ++seq, payload } as WorkerMessage<any, any>);
    const runFrame = async () => {
      const renderCount = renderer.frames.length;
      do {
        frames.shift()?.();
        await flushMicrotasks();
      } while (frames.length && renderer.frames.length === renderCount);
    };
    const dataLoads = () =>
      port.messages.filter((message) => message.type === 'rpc' && message.command === 'data:load');
    const acknowledge = (message: any, payload: unknown) =>
      port.dispatch({ type: 'rpc:ack', command: message.command, seq: message.seq, payload });
    const startPrepare = async (target = {}) => {
      const messageOffset = port.messages.length;
      await dispatch('frame:capture', target, 'rpc');
      const captured = port.messages
        .slice(messageOffset)
        .find((message) => message.command === 'frame:capture' && message.type === 'rpc:ack');
      return { completion: dispatch('frame:prepare', captured.payload.view, 'rpc'), view: captured.payload.view };
    };
    const present = async () => {
      const renderedFrames = renderer.frames.length;
      await dispatch('frame:commit', undefined, 'rpc');
      expect(renderer.frames).toHaveLength(renderedFrames);
      await runFrame();
    };

    await dispatch('init', { canvas: canvas() });
    await dispatch('sync', { time: { type: 'set:nullvalue', nullValue: Decimal(10) } });
    await dispatch('options:update', {
      padding: [0, 0, 0, 0],
      dataCacheOptions: { a: { immediate: true }, b: { immediate: true } },
    });
    await dispatch('data:changed', 'a');
    await dispatch('data:changed', 'b');
    await runFrame();
    const initialLoads = dataLoads();
    expect(initialLoads).toHaveLength(2);
    for (const load of initialLoads) await acknowledge(load, { id: `active-${load.payload.key}` });
    await runFrame();
    expect(renderer.frames.at(-1)).toEqual(['active-a', 'active-b']);

    vi.useFakeTimers();
    vi.setSystemTime(20_000);
    await dispatch('frame:latch', undefined);
    await runFrame();
    expect(renderer.frames.at(-1)).toEqual(['active-a', 'active-b']);
    expect(renderer.centers.at(-1)).toBe(10);

    const { completion: preparation, view: preparedView } = await startPrepare({ playbackTime: null });
    expect(preparedView.viewport.current).toEqual(preparedView.viewport.candidate);
    expect(preparedView.viewport.cursor.center).toEqual(preparedView.viewport.candidate.center);
    await flushMicrotasks();
    const stagedLoads = dataLoads().slice(initialLoads.length);
    expect(stagedLoads).toHaveLength(2);
    await acknowledge(stagedLoads[0], { id: `staged-${stagedLoads[0].payload.key}` });
    await runFrame();
    expect(renderer.frames.at(-1)).toEqual(['active-a', 'active-b']);

    await acknowledge(stagedLoads[1], { id: `staged-${stagedLoads[1].payload.key}` });
    await preparation;
    expect(renderer.frames.at(-1)).toEqual(['active-a', 'active-b']);
    await dispatch('sync', { time: { type: 'set:nullvalue', nullValue: null } });
    await present();
    expect(renderer.frames.at(-1)).toEqual(['staged-a', 'staged-b']);
    expect(renderer.centers.at(-1)).toBe(20);

    const nextLoadOffset = dataLoads().length;
    await dispatch('frame:latch', undefined);
    const { completion: nextPreparation } = await startPrepare();
    await flushMicrotasks();
    const nextLoads = dataLoads().slice(nextLoadOffset);
    expect(nextLoads).toHaveLength(2);
    await acknowledge(nextLoads[0], { id: `next-${nextLoads[0].payload.key}` });
    await runFrame();
    expect(renderer.frames.at(-1)).toEqual(['staged-a', 'staged-b']);
    expect(renderer.centers.at(-1)).toBe(20);
    expect(renderer.frames).not.toContainEqual(['staged-a', 'active-b']);
    expect(renderer.frames).not.toContainEqual(['active-a', 'staged-b']);
    await acknowledge(nextLoads[1], { id: `next-${nextLoads[1].payload.key}` });
    await nextPreparation;
    await present();
    expect(renderer.frames.at(-1)).toEqual(['next-a', 'next-b']);

    const droppedLoadOffset = dataLoads().length;
    await dispatch('frame:latch', undefined);
    const { completion: droppedPreparation } = await startPrepare();
    await flushMicrotasks();
    const droppedLoads = dataLoads().slice(droppedLoadOffset);
    for (const load of droppedLoads) await acknowledge(load, { id: `dropped-${load.payload.key}` });
    await droppedPreparation;
    await dispatch('frame:abort', undefined);

    const latestLoadOffset = dataLoads().length;
    await dispatch('frame:latch', undefined);
    const { completion: latestPreparation } = await startPrepare();
    await flushMicrotasks();
    const latestLoads = dataLoads().slice(latestLoadOffset);
    for (const load of latestLoads) await acknowledge(load, { id: `latest-${load.payload.key}` });
    await latestPreparation;
    const latestCommit = dispatch('frame:commit', undefined, 'rpc');
    await flushMicrotasks();
    const widthBeforeResize = renderer.widths.at(-1);
    await dispatch('resize', { size: { width: 200, height: 100 }, context: { dpr: 1 } }, 'rpc');
    await runFrame();
    await latestCommit;
    expect(renderer.frames.at(-1)).toEqual(['latest-a', 'latest-b']);
    expect(renderer.widths.at(-1)).toBe(widthBeforeResize);
    expect(renderer.frames).not.toContainEqual(['dropped-a', 'dropped-b']);
    await runFrame();
    expect(renderer.widths.at(-1)).toBe(200);

    const discardedLoadOffset = dataLoads().length;
    await dispatch('frame:latch', undefined);
    const { completion: discardedPreparation } = await startPrepare();
    await flushMicrotasks();
    const discardedLoads = dataLoads().slice(discardedLoadOffset);
    for (const load of discardedLoads) await acknowledge(load, { id: `discarded-${load.payload.key}` });
    await discardedPreparation;
    await dispatch('sync', { time: { type: 'set:nullvalue', nullValue: Decimal(40) } });
    await dispatch('frame:abort', undefined);
    await runFrame();
    expect(renderer.frames.at(-1)).toEqual(['latest-a', 'latest-b']);
    expect(renderer.centers.at(-1)).toBe(40);

    await dispatch('sync', { time: { type: 'set:nullvalue', nullValue: Decimal(30) } });
    await runFrame();
    expect(renderer.centers.at(-1)).toBe(30);

    await dispatch('frame:abort', undefined);
    await runFrame();
    expect(renderer.frames.at(-1)).toEqual(['latest-a', 'latest-b']);

    const failedLoadOffset = dataLoads().length;
    await dispatch('frame:latch', undefined);
    const { completion: failedPreparation } = await startPrepare();
    await flushMicrotasks();
    const failedLoads = dataLoads().slice(failedLoadOffset);
    expect(failedLoads).toHaveLength(2);
    await acknowledge(failedLoads[0], { id: 'partial' });
    await acknowledge(failedLoads[1], undefined);
    await failedPreparation;
    await runFrame();
    expect(renderer.frames.at(-1)).toEqual(['latest-a', 'latest-b']);

    const loadCount = dataLoads().length;
    await dispatch('frame:latch', undefined);
    const { completion: abortedPreparation } = await startPrepare();
    await flushMicrotasks();
    expect(dataLoads()).toHaveLength(loadCount + 2);
    await dispatch('frame:abort', undefined);
    await abortedPreparation;
    await runFrame();
    expect(renderer.frames.at(-1)).toEqual(['latest-a', 'latest-b']);
  });

  it('defers data invalidation until a prepared frame is committed', async () => {
    const port = new TestPort();
    const frames: (() => void)[] = [];
    createTimescopeWorkerThread(
      port as unknown as WorkerMessagePort,
      undefined,
      (callback) => frames.push(callback),
      [],
    );
    let seq = 0;
    const dispatch = (command: string, payload: unknown, type: 'event' | 'rpc' = 'event') =>
      port.dispatch({ type, command, seq: ++seq, payload } as WorkerMessage<any, any>);

    await dispatch('options:update', { dataCacheOptions: { a: { immediate: true } } });
    await dispatch('frame:latch', undefined);
    await dispatch('frame:capture', {}, 'rpc');
    const captured = port.messages.find((message) => message.command === 'frame:capture' && message.type === 'rpc:ack');
    const preparation = dispatch('frame:prepare', captured.payload.view, 'rpc');
    await flushMicrotasks();
    const load = port.messages.find((message) => message.command === 'data:load' && message.type === 'rpc');
    await port.dispatch({ type: 'rpc:ack', command: load.command, seq: load.seq, payload: { id: 'prepared' } });
    await preparation;

    await dispatch('data:changed', 'a');
    await dispatch('frame:commit', undefined, 'rpc');
    const committed = port.messages.findLast(
      (message) => message.command === 'frame:commit' && message.type === 'rpc:ack',
    );

    expect(committed.payload).toEqual({ ok: true });
  });

  it('keeps a captured playback time fixed until the ready frame is rendered', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(20_000);
    const port = new TestPort();
    const frames: (() => void)[] = [];
    const renderer = new SnapshotRenderer();
    createTimescopeWorkerThread(port as unknown as WorkerMessagePort, undefined, (callback) => frames.push(callback), [
      renderer,
    ]);
    let seq = 0;
    const dispatch = (command: string, payload: unknown, type: 'event' | 'rpc' = 'event') =>
      port.dispatch({ type, command, seq: ++seq, payload } as WorkerMessage<any, any>);

    await dispatch('init', { canvas: canvas() });
    await dispatch('options:update', { padding: [0, 0, 0, 0] });
    await dispatch('frame:latch', undefined);
    await dispatch('frame:capture', { playbackTime: null }, 'rpc');
    const captured = port.messages.find((message) => message.command === 'frame:capture' && message.type === 'rpc:ack');
    expect(Decimal(captured.payload.view.playbackTime as number)!.number()).toBe(20);

    vi.setSystemTime(30_000);
    await dispatch('frame:prepare', captured.payload.view, 'rpc');
    await dispatch('frame:commit', undefined, 'rpc');
    expect(renderer.centers).toHaveLength(0);

    await dispatch('frame:latch', undefined);
    await dispatch('frame:capture', {}, 'rpc');
    expect(
      port.messages.filter((message) => message.command === 'frame:capture' && message.type === 'rpc:ack'),
    ).toHaveLength(2);
    frames.shift()?.();
    await flushMicrotasks();

    expect(renderer.centers.at(-1)).toBe(20);
  });

  it('preserves an animated zoom target across consecutive frame latches', async () => {
    vi.useFakeTimers();
    const port = new TestPort();
    createTimescopeWorkerThread(port as unknown as WorkerMessagePort, undefined, () => {});
    let seq = 0;
    const dispatch = (command: string, payload: unknown, type: 'event' | 'rpc' = 'event') =>
      port.dispatch({ type, command, seq: ++seq, payload } as WorkerMessage<any, any>);
    const capturedViews = () =>
      port.messages.filter((message) => message.command === 'frame:capture' && message.type === 'rpc:ack');

    await dispatch('sync', {
      zoom: {
        type: 'commit',
        targetValue: Decimal(10),
        animation: 'linear',
        duration: 200,
        cursorMode: 'target',
        lazy: false,
      },
    });

    await dispatch('frame:latch', undefined);
    await dispatch('frame:capture', {}, 'rpc');
    const firstView = capturedViews().at(-1)!.payload.view;
    expect(firstView.zoom).toBe(10);
    await dispatch('frame:prepare', firstView, 'rpc');
    await dispatch('frame:commit', undefined, 'rpc');

    await dispatch('frame:latch', undefined);
    await dispatch('frame:capture', {}, 'rpc');
    expect(capturedViews().at(-1)!.payload.view.zoom).toBe(10);
  });

  it('applies time sync received by a latched frame before presenting it', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(20_000);
    const port = new TestPort();
    const frames: (() => void)[] = [];
    const renderer = new SnapshotRenderer();
    createTimescopeWorkerThread(port as unknown as WorkerMessagePort, undefined, (callback) => frames.push(callback), [
      renderer,
    ]);
    let seq = 0;
    const dispatch = (command: string, payload: unknown, type: 'event' | 'rpc' = 'event') =>
      port.dispatch({ type, command, seq: ++seq, payload } as WorkerMessage<any, any>);

    await dispatch('init', { canvas: canvas() });
    await dispatch('options:update', { padding: [0, 0, 0, 0] });
    await dispatch('sync', {
      time: { type: 'restore', value: Decimal(5), domain: [undefined, undefined] },
    });
    await dispatch('frame:latch', undefined);
    await dispatch('frame:capture', { time: null, playbackTime: Decimal(12) }, 'rpc');
    const captured = port.messages.findLast(
      (message) => message.command === 'frame:capture' && message.type === 'rpc:ack',
    );
    await dispatch('sync', {
      time: {
        type: 'commit',
        targetValue: null,
        animation: false,
        duration: 500,
        cursorMode: 'target',
        lazy: false,
      },
    });
    await dispatch('sync', { time: { type: 'set:nullvalue', nullValue: Decimal(12) } });
    await dispatch('frame:prepare', captured.payload.view, 'rpc');
    await dispatch('frame:commit', undefined, 'rpc');
    frames.shift()?.();
    await flushMicrotasks();

    expect(renderer.centers.at(-1)).toBe(12);

    await dispatch('frame:latch', undefined);
    await dispatch('frame:capture', {}, 'rpc');
    const nextCapture = port.messages.findLast(
      (message) => message.command === 'frame:capture' && message.type === 'rpc:ack',
    );
    expect(nextCapture.payload.view.time).toBeNull();
    expect(Decimal(nextCapture.payload.view.playbackTime as number)!.number()).toBe(12);
  });

  it('sends a committed time target even while a drag update is throttled', async () => {
    vi.useFakeTimers();
    const port = new TestPort();
    createTimescopeWorkerThread(port as unknown as WorkerMessagePort, undefined, () => {});

    await port.dispatch({
      type: 'event',
      command: 'sync',
      seq: 1,
      payload: structuredClone({ time: { type: 'update', candidate: Decimal(10), current: Decimal(10) } }),
    });
    expect(port.messages.filter((message) => message.command === 'viewport:changing')).toHaveLength(1);

    await port.dispatch({
      type: 'event',
      command: 'sync',
      seq: 2,
      payload: structuredClone({
        time: {
          type: 'commit',
          targetValue: Decimal(20),
          animation: 'linear',
          duration: 200,
          cursorMode: 'current',
          lazy: false,
        },
      }),
    });

    const viewChanges = port.messages.filter((message) => message.command === 'viewport:changing');
    expect(viewChanges).toHaveLength(2);
    const target = Decimal(20)!;
    expect(viewChanges[1].payload.viewport.candidate.center).toEqual({ coeff: target.coeff, digits: target.digits });
    const current = Decimal(10)!;
    expect(viewChanges[1].payload.viewport.current.center).toEqual({ coeff: current.coeff, digits: current.digits });
  });

  it('reports automatic live movement only after it accumulates to one pixel', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(10_000);
    const port = new TestPort();
    const frames: (() => void)[] = [];
    createTimescopeWorkerThread(
      port as unknown as WorkerMessagePort,
      undefined,
      (callback) => frames.push(callback),
      [],
    );
    let seq = 0;
    const dispatch = (command: string, payload: unknown, type: 'event' | 'rpc' = 'event') =>
      port.dispatch({ type, command, seq: ++seq, payload } as WorkerMessage<any, any>);
    const runFrame = async () => {
      frames.shift()?.();
      await flushMicrotasks();
    };
    const viewChanges = () => port.messages.filter((message) => message.command === 'viewport:changed');

    await dispatch('init', { canvas: canvas() });
    await dispatch('options:update', { padding: [0, 0, 0, 0] });
    await dispatch('resize', { size: { width: 100, height: 100 }, context: { dpr: 1 } });
    port.messages.length = 0;

    await runFrame();
    vi.advanceTimersByTime(999);
    await runFrame();
    expect(viewChanges()).toHaveLength(0);

    vi.advanceTimersByTime(2);
    await runFrame();
    expect(viewChanges()).toHaveLength(1);

    port.messages.length = 0;
    vi.advanceTimersByTime(500);
    await runFrame();
    expect(viewChanges()).toHaveLength(0);

    await dispatch('resize', { size: { width: 101, height: 100 }, context: { dpr: 1 } });
    expect(viewChanges()).toHaveLength(1);
  });

  it('reloads immediate data over the transition when the data changes', async () => {
    vi.useFakeTimers();
    const port = new TestPort();
    const frames: (() => void)[] = [];
    createTimescopeWorkerThread(port as unknown as WorkerMessagePort, undefined, (callback) => {
      frames.push(callback);
    });

    await port.dispatch({
      type: 'event',
      command: 'options:update',
      seq: 1,
      payload: { dataCacheOptions: { 'series:test:chart': { immediate: true } } },
    });
    await port.dispatch({
      type: 'event',
      command: 'sync',
      seq: 2,
      payload: structuredClone({ time: { type: 'update', candidate: Decimal(10), current: Decimal(10) } }),
    });
    await port.dispatch({
      type: 'event',
      command: 'sync',
      seq: 3,
      payload: structuredClone({
        time: {
          type: 'commit',
          targetValue: Decimal(20),
          animation: 'linear',
          duration: 200,
          cursorMode: 'current',
          lazy: false,
        },
      }),
    });

    port.messages.length = 0;
    await port.dispatch({ type: 'event', command: 'data:changed', seq: 4, payload: 'series:test:chart' });
    for (const frame of frames.splice(0)) frame();
    for (let i = 0; i < 5; i++) await Promise.resolve();

    const load = port.messages.find((message) => message.command === 'data:load');
    expect(load).toBeDefined();
    const start = Decimal(10)!;
    const end = Decimal(20)!;
    expect(load.payload.range).toEqual([
      { coeff: start.coeff, digits: start.digits },
      { coeff: end.coeff, digits: end.digits },
    ]);
    expect(load.payload.xOrigin).toEqual({ coeff: start.coeff, digits: start.digits });
  });
});
