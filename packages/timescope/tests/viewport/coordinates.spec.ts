import { Decimal } from '#src/core/decimal';
import { resolutionFor, zoomFor } from '#src/core/zoom';
import { renderScaleX } from '#src/renderer/layers/TimescopeSeriesChartLayer';
import { TimescopeViewport } from '#src/renderer/TimescopeViewport';
import { describe, expect, it, onTestFinished } from 'vitest';

describe('time coordinates', () => {
  it.each([-100, -10.25, 0, 0.25, 20, 20.25, 100])(
    'does not accumulate precision or position error through repeated round-trips at zoom %s',
    (zoom) => {
      const center = Decimal('1e48');
      const axis = new TimescopeViewport({ time: center, timeRange: [undefined, undefined], zoom });
      onTestFinished(() => axis.dispose());
      axis.setAxisLength([400, 400]);
      let time = axis.t(417.375);
      const sizes: number[] = [];
      for (const iterations of [64, 256, 1024]) {
        let size = 0;
        for (let i = 0; i < iterations; i++) {
          time = axis.t(axis.p(time));
          size = Math.max(size, time.coeff.toString().length + Math.max(0, time.digits));
          expect(axis.p(time)).toBeCloseTo(417.375, 3);
        }
        sizes.push(size);
      }
      // Compare growth, not a particular Decimal representation or rounding policy.
      expect(sizes[1]).toBeLessThanOrEqual(sizes[0]);
      expect(sizes[2]).toBeLessThanOrEqual(sizes[0]);
    },
  );

  it('keeps precision bounded when converted times feed back into pan and zoom state', () => {
    const center = Decimal('1e48');
    const axis = new TimescopeViewport({ time: center, timeRange: [undefined, undefined], zoom: 20 });
    onTestFinished(() => axis.dispose());
    axis.setAxisLength([400, 400]);
    const sizes: number[] = [];
    for (const cycles of [16, 64, 256]) {
      let size = 0;
      for (let cycle = 0; cycle < cycles; cycle++) {
        for (const zoom of [20, 20.25, 21.5, 100, 21.5, 20.25, 20]) {
          axis.handleSyncEvent({ zoom: { type: 'restore', value: Decimal(zoom), domain: [undefined, undefined] } });
          for (const pixel of [413.375, 386.625]) {
            const time = axis.t(pixel);
            axis.handleSyncEvent({ time: { type: 'restore', value: time, domain: [undefined, undefined] } });
            size = Math.max(size, time.coeff.toString().length + Math.max(0, time.digits));
          }
        }
        expect(axis.p(center)).toBeCloseTo(400, 3);
      }
      sizes.push(size);
    }
    expect(sizes[1]).toBeLessThanOrEqual(sizes[0]);
    expect(sizes[2]).toBeLessThanOrEqual(sizes[0]);
  });

  it('round-trips subpixel positions at an enormous absolute timestamp', () => {
    const center = Decimal('1e48');
    const axis = new TimescopeViewport({ time: center, timeRange: [undefined, undefined], zoom: 100 });
    onTestFinished(() => axis.dispose());
    const resolution = axis.r(Decimal(100));
    axis.setAxisLength([400, 400]);
    for (const offset of [-1, -0.25, 0, 0.25, 1]) {
      const time = center.add(resolution.mul(offset));
      expect(axis.p(time)).toBe(400 + offset);
      expect(axis.p(axis.t(400 + offset))).toBe(400 + offset);
    }
    expect(axis.t(401).eq(center.add(resolution))).toBe(true);
  });

  it('projects cached coordinates at a different resolution without losing absolute-time precision', () => {
    const origin = Decimal('1e30');
    const dataResolution = Decimal('1e-20');
    const renderResolution = Decimal('2.5e-21');
    const time = origin.add(dataResolution.mul('123.456'));
    const localX = time.sub(origin).div(dataResolution).number();
    const offset = -217.25;
    const projected = offset + localX * renderScaleX(dataResolution, renderResolution);
    expect(projected).toBeCloseTo(offset + 123.456 * 4, 10);
  });

  it('keeps the center fixed while changing zoom', () => {
    const axisHalfWidth = 400;
    const dataResolution = Decimal(512);
    const targetResolution = Decimal(1024);
    const origin = targetResolution.mul(-axisHalfWidth);
    const localX = origin.neg().div(dataResolution).number();
    for (const fraction of [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1]) {
      const resolution = dataResolution.add(targetResolution.sub(dataResolution).mul(fraction));
      const originX = origin.divRound(resolution, 3).number() + axisHalfWidth;
      expect(originX + localX * renderScaleX(dataResolution, resolution)).toBeCloseTo(axisHalfWidth, 3);
    }
  });

  it.each([-1000, -10.25, 0, 0.25, 20.25, 1000])('round-trips resolution at zoom %s', (zoom) => {
    const resolution = resolutionFor(zoom);
    expect(resolution.isPositive()).toBe(true);
    expect(zoomFor(resolution)).toBeCloseTo(zoom, 12);
  });

  it('rounds pixel positions to decimal places rather than significant digits', () => {
    const axis = new TimescopeViewport({ time: 0, timeRange: [undefined, undefined], zoom: 0 });
    onTestFinished(() => axis.dispose());
    axis.setAxisLength([400, 400]);
    expect(axis.p('123.45649')).toBe(523.456);
    expect(axis.p('123.45651')).toBe(523.457);
    expect(axis.t(523.456).eq('123.456')).toBe(true);
  });
});
