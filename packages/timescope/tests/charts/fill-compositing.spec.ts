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
    const fill = createFillStyle({ color: 'rgba(255, 0, 0, 0.5)', fillOpacity: 0.4 });
    const overBlue = paint(fill, [0, 0, 255]);
    expect(overBlue[0]).toBeCloseTo(255 * 0.5 * 0.4);
    expect(overBlue[2]).toBeCloseTo(255 * (1 - 0.5 * 0.4));
    expect(overBlue).not.toEqual(paint(fill, [0, 255, 0]));
  });

  it('explicit mark fillOpacity allows the underlying chart to show through', () => {
    const fill = createMarkFillStyle({ color: '#000', fillColor: '#f00', fillOpacity: 0.4 }, '#fff');
    expect(paint(fill, [0, 0, 255])[2]).toBeCloseTo(255 * 0.6);
  });
});
