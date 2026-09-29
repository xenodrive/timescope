import { Decimal } from '#src/core/decimal';
import { TimescopeTimeAxisLayer } from '#src/renderer/layers/TimescopeTimeAxisLayer';
import type { TimescopeRenderingContext } from '#src/renderer/types';
import { describe, expect, it, vi } from 'vitest';

describe('time-axis labels', () => {
  it('thins by a stable ordinal and draws labels whose centers are just offscreen', () => {
    const fillText = vi.fn();
    const ctx = {
      canvas: { width: 100, height: 50 },
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      beginPath: vi.fn(),
      rect: vi.fn(),
      clip: vi.fn(),
      measureText: () => ({ width: 35 }),
      strokeText: vi.fn(),
      fillText,
    } as unknown as CanvasRenderingContext2D;
    const track = { id: 'default', oy: 0, height: 50, y0: 30, top: 0, chartHeight: 50 };
    const data = Array.from({ length: 10 }, (_, i) => ({
      time: { time: Decimal(i) },
      text: `${i}`,
      labelIndex: BigInt(i),
    }));
    let offset = 0.5;
    const rendering = {
      ctx,
      dpr: 1,
      size: { width: 100, height: 50 },
      tracks: [track],
      options: { tracks: { default: { timeAxis: {} } } },
      dataCaches: { 'tracks:default:timeAxis': { data: { data } } },
      timeAxis: { p: (time: Decimal) => (time.number() - offset) * 20 },
    } as unknown as TimescopeRenderingContext;
    const layer = new TimescopeTimeAxisLayer();
    try {
      layer.render(rendering);
      expect(fillText.mock.calls.map(([text]) => text)).toEqual(['0', '3', '6']);
      fillText.mockClear();
      offset = 1.2;
      layer.render(rendering);
      expect(fillText.mock.calls.map(([text]) => text)).toEqual(['3', '6']);
    } finally {
      layer.dispose();
    }
  });
});
