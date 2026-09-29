import { defineLocalCalls } from '#src/bridge/rpc';
import {
  TimescopeRenderer,
  type TimescopeEnvironment,
  type TimescopeRendererOptions,
} from '#src/main/TimescopeRenderer';
import { TimescopeRenderEngine } from '#src/renderer/TimescopeRenderEngine';

export class TimescopeMainThreadRenderer extends TimescopeRenderer {
  readonly ready: Promise<void>;
  protected override get documentFontsAreLocal(): boolean {
    return true;
  }

  constructor(options: TimescopeRendererOptions) {
    super();
    const lifetime = new AbortController();
    let currentEngine: TimescopeRenderEngine | undefined;
    const createEngine = (environment: TimescopeEnvironment) => {
      if (lifetime.signal.aborted) throw lifetime.signal.reason;
      const engine = new TimescopeRenderEngine({
        call: defineLocalCalls(this.callbacks, lifetime.signal),
        fonts: environment.fonts ?? (typeof document === 'undefined' ? undefined : document.fonts),
        ...environment,
      });
      engine.commands.init({ canvas: options.canvas as HTMLCanvasElement });
      currentEngine = engine;
      return engine;
    };
    const ready =
      options.environment instanceof Promise
        ? options.environment.then(createEngine)
        : Promise.resolve(createEngine(options.environment ?? {}));
    void ready.catch(() => {});
    this.ready = ready.then(() => {});
    void this.ready.catch(() => {});
    this.attach(
      {
        call: (command, payload) =>
          command === 'init'
            ? Promise.reject(new Error('Render engine already initialized'))
            : (ready.then((engine) => defineLocalCalls(engine.commands, lifetime.signal)(command, payload)) as never),
        notify: (command, payload) =>
          ready.then((engine) => defineLocalCalls(engine.commands, lifetime.signal)(command, payload)).then(() => {}),
        dispose() {
          lifetime.abort(new DOMException('Renderer disposed', 'AbortError'));
          currentEngine?.dispose();
        },
      },
      options.fonts,
    );
  }
}
