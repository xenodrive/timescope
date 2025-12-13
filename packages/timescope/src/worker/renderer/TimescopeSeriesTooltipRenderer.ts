import type {
  TimescopeSeriesInstantaneousValueProviderData,
  TimescopeSeriesInstantaneousValueProviderMeta,
} from '#src/bridge/protocol';
import { Decimal } from '#src/core/decimal';
import { Vector2f } from '#src/core/vector';
import { bisectRight } from '#src/worker/bisect';
import { disperse } from '#src/worker/disperse';
import { TimescopeRenderer } from '#src/worker/renderer/TimescopeRenderer';
import type { TimescopeRenderingContext } from '#src/worker/types';
import { forEachTrack } from '#src/worker/utils';
import type { TimescopeDataCacheSeries } from '../TimescopeDataCacheSeries';

export class TimescopeSeriesTooltipRenderer extends TimescopeRenderer {
  postRender(timescope: TimescopeRenderingContext): void {
    super.postRender(timescope);

    this.#renderTooltips(timescope);
  }

  #readByTime(data: TimescopeSeriesInstantaneousValueProviderData[], t: Decimal) {
    if (!data) return;
    const idx = bisectRight(data, t, (o) => o.time.time);
    if (0 < idx && idx <= data.length) return data[idx - 1];
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

        const {
          data: tooltipData,
          meta,
          scaleY,
          floating,
        } = timescope.dataCaches[`series:${k}:instantaneous`] as TimescopeDataCacheSeries<
          TimescopeSeriesInstantaneousValueProviderData,
          TimescopeSeriesInstantaneousValueProviderMeta
        >;
        if (!meta) continue;

        if (!scaleY) continue;

        const data = this.#readByTime(tooltipData, cursorDecimal);

        if (!data) continue;

        const time = data.time.time;
        if (!time) continue;
        const x = timescope.timeAxis.p(time);

        /*
        if (s.options.label === false) continue;
        if (s.options.label?.side) sideX = s.options.label.side === 'right' ? 1 : -1;
        */

        const value = data.value;
        const text = data.text;

        const metrics = ctx.measureText(text);

        const paddingX = 6;
        const paddingY = 2;

        const color = meta.color;

        if (value == null) continue;

        const y = track.y(scaleY(value.value), floating) ?? NaN;

        labels.push({
          id: labels.length,

          cx: x,
          cy: y,
          point: new Vector2f(0, y),
          color,
          metrics,

          sideX: sideX,

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

      disperse(labels, timescope.chart.oy, timescope.chart.oy + timescope.chart.height);

      for (const p of labels) {
        p.point.x = p.cx + p.sideX * (p.point.x + 20);
      }

      for (const { cx, cy, point, color } of labels) {
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

      for (const { cx, cy, point, sideX, text, color, box } of labels) {
        ctx.beginPath();
        ctx.arc(cx, cy, 3, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = 'white';
        ctx.stroke();

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
