import { copyRenderPayload } from '#src/bridge/renderEngine';
import { Decimal } from '#src/core/decimal';
import { TimescopeMainThreadRenderer } from '#src/main/TimescopeMainThreadRenderer';
import { TimescopeLayer } from '#src/renderer/layers/TimescopeLayer';
import { TimescopeSeriesChartLayer } from '#src/renderer/layers/TimescopeSeriesChartLayer';
import { TimescopeRenderEngine } from '#src/renderer/TimescopeRenderEngine';
import type {
  RenderCall,
  RendererCommands,
  TimescopeRenderingContext,
  TimescopeSeriesChartData,
} from '#src/renderer/types';
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

describe('main-thread rendering', () => {
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

  it('copies mutable drawing payloads while preserving Decimal precision and aliases', () => {
    const value = Decimal('12345678901234567890.000000000000000000001');
    const values = new Float64Array([1, 2]);
    const payload = { value, alias: value, data: { y: values }, meta: { revision: 1 } };
    const copy = copyRenderPayload(payload);
    copy.data.y[0] = 99;
    copy.meta.revision++;
    expect(copy.value.eq(value)).toBe(true);
    expect(copy.value).toBe(copy.alias);
    expect(copy.value).not.toBe(value);
    expect(values[0]).toBe(1);
    expect(values.byteLength).toBe(16);
    expect(payload.meta.revision).toBe(1);
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
