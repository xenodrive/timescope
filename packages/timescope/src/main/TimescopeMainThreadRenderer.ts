import { defineLocalCalls } from '#src/bridge/rpc';
import { TimescopeRenderer, type TimescopeRendererOptions } from '#src/main/TimescopeRenderer';
import { TimescopeRenderEngine } from '#src/renderer/TimescopeRenderEngine';

export class TimescopeMainThreadRenderer extends TimescopeRenderer {
  protected override get documentFontsAreLocal(): boolean {
    return true;
  }

  constructor(options: TimescopeRendererOptions) {
    super();
    const lifetime = new AbortController();
    const engine = new TimescopeRenderEngine({
      call: defineLocalCalls(this.callbacks, lifetime.signal),
      fonts: document.fonts,
    });
    engine.commands.init({ canvas: options.canvas });
    const call = defineLocalCalls(engine.commands, lifetime.signal);
    this.attach(
      {
        call: (command, payload) =>
          command === 'init' ? Promise.reject(new Error('Render engine already initialized')) : call(command, payload),
        dispose() {
          lifetime.abort(new DOMException('Renderer disposed', 'AbortError'));
          engine.dispose();
        },
      },
      options.fonts,
    );
  }
}
