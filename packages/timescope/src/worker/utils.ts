import type { TimescopeTrack } from './TimescopeTrack';
import type { TimescopeRenderingContext } from './types';

export function clipToTrack(
  renderingContext: TimescopeRenderingContext,
  track: TimescopeTrack | null,
  callback: (renderingContext: TimescopeRenderingContext) => void,
) {
  const ctx = renderingContext.ctx;
  const dpr = renderingContext.dpr;
  const size = {
    width: ctx.canvas.width / dpr,
    height: ctx.canvas.height / dpr,
  };

  ctx.save();

  if (track) {
    ctx.translate(0, track.oy);
    size.height = track.height;
    renderingContext.renderingTrack = track;
  } else {
    renderingContext.renderingTrack = null;
  }

  renderingContext.chart.ox = renderingContext.options.padding![3] ?? 0;
  renderingContext.chart.oy = renderingContext.options.padding![0] ?? 0;
  renderingContext.chart.width = size.width - renderingContext.chart.ox - renderingContext.options.padding![1];
  renderingContext.chart.height = size.height - renderingContext.chart.oy - renderingContext.options.padding![2];
  renderingContext.size.width = size.width;
  renderingContext.size.height = size.height;

  ctx.beginPath();
  ctx.rect(0, 0, renderingContext.size.width, renderingContext.size.height);
  ctx.clip();

  callback(renderingContext);

  ctx.restore();
}

export function forEachTrack(
  timescope: TimescopeRenderingContext,
  callback: (id: string, track: TimescopeTrack) => void,
) {
  timescope.tracks.forEach((track) => clipToTrack(timescope, track, () => callback(track.id, track)));
}

export function normalizeOptions<T>(opts: boolean | T | undefined | null, defaults: T): T | null {
  if (opts === false) return null;
  if (opts === true || opts == null) opts = defaults;
  return opts;
}
