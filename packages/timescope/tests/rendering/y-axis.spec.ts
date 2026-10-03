import { TimescopeYAxisLayer } from '#src/renderer/layers/TimescopeYAxisLayer';
import type { TimescopeRenderingContext } from '#src/renderer/types';
import { Canvas } from 'skia-canvas';
import { describe, expect, it, vi } from 'vitest';

describe('value-axis label spacing', () => {
  it.each([
    { side: 'left', prioritizeZero: false },
    { side: 'right', prioritizeZero: false },
    { side: 'left', prioritizeZero: true },
    { side: 'right', prioritizeZero: true },
  ])(
    'hides overlapping labels on $side with zero priority=$prioritizeZero without removing tick marks',
    ({ side, prioritizeZero }) => {
      const ctx = new Canvas(160, 70).getContext('2d');
      const fillText = vi.spyOn(ctx, 'fillText');
      const lineTo = vi.spyOn(ctx, 'lineTo');
      const layer = new TimescopeYAxisLayer();
      try {
        layer.render({
          ctx,
          dpr: 1,
          size: { width: 160, height: 70 },
          options: {},
          tracks: [
            {
              id: 'volume',
              oy: 0,
              height: 70,
              top: 0,
              bottom: 70,
              y0: 70,
              fadeForDomain: () => 0,
              projectionForDomain: () => undefined,
              yForDomain: (_id: string, value: number) => value,
              axes: [
                {
                  id: 'volume',
                  side,
                  label: 'Volume',
                  font: { family: 'sans-serif' },
                  // Reverse order, as on a normal ascending value axis.
                  ticks: [
                    { text: prioritizeZero ? '-1' : '0', value: 60 },
                    { text: prioritizeZero ? '0' : '1', value: 32, zero: prioritizeZero },
                    { text: '2', value: 28 },
                  ],
                },
              ],
            },
          ],
        } as unknown as TimescopeRenderingContext);
        expect(fillText.mock.calls.map((call) => call[0])).toEqual(
          prioritizeZero ? ['0', '-1', 'Volume'] : ['2', '0', 'Volume'],
        );
        expect(lineTo.mock.calls.map((call) => call[1])).toEqual([70, 60.5, 32.5, 28.5]);
        expect(ctx.globalCompositeOperation).toBe('source-over');
      } finally {
        fillText.mockRestore();
        lineTo.mockRestore();
        layer.dispose();
      }
    },
  );
});
