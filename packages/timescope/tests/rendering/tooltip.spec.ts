import { Decimal } from '#src/core/decimal';
import { TimescopeSeriesTooltipLayer } from '#src/renderer/layers/TimescopeSeriesTooltipLayer';
import type { TimescopeRenderingContext } from '#src/renderer/types';
import { describe, expect, it, vi } from 'vitest';

describe('tooltip label placement', () => {
  it.each([
    { x: 100, edges: [120, 80, 120, 120, 80], positions: [125.5, 73.5, 125.5, 125.5, 73.5] },
    { x: 80, edges: [120, 60, 120, 120, 60], positions: [125.5, 53.5, 125.5, 125.5, 53.5] },
    { x: 120, edges: [140, 80, 140, 140, 80], positions: [145.5, 73.5, 145.5, 145.5, 73.5] },
    { x: -10, edges: [120, 20, 120, 120, 20], positions: [125.5, 45.5, 125.5, 125.5, 45.5] },
    { x: 210, edges: [180, 80, 180, 180, 80], positions: [153.5, 73.5, 153.5, 153.5, 73.5] },
    { x: 30, edges: [120, 50, 120, 120, 50], positions: [125.5, 55.5, 125.5, 125.5, 55.5], flipped: 'left' },
    { x: 170, edges: [150, 80, 150, 150, 80], positions: [143.5, 73.5, 143.5, 143.5, 73.5], flipped: 'right' },
    { x: 70, edges: [120, 90, 120, 120, 90], positions: [125.5, 95.5, 125.5, 125.5, 95.5], flipped: 'left' },
    { x: 130, edges: [110, 80, 110, 110, 80], positions: [103.5, 73.5, 103.5, 103.5, 73.5], flipped: 'right' },
    { x: 80, edges: [120, 60, 120, 120, 60], positions: [125.5, 53.5, 125.5, 125.5, 53.5], live: true },
  ])('places labels at x=$x, live=$live', ({ x, edges, positions, flipped, live }) => {
    const drawn: string[] = [];
    const labelXs: number[] = [];
    const moveTo = vi.fn();
    const lineTo = vi.fn();
    const ctx = new Proxy(
      {
        canvas: { width: 200, height: 200 },
        textAlign: 'left',
        measureText: () => ({ width: 20, fontBoundingBoxAscent: 8, fontBoundingBoxDescent: 2 }),
        moveTo,
        lineTo,
        fillText(_text: string, x: number) {
          drawn.push(this.textAlign);
          labelXs.push(x);
        },
      },
      {
        get(target, key) {
          return key in target ? Reflect.get(target, key) : vi.fn();
        },
      },
    );
    const sides = [undefined, 'left', undefined, 'right', 'left'];
    const keys = sides.map((_, index) => `series${index}`);
    const rendering = {
      ctx,
      dpr: 1,
      size: { width: 200, height: 200 },
      tracks: [{ id: 'default', oy: 0, height: 200, seriesKeys: keys, yForDomain: (_id: string, y: number) => y }],
      options: { series: Object.fromEntries(keys.map((key, index) => [key, { tooltip: { side: sides[index] } }])) },
      dataCaches: Object.fromEntries(
        keys.map((key, index) => [
          `series:${key}:tooltip`,
          {
            data: {
              data: { t: [Decimal(0), Decimal(2)], y: [20 + index * 35, 999], text: [key, 'future'] },
              meta: { color: '#0284c7', projection: { domainId: 'amplitude' } },
            },
          },
        ]),
      ),
      timeAxis: {
        cursor: { time: live ? null : Decimal(1), p: 100 },
        now: Decimal(1),
        p: (time: Decimal) => (time.eq(1) ? 100 : x),
        animating: false,
      },
    } as unknown as TimescopeRenderingContext;
    const layer = new TimescopeSeriesTooltipLayer();
    try {
      layer.postRender(rendering);
      expect(drawn).toEqual(
        flipped === 'left'
          ? ['left', 'left', 'left', 'left', 'left']
          : flipped === 'right'
            ? ['right', 'right', 'right', 'right', 'right']
            : ['left', 'right', 'left', 'left', 'right'],
      );
      expect(labelXs).toEqual(positions.map((position) => expect.closeTo(position, 1)));
      expect(lineTo.mock.calls).toEqual([0, 1, 2, 3, 4].map((index) => [x, 20 + index * 35]));
      // Boundary overlap switches the label side; leader lines follow its nearest edge.
      expect(moveTo.mock.calls.map(([edgeX]) => edgeX)).toEqual(edges.map((edge) => expect.closeTo(edge, 1)));
    } finally {
      layer.dispose();
    }
  });
});
