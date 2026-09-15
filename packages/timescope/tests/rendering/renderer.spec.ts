import type { RendererCommands } from '#src/bridge/protocol';
import type { RenderCall } from '#src/bridge/rpc';
import { Decimal } from '#src/core/decimal';
import { TimescopeMainThreadRenderer } from '#src/main/TimescopeMainThreadRenderer';
import { TimescopeLayer } from '#src/renderer/layers/TimescopeLayer';
import { TimescopeSeriesChartLayer } from '#src/renderer/layers/TimescopeSeriesChartLayer';
import { TimescopeRenderEngine } from '#src/renderer/TimescopeRenderEngine';
import type { TimescopeRenderingContext, TimescopeSeriesChartData } from '#src/renderer/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let frames: Map<number, () => void>;
let nextFrame: number;
const cleanups: (() => void)[] = [];

function canvas(): HTMLCanvasElement {
  const canvas = { width: 200, height: 100 } as HTMLCanvasElement;
  const ctx = new Proxy(
    { canvas, measureText: (text: string) => ({ width: text.length * 6 }) },
    {
      get(target, key) {
        return key in target ? target[key as keyof typeof target] : () => {};
      },
      set(target, key, value) {
        Reflect.set(target, key, value);
        return true;
      },
    },
  );
  canvas.getContext = (() => ctx) as unknown as HTMLCanvasElement['getContext'];
  return canvas;
}

async function flush() {
  for (let index = 0; index < 40; index++) await Promise.resolve();
}

async function frame() {
  const callbacks = [...frames.values()];
  frames.clear();
  for (const callback of callbacks) callback();
  await flush();
}

beforeEach(() => {
  frames = new Map();
  nextFrame = 0;
  vi.stubGlobal('document', { fonts: undefined });
  vi.stubGlobal('requestAnimationFrame', (callback: () => void) => {
    const handle = ++nextFrame;
    frames.set(handle, callback);
    return handle;
  });
  vi.stubGlobal('cancelAnimationFrame', (handle: number) => frames.delete(handle));
});

afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('renderer integration', () => {
  it('does not acquire a source when all its data presentations are disabled', async () => {
    const loader = vi.fn(async () => [{ time: 0, value: 1 }]);
    const renderer = new TimescopeMainThreadRenderer({ canvas: canvas(), fonts: [] });
    cleanups.push(() => renderer.dispose());
    renderer.setOptions({
      sources: { sample: { loader } },
      series: { sample: { data: { source: 'sample', instantaneous: false }, tooltip: false } },
      tracks: { default: { timeAxis: false } },
    });
    renderer.resize({ size: { width: 200, height: 100 }, context: { dpr: 1 } });
    await frame();
    await frame();
    expect(loader).not.toHaveBeenCalled();
  });

  it('redraws for each loaded font without waiting for slower fonts and releases only owned fonts', async () => {
    const pending = new Map<string, () => void>();
    class TestFontFace {
      constructor(readonly family: string) {}
      load() {
        return new Promise<this>((resolve) => pending.set(this.family, () => resolve(this)));
      }
    }
    vi.stubGlobal('FontFace', TestFontFace);
    const existing = new TestFontFace('document font');
    const fonts = new Set([existing]);
    const engine = new TimescopeRenderEngine({
      call: (async () => undefined) as RenderCall<RendererCommands>,
      fonts: fonts as unknown as FontFaceSet,
    });
    cleanups.push(() => engine.dispose());
    let finished = false;
    const loading = Promise.resolve(
      engine.commands.fonts([
        { family: 'fast', source: new ArrayBuffer(1) },
        { family: 'slow', source: new ArrayBuffer(1) },
      ]),
    ).then(() => {
      finished = true;
    });
    await flush();
    frames.clear();
    pending.get('fast')!();
    await flush();
    expect(finished).toBe(false);
    expect([...fonts].map((font) => font.family)).toEqual(['document font', 'fast']);
    expect(frames.size).toBe(1);
    engine.dispose();
    pending.get('slow')!();
    await loading;
    expect([...fonts]).toEqual([existing]);
    expect(frames.size).toBe(0);
  });

  it('loads real series data and presents a latched frame through the shared engine', async () => {
    const presented: TimescopeSeriesChartData[] = [];
    vi.spyOn(TimescopeSeriesChartLayer.prototype, 'render').mockImplementation((context) => {
      const data = context.dataCaches['series:sample:chart']?.data;
      if (data) presented.push(data);
    });
    const renderer = new TimescopeMainThreadRenderer({ canvas: canvas(), fonts: [] });
    cleanups.push(() => renderer.dispose());
    renderer.setOptions({
      sources: {
        sample: [
          { time: 0, value: 1 },
          { time: 10, value: 2 },
          { time: 20, value: 3 },
        ],
      },
      series: {
        sample: {
          data: { source: 'sample', instantaneous: false, domain: { axis: false, animation: false } },
          chart: 'lines',
          tooltip: false,
        },
      },
      tracks: { default: { timeAxis: false } },
    });
    renderer.resize({ size: { width: 200, height: 100 }, context: { dpr: 1 } });
    renderer.sync({ time: { type: 'set:nullvalue', nullValue: Decimal(10) } });
    await flush();
    await frame();
    await frame();
    renderer.latchFrame();
    const prepared = await renderer.prepareFrame({ time: Decimal(10), zoom: Decimal(0) }, new AbortController().signal);
    expect(prepared).toEqual({ ok: true });
    const beforeCommit = presented.length;
    expect(await renderer.commitFrame()).toEqual({ ok: true });
    expect(presented).toHaveLength(beforeCommit);
    await frame();
    expect(presented.length).toBeGreaterThan(beforeCommit);
    expect(presented.at(-1)?.data.links.length).toBeGreaterThan(0);
    expect(presented.at(-1)?.meta.resolution.eq(1)).toBe(true);
    renderer.dispose();
    expect(frames.size).toBe(0);
  });

  it('aborts a waiting frame and cancels scheduled draws when its engine is disposed', async () => {
    let finishLoad!: (value: unknown) => void;
    const pending = new Promise((resolve) => {
      finishLoad = resolve;
    });
    const call: RenderCall<RendererCommands> = async (command) => {
      return (command === 'data:load' ? await pending : undefined) as never;
    };
    class RecordingLayer extends TimescopeLayer {
      draw = vi.fn();
      override render(context: TimescopeRenderingContext) {
        this.draw(context);
      }
    }
    const layer = new RecordingLayer();
    const engine = new TimescopeRenderEngine({ call, layers: [layer] });
    cleanups.push(() => engine.dispose());
    engine.commands.init({ canvas: canvas() });
    engine.commands['options:update']({ padding: [0, 0, 0, 0], dataCacheOptions: { sample: {} } });
    engine.commands['frame:latch']();
    const captured = await engine.commands['frame:capture']({ time: Decimal(10) });
    if (!captured.ok) throw new Error(captured.message);
    const preparing = engine.commands['frame:prepare'](captured.view);
    await flush();
    const staleFrames = [...frames.values()];
    engine.dispose();
    expect(await preparing).toMatchObject({ ok: false });
    expect(frames.size).toBe(0);
    finishLoad({ data: [] });
    for (const callback of staleFrames) callback();
    await flush();
    expect(layer.draw).not.toHaveBeenCalled();
  });
});
