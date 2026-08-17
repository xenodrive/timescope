import type { TimescopeYAxisData } from '#src/bridge/protocol';
import { Y_AXIS_WIDTH } from '#src/core/layout';
import { TimescopeRenderer } from '#src/worker/renderer/TimescopeRenderer';
import type { TimescopeTrack } from '#src/worker/TimescopeTrack';
import type { TimescopeRenderingContext } from '#src/worker/types';
import { forEachTrack } from '#src/worker/utils';

export class TimescopeYAxisRenderer extends TimescopeRenderer {
  render(timescope: TimescopeRenderingContext) {
    forEachTrack(timescope, (_id, track) => {
      const left = track.axes.filter((axis) => axis.side === 'left');
      const right = track.axes.filter((axis) => axis.side === 'right');
      left.forEach((axis, index) => this.#renderAxis(timescope, track, axis, index));
      right.forEach((axis, index) => this.#renderAxis(timescope, track, axis, index));
    });
  }

  #renderAxis(
    timescope: TimescopeRenderingContext,
    track: TimescopeTrack,
    axis: TimescopeYAxisData['data'],
    index: number,
  ) {
    const ctx = timescope.ctx;
    const left = axis.side === 'left';
    const x = left ? index * Y_AXIS_WIDTH + 0.5 : timescope.size.width - index * Y_AXIS_WIDTH - 0.5;
    const direction = left ? 1 : -1;

    ctx.save();
    ctx.strokeStyle = axis.color || '#64748b';
    ctx.fillStyle = axis.color || '#334155';
    ctx.lineWidth = 1;
    ctx.font = '11px sans-serif';
    ctx.textBaseline = 'middle';
    ctx.textAlign = left ? 'left' : 'right';

    ctx.beginPath();
    ctx.moveTo(x, track.top);
    ctx.lineTo(x, track.bottom);
    for (const tick of axis.ticks) {
      const y = track.yForDomain(axis.id, tick.value);
      if (!Number.isFinite(y) || y < track.top - 1 || y > track.bottom + 1) continue;
      ctx.moveTo(x, y + 0.5);
      ctx.lineTo(x + direction * 5, y + 0.5);
    }
    ctx.stroke();

    for (const tick of axis.ticks) {
      const y = track.yForDomain(axis.id, tick.value);
      if (!Number.isFinite(y) || y < track.top - 1 || y > track.bottom + 1) continue;
      ctx.fillText(tick.text, x + direction * 8, y);
    }

    const title = [axis.label, axis.unit].filter(Boolean).join(' ');
    if (title) {
      ctx.textBaseline = 'top';
      ctx.fillText(title, x + direction * 8, track.top);
    }

    const projection = track.projectionForDomain(axis.id);
    if (projection && track.fadeForDomain(axis.id)) {
      const y = track.y0;
      ctx.beginPath();
      ctx.moveTo(x - direction * 4, y - 4);
      ctx.lineTo(x + direction * 4, y);
      ctx.lineTo(x - direction * 4, y + 4);
      ctx.stroke();
    }
    ctx.restore();
  }
}
