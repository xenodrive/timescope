import type { Decimal } from '#src/core/decimal';
import type { Range } from '#src/core/range';
import type { TimescopeRenderingContext } from '#src/worker/types';

export function renderTimeRange(
  timescope: TimescopeRenderingContext,
  range: Range<Decimal | null | undefined> | null,
  color: string,
) {
  if (!range) return;
  const { height } = timescope.size;
  const ctx = timescope.ctx;

  const [l, r] = timescope.timeAxis.p(range);
  ctx.fillStyle = color;
  ctx.fillRect(l, 0, r - l, height);
}

export function renderTimeRangeInverse(
  timescope: TimescopeRenderingContext,
  range: Range<Decimal | null | undefined> | null,
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

export function renderIndicator(timescope: TimescopeRenderingContext) {
  const ctx = timescope.ctx;
  const height = timescope.size.height;
  const x = Math.round(timescope.timeAxis.cursor.p);

  ctx.fillStyle = 'white';
  ctx.strokeStyle = 'red';
  ctx.lineWidth = 1;
  ctx.fillRect(x - 1, 0, 3, height);

  ctx.beginPath();
  ctx.moveTo(x + 0.5, 0);
  ctx.lineTo(x + 0.5, height);
  ctx.stroke();
}
