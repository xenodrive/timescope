import { bisectRight } from '#src/core/bisect';
import { Decimal } from '#src/core/decimal';
import { Vector2f } from '#src/core/vector';
import { disperse } from '#src/renderer/layers/disperse';
import { TimescopeLayer } from '#src/renderer/layers/TimescopeLayer';
import { forEachTrack } from '#src/renderer/rendering';
import type { TimescopeRenderingContext, TimescopeSeriesTooltipData } from '#src/renderer/types';
import type { TimescopeDataCache } from '../TimescopeDataCache.ts';

export function tooltipXPlacement(x: number, left: number, right: number, sideX: number) {
  if (x < left) return { x: left, sideX: 1, sticky: true };
  if (x > right) return { x: right, sideX: -1, sticky: true };
  return { x, sideX, sticky: false };
}

export class TimescopeSeriesTooltipLayer extends TimescopeLayer {
  postRender(timescope: TimescopeRenderingContext): void {
    super.postRender(timescope);

    this.#renderTooltips(timescope);
  }

  #readByTime(data: TimescopeSeriesTooltipData['data'], t: Decimal) {
    if (!data) return;
    const idx = bisectRight(data.t, t);
    if (0 < idx && idx <= data.t.length) return idx - 1;
    return undefined;
  }

  #renderTooltips(timescope: TimescopeRenderingContext) {
    if (timescope.timeAxis.animating) return;
    if (!timescope.options.series) return;

    const cursorTime = timescope.timeAxis.cursor.time;
    const cursorDecimal = cursorTime ?? Decimal(Date.now() / 1000)!;

    // group by tracks
    forEachTrack(timescope, (_trackId, track) => {
      const ctx = timescope.ctx;

      const labels = [];
      let sideX = 1;

      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';

      for (const k of track.seriesKeys) {
        const series = timescope.options.series?.[k];
        if (!series) throw new Error('Invalid series');

        if (series.tooltip === false) continue;

        const cache = timescope.dataCaches[`series:${k}:tooltip`] as TimescopeDataCache<TimescopeSeriesTooltipData>;

        if (!cache || !cache.data) continue;

        const {
          data: { data: tooltipData, meta },
        } = cache;

        const idx = this.#readByTime(tooltipData, cursorDecimal);
        if (idx == null) continue;

        const time = tooltipData.t[idx];
        if (!time) continue;
        const x = timescope.timeAxis.p(time);
        const placement = tooltipXPlacement(x, 5, timescope.size.width - 5, sideX);

        /*
        if (s.options.label === false) continue;
        if (s.options.label?.side) sideX = s.options.label.side === 'right' ? 1 : -1;
        */

        const point_y = tooltipData.y[idx];
        const text = tooltipData.text[idx];

        const metrics = ctx.measureText(text);

        const paddingX = 6;
        const paddingY = 2;

        const color = meta.color;

        if (point_y == null) continue;

        const y = track.yForDomain(meta.projection.domainId, point_y);
        if (!Number.isFinite(y)) continue;

        labels.push({
          id: labels.length,

          cx: placement.x,
          cy: y,
          point: new Vector2f(0, y),
          color,
          metrics,
          sticky: placement.sticky,

          sideX: placement.sideX,

          text: {
            dx: paddingX,
            dy: 0,
            value: text,
          },

          box: {
            dx: 0.5,
            dy: 0.5 - metrics.fontBoundingBoxAscent - paddingY,
            width: paddingX * 2 + metrics.width,
            height: paddingY * 2 + metrics.fontBoundingBoxAscent + metrics.fontBoundingBoxDescent,
          },
        });

        sideX = -sideX;
      }

      disperse(labels, 5, timescope.size.height - 5);

      for (const p of labels) {
        p.point.x = p.sticky ? p.cx : p.cx + p.sideX * (p.point.x + 20);
      }

      for (const { cx, cy, point, color, sticky } of labels) {
        if (sticky) continue;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(point.x, point.y);
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.setLineDash([3]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      for (const { cx, cy, point, sideX, text, color, box, sticky } of labels) {
        if (!sticky) {
          ctx.beginPath();
          ctx.arc(cx, cy, 3, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.fill();
          ctx.strokeStyle = 'white';
          ctx.stroke();
        }

        ctx.beginPath();
        ctx.roundRect(point.x + box.dx, point.y + box.dy, box.width * sideX, box.height, 4);
        ctx.shadowBlur = 3;
        ctx.shadowColor = 'black';
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 1;
        ctx.fillStyle = color;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.shadowColor = 'transparent';
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'white';
        ctx.stroke();

        ctx.textBaseline = 'middle';
        ctx.textAlign = sideX < 0 ? 'right' : 'left';
        //ctx.font = this.#labelStyle.font;
        ctx.fillStyle = 'white'; //this.#labelStyle.color ?? 'black';
        ctx.fillText(text.value, point.x + sideX * text.dx, point.y + text.dy);
      }
    });
  }
}
