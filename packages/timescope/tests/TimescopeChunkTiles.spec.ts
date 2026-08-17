import { createChunk, createChunkList, type TimescopeChunk } from '#src/core/chunk';
import { Decimal } from '#src/core/decimal';
import { PathCommand } from '#src/core/path';
import { resolutionFor } from '#src/core/zoom';
import { TimescopeDataSeries, type TimescopeSeriesPoint } from '#src/main/TimescopeDataSeries';
import { chunkStoreForDataSource, createDataSource, TimescopeDataSourceBase } from '#src/main/TimescopeDataSource';
import { TimescopeDomain } from '#src/main/TimescopeDomain';
import { TimescopeSeriesChart } from '#src/main/TimescopeSeriesChart';
import { TimescopeSeriesTooltip } from '#src/main/TimescopeSeriesTooltip';
import { TimescopeViewRegistry, type TimescopeViewState } from '#src/main/TimescopeView';
import { TimescopeAggregateSeriesIndex } from '#src/main/static/TimescopeAggregateSeriesIndex';
import { createYProjection } from '#src/main/yProjection';
import { describe, expect, it, vi } from 'vitest';

const seriesPoint = (time: number, value = time): TimescopeSeriesPoint => ({
  times: { time: Decimal(time) },
  values: { value: Decimal(value) },
  data: {},
  range: [Decimal(time), Decimal(time), '[]'],
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function viewState(
  range: [Decimal, Decimal],
  resolution: Decimal,
  options: Partial<Pick<TimescopeViewState, 'editing' | 'animating' | 'phase'>> & {
    currentRange?: [Decimal, Decimal];
    currentResolution?: Decimal;
  } = {},
): TimescopeViewState {
  const center = range[0].add(range[1]).div(2);
  const currentRange = options.currentRange ?? range;
  const halfSize = range[1].sub(range[0]).div(resolution).number() / 2;
  return {
    current: {
      center: currentRange[0].add(currentRange[1]).div(2),
      resolution: options.currentResolution ?? resolution,
    },
    candidate: { center, resolution },
    cursor: { center },
    axisSize: [halfSize, halfSize],
    editing: options.editing ?? false,
    animating: options.animating ?? false,
    phase: options.phase ?? 'changed',
  };
}

function registryOptions(registry: TimescopeViewRegistry) {
  return { viewContext: registry };
}

function domainFor(options: ConstructorParameters<typeof TimescopeDomain>[0] = {}) {
  return new TimescopeDomain(options);
}

async function preloadSeries(series: TimescopeDataSeries, range: [Decimal, Decimal], resolution: Decimal) {
  const store = chunkStoreForDataSource(series.source);
  await Promise.all(
    createChunkList(range, resolution, series.chunkSize, series.chunkOffset).map((chunk) => store.loadChunk(chunk)),
  );
}

type SyntheticTile = {
  range: readonly Decimal[];
  resolution: Decimal;
  rows: readonly TimescopeSeriesPoint[];
};

async function syntheticChart(input: unknown, range: [Decimal, Decimal], resolution: Decimal) {
  const fixture = input as {
    tiles: readonly SyntheticTile[];
    options: unknown;
    color?: string;
    domain: unknown;
  };
  const tiles = fixture.tiles.filter((tile) => tile.range[0].lt(range[1]) && range[0].lt(tile.range[1]));
  const first = tiles[0] ?? fixture.tiles[0];
  const chunkSize = Math.max(
    1,
    first.range[1].sub(first.range[0]).div(resolution).number(),
    Math.ceil(range[1].sub(range[0]).div(resolution).number() / 100),
  );
  class Source extends TimescopeDataSourceBase {
    constructor() {
      super({ chunkSize, chunkOffset: first.range[0], resolutions: [resolution] });
    }

    async query(descriptor: TimescopeChunk) {
      const direct = tiles
        .filter((tile) => tile.range[0].lt(descriptor.range[1]!) && descriptor.range[0]!.lt(tile.range[1]))
        .flatMap((tile) => tile.rows);
      const context = tiles
        .flatMap((tile) => tile.rows)
        .filter(
          (row) =>
            row.range[0].neq(row.range[1]) &&
            row.range[0].lt(descriptor.range[1]!) &&
            descriptor.range[0]!.lt(row.range[1]),
        );
      return [
        ...new Map(
          [...direct, ...context].map((row) => [
            `${row.range.map(String).join(':')}:${Object.values(row.times).map(String).join(':')}:${Object.values(
              row.values,
            )
              .map(String)
              .join(':')}`,
            row,
          ]),
        ).values(),
      ];
    }
  }
  const source = new Source();
  const series = {
    options: fixture.options,
    color: fixture.color,
    domain: {
      ...(fixture.domain as object),
      reportExtent: (fixture.domain as { reportExtent?: TimescopeDomain['reportExtent'] }).reportExtent ?? (() => {}),
    },
    immediate: true,
    chunkSize,
    chunkOffset: first.range[0],
    resolutions: [resolution],
    source,
  } as unknown as TimescopeDataSeries;
  const registry = new TimescopeViewRegistry();
  registry.update(viewState(range, resolution));
  const provider = new TimescopeSeriesChart({ series, ...registryOptions(registry) });
  await provider.waitForTarget();
  return { provider, series, registry };
}

describe('chunk descriptors', () => {
  it('aligns chunk ranges to a time-valued offset', () => {
    const chunks = createChunkList([Decimal(12), Decimal(25)], Decimal(2), 5, Decimal(3));
    expect(chunks.map((chunk) => chunk.range.map((value) => value?.number()))).toEqual([
      [3, 13],
      [13, 23],
      [23, 33],
      [33, 43],
    ]);
  });
});

describe('source invalidation', () => {
  it('keeps a series tile visible while a source invalidation refreshes it', async () => {
    class ControlledSource extends TimescopeDataSourceBase {
      requests = new Map<string, ReturnType<typeof deferred<readonly TimescopeSeriesPoint[]>>[]>();

      async query(chunk: TimescopeChunk) {
        const request = deferred<readonly TimescopeSeriesPoint[]>();
        this.requests.set(chunk.id, [...(this.requests.get(chunk.id) ?? []), request]);
        return request.promise;
      }
    }

    const source = new ControlledSource({ chunkSize: 10, resolutions: [1] });
    const registry = new TimescopeViewRegistry();
    const series = new TimescopeDataSeries({
      sources: { source },
      domain: domainFor(),
      options: { data: { source: 'source' }, chart: 'lines' },
    });
    const chunks = createChunkList([Decimal(0), Decimal(9)], Decimal(1), series.chunkSize, series.chunkOffset);
    const store = chunkStoreForDataSource(series.source);
    const loading = chunks.map((chunk) => store.loadChunk(chunk));
    await vi.waitFor(() => expect(source.requests.size).toBeGreaterThan(0));
    for (const chunk of chunks) {
      source.requests.get(chunk.id)![0].resolve([seriesPoint(Number(chunk.seq), 1)]);
    }
    await Promise.all(loading);
    expect(
      chunks.flatMap((chunk) => store.peekChunk(chunk)?.data ?? []).map((row) => row.values.value?.number()),
    ).toContain(1);

    source.invalidate([Decimal(0), Decimal(5)]);
    const refresh = store.loadChunk(chunks.find((chunk) => chunk.id === 'r1:seq0')!);
    await vi.waitFor(() => expect(source.requests.get('r1:seq0')).toHaveLength(2));

    source.requests.get('r1:seq0')![1].resolve([seriesPoint(1, 2)]);
    await expect(refresh).resolves.toMatchObject({
      data: [expect.objectContaining({ values: { value: Decimal(2) } })],
    });
    series.dispose();
  });
});

describe('tile consumers', () => {
  it('uses shared source tiles without loading while moving, then loads the instantaneous resolution', async () => {
    const rowsFor = (chunk: TimescopeChunk) => {
      const rows = [];
      for (let time = chunk.range[0]!; time.lt(chunk.range[1]!); time = time.add(chunk.resolution)) {
        rows.push({
          times: { time, observed: time },
          values: { value: 0.5, selected: chunk.resolution },
        });
      }
      return rows;
    };
    const pending = new Map<
      string,
      { chunk: TimescopeChunk; result: ReturnType<typeof deferred<ReturnType<typeof rowsFor>>> }
    >();
    const instantResolution = resolutionFor(2);
    const loader = vi.fn((chunk: TimescopeChunk) => {
      if (!chunk.resolution.eq(instantResolution)) return Promise.resolve(rowsFor(chunk));
      const result = deferred<ReturnType<typeof rowsFor>>();
      pending.set(chunk.id, { chunk, result });
      return result.promise;
    });
    const source = createDataSource({ loader, chunkSize: 4 });
    const registry = new TimescopeViewRegistry();
    const domain = domainFor({ range: [0, 1] });
    const series = new TimescopeDataSeries({
      sources: { source },
      domain,
      options: {
        data: { source: 'source', instantaneous: { using: 'selected@observed', zoom: 2 } },
        chart: 'lines',
      },
    });
    domain.removeSeries(series);
    const fallbackResolution = Decimal(2);

    await preloadSeries(series, [Decimal(8), Decimal(24)], fallbackResolution);
    const callsAfterPreload = loader.mock.calls.length;

    const instantRange: [Decimal, Decimal] = [Decimal(10), Decimal(11)];
    registry.update(
      viewState(instantRange, instantResolution, {
        currentResolution: fallbackResolution,
        editing: true,
        phase: 'changing',
      }),
    );
    const provider = new TimescopeSeriesTooltip({ series, ...registryOptions(registry) });
    const moving = await provider.loadData(instantRange, instantResolution, undefined, {
      fallbackResolution,
      loadMissing: false,
    });

    expect(loader).toHaveBeenCalledTimes(callsAfterPreload);
    expect(moving.data.t.map((time) => time.number())).toContain(10);
    expect(new Set(moving.data.y)).toEqual(new Set([2]));

    const betweenFallbackSamples = await provider.loadData(
      [Decimal(11), Decimal('11.5')],
      instantResolution,
      undefined,
      {
        fallbackResolution,
        loadMissing: false,
      },
    );
    expect(betweenFallbackSamples.data.t.map((time) => time.number())).toEqual([10]);
    expect(loader).toHaveBeenCalledTimes(callsAfterPreload);

    const fallbackWhileLoading = await provider.loadData(instantRange, instantResolution, undefined, {
      fallbackResolution,
      loadMissing: true,
    });
    expect(new Set(fallbackWhileLoading.data.y)).toEqual(new Set([2]));
    expect([...pending.values()].map(({ chunk }) => chunk.range.map((value) => value!.number()))).toEqual([
      [10, 11],
      [11, 12],
      [12, 13],
    ]);

    const loaded = new Promise<void>((resolve) => {
      const unsubscribe = provider.on('change', () => {
        unsubscribe();
        resolve();
      });
    });
    const firstInstant = [...pending.values()].find(({ chunk }) => chunk.range[0]!.eq(instantRange[0]))!;
    firstInstant.result.resolve(rowsFor(firstInstant.chunk));
    await loaded;

    const instantaneous = await provider.loadData(instantRange, instantResolution, undefined, {
      fallbackResolution,
      loadMissing: true,
    });
    expect(new Set(instantaneous.data.y)).toEqual(new Set([0.25]));

    const cachedRange: [Decimal, Decimal] = [Decimal('10.1'), Decimal('10.9')];
    const callsAfterInstantLoad = loader.mock.calls.length;
    const cached = await provider.loadData(cachedRange, instantResolution, undefined, {
      fallbackResolution,
      loadMissing: false,
    });
    expect(new Set(cached.data.y)).toEqual(new Set([0.25]));
    expect(loader).toHaveBeenCalledTimes(callsAfterInstantLoad);

    const newRange: [Decimal, Decimal] = [Decimal(20), Decimal(21)];
    registry.update(
      viewState(newRange, instantResolution, {
        currentResolution: fallbackResolution,
        editing: true,
        phase: 'changing',
      }),
    );
    const fallbackAtNewRange = await provider.loadData(newRange, instantResolution, undefined, {
      fallbackResolution,
      loadMissing: false,
    });
    expect(new Set(fallbackAtNewRange.data.y)).toEqual(new Set([2]));
    expect(loader).toHaveBeenCalledTimes(callsAfterInstantLoad);

    const missingRange: [Decimal, Decimal] = [Decimal(100), Decimal(101)];
    registry.update(
      viewState(missingRange, instantResolution, {
        currentResolution: fallbackResolution,
        editing: true,
        phase: 'changing',
      }),
    );
    const missing = await provider.loadData(missingRange, instantResolution, undefined, {
      fallbackResolution,
      loadMissing: false,
    });
    expect(missing.data.t).toEqual([]);
    expect(loader.mock.calls.length).toBeGreaterThan(callsAfterInstantLoad);

    for (const { chunk, result } of pending.values()) result.resolve(rowsFor(chunk));
    await Promise.resolve();
    provider.dispose();
    series.dispose();
  });

  it('uses a cached context row before the selected time', async () => {
    const loader = vi.fn(async (chunk: TimescopeChunk) => [
      {
        times: { time: chunk.range[0]!.sub(chunk.resolution), observed: chunk.range[0]!.sub(chunk.resolution) },
        values: { value: 0, selected: 1 },
      },
      {
        times: {
          time: chunk.range[0]!.add(chunk.resolution.mul(2)),
          observed: chunk.range[0]!.add(chunk.resolution.mul(2)),
        },
        values: { value: 0, selected: 2 },
      },
    ]);
    const source = createDataSource({ loader, chunkSize: 4, immediate: false });
    const registry = new TimescopeViewRegistry();
    const series = new TimescopeDataSeries({
      sources: { source },
      domain: domainFor({ range: [0, 2] }),
      options: { data: { source: 'source', instantaneous: { using: 'selected@observed', zoom: 2 } } },
    });
    series.domain.removeSeries(series);
    const fallbackResolution = Decimal(2);
    await preloadSeries(series, [Decimal(8), Decimal(16)], fallbackResolution);
    const callsAfterPreload = loader.mock.calls.length;
    registry.update(
      viewState([Decimal(10), Decimal('10.5')], resolutionFor(2), {
        currentResolution: fallbackResolution,
        editing: true,
        phase: 'changing',
      }),
    );
    const provider = new TimescopeSeriesTooltip({ series, ...registryOptions(registry) });

    const result = await provider.loadData([Decimal(10), Decimal('10.5')], resolutionFor(2), undefined, {
      fallbackResolution,
      loadMissing: false,
    });

    expect(result.data.t.map((time) => time.number())).toEqual([6]);
    expect(loader).toHaveBeenCalledTimes(callsAfterPreload);
    provider.dispose();
    series.dispose();
  });

  it('respects source immediate policy for fallback loads while moving', async () => {
    const loader = vi.fn(async () => []);
    const source = createDataSource({ loader, chunkSize: 4, immediate: false });
    const registry = new TimescopeViewRegistry();
    const series = new TimescopeDataSeries({
      sources: { source },
      domain: domainFor({ range: [0, 1] }),
      options: { data: { source: 'source', instantaneous: { zoom: 2 } } },
    });
    series.domain.removeSeries(series);
    const provider = new TimescopeSeriesTooltip({ series, ...registryOptions(registry) });
    const range: [Decimal, Decimal] = [Decimal(10), Decimal(11)];
    registry.update(viewState(range, resolutionFor(2), { editing: true, phase: 'changing' }));

    await provider.loadData(range, resolutionFor(2), undefined, {
      fallbackResolution: Decimal(2),
      loadMissing: false,
    });
    expect(loader).not.toHaveBeenCalled();

    await provider.loadData(range, resolutionFor(2), undefined, {
      fallbackResolution: Decimal(2),
      loadMissing: true,
    });
    expect(loader.mock.calls.length).toBeGreaterThan(0);
    provider.dispose();
    series.dispose();
  });

  it('loads a same-resolution fallback while moving when the source is immediate', async () => {
    const loader = vi.fn(async () => []);
    const source = createDataSource({ loader, chunkSize: 4 });
    const registry = new TimescopeViewRegistry();
    const series = new TimescopeDataSeries({
      sources: { source },
      domain: domainFor({ range: [0, 1] }),
      options: { data: { source: 'source' } },
    });
    series.domain.removeSeries(series);
    const provider = new TimescopeSeriesTooltip({ series, ...registryOptions(registry) });
    registry.update(viewState([Decimal(10), Decimal(11)], Decimal(2), { editing: true, phase: 'prepare' }));

    await provider.loadData([Decimal(10), Decimal(11)], Decimal(2), undefined, {
      fallbackResolution: Decimal(2),
      loadMissing: false,
    });

    expect(loader.mock.calls.length).toBeGreaterThan(0);
    provider.dispose();
    series.dispose();
  });

  it('keeps chart preset geometry stable when movement settles at time 0.4', async () => {
    const resolution = resolutionFor(10);
    const halfWidth = resolution.mul(688 / 2);
    const rangeAt = (time: number): [Decimal, Decimal] => {
      const center = Decimal(time);
      return [center.sub(halfWidth), center.add(halfWidth)];
    };
    const source = createDataSource([
      { time: 0, value: 0.2 },
      { time: 1, value: 0.45 },
      { time: 2, value: 0.6 },
      { time: 3, value: 0.4 },
    ]);
    const registry = new TimescopeViewRegistry();
    const series = new TimescopeDataSeries({
      sources: { source },
      domain: domainFor({ range: [0, 1] }),
      options: { data: { source: 'source' }, chart: 'curvespoints:filled' },
    });
    const provider = new TimescopeSeriesChart({ series, ...registryOptions(registry) });
    const viewport = rangeAt(0.4);
    const geometryAtViewport = async () => {
      const result = await provider.transform(series, viewport, resolution);
      const commands = result.data.links.find((link) => link.draw === 'curve')!.commands.values;
      expect(commands[0]).toBe(PathCommand.moveTo);
      expect(commands[3]).toBe(PathCommand.bezierCurveTo);
      const t = (344 - commands[1]) / (commands[8] - commands[1]);
      const mt = 1 - t;
      return {
        y:
          (mt ** 3 * commands[2] +
            3 * mt ** 2 * t * commands[5] +
            3 * mt * t ** 2 * commands[7] +
            t ** 3 * commands[9]) *
          240,
        slope: ((commands[9] - commands[7]) / (commands[8] - commands[6])) * 240,
      };
    };

    registry.update(viewState(viewport, resolution));
    await provider.waitForTarget();
    registry.update(viewState(rangeAt(0.7), resolution, { currentRange: viewport, editing: true, phase: 'changing' }));
    await provider.waitForTarget();
    const moving = await geometryAtViewport();

    registry.update(viewState(viewport, resolution));
    await provider.waitForTarget();
    const settled = await geometryAtViewport();

    provider.dispose();
    series.dispose();
    expect.soft(settled.y).toBeCloseTo(moving.y, 5);
    expect.soft(settled.slope).toBeCloseTo(moving.slope, 5);
  });

  it.each([55, 65, 70])('keeps a line across distant context points at zoom %s', async (zoom) => {
    const resolution = Decimal(2).pow(-zoom, zoom);
    const start = Decimal('1.5');
    const range: [Decimal, Decimal] = [start, start.add(resolution.mul(256))];
    const rows = new TimescopeAggregateSeriesIndex([
      seriesPoint(0, 0.2),
      seriesPoint(1, 0.45),
      seriesPoint(2, 0.6),
      seriesPoint(3, 0.4),
    ]).query(createChunk({ id: 'high-zoom', seq: 0n, range, resolution, zoom }));
    const projection = createYProjection([Decimal(0), Decimal(1)], 'linear');
    const series = {
      tiles: [
        {
          id: 'high-zoom',
          role: 'target',
          range,
          resolution,
          rows,
          owned: rows.map(() => false),
          visibleRanges: [range],
        },
      ],
      options: { chart: 'linespoints' },
      color: 'red',
      on: () => () => {},
      domain: {
        on: () => () => {},
        createProjection: () => ({
          projection,
          wire: {
            domainId: 'high-zoom',
            domainEpoch: 1,
            revision: 1,
            mode: projection.mode,
            extent: projection.extent,
            gap: projection.gap,
            floating: projection.floating,
            numericZero: projection.numericZero,
            toAnchor: { scale: 1, offset: 0 },
          },
        }),
      },
    };

    const { provider, series: chartSeries } = await syntheticChart(series, range, resolution);
    const result = await provider.transform(chartSeries, range, resolution, start);

    expect(rows.map((row) => row.times.time.number())).toEqual([0, 1, 2, 3]);
    expect(result.data.links).toEqual([expect.objectContaining({ draw: 'line' })]);
    expect(result.data.marks).toEqual([]);
  });

  it('keeps X and Y as Decimal until provider coordinate projection', async () => {
    const timeOrigin = Decimal('1000000000000000000000000000000');
    const resolution = Decimal('0.00000000000000000001');
    const valueOrigin = Decimal('2000000000000000000000000000000');
    const valueStep = Decimal('0.0000000002');
    const projection = createYProjection([valueOrigin, valueOrigin.add(valueStep.mul(2))], 'linear');
    const rows: TimescopeSeriesPoint[] = [0, 1, 2].map((index) => {
      const time = timeOrigin.add(resolution.mul(index));
      return {
        times: { time },
        values: { value: valueOrigin.add(valueStep.mul(index)) },
        data: {},
        range: [time, time, '[]'],
      };
    });
    const range: [Decimal, Decimal] = [timeOrigin, timeOrigin.add(resolution.mul(3))];
    const series = {
      tiles: [
        {
          id: 'precision',
          role: 'target',
          range,
          resolution,
          rows,
          owned: rows.map(() => true),
          visibleRanges: [range],
        },
      ],
      options: { chart: 'points' },
      color: 'red',
      on: () => () => {},
      domain: {
        on: () => () => {},
        createProjection: () => ({
          projection,
          wire: {
            domainId: 'precision',
            domainEpoch: 1,
            revision: 1,
            mode: projection.mode,
            extent: projection.extent,
            gap: projection.gap,
            floating: projection.floating,
            numericZero: projection.numericZero,
            toAnchor: { scale: 1, offset: 0 },
          },
        }),
      },
    };

    expect(rows[0].times.time.number()).toBe(rows[1].times.time.number());
    expect(rows[0].values.value!.number()).toBe(rows[1].values.value!.number());

    const { provider, series: chartSeries } = await syntheticChart(series, range, resolution);
    const result = await provider.transform(chartSeries, range, resolution, timeOrigin);

    expect(result.meta.time.eq(timeOrigin)).toBe(true);
    expect(result.meta.resolution.eq(resolution)).toBe(true);
    expect(result.data.marks.map(([mark]) => mark.point.x1)).toEqual([0, 1, 2]);
    expect(result.data.marks.map(([mark]) => mark.point.y1)).toEqual([0, 0.5, 1]);
  });

  it('selects only the nearest two context rows without relying on row start order', async () => {
    const contextRow = (start: number, end: number, value: number): TimescopeSeriesPoint => ({
      times: { time: Decimal(start).add(end).div(2) },
      values: { value: Decimal(value) },
      data: {},
      range: [Decimal(start), Decimal(end), start === end ? '[]' : '[)'],
    });
    const rows = [
      contextRow(0, 9, 1),
      contextRow(1, 9.5, 3),
      contextRow(8, 8, 2),
      contextRow(12, 12, 7),
      contextRow(18, 18, 8),
      contextRow(20.5, 40, 6),
      contextRow(21, 25, 5),
      contextRow(21, 30, 4),
    ];
    const project = vi.fn((value: Decimal | null) => value);
    const series = {
      tiles: [
        {
          id: 'context',
          role: 'target',
          range: [Decimal(10), Decimal(20)],
          resolution: Decimal(1),
          rows,
          owned: [false, false, false, true, true, false, false, false],
          visibleRanges: [[Decimal(10), Decimal(20)]],
        },
      ],
      options: {
        chart: { links: [{ draw: 'line', using: 'value@time' }], marks: [] },
      },
      color: 'red',
      on: () => () => {},
      domain: {
        on: () => () => {},
        createProjection: () => ({
          projection: { project, normalize: (value: Decimal | null) => value?.number() ?? NaN },
          wire: {
            domainId: 'context',
            domainEpoch: 1,
            revision: 1,
            mode: 'zero-inclusive',
            extent: [0, 1],
            gap: 0,
            floating: 0,
            numericZero: 0,
            toAnchor: { scale: 1, offset: 0 },
          },
        }),
      },
    };

    const range: [Decimal, Decimal] = [Decimal(10), Decimal(20)];
    const { provider, series: chartSeries } = await syntheticChart(series, range, Decimal(1));
    await provider.transform(chartSeries, range, Decimal(1));

    expect(project.mock.calls.map(([value]) => value!.number())).toEqual([1, 3, 7, 8, 6, 5]);
  });

  it('generates marks only for core rows while retaining all rows for links', async () => {
    const rows = [seriesPoint(-2), seriesPoint(-1), seriesPoint(1), seriesPoint(2), seriesPoint(10), seriesPoint(11)];
    const projection = {
      project: vi.fn((value: Decimal | null) => value),
      normalize: vi.fn((value: Decimal | null) => value?.number() ?? NaN),
      mode: 'zero-inclusive',
    };
    const series = {
      tiles: [
        {
          id: 'tile',
          role: 'target',
          range: [Decimal(0), Decimal(10)],
          resolution: Decimal(1),
          rows,
          owned: [false, false, true, true, false, false],
          visibleRanges: [[Decimal(-5), Decimal(15)]],
        },
        {
          id: 'outside',
          role: 'fallback',
          range: [Decimal(100), Decimal(110)],
          resolution: Decimal(1),
          rows: [seriesPoint(101)],
          owned: [true],
          visibleRanges: [[Decimal(100), Decimal(110)]],
        },
      ],
      options: { chart: 'linespoints' },
      color: 'red',
      on: () => () => {},
      domain: {
        on: () => () => {},
        createProjection: () => ({
          projection,
          wire: {
            domainId: 'domain',
            domainEpoch: 1,
            revision: 1,
            mode: 'zero-inclusive',
            extent: [0, 1],
            gap: 0,
            floating: 0,
            numericZero: 0,
            toAnchor: { scale: 1, offset: 0 },
          },
        }),
      },
    };
    const range: [Decimal, Decimal] = [Decimal(0), Decimal(10)];
    const { provider, series: chartSeries } = await syntheticChart(series, range, Decimal(1));
    const result = await provider.transform(chartSeries, range, Decimal(1));

    expect(result.data.marks.map(([mark]) => mark.point.x1)).toEqual([1, 2]);
    expect(result.data.marks.map((marks) => marks.length)).toEqual([1, 1]);
    expect(result.data.marks[0][0].draw).toBe('circle');
    expect(result.data.links).toHaveLength(1);
    expect([...result.data.links[0].commands.values.subarray(0, 2)]).toEqual([0, 0]);
    expect(projection.project).toHaveBeenCalledTimes(6);

    const rescaled = await provider.transform(chartSeries, range, Decimal(2));
    expect(rescaled.data.marks.map(([mark]) => mark.point.x1)).toEqual([0.5, 1]);

    const zeroWidth = await provider.transform(chartSeries, [Decimal(0), Decimal(0)], Decimal(1));
    expect(zeroWidth.data.links).toEqual([]);

    const baselineSeries = {
      ...series,
      options: {
        chart: { marks: [{ draw: 'line' as const, using: ['value', '#zero'] as const }] },
      },
    };
    const { provider: baselineProvider, series: baselineChartSeries } = await syntheticChart(
      baselineSeries,
      range,
      Decimal(1),
    );
    const baseline = await baselineProvider.transform(baselineChartSeries, range, Decimal(1));
    expect(baseline.data.marks[0][0].point.y2).toBe('zero');

    const unusedTime = {
      sub: () => {
        throw new Error('unused time field was projected');
      },
    } as unknown as Decimal;
    const unusedValue = Decimal(999);
    const selectiveSeries = {
      ...series,
      tiles: [
        {
          ...series.tiles[0],
          rows: rows.map((row) => ({
            ...row,
            times: { ...row.times, unusedTime },
            values: { ...row.values, unusedValue },
          })),
          rowsByStart: undefined,
          rowsByEndDescending: undefined,
        },
      ],
      options: {
        ...series.options,
        chart: { links: [{ draw: 'line' as const, using: 'value@time' }], marks: [] },
      },
    };
    projection.project.mockClear();
    const { provider: selectiveProvider, series: selectiveChartSeries } = await syntheticChart(
      selectiveSeries,
      range,
      Decimal(1),
    );
    const selective = await selectiveProvider.transform(selectiveChartSeries, range, Decimal(1));
    expect(selective.data.marks).toEqual([]);
    expect(projection.project).toHaveBeenCalledTimes(6);
    expect(projection.project).not.toHaveBeenCalledWith(unusedValue);

    const fillColor = vi.fn(({ values }: TimescopeSeriesPoint) => (values.value!.lt(2) ? 'red' : 'blue'));
    const dynamicSeries = {
      ...series,
      options: {
        chart: { marks: [{ draw: 'circle' as const, style: { fillColor } }] },
      },
    };
    const { provider: dynamicProvider, series: dynamicChartSeries } = await syntheticChart(
      dynamicSeries,
      range,
      Decimal(1),
    );
    const dynamic = await dynamicProvider.transform(dynamicChartSeries, range, Decimal(1));
    const dynamicMarks = dynamic.data.marks;

    expect(fillColor).toHaveBeenCalledTimes(2);
    expect((dynamicMarks[0][0].style as { fillColor?: string }).fillColor).toBe('red');
    expect((dynamicMarks[1][0].style as { fillColor?: string }).fillColor).toBe('blue');
    expect(dynamicMarks[0][0].style).not.toBe(dynamicMarks[1][0].style);

    const distantSeries = {
      ...series,
      tiles: [
        {
          ...series.tiles[0],
          rows: [seriesPoint(-1000000000000000), seriesPoint(1), seriesPoint(1000000000000000)],
          owned: [false, true, false],
        },
      ],
    };
    const { provider: distantProvider, series: distantChartSeries } = await syntheticChart(
      distantSeries,
      range,
      Decimal(1),
    );
    const distant = await distantProvider.transform(distantChartSeries, range, Decimal(1));

    expect(distant.data.marks.map(([mark]) => mark.point.x1)).toEqual([1]);
    expect(distant.data.marks.every(([mark]) => Number.isFinite(mark.point.x1))).toBe(true);
  });

  it('uses the render resolution consistently when switching between marks and links', async () => {
    const threshold = Decimal(2);
    const range: [Decimal, Decimal] = [Decimal(0), Decimal(10)];
    const rows = [seriesPoint(1), seriesPoint(2)];
    const projection = createYProjection([Decimal(0), Decimal(10)], 'linear');
    const tile = {
      id: 'transition',
      role: 'target',
      range,
      resolution: Decimal(4),
      rows,
      owned: rows.map(() => true),
      visibleRanges: [range],
    };
    const series = {
      tiles: [tile],
      options: {
        chart: {
          links: ({ resolution }: { resolution: Decimal }) =>
            resolution.lt(threshold) ? [] : [{ draw: 'line', using: 'value@time' }],
          marks: ({ resolution }: { resolution: Decimal }) =>
            resolution.lt(threshold) ? [{ draw: 'circle', using: 'value@time' }] : [],
        },
      },
      color: 'red',
      on: () => () => {},
      domain: {
        on: () => () => {},
        createProjection: () => ({
          projection,
          wire: {
            domainId: 'transition',
            domainEpoch: 1,
            revision: 1,
            mode: projection.mode,
            extent: projection.extent,
            gap: projection.gap,
            floating: projection.floating,
            numericZero: projection.numericZero,
            toAnchor: { scale: 1, offset: 0 },
          },
        }),
      },
    };
    const { provider, series: chartSeries, registry } = await syntheticChart(series, range, Decimal(1));

    const fine = await provider.transform(chartSeries, range, Decimal(1));
    expect(fine.data.marks).toHaveLength(2);
    expect(fine.data.links).toEqual([]);

    tile.resolution = Decimal(1);
    registry.update(viewState(range, Decimal(4)));
    await provider.waitForTarget();
    const coarse = await provider.transform(chartSeries, range, Decimal(4));
    expect(coarse.data.marks).toEqual([]);
    expect(coarse.data.links).toHaveLength(1);
  });

  it('uses context only from the chunks at the outer edges of the combined path', async () => {
    const projection = {
      project: (value: Decimal | null) => value,
      normalize: (value: Decimal | null) => value?.number() ?? NaN,
      mode: 'zero-inclusive',
    };
    const series = {
      tiles: [
        {
          id: 'left',
          role: 'target',
          range: [Decimal(0), Decimal(10)],
          resolution: Decimal(1),
          rows: [seriesPoint(-2), seriesPoint(-1), seriesPoint(1), seriesPoint(9), seriesPoint(10)],
          owned: [false, false, true, true, false],
          visibleRanges: [[Decimal(0), Decimal(10)]],
        },
        {
          id: 'middle',
          role: 'target',
          range: [Decimal(10), Decimal(20)],
          resolution: Decimal(1),
          rows: [seriesPoint(9), seriesPoint(10), seriesPoint(15), seriesPoint(20)],
          owned: [false, true, true, false],
          visibleRanges: [[Decimal(10), Decimal(20)]],
        },
        {
          id: 'right',
          role: 'target',
          range: [Decimal(20), Decimal(30)],
          resolution: Decimal(1),
          rows: [seriesPoint(19), seriesPoint(20), seriesPoint(29), seriesPoint(30), seriesPoint(31)],
          owned: [false, true, true, false, false],
          visibleRanges: [[Decimal(20), Decimal(30)]],
        },
        {
          id: 'candidate',
          role: 'target',
          range: [Decimal('1000000000000000'), Decimal('1000000000000010')],
          resolution: Decimal(1),
          rows: [seriesPoint(1000000000000001, 1)],
          owned: [true],
          visibleRanges: [[Decimal('1000000000000000'), Decimal('1000000000000010')]],
        },
      ],
      options: { chart: 'linespoints' },
      color: 'red',
      on: () => () => {},
      domain: {
        on: () => () => {},
        createProjection: () => ({
          projection,
          wire: {
            domainId: 'domain',
            domainEpoch: 1,
            revision: 1,
            mode: 'zero-inclusive',
            extent: [0, 1],
            gap: 0,
            floating: 0,
            numericZero: 0,
            toAnchor: { scale: 1, offset: 0 },
          },
        }),
      },
    };

    const range: [Decimal, Decimal] = [Decimal(0), Decimal(30)];
    const { provider, series: chartSeries } = await syntheticChart(series, range, Decimal(1));
    const result = await provider.transform(chartSeries, range, Decimal(1));

    expect(result.meta.time).toEqual(Decimal(0));
    expect(result.data.marks.map(([mark]) => mark.point.x1)).toEqual([1, 9, 10, 15, 20, 29]);
    expect(result.data.marks.map((marks) => marks.length)).toEqual([1, 1, 1, 1, 1, 1]);
    expect([...result.data.links[0].commands.values]).not.toContain(-2);
    expect([...result.data.links[0].commands.values]).not.toContain(31);
    expect([...result.data.links[0].commands.values]).toContain(0);
    expect([...result.data.links[0].commands.values]).toContain(30);

    const transitionRange: [Decimal, Decimal] = [Decimal(0), Decimal('1000000000000010')];
    const { provider: transitionProvider, series: transitionSeries } = await syntheticChart(
      series,
      transitionRange,
      Decimal(1),
    );
    const transition = await transitionProvider.transform(transitionSeries, transitionRange, Decimal(1), Decimal(0));

    expect(transition.meta.time).toEqual(Decimal(0));
    expect(transition.data.marks.at(-1)?.[0].point.x1).toBe(1000000000000001);
    expect(transition.data.marks.at(-1)).toHaveLength(1);
    expect([...transition.data.links[0].commands.values]).toContain(1000000000000001);
  });

  it('adds an interval mark only once when the row is present in adjacent chunks', async () => {
    const interval = { ...seriesPoint(5), range: [Decimal(5), Decimal(15), '[)'] as const };
    const projection = {
      project: (value: Decimal | null) => value,
      normalize: (value: Decimal | null) => value?.number() ?? NaN,
      mode: 'zero-inclusive',
    };
    const series = {
      tiles: [
        {
          id: 'left',
          role: 'target',
          range: [Decimal(0), Decimal(10)],
          resolution: Decimal(1),
          rows: [interval],
          owned: [true],
          visibleRanges: [[Decimal(0), Decimal(10)]],
        },
        {
          id: 'right',
          role: 'target',
          range: [Decimal(10), Decimal(20)],
          resolution: Decimal(1),
          rows: [{ ...interval }],
          owned: [true],
          visibleRanges: [[Decimal(10), Decimal(20)]],
        },
      ],
      options: { chart: 'points' },
      color: 'red',
      on: () => () => {},
      domain: {
        on: () => () => {},
        createProjection: () => ({
          projection,
          wire: {
            domainId: 'domain',
            domainEpoch: 1,
            revision: 1,
            mode: 'zero-inclusive',
            extent: [0, 1],
            gap: 0,
            floating: 0,
            numericZero: 0,
            toAnchor: { scale: 1, offset: 0 },
          },
        }),
      },
    };

    const range: [Decimal, Decimal] = [Decimal(4), Decimal(16)];
    const { provider, series: chartSeries } = await syntheticChart(series, range, Decimal(1));
    const result = await provider.transform(chartSeries, range, Decimal(1));

    expect(result.meta.time).toEqual(Decimal(4));
    expect(result.data.marks.map(([mark]) => mark.point.x1)).toEqual([1]);
    expect(result.data.marks).toHaveLength(1);
    expect(result.data.marks[0]).toHaveLength(1);
  });

  it('selects the first intersecting fragment across boundaries and gaps', async () => {
    const interval = (start: number, end: number, time: number, value: number): TimescopeSeriesPoint => ({
      ...seriesPoint(time, value),
      range: [Decimal(start), Decimal(end), '[)'],
    });
    const rows = [
      seriesPoint(0, 1),
      interval(9, 11, 9.5, 2),
      seriesPoint(10, 3),
      interval(10, 20, 15, 4),
      seriesPoint(15, 5),
      interval(15, 25, 16, 6),
      seriesPoint(20, 7),
      seriesPoint(30, 8),
    ];
    const projection = createYProjection([Decimal(0), Decimal(10)], 'linear');
    const series = {
      tiles: [
        {
          id: 'left-fragment',
          role: 'target',
          range: [Decimal(0), Decimal(10)],
          resolution: Decimal(1),
          rows: rows.slice(0, 3),
          owned: [true, true, false],
          visibleRanges: [[Decimal(0), Decimal(10)]],
        },
        {
          id: 'right-fragment',
          role: 'target',
          range: [Decimal(20), Decimal(30)],
          resolution: Decimal(1),
          rows: rows.slice(5),
          owned: [true, true, false],
          visibleRanges: [[Decimal(20), Decimal(30)]],
        },
      ],
      options: { chart: 'points' },
      color: 'red',
      on: () => () => {},
      domain: {
        on: () => () => {},
        createProjection: () => ({
          projection,
          wire: {
            domainId: 'domain',
            domainEpoch: 1,
            revision: 1,
            mode: projection.mode,
            extent: projection.extent,
            gap: projection.gap,
            floating: projection.floating,
            numericZero: projection.numericZero,
            toAnchor: { scale: 1, offset: 0 },
          },
        }),
      },
    };

    const range: [Decimal, Decimal] = [Decimal(0), Decimal(30)];
    const { provider, series: chartSeries } = await syntheticChart(series, range, Decimal(1));
    const result = await provider.transform(chartSeries, range, Decimal(1));

    expect(result.data.marks.map(([mark]) => mark.point.x1)).toEqual([0, 9.5, 16, 20]);
    expect(result.data.marks.map(([mark]) => mark.point.y1)).toEqual([0.1, 0.2, 0.6, 0.7]);
    expect(result.data.marks).toHaveLength(4);
  });

  it('derives automatic extent from the values projected by each chart style', async () => {
    const interval = { ...seriesPoint(-5, 75), range: [Decimal(-5), Decimal(2), '[)'] as const };
    const rows = [
      interval,
      seriesPoint(-2, -200),
      seriesPoint(-1, -100),
      seriesPoint(1, 1),
      seriesPoint(10, 50),
      seriesPoint(11, 100),
    ];
    for (const chart of ['lines', 'points'] as const) {
      class Source extends TimescopeDataSourceBase {
        async query() {
          return rows;
        }
      }
      const registry = new TimescopeViewRegistry();
      registry.update(viewState([Decimal(0), Decimal(10)], Decimal(1)));
      const domain = domainFor();
      const series = new TimescopeDataSeries({
        sources: { source: new Source({ chunkSize: 10, resolutions: [1] }) },
        domain,
        options: { data: { source: 'source' }, chart },
      });
      const provider = new TimescopeSeriesChart({ series, ...registryOptions(registry) });

      await provider.waitForTarget();
      await provider.transform(series, [Decimal(0), Decimal(10)], Decimal(1));
      expect(domain.dataRange?.map(Number)).toEqual(chart === 'lines' ? [-200, 100] : [1, 75]);
      provider.dispose();
      series.dispose();
    }
  });

  it('includes nearest link context around each visible fallback fragment', async () => {
    const rows = [seriesPoint(0, 0), seriesPoint(15, 100), seriesPoint(25, 0)];
    class Source extends TimescopeDataSourceBase {
      async query() {
        return rows;
      }
    }
    const registry = new TimescopeViewRegistry();
    registry.update(viewState([Decimal(0), Decimal(30)], Decimal(2)));
    const domain = domainFor();
    const series = new TimescopeDataSeries({
      sources: { source: new Source({ chunkSize: 15, resolutions: [2] }) },
      domain,
      options: { data: { source: 'source' }, chart: 'lines' },
    });
    const provider = new TimescopeSeriesChart({ series, ...registryOptions(registry) });

    await provider.waitForTarget();
    await provider.transform(series, [Decimal(0), Decimal(30)], Decimal(2));
    expect(domain.dataRange?.map(Number)).toEqual([0, 100]);
    provider.dispose();
    series.dispose();
  });

  it('scales charts from their projected values while sharing one source', async () => {
    const row: TimescopeSeriesPoint = {
      times: { time: Decimal(1) },
      values: {
        open: Decimal(100),
        high: Decimal(110),
        low: Decimal(90),
        close: Decimal(105),
        volume: Decimal(5),
      },
      data: {},
      range: [Decimal(1), Decimal(1), '[]'],
    };
    class Source extends TimescopeDataSourceBase {
      query = vi.fn(async (_chunk: TimescopeChunk) => [row]);
    }
    const source = new Source({ chunkSize: 10, resolutions: [1] });
    const registry = new TimescopeViewRegistry();
    registry.update(viewState([Decimal(0), Decimal(10)], Decimal(1)));
    const priceDomain = new TimescopeDomain();
    const volumeDomain = new TimescopeDomain({ range: [0, undefined] });
    const price = new TimescopeDataSeries({
      sources: { market: source },
      domain: priceDomain,
      options: {
        data: { source: 'market' },
        chart: {
          marks: [
            { draw: 'section', using: ['high', 'low'] },
            { draw: 'bar', using: ['open', 'close'] },
          ],
        },
      },
    });
    const volume = new TimescopeDataSeries({
      sources: { market: source },
      domain: volumeDomain,
      options: {
        data: { source: 'market' },
        chart: { marks: [{ draw: 'bar', using: ['volume', '#zero'] }] },
      },
    });
    const priceChart = new TimescopeSeriesChart({ series: price, ...registryOptions(registry) });
    const volumeChart = new TimescopeSeriesChart({ series: volume, ...registryOptions(registry) });

    await Promise.all([priceChart.waitForTarget(), volumeChart.waitForTarget()]);
    await Promise.all([
      priceChart.transform(price, [Decimal(0), Decimal(10)], Decimal(1)),
      volumeChart.transform(volume, [Decimal(0), Decimal(10)], Decimal(1)),
    ]);

    expect(priceDomain.dataRange?.map(Number)).toEqual([90, 110]);
    expect(volumeDomain.dataRange?.map(Number)).toEqual([0, 5]);
    const requestedChunks = source.query.mock.calls.map(([chunk]) => chunk.id);
    expect(requestedChunks).toHaveLength(3);
    expect(new Set(requestedChunks).size).toBe(3);

    priceChart.dispose();
    volumeChart.dispose();
    price.dispose();
    volume.dispose();
  });
});
