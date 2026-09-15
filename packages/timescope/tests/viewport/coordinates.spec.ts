import { Decimal } from '#src/core/decimal';
import { renderScaleX } from '#src/renderer/layers/TimescopeSeriesChartLayer';
import { TimescopeViewport } from '#src/renderer/TimescopeViewport';
import { describe, expect, it, onTestFinished } from 'vitest';

describe('time coordinates', () => {
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
      const originX = origin.div(resolution, 3).number() + axisHalfWidth;
      expect(originX + localX * renderScaleX(dataResolution, resolution)).toBeCloseTo(axisHalfWidth, 3);
    }
  });
});
