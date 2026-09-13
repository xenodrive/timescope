import { Decimal } from '#src/core/decimal';
import type {
  TimescopeSeriesChartData,
  TimescopeSeriesTooltipData,
  TimescopeYAxisData,
  TimescopeYProjectionWire,
} from '#src/renderer/types';
import { createYProjectionRebase, rebaseYProjectionData } from '#src/renderer/yProjection';
import { describe, expect, it } from 'vitest';

function projection(revision: number, scale: number, offset: number): TimescopeYProjectionWire {
  return {
    domainId: 'domain',
    domainEpoch: 1,
    revision,
    autoscale: true,
    animation: true,
    mode: 'floating-positive',
    extent: [0, 1],
    gap: 20,
    floating: 20,
    numericZero: -1,
    toAnchor: { scale, offset },
  };
}

describe('worker Y projection rebase', () => {
  it('rewrites projected mark coordinates and axis ticks in place', () => {
    const source = projection(1, 1, 0);
    const target = projection(2, 0.4, 0.2);
    const data = {
      data: {
        marks: [
          [
            {
              draw: 'line' as const,
              point: { x1: 0, y1: 0.4, x2: 1, y2: 'zero' as const },
            },
          ],
          [{ draw: 'circle' as const, point: { x1: 1, y1: 0.6, x2: 1, y2: NaN } }],
        ],
        links: [],
      },
      meta: {
        time: Decimal(0),
        resolution: Decimal(1),
        color: '',
        projection: source,
        linkProjection: source,
      },
    } satisfies TimescopeSeriesChartData;
    const axis = {
      data: { id: 'domain', side: 'left', color: '', ticks: [{ value: 0.4, text: 'value' }] },
      meta: { time: Decimal(0), resolution: Decimal(1), projection: source },
    } satisfies TimescopeYAxisData;

    expect(createYProjectionRebase(source, target)).toEqual({ scale: 2.5, offset: -0.5 });
    expect(rebaseYProjectionData(data, target)).toBe(true);
    expect(data.data.marks[0][0].point).toEqual({ x1: 0, y1: 0.5, x2: 1, y2: 'zero' });
    expect(data.data.marks[1][0].point.y1).toBe(1);
    expect(data.data.marks[1][0].point.y2).toBeNaN();
    expect(rebaseYProjectionData(axis, target)).toBe(true);
    expect(axis.data.ticks[0].value).toBe(0.5);
    expect(data.meta.projection).toBe(target);
    expect(data.meta.linkProjection).toBe(source);
  });

  it('rewrites tooltip values and clears incompatible epochs', () => {
    const source = projection(1, 1, 0);
    const target = { ...projection(2, 1, 0), domainEpoch: 2 };
    const y = new Float64Array([0.25]);
    const data = {
      data: { t: [Decimal(0)], y, text: ['value'] },
      meta: { time: Decimal(0), resolution: Decimal(1), color: '', projection: source },
    } satisfies TimescopeSeriesTooltipData;

    expect(rebaseYProjectionData(data, target)).toBe(true);
    expect(data.data.y).toBe(y);
    expect(y[0]).toBeNaN();
    expect(data.meta.projection).toBe(target);
  });

  it('collapses finite values for a zero-only target', () => {
    const source = projection(1, 1, 0);
    const target = {
      ...projection(2, 0, 0),
      mode: 'zero-only' as const,
      extent: [0, 0] as [number, number],
      floating: 0,
    };
    const y = new Float64Array([0.25, 0.75]);
    const data = {
      data: { t: [Decimal(0), Decimal(1)], y, text: ['a', 'b'] },
      meta: { time: Decimal(0), resolution: Decimal(1), color: '', projection: source },
    } satisfies TimescopeSeriesTooltipData;

    rebaseYProjectionData(data, target);
    expect([...y]).toEqual([0, 0]);
  });
});
