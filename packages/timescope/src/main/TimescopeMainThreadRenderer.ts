import { copyRenderPayload } from '#src/bridge/renderEngine';
import { TimescopeRenderer, type TimescopeRendererOptions } from '#src/main/TimescopeRenderer';
import { TimescopeRenderEngine } from '#src/renderer/TimescopeRenderEngine';
import type { RenderCall, RenderEngineCommands, RendererCommands } from '#src/renderer/types';

export class TimescopeMainThreadRenderer extends TimescopeRenderer {
  protected override get documentFontsAreLocal(): boolean {
    return true;
  }

  constructor(options: TimescopeRendererOptions) {
    super();
    const lifetime = new AbortController();
    const callbacks = this.callbacks;
    const callRenderer: RenderCall<RendererCommands> = async (command, payload) => {
      const snapshot = copyRenderPayload(payload);
      await Promise.resolve();
      lifetime.signal.throwIfAborted();
      const result = await callbacks[command](snapshot as never);
      lifetime.signal.throwIfAborted();
      return copyRenderPayload(result) as never;
    };
    const engine = new TimescopeRenderEngine({
      call: callRenderer,
      fonts: document.fonts,
    });
    engine.commands.init({ canvas: options.canvas });
    const call: RenderCall<RenderEngineCommands> = (command, payload) => {
      // Capture before queuing: a caller may mutate an options object immediately after this call.
      const snapshot = command === 'init' ? payload : copyRenderPayload(payload);
      return Promise.resolve().then(async () => {
        lifetime.signal.throwIfAborted();
        return (await engine.commands[command](snapshot as never)) as never;
      });
    };
    this.attach(
      {
        call,
        dispose() {
          lifetime.abort(new DOMException('Renderer disposed', 'AbortError'));
          engine.dispose();
        },
      },
      options.fonts,
    );
  }
}
