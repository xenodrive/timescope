import type { InteractionInfo, TimescopeOptionsForWorker } from '#src/bridge/protocol';
import config from '#src/core/config';
import { Decimal } from '#src/core/decimal';
import { TimescopeEvent } from '#src/core/event';
import type { TimescopeRange } from '#src/core/range';
import { TimescopeRenderer } from '#src/worker/renderer/TimescopeRenderer';
import { renderTimeRange, renderTimeRangeInverse } from '#src/worker/rendering';
import type { TimescopeRenderingContext } from '#src/worker/types';
import { clipToTrack } from '#src/worker/utils';

function nearby(p: number | undefined, x: number, tolerance: number = config.clickTolerance) {
  return p && p - tolerance <= x && x <= p + tolerance;
}

export class TimescopeSelectionRenderer extends TimescopeRenderer<TimescopeEvent<'renderer:event'>> {
  #range: TimescopeRange<Decimal | undefined> | null = null;
  #color: string = 'rgba(0, 0, 255, 0.2)';
  #invert: boolean = false;

  #resizing: boolean = false;
  #resizable: boolean = true;

  #counterpart: Decimal = Decimal(0n)!;

  #selectionTolerance = 8;

  constructor() {
    super();

    this.on('change', () => {
      this.dispatchEvent(new TimescopeEvent('renderer:event', { range: this.#range, resizing: this.#resizing }));
    });
  }

  updateOptions(options: TimescopeOptionsForWorker) {
    const opts = options.selection;
    if (opts === undefined) return;

    if (opts === false) {
      this.#resizable = false;
      this.#range = null;
    } else if (opts === true) {
      this.#resizable = true;
    } else {
      if (opts.resizable !== undefined) this.#resizable = opts.resizable;
      if (opts.color !== undefined) this.#color = opts.color;
      if (opts.invert !== undefined) this.#invert = opts.invert;
      if (opts.range !== undefined) this.#range = opts.range;
    }
    this.changed();
  }

  #selectionDragStart({ shiftKey, buttons }: InteractionInfo, timescope: TimescopeRenderingContext) {
    if (!this.#resizable) return false;

    const p = buttons[0].latest.x;

    if (shiftKey) {
      const t = timescope.timeAxis.t(p);
      this.#resizing = true;
      this.#counterpart = t;
      this.#range = [t, t];
      this.changed();
      return true;
    }

    if (!this.#range) return false;

    const selectionP = timescope.timeAxis.p(this.#range);

    if (nearby(selectionP[0], p, this.#selectionTolerance)) {
      const counterpart = this.#range[1];
      if (counterpart === undefined) return false;
      this.#resizing = true;
      this.#counterpart = counterpart;
      return true;
    } else if (nearby(selectionP[1], p, this.#selectionTolerance)) {
      const counterpart = this.#range[0];
      if (counterpart === undefined) return false;
      this.#resizing = true;
      this.#counterpart = counterpart;
      return true;
    }
    return false;
  }

  #selectionDragUpdate({ buttons }: InteractionInfo, timescope: TimescopeRenderingContext) {
    if (!this.#resizable) return false;
    if (!this.#resizing) return false;

    const a = timescope.timeAxis.t(buttons[0].latest.x);
    const b = this.#counterpart;
    const range = a.lt(b) ? [a, b] : [b, a];
    this.#range = range as TimescopeRange<Decimal | undefined>;
    this.changed();

    return true;
  }

  #selectionDragEnd(_: InteractionInfo, timescope: TimescopeRenderingContext) {
    if (!this.#resizable) return false;
    if (!this.#resizing || !this.#range) return false;
    this.#resizing = false;

    const a = timescope.timeAxis.p(this.#range[0]);
    const b = timescope.timeAxis.p(this.#range[1]);
    if (Math.abs(a - b) < this.#selectionTolerance) {
      this.#range = null;
    }
    this.changed();
    return true;
  }

  onPointerEvent(info: InteractionInfo, timescope: TimescopeRenderingContext) {
    if (!this.#resizable) return;

    switch (info.type) {
      case 'down':
        return this.#selectionDragStart(info, timescope);

      case 'drag:update':
        return this.#selectionDragUpdate(info, timescope);

      case 'up':
        return this.#selectionDragEnd(info, timescope);
    }
  }

  pointerStyle(info: InteractionInfo, timescope: TimescopeRenderingContext) {
    if (!this.#range || !this.#resizable) return;

    const rangeX = timescope.timeAxis.p(this.#range);
    if (this.#resizing && nearby(rangeX[0], rangeX[1], this.#selectionTolerance)) {
      return 'not-allowed';
    }
    if (nearby(rangeX[0], info.buttons[0].latest.x, this.#selectionTolerance)) {
      return 'w-resize';
    }
    if (nearby(rangeX[1], info.buttons[0].latest.x, this.#selectionTolerance)) {
      return 'e-resize';
    }
  }

  render(timescope: TimescopeRenderingContext): void {
    clipToTrack(timescope, null, () => {
      if (this.#invert) {
        renderTimeRangeInverse(timescope, this.#range, this.#color);
      } else {
        renderTimeRange(timescope, this.#range, this.#color);
      }
    });
  }
}
