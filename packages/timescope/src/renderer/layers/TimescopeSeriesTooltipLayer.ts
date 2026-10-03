import { Vector2f } from '#src/core/vector';
import { DEFAULT_FONT_FAMILY, resolveFont } from '#src/main/fontStyle';
import { disperse } from '#src/renderer/layers/disperse';
import { TimescopeLayer } from '#src/renderer/layers/TimescopeLayer';
import { forEachTrack } from '#src/renderer/rendering';
import type { TimescopeRenderingContext, TimescopeSeriesTooltipData } from '#src/renderer/types';
import type { TimescopeDataCache } from '../TimescopeDataCache.ts';

export class TimescopeSeriesTooltipLayer extends TimescopeLayer {
  postRender(timescope: TimescopeRenderingContext): void {
    super.postRender(timescope);

    this.#renderTooltips(timescope);
  }

  #renderTooltips(timescope: TimescopeRenderingContext) {
    if (timescope.timeAxis.animating) return;
    if (!timescope.options.series) return;

    const cursorX = timescope.timeAxis.cursor.p;

    // group by tracks
    forEachTrack(timescope, (_trackId, track) => {
      const ctx = timescope.ctx;

      const labels = [];

      ctx.font = resolveFont(
        undefined,
        { weight: 'normal', size: 12, family: DEFAULT_FONT_FAMILY },
        timescope.options.font,
      );
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

        // The provider already selected the instantaneous sample. Keep showing it
        // when a backward pan moves the cursor before its time, until the cache updates.
        const idx = 0;
        const time = tooltipData.t[idx];
        if (!time) continue;
        const x = timescope.timeAxis.p(time);
        const side = typeof series.tooltip === 'object' ? series.tooltip.side : undefined;

        const point_y = tooltipData.y[idx];
        const text = tooltipData.text[idx];

        const metrics = ctx.measureText(text);

        const paddingX = 6;
        const paddingY = 2;
        const boxHeight = metrics.fontBoundingBoxAscent + metrics.fontBoundingBoxDescent + paddingY * 2;

        const color = meta.color;

        if (point_y == null) continue;

        const y = track.yForDomain(meta.projection.domainId, point_y);
        if (!Number.isFinite(y)) continue;

        labels.push({
          id: labels.length,

          cx: x,
          cy: y,
          point: new Vector2f(0, y),
          color,
          metrics,
          sideX: side === 'left' ? -1 : 1,

          text: {
            dx: paddingX,
            value: text,
          },

          box: {
            dx: 0.5,
            dy: 0.5 - boxHeight / 2,
            width: paddingX * 2 + metrics.width,
            height: boxHeight,
          },
        });
      }

      disperse(labels, 5, timescope.size.height - 5);

      const labelGap = 20;
      for (const p of labels) {
        const sampleOnLeft = p.cx <= cursorX;
        p.point.x = p.cx + p.sideX * (p.point.x + labelGap) - p.box.dx;
        const sampleEdge = p.point.x + p.box.dx;
        const sampleLeft = Math.min(sampleEdge, sampleEdge + p.sideX * p.box.width);
        const sampleRight = Math.max(sampleEdge, sampleEdge + p.sideX * p.box.width);
        if (sampleOnLeft) {
          const boundary = (p.sideX < 0 ? 0 : cursorX) + labelGap;
          p.point.x += Math.max(0, boundary - sampleLeft);
        } else {
          const boundary = (p.sideX < 0 ? cursorX : timescope.size.width) - labelGap;
          p.point.x += Math.min(0, boundary - sampleRight);
        }

        const edgeX = p.point.x + p.box.dx;
        // Include the gap in the label's exclusion region before checking overlap.
        const left = Math.min(edgeX, edgeX + p.sideX * p.box.width) - labelGap;
        const right = Math.max(edgeX, edgeX + p.sideX * p.box.width) + labelGap;
        const top = p.point.y + p.box.dy - labelGap;
        const bottom = p.point.y + p.box.dy + p.box.height + labelGap;
        if (p.cx > left && p.cx < right && p.cy > top && p.cy < bottom) {
          p.sideX = sampleOnLeft ? 1 : -1;
          p.point.x = p.cx + p.sideX * labelGap - p.box.dx;
        }
      }

      for (const { cx, cy, point, color, box, sideX } of labels) {
        const nearEdge = point.x + box.dx;
        const farEdge = nearEdge + sideX * box.width;
        const edgeX = Math.abs(cx - nearEdge) <= Math.abs(cx - farEdge) ? nearEdge : farEdge;
        ctx.beginPath();
        ctx.moveTo(edgeX, point.y + box.dy + box.height / 2);
        ctx.lineTo(cx, cy);
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.setLineDash([3]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      for (const { cx, cy, point, sideX, text, color, box } of labels) {
        ctx.beginPath();
        ctx.arc(cx, cy, 3, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = 'white';
        ctx.stroke();

        ctx.beginPath();
        ctx.roundRect(point.x + box.dx, point.y + box.dy, box.width * sideX, box.height, 4);
        ctx.shadowBlur = 3 * timescope.dpr;
        ctx.shadowColor = 'black';
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = timescope.dpr;
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
        ctx.fillStyle = 'white'; //this.#labelStyle.color ?? 'black';
        ctx.fillText(text.value, point.x + sideX * text.dx, point.y + box.dy + box.height / 2);
      }
    });
  }
}
