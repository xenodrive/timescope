import { createCanvas } from '@napi-rs/canvas';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { makeDummyResponse } from '../prom/dummy-data';
import type {
  RendererCommands,
  TimescopeDataCacheOptionsWire,
  TimescopeViewChangedMessage,
  WorkerCommands,
} from '../src/bridge/protocol';
import { defineCalls, listenCalls, type WorkerMessagePort } from '../src/bridge/rpc';
import { TimescopeState } from '../src/core/TimescopeState';
import type { TimescopeDomainOptions, TimescopeOptions, TimescopeTimeAxisOptions } from '../src/core/types';
import { TimescopeDomain } from '../src/main/TimescopeDomain';
import { createDataSeries } from '../src/main/TimescopeDataSeries';
import { createDataSource } from '../src/main/TimescopeDataSource';
import { TimescopeSeriesChartProvider } from '../src/main/providers/TimescopeSeriesChartProvider';
import { TimescopeSeriesInstantaneousValueProvider } from '../src/main/providers/TimescopeSeriesInstantaneousValueProvider';
import { TimescopeTimeAxisProvider } from '../src/main/providers/TimescopeTimeAxisProvider';
import { createTimescopeWorkerThread } from '../src/worker/WorkerThread';
import type { TimescopeChunk } from '../src/core/chunk';

type MessageListener = (ev: { data: any }) => void;

class LocalMessagePort {
  peer?: LocalMessagePort;
  listeners = new Set<MessageListener>();

  postMessage(message: any) {
    queueMicrotask(() => {
      this.peer?.dispatch(message);
    });
  }

  addEventListener(type: string, listener: MessageListener | EventListenerOrEventListenerObject) {
    if (type === 'message') this.listeners.add(listener as MessageListener);
  }

  removeEventListener(type: string, listener: MessageListener | EventListenerOrEventListenerObject) {
    if (type === 'message') this.listeners.delete(listener as MessageListener);
  }

  dispatch(message: any) {
    for (const listener of this.listeners) {
      listener({ data: message });
    }
  }
}

function createLocalChannel() {
  const a = new LocalMessagePort();
  const b = new LocalMessagePort();
  a.peer = b;
  b.peer = a;
  return { a, b };
}

describe('worker fps benchmark', () => {
  let originalRaf: typeof globalThis.requestAnimationFrame | undefined;
  let originalCancel: typeof globalThis.cancelAnimationFrame | undefined;
  let originalOffscreenCanvas: typeof globalThis.OffscreenCanvas | undefined;
  const frameIntervalMs = 16;

  beforeAll(() => {
    originalRaf = globalThis.requestAnimationFrame;
    originalCancel = globalThis.cancelAnimationFrame;
    originalOffscreenCanvas = globalThis.OffscreenCanvas;
    globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) =>
      setTimeout(() => cb(performance.now()), frameIntervalMs)) as unknown as typeof globalThis.requestAnimationFrame;
    globalThis.cancelAnimationFrame = ((id: number) =>
      clearTimeout(id as unknown as NodeJS.Timeout)) as unknown as typeof globalThis.cancelAnimationFrame;

    if (!globalThis.OffscreenCanvas) {
      class OffscreenCanvasPolyfill {
        #canvas;
        constructor(width: number, height: number) {
          this.#canvas = createCanvas(width, height);
        }
        get width() {
          return this.#canvas.width;
        }
        set width(value: number) {
          this.#canvas.width = value;
        }
        get height() {
          return this.#canvas.height;
        }
        set height(value: number) {
          this.#canvas.height = value;
        }
        getContext(type: '2d') {
          return this.#canvas.getContext(type);
        }
      }
      globalThis.OffscreenCanvas = OffscreenCanvasPolyfill as unknown as typeof globalThis.OffscreenCanvas;
    }
  });

  afterAll(() => {
    if (originalRaf) globalThis.requestAnimationFrame = originalRaf;
    if (originalCancel) globalThis.cancelAnimationFrame = originalCancel;
    if (originalOffscreenCanvas) {
      globalThis.OffscreenCanvas = originalOffscreenCanvas;
    } else {
      delete (globalThis as { OffscreenCanvas?: typeof globalThis.OffscreenCanvas }).OffscreenCanvas;
    }
  });

  it('keeps worker fps at or above 50 during zoom animations', async () => {
    const { a: mainPort, b: workerPort } = createLocalChannel();

    const frameTimes: number[] = [];
    createTimescopeWorkerThread(workerPort as unknown as WorkerMessagePort, undefined, (cb) => {
      setTimeout(() => {
        frameTimes.push(performance.now());
        cb();
      }, frameIntervalMs);
    });

    const pivot = (data: { metric: Record<string, string>; values: [number, string | null][] }[]) => {
      if (!data) return [];
      const byTime = new Map<number, Record<string, number | null>>();
      for (const series of data) {
        const key = series.metric.rollup;
        for (const [ts, v] of series.values) {
          const time = Number(ts);
          const row = byTime.get(time) ?? { time, min: null, max: null, avg: null };
          row[key] = v === null ? null : Number(v);
          byTime.set(time, row);
        }
      }
      return Array.from(byTime.values()).sort((a, b) => (a.time as number) - (b.time as number));
    };

    const sources = {
      netin: createDataSource({
        async loader(chunk: TimescopeChunk) {
          return makeDummyResponse(
            { start: Number(chunk.range[0]), end: Number(chunk.range[1]), step: Number(chunk.resolution) },
            'netin',
          );
        },
      }),
      netout: createDataSource({
        async loader(chunk: TimescopeChunk) {
          return makeDummyResponse(
            { start: Number(chunk.range[0]), end: Number(chunk.range[1]), step: Number(chunk.resolution) },
            'netout',
          );
        },
      }),
    };

    const options: TimescopeOptions = {
      padding: [5, 5, 5, 5],
      indicator: false,
      tracks: {
        default: {},
      },
      series: {
        netin0: {
          data: {
            source: 'netin',
            domain: {
              range: [undefined, undefined],
              expand: true,
              shrink: true,
            },
            parser(data: unknown) {
              const d = data as { data?: { result?: { metric: Record<string, string>; values: [number, string | null][] }[] } };
              return pivot(d?.data?.result?.filter((entry) => entry.metric.host === 'docker') ?? []);
            },
            value: ['avg', 'min', 'max'],
            color: '#008000',
          },
          chart: {
            links: [
              { draw: 'line', using: 'avg' },
              { draw: 'area', using: ['min', 'max'] },
            ],
          },
        },
        netout0: {
          data: {
            source: 'netout',
            domain: {
              range: [undefined, undefined],
              expand: true,
              shrink: true,
            },
            parser(data: unknown) {
              const d = data as { data?: { result?: { metric: Record<string, string>; values: [number, string | null][] }[] } };
              return pivot(d?.data?.result?.filter((entry) => entry.metric.host === 'docker') ?? []);
            },
            value: ['avg', 'min', 'max'],
            color: '#800000',
          },
          chart: {
            links: [
              { draw: 'line', using: 'avg' },
              { draw: 'area', using: ['min', 'max'] },
            ],
          },
        },
        netin1: {
          data: {
            source: 'netin',
            domain: {
              range: [undefined, undefined],
              expand: true,
              shrink: true,
            },
            parser(data: unknown) {
              const d = data as { data?: { result?: { metric: Record<string, string>; values: [number, string | null][] }[] } };
              return pivot(d?.data?.result?.filter((entry) => entry.metric.host === 'openwrt') ?? []);
            },
            value: ['avg', 'min', 'max'],
            color: '#000080',
          },
          chart: {
            links: [
              { draw: 'line', using: 'avg' },
              { draw: 'area', using: ['min', 'max'] },
            ],
          },
        },
        netout1: {
          data: {
            source: 'netout',
            domain: {
              range: [undefined, undefined],
              expand: true,
              shrink: true,
            },
            parser(data: unknown) {
              const d = data as { data?: { result?: { metric: Record<string, string>; values: [number, string | null][] }[] } };
              return pivot(d?.data?.result?.filter((entry) => entry.metric.host === 'openwrt') ?? []);
            },
            value: ['avg', 'min', 'max'],
            color: '#808000',
          },
          chart: {
            links: [
              { draw: 'line', using: 'avg' },
              { draw: 'area', using: ['min', 'max'] },
            ],
          },
        },
      },
      sources: {
        netin: {},
        netout: {},
      },
    };

    const resolveDomain = (ref: string | TimescopeDomainOptions | undefined) => {
      if (typeof ref === 'string') {
        const named = options.domains?.[ref];
        if (!named) throw new Error(`Unknown domain: ${ref}`);
        return new TimescopeDomain(named);
      }
      if (ref && typeof ref === 'object') {
        return new TimescopeDomain(ref);
      }
      return new TimescopeDomain({});
    };

    const seriesMap = Object.fromEntries(
      Object.entries(options.series ?? {}).map(([key, series]) => [
        key,
        createDataSeries({ sources, options: series, domain: resolveDomain(series.data.domain) }),
      ]),
    );

    const dataCacheOptions: Record<string, TimescopeDataCacheOptionsWire> = {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const providers: Record<string, { loadData: (range: any, resolution: any) => Promise<any> }> = {};

    const trackIds = Object.keys(options.tracks ?? { default: {} });
    for (const trackId of trackIds) {
      const trackConfig = options.tracks?.[trackId];
      const timeAxis: TimescopeTimeAxisOptions =
        typeof trackConfig?.timeAxis === 'object' ? trackConfig.timeAxis : {};
      const key = `tracks:${trackId}:timeAxis`;
      providers[key] = new TimescopeTimeAxisProvider({ timeAxis });
      dataCacheOptions[key] = { immediate: true };
    }

    for (const [key, series] of Object.entries(seriesMap)) {
      providers[`series:${key}:chart`] = new TimescopeSeriesChartProvider({ series });
      providers[`series:${key}:instantaneous`] = new TimescopeSeriesInstantaneousValueProvider({ series });
      dataCacheOptions[`series:${key}:chart`] = {};
      dataCacheOptions[`series:${key}:instantaneous`] = {};
    }

    listenCalls<RendererCommands>(mainPort as unknown as WorkerMessagePort, {
      sync: () => {},
      'renderer:event': () => {},
      'provider:loadData': async ({ key, range, resolution }) => {
        return await providers[key].loadData(range, resolution);
      },
      'view:changed': async (_e: TimescopeViewChangedMessage) => {},
      'view:changing': () => {},
    });

    const call = defineCalls<WorkerCommands>(mainPort as unknown as WorkerMessagePort);

    const canvas = new OffscreenCanvas(800, 200);
    const ctx = canvas.getContext('2d');
    if (ctx && !Object.prototype.hasOwnProperty.call(ctx, 'reset')) {
      // Polyfill reset method for environments that don't support it
      (ctx as OffscreenCanvasRenderingContext2D & { reset: () => void }).reset = function (this: OffscreenCanvasRenderingContext2D) {
        this.setTransform(1, 0, 0, 1, 0, 0);
      };
    }

    await call('init', { canvas }, { transfer: [canvas as unknown as Transferable] });
    await call('resize', { size: { width: 800, height: 200 }, context: { dpr: 1 } }, { rpc: true });
    await call('options:update', { ...options, dataCacheOptions }, { rpc: true });

    const state = new TimescopeState({ time: '2026-01-12 16:00', zoom: -10 });
    state.time.on('sync', (e) => {
      call('sync', { time: e.value });
    });
    state.zoom.on('sync', (e) => {
      call('sync', { zoom: e.value });
    });
    state.time.restore();
    state.zoom.restore();

    const redrawTimer = setInterval(() => {
      call('redraw', {});
    }, frameIntervalMs);

    const steps = 18;
    const delayMs = 80;
    const animationMs = 200;
    const animationWindows: Array<[number, number]> = [];
    for (let i = 0; i < steps; i += 1) {
      state.setZoom(i % 2 === 0 ? 0 : 1);
      const start = performance.now();
      animationWindows.push([start, start + animationMs]);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    await new Promise((resolve) => setTimeout(resolve, animationMs + frameIntervalMs * 2));
    clearInterval(redrawTimer);
    const animatingFrames = frameTimes.filter((t) => animationWindows.some(([start, end]) => t >= start && t <= end));
    expect(animatingFrames.length).toBeGreaterThan(1);

    const animatingIntervals = animatingFrames.slice(1).map((t, i) => t - animatingFrames[i]);
    expect(animatingIntervals.length).toBeGreaterThan(0);

    const maxInterval = Math.max(...animatingIntervals);
    const minFps = 1000 / maxInterval;
    const durationMs = animatingFrames[animatingFrames.length - 1] - animatingFrames[0];
    const avgFps = durationMs > 0 ? ((animatingFrames.length - 1) * 1000) / durationMs : 0;
    console.info(
      `worker fps (animating) min=${minFps.toFixed(1)} avg=${avgFps.toFixed(1)} frames=${animatingFrames.length}`,
    );
    expect(minFps).toBeGreaterThanOrEqual(50);
  });
});
