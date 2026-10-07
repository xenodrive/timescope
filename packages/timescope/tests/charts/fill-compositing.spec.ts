import { createFillStyle, createMarkFillStyle, renderPath } from '#src/renderer/layers/TimescopeSeriesChartLayer';
import { TimescopeTimeAxisLayer } from '#src/renderer/layers/TimescopeTimeAxisLayer';
import { TimescopeYAxisLayer } from '#src/renderer/layers/TimescopeYAxisLayer';
import type { TimescopeRenderingContext } from '#src/renderer/types';
import { Canvas, Path2D } from 'skia-canvas';
import { describe, expect, it } from 'vitest';

describe('fill compositing', () => {
  it('gives value-axis tick labels and the title transparent halos', () => {
    const canvas = new Canvas(120, 60);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'blue';
    ctx.fillRect(0, 0, 120, 60);
    const layer = new TimescopeYAxisLayer();
    try {
      layer.render({
        ctx,
        dpr: 1,
        size: { width: 120, height: 60 },
        options: { foreground: 'black' },
        tracks: [
          {
            id: 'default',
            oy: 0,
            height: 60,
            top: 0,
            bottom: 60,
            y0: 25,
            fadeForDomain: () => 0,
            projectionForDomain: () => undefined,
            yForDomain: () => 35,
            axes: [
              {
                id: 'value',
                side: 'left',
                label: 'Axis',
                font: { family: 'sans-serif' },
                ticks: [{ text: '0.0', value: 0.5 }],
              },
            ],
          },
        ],
      } as unknown as TimescopeRenderingContext);
      for (const [y, height] of [
        [0, 20],
        [20, 30],
      ]) {
        const pixels = ctx.getImageData(0, y, 60, height).data;
        let transparent = 0;
        let text = 0;
        for (let i = 0; i < pixels.length; i += 4) {
          if (pixels[i + 3] === 0) transparent++;
          if (pixels[i] === 0 && pixels[i + 1] === 0 && pixels[i + 2] === 0 && pixels[i + 3] > 0) text++;
        }
        expect(transparent).toBeGreaterThan(0);
        expect(text).toBeGreaterThan(0);
      }
      expect([...ctx.getImageData(119, 59, 1, 1).data]).toEqual([0, 0, 255, 255]);
      expect(ctx.globalCompositeOperation).toBe('source-over');
    } finally {
      layer.dispose();
    }
  });

  function draw(fillColor: string | undefined, clearFill = true, fillOpacity = 1) {
    const canvas = new Canvas(40, 20);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'blue';
    ctx.fillRect(0, 0, 40, 20);
    const path = new Path2D();
    // Multiple marks share one path, with untouched pixels between them.
    path.rect(2, 2, 8, 16);
    path.rect(22, 2, 8, 16);
    const style = { color: 'rgba(255, 0, 0, 0.5)', fillColor, fillOpacity };
    renderPath({ ctx } as unknown as TimescopeRenderingContext, undefined, path, {
      color: style.color,
      baseline: 0,
      fill: true,
      clearFill,
      fillStyle: clearFill ? createMarkFillStyle(style) : createFillStyle(style),
    });
    const pixel = (x: number) => [...ctx.getImageData(x, 10, 1, 1).data];
    return { ctx, pixel };
  }

  it('replaces links with translucent marks without touching pixels outside their paths', () => {
    const { ctx, pixel } = draw(undefined);
    for (const x of [5, 25]) {
      const [r, g, b, a] = pixel(x);
      expect(r).toBeGreaterThan(250);
      expect(g).toBe(0);
      expect(b).toBe(0);
      expect(a).toBeCloseTo(255 * 0.5 * 0.25, 0);
    }
    expect(pixel(15)).toEqual([0, 0, 255, 255]);
    expect(ctx.globalCompositeOperation).toBe('source-over');
    expect(ctx.globalAlpha).toBe(1);
  });

  it('preserves the alpha of explicit fill colors while removing underlying links', () => {
    const { pixel } = draw('rgba(255, 0, 0, 0.5)');
    expect(pixel(5)[2]).toBe(0);
    expect(Math.abs(pixel(5)[3] - 127.5)).toBeLessThanOrEqual(1);
  });

  it('allows a transparent mark fill to erase its interior', () => {
    const { pixel } = draw('transparent');
    expect(pixel(5)).toEqual([0, 0, 0, 0]);
    expect(pixel(15)).toEqual([0, 0, 255, 255]);
  });

  it.each([
    { fillColor: undefined, fillOpacity: 0.4, alpha: 0.5 * 0.25 * 0.4 },
    { fillColor: 'rgba(255, 0, 0, 0.5)', fillOpacity: 0.4, alpha: 0.5 * 0.4 },
    { fillColor: undefined, fillOpacity: 0, alpha: 0 },
    { fillColor: undefined, fillOpacity: -1, alpha: 0 },
    { fillColor: undefined, fillOpacity: 2, alpha: 0.5 * 0.25 },
  ])('multiplies mark fill alpha without revealing links: %o', ({ fillColor, fillOpacity, alpha }) => {
    const { pixel } = draw(fillColor, true, fillOpacity);
    expect(pixel(5)[2]).toBe(0);
    expect(Math.abs(pixel(5)[3] - 255 * alpha)).toBeLessThanOrEqual(1);
    expect(pixel(15)).toEqual([0, 0, 255, 255]);
  });

  it('keeps link fills translucent over previously drawn series', () => {
    const { pixel } = draw('rgba(255, 0, 0, 0.5)', false, 0.4);
    const [r, g, b, a] = pixel(5);
    expect(r).toBeCloseTo(255 * 0.5 * 0.4, 0);
    expect(g).toBe(0);
    expect(b).toBeCloseTo(255 * (1 - 0.5 * 0.4), 0);
    expect(a).toBe(255);
  });

  it.each([false, true])('orders clearing with the fill when fillPost is %s', (fillPost) => {
    const canvas = new Canvas(20, 20);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'blue';
    ctx.fillRect(0, 0, 20, 20);
    const path = new Path2D();
    path.rect(5, 5, 10, 10);
    renderPath({ ctx } as unknown as TimescopeRenderingContext, path, path, {
      color: 'red',
      baseline: 0,
      fill: true,
      fillPost,
      clearFill: true,
      fillStyle: 'transparent',
      stroke: true,
      strokeStyle: 'red',
      lineWidth: 4,
    });
    expect([...ctx.getImageData(6, 10, 1, 1).data]).toEqual(fillPost ? [0, 0, 0, 0] : [255, 0, 0, 255]);
    expect([...ctx.getImageData(4, 10, 1, 1).data]).toEqual([255, 0, 0, 255]);
    expect([...ctx.getImageData(10, 10, 1, 1).data]).toEqual([0, 0, 0, 0]);
    expect([...ctx.getImageData(1, 10, 1, 1).data]).toEqual([0, 0, 255, 255]);
  });

  it.each([
    { foreground: undefined, labelColor: undefined, expected: [0, 0, 0] },
    { foreground: '#00ff00', labelColor: undefined, expected: [0, 255, 0] },
    { foreground: '#00ff00', labelColor: 'black', expected: [0, 0, 0] },
  ])('clears label halos and honors inherited or explicit colors: %o', ({ foreground, labelColor, expected }) => {
    const canvas = new Canvas(120, 60);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'red';
    ctx.fillRect(0, 0, 120, 60);
    const layer = new TimescopeTimeAxisLayer();
    try {
      layer.render({
        ctx,
        dpr: 1,
        size: { width: 120, height: 60 },
        tracks: [{ id: 'default', oy: 0, height: 60, y0: 20, top: 0, chartHeight: 40 }],
        options: {
          foreground,
          tracks: { default: { timeAxis: { labels: { color: labelColor, font: { family: 'sans-serif' } } } } },
        },
        dataCaches: { 'tracks:default:timeAxis': { data: { data: [{ text: 'M', time: { time: 0 } }] } } },
        timeAxis: { p: () => 60 },
      } as unknown as TimescopeRenderingContext);
      const pixels = ctx.getImageData(40, 20, 40, 25).data;
      let transparent = 0;
      let text = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        if (pixels[i + 3] === 0) transparent++;
        if (expected.every((channel, j) => pixels[i + j] === channel) && pixels[i + 3] > 0) text++;
      }
      expect(transparent).toBeGreaterThan(0);
      expect(text).toBeGreaterThan(0);
      expect([...ctx.getImageData(0, 0, 1, 1).data]).toEqual([255, 0, 0, 255]);
      expect(ctx.globalCompositeOperation).toBe('source-over');
    } finally {
      layer.dispose();
    }
  });
});
