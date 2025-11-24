import type { InteractionInfo, TimescopeOptionsForWorker } from '#src/bridge/protocol';
import { TimescopeEvent, TimescopeObservable } from '#src/core/event';
import type { Interaction, TimescopeRenderingContext } from '#src/worker/types';

export class TimescopeRenderer<E extends TimescopeEvent<string, unknown> | string = any>
  extends TimescopeObservable<E>
  implements Interaction
{
  constructor() {
    super();
  }

  updateOptions(_options: TimescopeOptionsForWorker) {
    /* noop */
  }

  render(_timescope: TimescopeRenderingContext): void {
    /* noop */
  }
  preRender(_timescope: TimescopeRenderingContext): void {
    /* noop */
  }
  postRender(_timescope: TimescopeRenderingContext): void {
    /* noop */
  }

  onPointerEvent(_info: InteractionInfo, _timescope: TimescopeRenderingContext): boolean | void {
    /* noop */
  }
  pointerStyle(_info: InteractionInfo, _timescope: TimescopeRenderingContext): string | void {
    /* noop */
  }
}
