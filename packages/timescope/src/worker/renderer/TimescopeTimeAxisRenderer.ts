import type { TimescopeTimeAxisProviderData } from '#src/bridge/protocol';
import { TimescopeRenderer } from '#src/worker/renderer/TimescopeRenderer';
import { parseTextStyle } from '#src/worker/style';
import type { TimescopeRenderingContext } from '#src/worker/types';
import { forEachTrack, normalizeOptions } from '#src/worker/utils';

export class TimescopeTimeAxisRenderer extends TimescopeRenderer {
  render(timescope: TimescopeRenderingContext): void {
    super.render(timescope);

    forEachTrack(timescope, () => {
      this.#renderLabels(timescope);
    });
  }

  preRender(timescope: TimescopeRenderingContext): void {
    super.preRender(timescope);

    forEachTrack(timescope, () => {
      this.#renderAxis(timescope);
    });
  }

  #renderAxis(timescope: TimescopeRenderingContext): void {
    const ctx = timescope.ctx;
    const { width } = timescope.size;
    const axisY = timescope.renderingTrack!.y0;

    const id = timescope.renderingTrack!.id;
    const opts = normalizeOptions(timescope.options.tracks?.[id].timeAxis, {});
    if (!opts) return;

    const data: TimescopeTimeAxisProviderData[] = timescope.dataCaches[`tracks:${id}:timeAxis`]?.data;
    if (!data) return;

    ctx.beginPath();

    if (opts.axis !== false) {
      ctx.strokeStyle = (typeof opts.axis === 'object' ? opts.axis.color : undefined) || '#3333';
      ctx.moveTo(0, axisY + 0.5);
      ctx.lineTo(width, axisY + 0.5);
    }

    ctx.strokeStyle =
      (opts.ticks !== false && typeof opts.ticks === 'object' ? opts.ticks.color : undefined) || '#3333';

    data.forEach((tick) => {
      if (!tick.tick) return;
      const x = timescope.timeAxis.p(tick.time.time);
      if (opts.ticks !== false) {
        ctx.moveTo(x, axisY - (tick.major ? 10 : 5));
        ctx.lineTo(x, axisY + (timescope.symmetric ? (tick.major ? 10 : 5) : 0));
      }
    });

    ctx.stroke();
  }

  #renderLabels(timescope: TimescopeRenderingContext): void {
    const ctx = timescope.ctx;

    const axisY = timescope.renderingTrack!.y0;
    const labelY = axisY + 2;

    const id = timescope.renderingTrack!.id;
    const opts = normalizeOptions(timescope.options.tracks?.[id].timeAxis, {});
    if (!opts) return;
    const data: TimescopeTimeAxisProviderData[] = timescope.dataCaches[`tracks:${id}:timeAxis`]?.data;
    if (!data) return;

    if (opts.labels === false) return;

    const textStyle = parseTextStyle(opts.labels);
    ctx.fillStyle = textStyle?.color ?? 'black'; // for labels
    ctx.font = textStyle?.font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    data.forEach((tick) => {
      const x = timescope.timeAxis.p(tick.time.time);
      if (tick.text !== undefined) ctx.fillText(tick.text, x, labelY);
    });
  }
}
