import { createFillStyle, createMarkFillStyle } from '#src/renderer/layers/TimescopeSeriesChartLayer';
import { describe, expect, it } from 'vitest';

// Evaluate the resulting paint over a pixel. Assertions concern the visible
// result, not a particular CSS spelling of the generated color.
function paint(color: string, behind: number[]): number[] {
  const channels = color.match(/[\d.]+/g)!.map(Number);
  const alpha = channels[3] ?? 1;
  return behind.map((value, i) => channels[i] * alpha + value * (1 - alpha));
}

describe('fill compositing', () => {
  it.each(['#fff', '#222'])('marks hide underlying links over an opaque %s background', (background) => {
    const fill = createMarkFillStyle({ color: 'rgba(255, 0, 0, 0.5)' }, background);
    expect(paint(fill, [0, 0, 255])).toEqual(paint(fill, [0, 255, 0]));
  });

  it('mark shading follows the configured background', () => {
    const style = { color: 'rgba(255, 0, 0, 0.5)' };
    const light = paint(createMarkFillStyle(style, '#fff'), [0, 0, 0]);
    const dark = paint(createMarkFillStyle(style, '#000'), [0, 0, 0]);
    expect(light[1]).toBeGreaterThan(dark[1]);
  });

  it('links leave other series visible through their fill', () => {
    const fill = createFillStyle({ color: '#000', fillColor: 'rgba(255, 0, 0, 0.5)', fillOpacity: 0.4 });
    const overBlue = paint(fill, [0, 0, 255]);
    expect(overBlue[0]).toBeCloseTo(255 * 0.5 * 0.4);
    expect(overBlue[2]).toBeCloseTo(255 * (1 - 0.5 * 0.4));
    expect(overBlue).not.toEqual(paint(fill, [0, 255, 0]));
  });

  it('explicit mark fillOpacity allows the underlying chart to show through', () => {
    const fill = createMarkFillStyle({ color: '#000', fillColor: '#f00', fillOpacity: 0.4 }, '#fff');
    expect(paint(fill, [0, 0, 255])[2]).toBeCloseTo(255 * 0.6);
  });

  it('fillOpacity fades the derived mark shade rather than changing its color', () => {
    const style = { color: '#f00' };
    const shade = paint(createMarkFillStyle(style, '#fff'), [0, 0, 0]);
    const faded = paint(createMarkFillStyle({ ...style, fillOpacity: 0.5 }, '#fff'), [0, 0, 255]);
    expect(faded).toEqual(shade.map((value, i) => value * 0.5 + (i === 2 ? 255 * 0.5 : 0)));
  });

  it.each([
    { fillColor: '#f00', expectedAlpha: 1 },
    { fillColor: 'rgba(255, 0, 0, 0.5)', expectedAlpha: 0.5 },
    { fillColor: 'rgba(255, 0, 0, 0.5)', fillOpacity: 0.5, expectedAlpha: 0.25 },
  ])('explicit fill colors have identical compositing for marks and links: %o', ({ expectedAlpha, ...fillStyle }) => {
    const style = { color: '#000', ...fillStyle };
    const expected = [255 * expectedAlpha, 0, 255 * (1 - expectedAlpha)];
    expect(paint(createFillStyle(style), [0, 0, 255])).toEqual(expected);
    for (const background of ['#fff', '#222']) {
      expect(paint(createMarkFillStyle(style, background), [0, 0, 255])).toEqual(expected);
    }
  });

  it.each([{ fillOpacity: 0 }, { fillColor: 'transparent' }, { fillColor: '#f00', fillOpacity: 0 }])(
    'transparent fills preserve the underlying chart: %o',
    (fillStyle) => {
      const style = { color: '#f00', ...fillStyle };
      const behind = [20, 80, 160];
      expect(paint(createFillStyle(style), behind)).toEqual(behind);
      expect(paint(createMarkFillStyle(style, '#fff'), behind)).toEqual(behind);
    },
  );
});
