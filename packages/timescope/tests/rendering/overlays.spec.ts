import { Decimal } from '#src/core/decimal';
import { TimescopeTimeAxisLayer } from '#src/renderer/layers/TimescopeTimeAxisLayer';
import { OUTSIDE_TIME_RANGE_COLOR, renderCursor, renderTimeRangeInverse } from '#src/renderer/rendering';
import type { TimescopeRenderingContext } from '#src/renderer/types';
import { Canvas } from 'skia-canvas';
import { describe, expect, it } from 'vitest';

describe('overlays', () => {
  function drawAxis(background: string, timeAxis = {}) {
    const canvas = new Canvas(20, 20);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, 20, 20);
    const layer = new TimescopeTimeAxisLayer();
    try {
      layer.preRender({
        ctx,
        dpr: 1,
        size: { width: 20, height: 20 },
        tracks: [{ id: 'default', oy: 0, height: 20, y0: 10.5 }],
        options: { tracks: { default: { timeAxis } } },
        dataCaches: { 'tracks:default:timeAxis': { data: { data: [{ tick: true, time: { time: 0 } }] } } },
        timeAxis: { p: () => 10.5 },
      } as unknown as TimescopeRenderingContext);
    } finally {
      layer.dispose();
    }
    return (x: number, y: number) => [...ctx.getImageData(x, y, 1, 1).data];
  }

  it.each([
    { background: '#fff', expected: 214 },
    { background: '#1e1e1e', expected: 66 },
  ])('keeps time-axis lines and ticks visible over $background', ({ background, expected }) => {
    const pixel = drawAxis(background);
    for (const [x, y] of [
      [2, 10],
      [10, 7],
    ]) {
      for (const channel of pixel(x, y).slice(0, 3)) expect(Math.abs(channel - expected)).toBeLessThanOrEqual(1);
    }
  });

  it('honors independent axis-line and tick colors', () => {
    const pixel = drawAxis('#fff', { axis: { color: '#00ff00' }, ticks: { color: '#ff0000' } });
    expect(pixel(2, 10)).toEqual([0, 255, 0, 255]);
    expect(pixel(10, 7)).toEqual([255, 0, 0, 255]);
  });

  it.each([
    { color: '#fff', expected: 239 },
    { color: '#000', expected: 18 },
    { color: '#1e1e1e', expected: 44 },
  ])('distinguishes out-of-range areas over $color', ({ color, expected }) => {
    const canvas = new Canvas(20, 4);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 20, 4);
    const inside = [...ctx.getImageData(10, 2, 1, 1).data];
    renderTimeRangeInverse(
      {
        ctx,
        size: { width: 20, height: 4 },
        timeAxis: { p: () => [5, 15] },
      } as unknown as TimescopeRenderingContext,
      [Decimal(0), Decimal(1)],
      OUTSIDE_TIME_RANGE_COLOR,
    );
    for (const x of [2, 18]) {
      const pixel = ctx.getImageData(x, 2, 1, 1).data;
      for (const channel of pixel.slice(0, 3)) expect(Math.abs(channel - expected)).toBeLessThanOrEqual(1);
      expect(pixel[3]).toBe(255);
    }
    expect([...ctx.getImageData(10, 2, 1, 1).data]).toEqual(inside);
  });

  it.each([
    { cursor: true, center: [255, 0, 0, 255], border: [0, 0, 0, 0] },
    { cursor: { color: 'rgba(0, 255, 0, 0.5)' }, center: [0, 255, 0, 128], border: [0, 0, 0, 0] },
    { cursor: { borderColor: 'rgba(0, 255, 0, 0.5)' }, center: [255, 0, 0, 255], border: [0, 255, 0, 128] },
  ])('clears the cursor strip before painting its center and borders: %o', ({ cursor, center, border }) => {
    const canvas = new Canvas(20, 4);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'blue';
    ctx.fillRect(0, 0, 20, 4);
    renderCursor({
      ctx,
      size: { height: 4 },
      timeAxis: { cursor: { p: 10 } },
      options: { cursor },
    } as unknown as TimescopeRenderingContext);
    for (const x of [9, 11]) expect([...ctx.getImageData(x, 2, 1, 1).data]).toEqual(border);
    expect([...ctx.getImageData(10, 2, 1, 1).data]).toEqual(center);
    expect([...ctx.getImageData(8, 2, 1, 1).data]).toEqual([0, 0, 255, 255]);
    expect(ctx.globalCompositeOperation).toBe('source-over');
  });
});
