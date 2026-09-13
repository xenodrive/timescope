import type { InteractionInfoWire } from '#src/bridge/protocol';
import { TimescopeEvent, TimescopeObservable } from '#src/core/event';
import type { Interaction, TimescopeRenderEngineOptions, TimescopeRenderingContext } from '#src/renderer/types';

export class TimescopeLayer<E extends TimescopeEvent<string, unknown> | string = any>
  extends TimescopeObservable<E>
  implements Interaction
{
  constructor() {
    super();
  }

  updateOptions(_options: TimescopeRenderEngineOptions) {
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

  onPointerEvent(_info: InteractionInfoWire, _timescope: TimescopeRenderingContext): boolean | void {
    /* noop */
  }
  pointerStyle(_info: InteractionInfoWire, _timescope: TimescopeRenderingContext): string | void {
    /* noop */
  }

  dispose(): void {
    /* noop */
  }
}
