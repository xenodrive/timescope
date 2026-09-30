import { DEFAULT_FONT_FAMILY, resolveFont } from '#src/main/fontStyle';
import { TimescopeLayer } from '#src/renderer/layers/TimescopeLayer';
import { forEachTrack } from '#src/renderer/rendering';
import type { TimescopeTrack } from '#src/renderer/TimescopeTrack';
import type { TimescopeRenderingContext, TimescopeYAxisData } from '#src/renderer/types';

const Y_AXIS_WIDTH = 72;

export class TimescopeYAxisLayer extends TimescopeLayer {
  render(timescope: TimescopeRenderingContext) {
    forEachTrack(timescope, (_id, track) => {
      const left = track.axes.filter((axis) => axis.side === 'left');
      const right = track.axes.filter((axis) => axis.side === 'right');
      let leftOffset = 0;
      let rightOffset = 0;
      for (const axis of left) leftOffset += this.#renderAxis(timescope, track, axis, leftOffset);
      for (const axis of right) rightOffset += this.#renderAxis(timescope, track, axis, rightOffset);
    });
  }

  #renderAxis(
    timescope: TimescopeRenderingContext,
    track: TimescopeTrack,
    axis: TimescopeYAxisData['data'],
    offset: number,
  ) {
    const ctx = timescope.ctx;
    const left = axis.side === 'left';
    const x = left ? offset + 0.5 : timescope.size.width - offset - 0.5;
    const direction = left ? 1 : -1;

    ctx.save();
    ctx.strokeStyle = axis.color || '#64748b';
    ctx.fillStyle = axis.color || timescope.options.foreground || 'black';
    ctx.lineWidth = 1;
    ctx.font = resolveFont(
      axis.font,
      { weight: 'normal', size: 11, family: DEFAULT_FONT_FAMILY },
      timescope.options.font,
    );
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'right';
    const maxTickWidth = Math.max(0, ...axis.ticks.map((tick) => ctx.measureText(tick.text).width));

    const floating = track.fadeForDomain(axis.id);
    const bottom = floating > 0 ? Math.min(track.bottom, track.y0 - floating) : track.bottom;
    const title = [axis.label, axis.unit].filter(Boolean).join(' ');
    const titleY = 1;
    const titleMetrics = title ? ctx.measureText(title) : undefined;
    const titleBottom = titleMetrics
      ? titleY + Math.max(11, titleMetrics.actualBoundingBoxAscent + titleMetrics.actualBoundingBoxDescent) + 4
      : -Infinity;
    const top = Math.max(track.top, titleBottom, floating < 0 ? track.y0 - floating : -Infinity);
    const ticks = axis.ticks.flatMap((tick) => {
      const y = track.yForDomain(axis.id, tick.value);
      if (!Number.isFinite(y) || y < top || y > bottom) return [];
      const metrics = ctx.measureText(tick.text);
      const textTop = y - Math.max(5.5, metrics.actualBoundingBoxAscent);
      if (textTop <= titleBottom) return [];
      return [{ text: tick.text, y }];
    });

    ctx.beginPath();
    if (top <= bottom) {
      ctx.moveTo(x, top);
      ctx.lineTo(x, bottom);
    }
    for (const { y } of ticks) {
      ctx.moveTo(x, y + 0.5);
      ctx.lineTo(x + direction * 5, y + 0.5);
    }
    ctx.stroke();

    for (const { text, y } of ticks) {
      ctx.fillText(text, left ? x + 8 + maxTickWidth : x - 8, y);
    }

    if (title) {
      ctx.textBaseline = 'top';
      ctx.textAlign = left ? 'left' : 'right';
      ctx.fillText(title, x - direction * 0.5, titleY);
    }

    ctx.restore();
    return Math.max(Y_AXIS_WIDTH, maxTickWidth + 16);
  }
}
