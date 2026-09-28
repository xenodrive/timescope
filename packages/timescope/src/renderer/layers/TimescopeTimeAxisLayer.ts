import { TimescopeAnimatedValue } from '#src/core/animation';
import { normalizeOptions } from '#src/core/options';
import { resolveFont } from '#src/main/fontStyle';
import { TimescopeLayer } from '#src/renderer/layers/TimescopeLayer';
import { forEachTrack } from '#src/renderer/rendering';
import type { TimescopeRenderingContext, TimescopeTimeAxisData } from '#src/renderer/types';

export class TimescopeTimeAxisLayer extends TimescopeLayer {
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
    const opts = normalizeOptions(timescope.options.tracks?.[id]?.timeAxis, {});
    if (!opts) return;

    const cache: TimescopeTimeAxisData = timescope.dataCaches[`tracks:${id}:timeAxis`]?.data;
    if (!cache) return;
    const data = cache?.data ?? [];

    ctx.beginPath();

    if (opts.axis !== false) {
      ctx.strokeStyle = (typeof opts.axis === 'object' ? opts.axis.color : undefined) || '#3333';
      ctx.moveTo(0, axisY);
      ctx.lineTo(width, axisY);
    }

    ctx.strokeStyle =
      (opts.ticks !== false && typeof opts.ticks === 'object' ? opts.ticks.color : undefined) || '#3333';

    data.forEach((tick) => {
      if (!tick.tick) return;
      const x = timescope.timeAxis.p(tick.time.time);
      if (opts.ticks !== false) {
        ctx.moveTo(x, axisY - (tick.major ? 10 : 5));
        ctx.lineTo(x, axisY + (tick.major ? 10 : 5));
      }
    });

    ctx.stroke();
  }

  #labelY = new TimescopeAnimatedValue();

  override dispose(): void {
    this.#labelY.dispose();
    super.dispose();
  }

  #renderLabels(timescope: TimescopeRenderingContext): void {
    const ctx = timescope.ctx;

    const track = timescope.renderingTrack!;

    const axisY = track.y0;

    this.#labelY.setValue(track.top + track.chartHeight / 2 - 5 <= axisY ? 2 : -16, {
      animation: 'linear',
      duration: 200,
    });
    const labelY = axisY + this.#labelY.value!;
    if (this.#labelY.animating) this.changed();

    const id = timescope.renderingTrack!.id;
    const opts = normalizeOptions(timescope.options.tracks?.[id]?.timeAxis, {});
    if (!opts) return;
    const cache: TimescopeTimeAxisData = timescope.dataCaches[`tracks:${id}:timeAxis`]?.data;
    if (!cache) return;
    const data = cache?.data ?? [];

    if (opts.labels === false) return;

    ctx.fillStyle = (typeof opts.labels === 'object' ? opts.labels.color : undefined) ?? 'black'; // for labels
    ctx.font = resolveFont(typeof opts.labels === 'object' ? opts.labels.font : undefined, {
      weight: 'normal',
      size: 12,
      family: 'BIZ UDPGothic',
    });
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.strokeStyle = timescope.options.background ?? 'white';
    ctx.lineWidth = 3;

    data.forEach((tick) => {
      const x = timescope.timeAxis.p(tick.time.time);
      if (tick.text !== undefined) {
        ctx.strokeText(tick.text, x, labelY);
        ctx.fillText(tick.text, x, labelY);
      }
    });
  }
}
