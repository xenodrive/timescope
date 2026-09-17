import { Decimal } from '#src/core/decimal';
import { TimescopeYAxis } from '#src/main/layers/TimescopeYAxis';
import { TimescopeDataSeries } from '#src/main/TimescopeDataSeries';
import { createDataSource } from '#src/main/TimescopeDataSource';
import { TimescopeDomain, type TimescopeDomainOptions } from '#src/main/TimescopeDomain';
import { createLinkProjectionRebase } from '#src/renderer/layers/TimescopeSeriesChartLayer';
import { TimescopeTrack } from '#src/renderer/TimescopeTrack';
import type { TimescopeRenderingContext, TimescopeSeriesTooltipData } from '#src/renderer/types';
import { createYProjectionRebase, rebaseYProjectionData } from '#src/renderer/yProjection';
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';

type Range = [number | Decimal, number | Decimal];

function fixture(options: TimescopeDomainOptions = {}) {
  const domain = new TimescopeDomain(options);
  const series = new TimescopeDataSeries({
    sources: { s: createDataSource([]) },
    domain,
    options: { data: { source: 's' } },
  });
  const track = new TimescopeTrack({ id: 'track', oy: 0, height: 200, seriesKeys: ['s'] });
  let snapshot = domain.createProjection();
  onTestFinished(() => {
    track.dispose();
    series.dispose();
  });
  return {
    domain,
    track,
    update(range: Range) {
      const extent: [Decimal, Decimal] = range.map(Decimal) as [Decimal, Decimal];
      domain.reportExtent(series, extent, extent[0].isPositive() ? extent : null);
      const next = domain.createProjection();
      const rebase = createYProjectionRebase(snapshot.wire, next.wire);
      const context = {
        dataCaches: { 'series:s:chart': { data: { data: { marks: [], links: [] }, meta: { projection: next.wire } } } },
      } as unknown as TimescopeRenderingContext;
      track.adjustScale(context, new Map([[domain.uid, rebase]]));
      snapshot = next;
    },
    y(value: number | Decimal) {
      const y = track.yForDomain(domain.uid, snapshot.projection.normalize(Decimal(value)));
      expect(Number.isFinite(y)).toBe(true);
      return y;
    },
  };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('constant range transitions', () => {
  it('keeps tiny value differences at a huge base through collapse and re-expansion', () => {
    const base = Decimal('1e30');
    const middle = base.add('1e-10');
    const upper = base.add('2e-10');
    const values = [base, middle, upper];
    const view = fixture();
    view.update([base, upper]);
    const original = values.map(view.y);
    view.update([middle, middle]);
    values.forEach((value, i) => expect(view.y(value)).toBeCloseTo(original[i], 10));
    vi.advanceTimersByTime(1000);
    const constantY = view.y(middle);
    view.update([base, upper]);
    values.forEach((value) => expect(view.y(value)).toBeCloseTo(constantY, 10));
    vi.advanceTimersByTime(1000);
    values.forEach((value, i) => expect(view.y(value)).toBeCloseTo(original[i], 10));
  });

  it.each([
    { from: [10, 20], to: [15, 15], values: [10, 15, 20] },
    { from: [-20, -10], to: [-15, -15], values: [-20, -15, -10] },
    { from: [-10, 10], to: [0, 0], values: [-10, 0, 10] },
    { from: [15, 15], to: [10, 20], values: [10, 15, 20] },
    { from: [0, 0], to: [-10, 10], values: [-10, 0, 10] },
    { from: [15, 15], to: [-15, -15], values: [-15, 15] },
  ])('moves continuously from $from to $to and finishes independently of history', ({ from, to, values }) => {
    const view = fixture();
    view.update(from as Range);
    const start = values.map(view.y);
    const fresh = fixture();
    fresh.update(to as Range);
    const end = values.map(fresh.y);
    view.update(to as Range);
    values.forEach((value, i) => expect(view.y(value)).toBeCloseTo(start[i], 10));
    vi.advanceTimersByTime(80);
    values.forEach((value, i) => {
      const actual = view.y(value);
      expect(actual).toBeGreaterThanOrEqual(Math.min(start[i], end[i]) - 1e-8);
      expect(actual).toBeLessThanOrEqual(Math.max(start[i], end[i]) + 1e-8);
      if (Math.abs(start[i] - end[i]) > 1) {
        expect(actual).not.toBeCloseTo(start[i]);
        expect(actual).not.toBeCloseTo(end[i]);
      }
    });
    vi.advanceTimersByTime(1000);
    values.forEach((value, i) => expect(view.y(value)).toBeCloseTo(end[i], 10));
    expect(view.domain.dataRange?.map(Number)).toEqual(to);
  });

  it.each(['linear', 'log'] as const)(
    'retargets a collapsing %s display from its current position without losing value differences',
    (scale) => {
      const view = fixture({ scale });
      view.update([10, 20]);
      view.update([15, 15]);
      vi.advanceTimersByTime(80);
      const start = [10, 15, 20].map(view.y);
      view.update([5, 25]);
      [10, 15, 20].forEach((value, i) => expect(view.y(value)).toBeCloseTo(start[i], 10));
      vi.advanceTimersByTime(1000);
      const fresh = fixture({ scale });
      fresh.update([5, 25]);
      [10, 15, 20].forEach((value) => expect(view.y(value)).toBeCloseTo(fresh.y(value), 10));
    },
  );

  it.each(['linear', 'log'] as const)(
    'keeps cached tooltip and link coordinates aligned throughout %s collapse and expansion',
    (scale) => {
      const view = fixture({ scale });
      view.update([10, 20]);
      const initial = view.domain.createProjection();
      const local = initial.projection.normalize(Decimal(12));
      const tooltip: TimescopeSeriesTooltipData = {
        data: { t: [Decimal(0)], y: new Float64Array([local]), text: ['12'] },
        meta: { time: Decimal(0), resolution: Decimal(1), color: '', projection: initial.wire },
      };
      for (const range of [
        [15, 15],
        [5, 25],
      ] as Range[]) {
        view.update(range);
        const target = view.domain.createProjection().wire;
        rebaseYProjectionData(tooltip, target);
        const link = createLinkProjectionRebase(initial.wire, target)!;
        expect(link).not.toBeNull();
        for (const delay of [0, 80, 1000]) {
          vi.advanceTimersByTime(delay);
          const affine = view.track.affineForDomain(view.domain.uid)!;
          expect((local * link.scale + link.offset) * affine.scale + affine.offset).toBeCloseTo(view.y(12), 10);
          expect(view.track.yForDomain(view.domain.uid, tooltip.data.y[0])).toBeCloseTo(view.y(12), 10);
        }
      }
    },
  );

  it('preserves history only when shrinking is disabled', () => {
    const view = fixture({ shrink: false });
    view.update([10, 20]);
    view.update([15, 15]);
    expect(view.domain.dataRange?.map(Number)).toEqual([10, 20]);
  });

  it('honors a fixed boundary when automatic data becomes constant', () => {
    const view = fixture({ range: [0, undefined] });
    view.update([10, 20]);
    view.update([15, 15]);
    expect(view.domain.dataRange?.map(Number)).toEqual([0, 15]);
  });

  it.each(['linear', 'log'] as const)('shows one truthful tick for a constant %s range', async (scale) => {
    const view = fixture({ scale, axis: true });
    view.update([10, 20]);
    view.update([15, 15]);
    const axis = new TimescopeYAxis({ domain: view.domain });
    onTestFinished(() => axis.dispose());
    const result = await axis.loadData([Decimal(0), Decimal(1)], Decimal(1));
    expect(result.data.ticks.map((tick) => Number(tick.text))).toEqual([15]);
    vi.advanceTimersByTime(1000);
    expect(view.track.yForDomain(view.domain.uid, result.data.ticks[0].value)).toBeCloseTo(view.y(15), 10);
  });

  it('applies symmetric scaling to a nonzero constant', () => {
    const view = fixture({ scale: 'linear-symmetric' });
    view.update([15, 15]);
    expect(view.y(15)).toBeLessThan(view.y(0));
    expect(view.y(-15) - view.y(0)).toBeCloseTo(view.y(0) - view.y(15));
  });

  it('applies the final constant display immediately when animation is disabled', () => {
    const view = fixture({ animation: false });
    view.update([10, 20]);
    view.update([15, 15]);
    const fresh = fixture({ animation: false });
    fresh.update([15, 15]);
    expect(view.y(15)).toBe(fresh.y(15));
    expect(view.track.animating).toBe(false);
  });
});
