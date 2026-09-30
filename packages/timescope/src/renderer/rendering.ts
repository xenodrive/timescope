import type { Decimal } from '#src/core/decimal';
import { defaultOptions } from '#src/core/defaults';
import type { TimescopeRange } from '#src/core/range';
import type { TimescopeTrack } from '#src/renderer/TimescopeTrack';
import type { TimescopeRenderingContext } from '#src/renderer/types';

export function clipToTrack(
  renderingContext: TimescopeRenderingContext,
  track: TimescopeTrack | null,
  callback: (renderingContext: TimescopeRenderingContext) => void,
) {
  const ctx = renderingContext.ctx;
  const dpr = renderingContext.dpr;
  const size = { width: ctx.canvas.width / dpr, height: ctx.canvas.height / dpr };
  ctx.save();
  if (track) {
    ctx.translate(0, track.oy);
    size.height = track.height;
    renderingContext.renderingTrack = track;
  } else {
    renderingContext.renderingTrack = null;
  }
  renderingContext.size.width = size.width;
  renderingContext.size.height = size.height;
  ctx.beginPath();
  ctx.rect(0, 0, renderingContext.size.width, renderingContext.size.height);
  ctx.clip();
  try {
    callback(renderingContext);
  } finally {
    ctx.restore();
  }
}

export function forEachTrack(
  timescope: TimescopeRenderingContext,
  callback: (id: string, track: TimescopeTrack) => void,
) {
  timescope.tracks.forEach((track) => clipToTrack(timescope, track, () => callback(track.id, track)));
}

export function renderTimeRange(
  timescope: TimescopeRenderingContext,
  range: TimescopeRange<Decimal> | null,
  color: string,
) {
  if (!range) return;
  const { height } = timescope.size;
  const ctx = timescope.ctx;

  const [l, r] = timescope.timeAxis.p(range);
  ctx.fillStyle = color;
  ctx.fillRect(l, 0, r - l, height);
}

// Match #00000010 over white, while also distinguishing out-of-range dark backgrounds.
export const OUTSIDE_TIME_RANGE_COLOR = `rgba(136, 136, 136, ${16 / (255 - 136)})`;

export function renderTimeRangeInverse(
  timescope: TimescopeRenderingContext,
  range: TimescopeRange<Decimal | null | undefined> | null,
  color: string,
) {
  if (!range) return;
  const { width, height } = timescope.size;
  const ctx = timescope.ctx;

  const [l, r] = timescope.timeAxis.p(range);
  ctx.fillStyle = color;
  if (0 < l) ctx.fillRect(0, 0, Math.min(l, width), height);
  if (r < width) ctx.fillRect(r, 0, width - r, height);
}

export function renderLabel(ctx: TimescopeRenderingContext['ctx'], text: string, x: number, y: number) {
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.globalAlpha = 1;
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 3;
  ctx.strokeText(text, x, y);
  ctx.restore();
  ctx.fillText(text, x, y);
}

export function renderCursor(timescope: TimescopeRenderingContext) {
  const ctx = timescope.ctx;
  const height = timescope.size.height;
  const x = Math.round(timescope.timeAxis.cursor.p);

  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#000';
  ctx.fillRect(x - 1, 0, 3, height);
  ctx.restore();

  const cursor = timescope.options.cursor;
  ctx.fillStyle =
    typeof cursor === 'object' ? (cursor.color ?? defaultOptions.cursor.color) : defaultOptions.cursor.color;
  ctx.strokeStyle =
    typeof cursor === 'object'
      ? (cursor.borderColor ?? defaultOptions.cursor.borderColor)
      : defaultOptions.cursor.borderColor;
  ctx.lineWidth = 1;
  ctx.fillRect(x - 1, 0, 3, height);

  ctx.beginPath();
  ctx.moveTo(x + 0.5, 0);
  ctx.lineTo(x + 0.5, height);
  ctx.stroke();
}
