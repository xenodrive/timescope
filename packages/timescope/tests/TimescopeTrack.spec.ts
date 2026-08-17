import type { TimescopeSeriesChartData, TimescopeYAxisData, TimescopeYProjectionWire } from '#src/bridge/protocol';
import { Decimal } from '#src/core/decimal';
import { TimescopeTrack } from '#src/worker/TimescopeTrack';
import type { TimescopeRenderingContext } from '#src/worker/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function projection(
  domainId: string,
  mode: TimescopeYProjectionWire['mode'],
  extent: [number, number],
  floating = 0,
  options: Partial<Pick<TimescopeYProjectionWire, 'autoscale' | 'animation' | 'initialAnimation' | 'numericZero'>> = {},
): TimescopeYProjectionWire {
  return {
    domainId,
    domainEpoch: 1,
    revision: 1,
    autoscale: true,
    animation: true,
    initialAnimation: true,
    mode,
    extent,
    gap: 20,
    floating,
    numericZero:
      mode === 'floating-positive' ? -1 : mode === 'floating-negative' ? 1 : mode === 'zero-inclusive' ? 0 : null,
    toAnchor: { scale: 1, offset: 0 },
    ...options,
  };
}

function context(entries: Record<string, TimescopeYProjectionWire>) {
  return {
    dataCaches: Object.fromEntries(
      Object.entries(entries).map(([key, value]) => [
        `series:${key}:chart`,
        {
          data: {
            data: { x: {}, y: {}, marks: [] },
            meta: { projection: value },
          } as unknown as TimescopeSeriesChartData,
        },
      ]),
    ),
  } as unknown as TimescopeRenderingContext;
}

function track(keys: string[], symmetric = false) {
  return new TimescopeTrack({ id: 'main', oy: 0, height: 200, seriesKeys: keys, symmetric });
}

describe('TimescopeTrack Y projection', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function finishAnimations() {
    vi.advanceTimersByTime(250);
  }

  it('takes axis presentation only from the track-domain axis data', () => {
    const value = track(['a']);
    const domainProjection = projection('domain', 'zero-inclusive', [0, 1]);
    const timescope = context({ a: domainProjection });
    timescope.dataCaches['tracks:main:domains:domain:yAxis'] = {
      revision: 1,
      data: {
        data: {
          id: 'domain',
          side: 'right',
          label: 'Value',
          ticks: [{ value: 0.5, text: '0.5' }],
        },
        meta: { time: Decimal(0), resolution: Decimal(1), projection: domainProjection },
      } satisfies TimescopeYAxisData,
    } as never;

    value.adjustScale(timescope);

    expect(value.axes).toEqual([expect.objectContaining({ id: 'domain', side: 'right', label: 'Value' })]);
  });

  it('keeps the zero axis at its target while the initial chart grows from it', () => {
    const value = track(['a']);
    value.adjustScale(context({}));

    value.adjustScale(context({ a: projection('a', 'zero-inclusive', [-0.25, 1]) }));

    const targetZero = value.bottom - value.chartHeight * 0.2;
    expect(value.y0).toBeCloseTo(targetZero);
    expect(value.yForDomain('a', -0.25)).toBeCloseTo(targetZero);
    expect(value.yForDomain('a', 1)).toBeCloseTo(targetZero);
    expect(value.animating).toBe(true);

    finishAnimations();
    expect(value.y0).toBeCloseTo(targetZero);
    expect(value.yForDomain('a', -0.25)).toBeCloseTo(value.bottom);
    expect(value.yForDomain('a', 1)).toBeCloseTo(value.top);
    expect(value.animating).toBe(false);
  });

  it('shows a fixed-range chart immediately', () => {
    const value = track(['a']);
    const source = projection('a', 'zero-inclusive', [-0.25, 1], 0, {
      autoscale: false,
      initialAnimation: false,
    });

    value.adjustScale(context({ a: source }));

    expect(value.yForDomain('a', -0.25)).toBeCloseTo(value.bottom);
    expect(value.yForDomain('a', 1)).toBeCloseTo(value.top);
    expect(value.animating).toBe(false);
  });

  it('allows an initial animation override for a fixed-range chart', () => {
    const value = track(['a']);
    const source = projection('a', 'zero-inclusive', [-0.25, 1], 0, {
      autoscale: false,
      initialAnimation: 350,
    });

    value.adjustScale(context({ a: source }));

    expect(value.yForDomain('a', -0.25)).toBeCloseTo(value.y0);
    expect(value.yForDomain('a', 1)).toBeCloseTo(value.y0);
    expect(value.animating).toBe(true);
    vi.advanceTimersByTime(400);
    expect(value.yForDomain('a', 1)).toBeCloseTo(value.top);
  });

  it('supports disabling the initial animation', () => {
    const value = track(['a']);
    const source = projection('a', 'zero-inclusive', [-0.25, 1], 0, { initialAnimation: false });

    value.adjustScale(context({ a: source }));

    expect(value.yForDomain('a', -0.25)).toBeCloseTo(value.bottom);
    expect(value.yForDomain('a', 1)).toBeCloseTo(value.top);
    expect(value.animating).toBe(false);
  });

  it('uses a numeric initial animation duration in milliseconds', () => {
    const value = track(['a']);
    const source = projection('a', 'zero-inclusive', [-0.25, 1], 0, { initialAnimation: 500 });

    value.adjustScale(context({ a: source }));
    vi.advanceTimersByTime(250);
    expect(value.animating).toBe(true);

    vi.advanceTimersByTime(300);
    expect(value.animating).toBe(false);
    expect(value.yForDomain('a', 1)).toBeCloseTo(value.top);
  });

  it('supports disabling autoscale update animations', () => {
    const value = track(['a']);
    const source = projection('a', 'zero-inclusive', [-0.25, 1], 0, {
      animation: false,
      initialAnimation: false,
    });
    value.adjustScale(context({ a: source }));

    const next = { ...source, revision: 2, extent: [-1, 1] as [number, number] };
    value.adjustScale(context({ a: next }));

    expect(value.y0).toBeCloseTo(value.top + value.chartHeight / 2);
    expect(value.yForDomain('a', -1)).toBeCloseTo(value.bottom);
    expect(value.yForDomain('a', 1)).toBeCloseTo(value.top);
    expect(value.animating).toBe(false);
  });

  it('floats a positive local range above the zero axis', () => {
    const value = track(['a']);
    const source = projection('a', 'floating-positive', [0, 1], 20);
    value.adjustScale(context({ a: source }));
    finishAnimations();
    expect(value.y0).toBeCloseTo(value.bottom);
    expect(value.yForDomain('a', 0)).toBeCloseTo(value.bottom - 20);
    expect(value.yForDomain('a', 1)).toBeCloseTo(value.top);
    expect(value.yForDomain('a', 0)).toBeCloseTo(value.bottom - 20);
    expect(value.fadeForDomain('a')).toBe(20);
  });

  it('keeps a logarithmic range separated from the zero axis', () => {
    const value = track(['a']);
    const source = projection('a', 'floating-positive', [0, 1], 20, {
      initialAnimation: false,
      numericZero: null,
    });

    value.adjustScale(context({ a: source }));

    expect(value.y0).toBeCloseTo(value.bottom);
    expect(value.yForDomain('a', 0)).toBeCloseTo(value.y0 - 20);
    expect(value.yForDomain('a', 0)).toBeCloseTo(value.y0 - 20);
    expect(value.fadeForDomain('a')).toBe(20);
  });

  it('floats a negative local range below the zero axis', () => {
    const value = track(['a']);
    const source = projection('a', 'floating-negative', [-1, 0], -20);
    value.adjustScale(context({ a: source }));
    finishAnimations();
    expect(value.y0).toBeCloseTo(value.top);
    expect(value.yForDomain('a', -1)).toBeCloseTo(value.bottom);
    expect(value.yForDomain('a', 0)).toBeCloseTo(value.top + 20);
    expect(value.yForDomain('a', 0)).toBeCloseTo(value.top + 20);
    expect(value.fadeForDomain('a')).toBe(-20);
  });

  it('includes zero when a positive autoscale reaches it within the floating gap', () => {
    const value = track(['a']);
    const source = projection('a', 'floating-positive', [0, 1], 20, {
      initialAnimation: false,
      numericZero: -0.1,
    });

    value.adjustScale(context({ a: source }));

    expect(value.yForDomain('a', source.numericZero)).toBeCloseTo(value.y0);
    expect(value.yForDomain('a', 0)).toBeGreaterThan(value.top);
    expect(value.yForDomain('a', 0)).toBeLessThan(value.y0);
    expect(value.fadeForDomain('a')).toBe(0);
  });

  it('includes zero when a negative autoscale reaches it within the floating gap', () => {
    const value = track(['a']);
    const source = projection('a', 'floating-negative', [-1, 0], -20, {
      initialAnimation: false,
      numericZero: 0.1,
    });

    value.adjustScale(context({ a: source }));

    expect(value.yForDomain('a', source.numericZero)).toBeCloseTo(value.y0);
    expect(value.yForDomain('a', 0)).toBeGreaterThan(value.y0);
    expect(value.yForDomain('a', 0)).toBeLessThan(value.bottom);
    expect(value.fadeForDomain('a')).toBe(0);
  });

  it('keeps an explicit one-sided range floating even when its scale reaches zero within the gap', () => {
    const value = track(['a']);
    const source = projection('a', 'floating-positive', [0, 1], 20, {
      autoscale: false,
      initialAnimation: false,
      numericZero: -0.1,
    });

    value.adjustScale(context({ a: source }));

    expect(value.yForDomain('a', 0)).toBeCloseTo(value.y0 - 20);
    expect(value.fadeForDomain('a')).toBe(20);
  });

  it('shares zero across independent zero-inclusive domains', () => {
    const value = track(['a', 'b']);
    const a = projection('a', 'zero-inclusive', [-0.25, 1]);
    const b = projection('b', 'zero-inclusive', [-1, 0.2]);
    value.adjustScale(context({ a, b }));
    expect(value.yForDomain('a', 0)).toBeCloseTo(value.y0);
    expect(value.yForDomain('b', 0)).toBeCloseTo(value.y0);
    expect(value.y0).toBeCloseTo(value.top + value.chartHeight / 2);
  });

  it('centers an asymmetric extent when the track is symmetric', () => {
    const value = track(['a'], true);
    value.adjustScale(context({ a: projection('a', 'zero-inclusive', [-0.25, 1]) }));
    expect(value.y0).toBeCloseTo(value.top + value.chartHeight / 2);
  });

  it('rebases a new normalized basis onto the current presentation', () => {
    const value = track(['a']);
    const previous = projection('a', 'floating-positive', [0, 1], 20);
    value.adjustScale(context({ a: previous }));
    finishAnimations();
    const previousY = value.yForDomain('a', 0.4);
    const previousFade = value.fadeForDomain('a');
    const next = projection('a', 'floating-positive', [0, 1], 20);
    next.revision = 2;
    next.toAnchor = { scale: 0.4, offset: 0.2 };
    value.adjustScale(context({ a: next }), new Map([['a', { scale: 2.5, offset: -0.5 }]]));
    expect(value.yForDomain('a', 0.5)).toBeCloseTo(previousY);
    expect(value.fadeForDomain('a')).toBeCloseTo(previousFade);
    expect(value.y0 - value.yForDomain('a', 0)).not.toBeCloseTo(previousFade);
  });

  it('does not roll a shared domain back to an older chart revision', () => {
    const value = track(['a', 'b']);
    const previous = projection('shared', 'floating-positive', [0, 1], 20);
    const next = { ...previous, revision: 2, toAnchor: { scale: 0.5, offset: 0.25 } };

    value.adjustScale(context({ a: next, b: previous }));
    expect(value.projectionForDomain('shared')?.revision).toBe(2);

    value.adjustScale(context({ b: previous }));
    expect(value.projectionForDomain('shared')?.revision).toBe(2);
  });

  it('resets presentation state for another domain epoch', () => {
    const value = track(['a']);
    const active = projection('a', 'floating-positive', [0, 1], 20);
    value.adjustScale(context({ a: active }));

    const next = { ...active, domainEpoch: 2, revision: 2 };
    value.adjustScale(context({ a: next }), new Map([['a', null]]));
    expect(value.projectionForDomain('a')).toBe(next);
    expect(Number.isFinite(value.yForDomain('a', 0.5))).toBe(true);
  });
});
