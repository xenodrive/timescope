import { Vector2f } from '#src/core/vector';
import { dataBuffers, TimescopeWorkerRenderer } from '#src/main/TimescopeWorkerRenderer';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { workers } = vi.hoisted(() => ({
  workers: [] as { messages: any[] }[],
}));

vi.mock('../src/worker/index.ts?worker&inline', () => ({
  default: class {
    messages: any[] = [];
    listeners = new Set<EventListenerOrEventListenerObject>();

    constructor() {
      workers.push(this);
    }

    postMessage(message: any) {
      this.messages.push(message);
    }

    addEventListener(_type: string, listener: EventListenerOrEventListenerObject) {
      this.listeners.add(listener);
    }

    removeEventListener(_type: string, listener: EventListenerOrEventListenerObject) {
      this.listeners.delete(listener);
    }

    terminate() {}
  },
}));

afterEach(() => {
  workers.length = 0;
});

it('distinguishes automatic document fonts from an explicit empty font list', async () => {
  const canvas = {
    transferControlToOffscreen: () => ({}),
  } as HTMLCanvasElement;
  const automatic = new TimescopeWorkerRenderer({ canvas });
  const explicit = new TimescopeWorkerRenderer({ canvas, fonts: [] });

  await Promise.resolve();
  await Promise.resolve();

  expect(workers[0]!.messages.find((message) => message.command === 'fonts')?.payload).toBeUndefined();
  expect(workers[1]!.messages.find((message) => message.command === 'fonts')?.payload).toEqual([]);

  automatic.dispose();
  explicit.dispose();
});

function lastCacheOptions(worker: (typeof workers)[number]) {
  return worker.messages.filter((message) => message.command === 'options:update').at(-1)?.payload.dataCacheOptions;
}

function lastOptions(worker: (typeof workers)[number]) {
  return worker.messages.filter((message) => message.command === 'options:update').at(-1)?.payload;
}

describe('source immediate option', () => {
  it('converts instantaneous zoom values, including zero, to fixed resolutions', () => {
    const renderer = new TimescopeWorkerRenderer({
      canvas: {
        transferControlToOffscreen: () => ({}),
      } as HTMLCanvasElement,
      fonts: [],
    });
    const worker = workers[0]!;

    renderer.setOptions({
      sources: { data: [] },
      series: {
        zero: { data: { source: 'data', instantaneous: { using: 'value', zoom: 0 } } },
        zoomed: { data: { source: 'data', instantaneous: { using: 'value', zoom: 2 } } },
      },
    });

    const options = lastCacheOptions(worker);
    expect(options['series:zero:tooltip'].instantResolution.eq(1)).toBe(true);
    expect(options['series:zoomed:tooltip'].instantResolution.eq('0.25')).toBe(true);

    renderer.dispose();
  });

  it('omits tooltip caches when tooltip or instantaneous data is disabled', () => {
    const renderer = new TimescopeWorkerRenderer({
      canvas: {
        transferControlToOffscreen: () => ({}),
      } as HTMLCanvasElement,
      fonts: [],
    });
    const worker = workers[0]!;

    renderer.setOptions({
      sources: { data: [] },
      series: {
        tooltipDisabled: { data: { source: 'data' }, chart: 'lines', tooltip: false },
        instantaneousDisabled: { data: { source: 'data', instantaneous: false }, chart: 'lines' },
        enabled: { data: { source: 'data' }, chart: 'lines' },
      },
    });

    const options = lastCacheOptions(worker);
    expect(options).not.toHaveProperty('series:tooltipDisabled:tooltip');
    expect(options).not.toHaveProperty('series:instantaneousDisabled:tooltip');
    expect(options).toHaveProperty('series:enabled:tooltip');

    renderer.dispose();
  });

  it('creates one Y-axis cache for a shared named domain on one track', () => {
    const renderer = new TimescopeWorkerRenderer({
      canvas: {
        transferControlToOffscreen: () => ({}),
      } as HTMLCanvasElement,
      fonts: [],
    });
    const worker = workers[0]!;

    renderer.setOptions({
      sources: { data: [] },
      domains: { shared: { axis: 'right' } },
      series: {
        first: { data: { source: 'data', domain: 'shared' }, chart: 'lines' },
        second: { data: { source: 'data', domain: 'shared' }, chart: 'points' },
      },
    });

    const axisKeys = Object.keys(lastCacheOptions(worker)).filter(
      (key) => key.startsWith('tracks:default:domains:') && key.endsWith(':yAxis'),
    );
    expect(axisKeys).toHaveLength(1);

    renderer.dispose();
  });

  it('creates one shared-domain Y axis in each track where the domain is used', () => {
    const renderer = new TimescopeWorkerRenderer({
      canvas: {
        transferControlToOffscreen: () => ({}),
      } as HTMLCanvasElement,
      fonts: [],
    });
    const worker = workers[0]!;

    renderer.setOptions({
      sources: { data: [] },
      domains: { shared: { axis: true } },
      tracks: { first: {}, second: {} },
      series: {
        first: { data: { source: 'data', domain: 'shared' }, track: 'first', tooltip: false },
        second: { data: { source: 'data', domain: 'shared' }, track: 'second', tooltip: false },
      },
    });

    const axisKeys = Object.keys(lastCacheOptions(worker)).filter((key) => key.endsWith(':yAxis'));
    expect(axisKeys).toHaveLength(2);
    expect(axisKeys.some((key) => key.startsWith('tracks:first:domains:'))).toBe(true);
    expect(axisKeys.some((key) => key.startsWith('tracks:second:domains:'))).toBe(true);

    renderer.dispose();
  });

  it('does not create series data loaders when every presentation is disabled', () => {
    const renderer = new TimescopeWorkerRenderer({
      canvas: {
        transferControlToOffscreen: () => ({}),
      } as HTMLCanvasElement,
      fonts: [],
    });
    const worker = workers[0]!;

    renderer.setOptions({
      sources: { data: [] },
      series: {
        hidden: {
          data: { source: 'data', instantaneous: false },
          tooltip: false,
        },
      },
    });

    expect(Object.keys(lastCacheOptions(worker)).filter((key) => key.startsWith('series:'))).toEqual([]);

    renderer.dispose();
  });

  it('adds and removes the tooltip cache when tooltip is toggled', () => {
    const renderer = new TimescopeWorkerRenderer({
      canvas: {
        transferControlToOffscreen: () => ({}),
      } as HTMLCanvasElement,
      fonts: [],
    });
    const worker = workers[0]!;
    const series = (tooltip: boolean) => ({
      data: { source: 'data' },
      chart: 'lines' as const,
      tooltip,
    });

    renderer.setOptions({ sources: { data: [] }, series: { first: series(true) } });
    expect(lastCacheOptions(worker)).toHaveProperty('series:first:tooltip');

    renderer.updateOptions({ series: { first: series(false) } });
    expect(lastCacheOptions(worker)).not.toHaveProperty('series:first:tooltip');

    renderer.updateOptions({ series: { first: series(true) } });
    expect(lastCacheOptions(worker)).toHaveProperty('series:first:tooltip');

    renderer.dispose();
  });

  it('transfers every ephemeral data buffer once', () => {
    const backing = new ArrayBuffer(32);
    const x = new Float64Array(backing, 0, 2);
    const y = new Float64Array(backing, 16, 2);
    const path = new Float64Array([1, 2, 3]);

    expect(
      dataBuffers({
        data: {
          x: { time: x },
          y: { value: y },
          links: [{ commands: { values: path } }],
        },
      }),
    ).toEqual([backing, path.buffer]);

    const instantaneous = new Float64Array([4, 5]);
    expect(dataBuffers({ data: { y: instantaneous } })).toEqual([instantaneous.buffer]);
  });

  it('keeps inline source arrays opaque while updating options', () => {
    let reads = 0;
    const data = new Proxy([{ time: 0, value: 1 }], {
      get(target, property, receiver) {
        reads++;
        return Reflect.get(target, property, receiver);
      },
    });
    const renderer = new TimescopeWorkerRenderer({
      canvas: {
        transferControlToOffscreen: () => ({}),
      } as HTMLCanvasElement,
      fonts: [],
    });

    renderer.setOptions({ sources: { data } });

    expect(reads).toBe(0);
    renderer.dispose();
  });

  it('preserves default tracks for the worker time axis', () => {
    const renderer = new TimescopeWorkerRenderer({
      canvas: {
        transferControlToOffscreen: () => ({}),
      } as HTMLCanvasElement,
      fonts: [],
    });
    const worker = workers[0]!;

    renderer.setOptions({});

    const options = lastOptions(worker);
    expect(options).toHaveProperty('tracks', undefined);
    expect(options).toHaveProperty('series', undefined);

    renderer.dispose();
  });

  it('sends the merged background color to the worker', () => {
    const renderer = new TimescopeWorkerRenderer({
      canvas: {
        transferControlToOffscreen: () => ({}),
      } as HTMLCanvasElement,
      fonts: [],
    });
    const worker = workers[0]!;

    renderer.setOptions({ style: { background: '#123456' } });
    expect(lastOptions(worker).background).toBe('#123456');

    renderer.updateOptions({ style: { height: '100px' } });
    expect(lastOptions(worker).background).toBe('#123456');

    renderer.dispose();
  });

  it('marks charts by source policy and tooltip caches as immediate', () => {
    const renderer = new TimescopeWorkerRenderer({
      canvas: {
        transferControlToOffscreen: () => ({}),
      } as HTMLCanvasElement,
      fonts: [],
    });
    const worker = workers[0]!;

    renderer.setOptions({
      sources: {
        fast: { data: [] },
        deferred: { data: [], immediate: false },
      },
      series: {
        first: { data: { source: 'fast' }, chart: 'lines' },
        second: { data: { source: 'fast' }, chart: 'points' },
        third: { data: { source: 'deferred' }, chart: 'lines' },
      },
    });

    let options = lastCacheOptions(worker);
    expect(options['series:first:chart']).toEqual({ immediate: true });
    expect(options['series:second:chart']).toEqual({ immediate: true });
    expect(options['series:third:chart']).toEqual({});
    expect(options['series:first:tooltip'].immediate).toBe(true);

    const workerOptions = lastOptions(worker);
    expect(workerOptions).not.toHaveProperty('sources');
    expect(workerOptions).not.toHaveProperty('domains');
    expect(workerOptions.series).toEqual({ first: {}, second: {}, third: {} });

    const position = new Vector2f(10, 20);
    renderer.onPointerEvent({
      type: 'drag:update',
      state: 'drag',
      latest: {
        pointerId: 1,
        latest: position,
        last: position,
        delta: new Vector2f(1, 2),
        anchor: new Vector2f(0, 0),
        pressed: true,
      },
      buttons: [],
      shiftKey: false,
    });
    const pointer = worker.messages.findLast((message) => message.command === 'pointer')!.payload;
    expect(pointer.latest.latest).toEqual({ x: 10, y: 20 });
    expect(pointer.latest.delta).toEqual({ x: 1, y: 2 });
    expect(pointer.latest.latest).not.toBeInstanceOf(Vector2f);
    expect(options['series:second:tooltip'].immediate).toBe(true);

    renderer.updateOptions({
      sources: {
        fast: { data: [], immediate: false },
        deferred: { data: [] },
      },
    });

    options = lastCacheOptions(worker);
    expect(options['series:first:chart']).toEqual({});
    expect(options['series:second:chart']).toEqual({});
    expect(options['series:third:chart']).toEqual({ immediate: true });
    expect(options['series:first:tooltip'].immediate).toBe(true);

    renderer.dispose();
  });
});
