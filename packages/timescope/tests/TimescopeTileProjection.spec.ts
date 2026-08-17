import { Decimal } from '#src/core/decimal';
import { createLinkProjectionRebase, renderScaleX } from '#src/worker/renderer/TimescopeSeriesChartRenderer';
import { describe, expect, it } from 'vitest';

describe('render-column projection', () => {
  it('collapses stale link geometry for a degenerate active projection', () => {
    const projection = {
      domainId: 'domain',
      domainEpoch: 1,
      revision: 1,
      autoscale: true,
      animation: true,
      initialAnimation: true,
      mode: 'floating-positive' as const,
      extent: [0, 1] as [number, number],
      gap: 20,
      floating: 20,
      numericZero: -1,
      toAnchor: { scale: 1, offset: 0 },
    };
    expect(
      createLinkProjectionRebase(projection, {
        ...projection,
        revision: 2,
        mode: 'constant',
        extent: [0.5, 0.5],
        toAnchor: null,
      }),
    ).toEqual({ scale: 0, offset: 0.5 });
    expect(
      createLinkProjectionRebase(projection, {
        ...projection,
        revision: 2,
        mode: 'constant',
        extent: [-0.5, -0.5],
        floating: -20,
        toAnchor: null,
      }),
    ).toEqual({ scale: 0, offset: -0.5 });
    expect(
      createLinkProjectionRebase(projection, {
        ...projection,
        revision: 2,
        mode: 'zero-only',
        extent: [0, 0],
        floating: 0,
        toAnchor: null,
      }),
    ).toEqual({ scale: 0, offset: 0 });
    expect(createLinkProjectionRebase(projection, { ...projection, domainEpoch: 2 })).toBeNull();
  });

  it('keeps large absolute times out of floating-point projection', () => {
    const xOrigin = Decimal('1000000000000000000000000000000');
    const dataResolution = Decimal('0.00000000000000000001');
    const renderResolution = Decimal('0.0000000000000000000025');
    const time = xOrigin.add(dataResolution.mul('123.456'));
    const localX = time.sub(xOrigin).div(dataResolution).number();
    const origin = -217.25;

    const projected = origin + localX * renderScaleX(dataResolution, renderResolution);
    const expected = origin + time.sub(xOrigin).div(renderResolution, 3).number();

    expect(projected).toBeCloseTo(expected, 10);
    expect(renderScaleX(dataResolution, renderResolution)).toBe(4);
  });

  it('does not accumulate projection drift between frames', () => {
    const dataResolution = Decimal('0.000000001');
    const renderResolution = Decimal('0.0000000003');
    const scale = renderScaleX(dataResolution, renderResolution);
    const project = () => 103.125 + 255.75 * scale;

    expect(Array.from({ length: 1000 }, project).every((value) => value === project())).toBe(true);
  });

  it('keeps a fixed time stable throughout a zoom-out animation', () => {
    const axisHalfWidth = 400;
    const sourceResolution = Decimal(512);
    const targetResolution = Decimal(1024);
    const centerTime = Decimal(0);
    const xOrigin = centerTime.sub(targetResolution.mul(axisHalfWidth));
    const localX = centerTime.sub(xOrigin).div(sourceResolution).number();
    const errors: number[] = [];

    for (let frame = 0; frame <= 200; frame++) {
      const renderResolution = sourceResolution.add(targetResolution.sub(sourceResolution).mul(frame / 200));
      const originX = xOrigin.sub(centerTime).div(renderResolution, 3).number() + axisHalfWidth;
      errors.push(originX + localX * renderScaleX(sourceResolution, renderResolution) - axisHalfWidth);
    }

    expect(Math.max(...errors.map(Math.abs))).toBeLessThan(0.001);
  });
});
