import { Decimal } from '#src/core/decimal';
import { TimescopeSeriesChart } from '#src/main/loaders/TimescopeSeriesChart';
import { TimescopeDataSeries } from '#src/main/TimescopeDataSeries';
import { createDataSource, type TimescopeDataSource } from '#src/main/TimescopeDataSource';
import { TimescopeDomain } from '#src/main/TimescopeDomain';
import { TimescopeViewRegistry } from '#src/main/TimescopeView';
import { describe, expect, it, onTestFinished } from 'vitest';
import { yAtX } from '../helpers/geometry';
import { viewState } from '../helpers/view';

type Chart = ConstructorParameters<typeof TimescopeDataSeries>[0]['options']['chart'];

function fixture(
  source: TimescopeDataSource<unknown>,
  chart: Chart = 'linespoints',
  domain = new TimescopeDomain({ range: [0, 1] }),
) {
  const registry = new TimescopeViewRegistry();
  const series = new TimescopeDataSeries({
    sources: { source },
    domain,
    options: { data: { source: 'source' }, chart },
  });
  const provider = new TimescopeSeriesChart({ series, viewContext: registry });
  onTestFinished(() => {
    provider.dispose();
    series.dispose();
  });
  return {
    registry,
    series,
    provider,
    domain,
    async render(range: [Decimal, Decimal], resolution = Decimal(1)) {
      registry.update(viewState(range, resolution));
      await provider.waitForTarget();
      return provider.transform(series, range, resolution, range[0]);
    },
  };
}

describe('chart data', () => {
  it.each(['lines', 'curves'] as const)('%s preserve visible geometry across chunk boundaries', async (chart) => {
    const data = Array.from({ length: 13 }, (_, time) => ({ time: time - 2, value: (time % 4) / 4 }));
    const range: [Decimal, Decimal] = [Decimal(0), Decimal(9)];
    const whole = fixture(createDataSource({ data, chunkSize: 32 }), chart);
    const tiled = fixture(createDataSource({ data, chunkSize: 3 }), chart);
    const a = await whole.render(range);
    const b = await tiled.render(range);
    for (const x of [0.5, 2.9, 3, 3.1, 5.9, 6, 6.1, 8.5]) {
      expect(yAtX(b.data.links[0].commands, x)).toBeCloseTo(yAtX(a.data.links[0].commands, x), 10);
    }
  });

  it.each([0.4, 1.4, 2.4])('keeps a curve stable when movement settles at %s', async (center) => {
    const resolution = Decimal('0.01');
    const rangeAt = (time: number): [Decimal, Decimal] => [Decimal(time).sub('0.3'), Decimal(time).add('0.3')];
    const data = [0.2, 0.45, 0.6, 0.4, 0.8].map((value, time) => ({ time, value }));
    const view = fixture(createDataSource(data), 'curves');
    const range = rangeAt(center);
    await view.render(range, resolution);
    view.registry.update(
      viewState(rangeAt(center + 0.3), resolution, { currentRange: range, editing: true, phase: 'changing' }),
    );
    await view.provider.waitForTarget();
    const moving = await view.provider.transform(view.series, range, resolution, range[0]);
    const settled = await view.render(range, resolution);
    for (const x of [10, 30, 50]) {
      expect(yAtX(settled.data.links[0].commands, x)).toBeCloseTo(yAtX(moving.data.links[0].commands, x), 10);
    }
  });

  it('uses context for links without drawing marks outside the visible range', async () => {
    const view = fixture(createDataSource([-2, -1, 1, 2, 10, 11].map((time) => ({ time, value: 0.5 }))));
    const result = await view.render([Decimal(0), Decimal(10)]);
    expect(result.data.marks.map(([mark]) => mark.point.x1)).toEqual([1, 2]);
    for (const x of [0, 5, 10]) expect(yAtX(result.data.links[0].commands, x)).toBeCloseTo(0.5);
  });

  it('draws an overlapping interval once even when adjacent chunks both return it', async () => {
    const view = fixture(
      createDataSource({
        chunkSize: 10,
        loader: async () => [{ times: { start: 5, end: 15 }, value: 0.5 }],
      }),
      { marks: [{ draw: 'line', using: ['value@start', 'value@end'] }] },
    );
    const result = await view.render([Decimal(4), Decimal(16)]);
    expect(result.data.marks).toHaveLength(1);
    expect(result.data.marks[0][0].point).toMatchObject({ x1: 1, x2: 11, y1: 0.5, y2: 0.5 });
  });

  it('preserves subpixel differences at huge absolute times and values', async () => {
    const base = Decimal('1e30');
    const resolution = Decimal('1e-20');
    const valueStep = Decimal('2e-10');
    const source = createDataSource(
      [0, 1, 2].map((index) => ({ time: base.add(resolution.mul(index)), value: base.add(valueStep.mul(index)) })),
    );
    const view = fixture(source, 'points', new TimescopeDomain({ range: [base, base.add(valueStep.mul(2))] }));
    const result = await view.render([base, base.add(resolution.mul(3))], resolution);
    expect(result.data.marks.map(([mark]) => mark.point.x1)).toEqual([0, 1, 2]);
    expect(result.data.marks.map(([mark]) => mark.point.y1)).toEqual([0, 0.5, 1]);
  });

  it.each([55, 70])('keeps a visible line between distant samples at zoom %s', async (zoom) => {
    const resolution = Decimal(2).pow(-zoom);
    const start = Decimal('1.5');
    const view = fixture(
      createDataSource([
        { time: 1, value: 0.25 },
        { time: 2, value: 0.75 },
      ]),
    );
    const result = await view.render([start, start.add(resolution.mul(256))], resolution);
    expect(result.data.marks).toEqual([]);
    expect(yAtX(result.data.links[0].commands, 128)).toBeCloseTo(0.5, 10);
  });

  it('resolves per-row mark styles from the selected data', async () => {
    const view = fixture(
      createDataSource([
        { time: 1, value: 0.25 },
        { time: 2, value: 0.75 },
      ]),
      {
        marks: [{ draw: 'circle', style: { fillColor: ({ values }) => (values.value!.lt('0.5') ? 'red' : 'blue') } }],
      },
    );
    const result = await view.render([Decimal(0), Decimal(3)]);
    expect(result.data.marks.map(([mark]) => mark.style)).toEqual([
      expect.objectContaining({ fillColor: 'red' }),
      expect.objectContaining({ fillColor: 'blue' }),
    ]);
  });

  it('uses the same render resolution to select marks and links', async () => {
    const view = fixture(
      createDataSource([
        { time: 1, value: 0.25 },
        { time: 2, value: 0.75 },
      ]),
      {
        marks: ({ resolution }) => (resolution.lt(2) ? [{ draw: 'circle' }] : []),
        links: ({ resolution }) => (resolution.lt(2) ? [] : [{ draw: 'line' }]),
      },
    );
    const range: [Decimal, Decimal] = [Decimal(0), Decimal(10)];
    await view.render(range);
    const fine = await view.provider.transform(view.series, range, Decimal(1));
    const coarse = await view.provider.transform(view.series, range, Decimal(4));
    expect(fine.data.marks).toHaveLength(2);
    expect(fine.data.links).toEqual([]);
    expect(coarse.data.marks).toEqual([]);
    expect(coarse.data.links).toHaveLength(1);
  });

  it('scales series by their selected fields even when they share a source', async () => {
    const source = createDataSource([{ time: 1, values: { high: 110, low: 90, volume: 5 } }]);
    const price = fixture(source, { marks: [{ draw: 'section', using: ['high', 'low'] }] }, new TimescopeDomain());
    const volume = fixture(
      source,
      { marks: [{ draw: 'bar', using: ['volume', '#zero'] }] },
      new TimescopeDomain({ range: [0, undefined] }),
    );
    const range: [Decimal, Decimal] = [Decimal(0), Decimal(10)];
    await price.render(range);
    await volume.render(range);
    expect(price.domain.dataRange?.map(Number)).toEqual([90, 110]);
    expect(volume.domain.dataRange?.map(Number)).toEqual([0, 5]);
  });
});
