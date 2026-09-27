import type { RendererCommands } from '#src/bridge/protocol';
import type { RenderCall } from '#src/bridge/rpc';
import { Decimal } from '#src/core/decimal';
import { TimescopeLayer } from '#src/renderer/layers/TimescopeLayer';
import { TimescopeRenderEngine } from '#src/renderer/TimescopeRenderEngine';
import type { TimescopeRenderingContext } from '#src/renderer/types';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { deferred } from '../helpers/deferred';

class RecordingLayer extends TimescopeLayer {
  frames: { data: unknown[]; center: number }[] = [];
  render(context: TimescopeRenderingContext) {
    const [start, end] = context.timeAxis.current.range;
    this.frames.push({
      data: ['a', 'b'].map((key) => (context.dataCaches[key]?.data as { id?: string } | undefined)?.id),
      center: start.add(end).div(2).number(),
    });
  }
}

const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const dispose of cleanups.splice(0)) dispose();
  vi.useRealTimers();
});

function fixture() {
  const frames = new Map<number, () => void>();
  let nextFrame = 0;
  const requests = new Map<string, ReturnType<typeof deferred<unknown>>>();
  const layer = new RecordingLayer();
  const call: RenderCall<RendererCommands> = async (command, payload) => {
    if (command !== 'data:load') return undefined as never;
    const request = deferred<unknown>();
    requests.set((payload as { key: string }).key, request);
    return (await request.promise) as never;
  };
  const engine = new TimescopeRenderEngine({
    call,
    layers: [layer],
    requestAnimationFrame: (callback) => {
      const id = ++nextFrame;
      frames.set(id, callback);
      return id;
    },
    cancelAnimationFrame: (id) => {
      frames.delete(id);
    },
  });
  cleanups.push(() => engine.dispose());
  const canvas = { width: 100, height: 100 };
  const ctx = new Proxy({ canvas }, { get: (target, key) => (key === 'canvas' ? target.canvas : () => {}) });
  const commands = engine.commands;
  commands.init({ canvas: { ...canvas, getContext: () => ctx } as unknown as HTMLCanvasElement });
  commands['options:update']({
    cursor: false,
    dataCacheOptions: { a: { immediate: true }, b: { immediate: true } },
  });
  commands.sync({ time: { type: 'set:nullvalue', nullValue: Decimal(10) } });

  return {
    commands,
    layer,
    draw() {
      const callbacks = [...frames.values()];
      frames.clear();
      for (const callback of callbacks) callback();
    },
    async load(key: string, data: unknown) {
      await vi.waitFor(() => expect(requests.has(key)).toBe(true));
      const request = requests.get(key)!;
      requests.delete(key);
      request.resolve(data === undefined ? undefined : { id: data });
      await request.promise;
    },
    async prepare(target: Parameters<(typeof commands)['frame:capture']>[0] = {}) {
      commands['frame:latch']();
      const captured = await commands['frame:capture'](target);
      if (!captured.ok) throw new Error(captured.message);
      if (target.time !== undefined) {
        commands.sync({
          time: {
            type: 'commit',
            targetValue: target.time,
            animation: false,
            duration: 0,
            cursorMode: 'target',
            lazy: false,
          },
        });
      }
      return { ready: commands['frame:prepare'](captured.view) };
    },
  };
}

async function activeFixture() {
  const view = fixture();
  const { ready } = await view.prepare({ time: Decimal(10) });
  await view.load('a', 'active-a');
  await view.load('b', 'active-b');
  await ready;
  await view.commands['frame:commit']();
  view.draw();
  expect(view.layer.frames.at(-1)?.data).toEqual(['active-a', 'active-b']);
  return view;
}

describe('frame synchronization', () => {
  it('presents data and time together only after all loads and commit', async () => {
    const view = await activeFixture();
    const { ready } = await view.prepare({ time: Decimal(20) });
    await view.load('a', 'next-a');
    view.draw();
    expect(view.layer.frames.at(-1)).toEqual({ data: ['active-a', 'active-b'], center: 10 });
    await view.load('b', 'next-b');
    await ready;
    view.draw();
    expect(view.layer.frames.at(-1)).toEqual({ data: ['active-a', 'active-b'], center: 10 });
    await view.commands['frame:commit']();
    view.draw();
    expect(view.layer.frames.at(-1)).toEqual({ data: ['next-a', 'next-b'], center: 20 });
    expect(
      view.layer.frames.every(({ data }) =>
        data[0] === 'active-a' ? data[1] === 'active-b' : data[0] === 'next-a' && data[1] === 'next-b',
      ),
    ).toBe(true);
  });

  it.each(['loading', 'ready'] as const)(
    'discards an aborted %s frame and allows the next frame to commit',
    async (phase) => {
      const view = await activeFixture();
      const aborted = await view.prepare({ time: Decimal(20) });
      if (phase === 'ready') {
        await view.load('a', 'discarded-a');
        await view.load('b', 'discarded-b');
        await aborted.ready;
      }
      view.commands['frame:abort']();
      if (phase === 'loading') {
        await view.load('a', 'discarded-a');
        await view.load('b', 'discarded-b');
      }
      await aborted.ready;
      view.draw();
      expect(view.layer.frames.at(-1)?.data).toEqual(['active-a', 'active-b']);
      const next = await view.prepare({ time: Decimal(30) });
      await view.load('a', 'next-a');
      await view.load('b', 'next-b');
      await next.ready;
      await view.commands['frame:commit']();
      view.draw();
      expect(view.layer.frames.at(-1)).toEqual({ data: ['next-a', 'next-b'], center: 30 });
      expect(view.layer.frames.some(({ data }) => data.some((value) => String(value).startsWith('discarded')))).toBe(
        false,
      );
    },
  );

  it('keeps all active data when one target cannot be loaded', async () => {
    const view = await activeFixture();
    const { ready } = await view.prepare();
    await view.load('a', 'partial');
    await view.load('b', undefined);
    expect(await ready).toMatchObject({ ok: false });
    view.draw();
    expect(view.layer.frames.at(-1)).toEqual({ data: ['active-a', 'active-b'], center: 10 });
  });

  it('uses the captured playback time even if loading finishes later', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(20_000);
    const view = fixture();
    const { ready } = await view.prepare({ playbackTime: null });
    vi.setSystemTime(30_000);
    await view.load('a', 'a');
    await view.load('b', 'b');
    await ready;
    await view.commands['frame:commit']();
    view.draw();
    expect(view.layer.frames.at(-1)?.center).toBe(20);
  });
});
