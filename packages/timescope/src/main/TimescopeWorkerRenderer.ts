import { connectWorkerRenderer } from '#src/bridge/renderEngine';
import { TimescopeRenderer, type TimescopeRendererOptions } from '#src/main/TimescopeRenderer';
export class TimescopeWorkerRenderer extends TimescopeRenderer {
  readonly ready: Promise<void>;
  constructor(options: TimescopeRendererOptions) {
    super();
    let disposed = false;
    const ready = import('../renderer/worker.ts?worker&inline').then(({ default: TimescopeWorker }) => {
      if (disposed) throw new DOMException('Renderer disposed', 'AbortError');
      const worker = new TimescopeWorker();
      try {
        const canvas = (options.canvas as HTMLCanvasElement).transferControlToOffscreen();
        const connection = connectWorkerRenderer(worker, this.callbacks, canvas);
        if (disposed) {
          connection.dispose();
          worker.terminate();
          throw new DOMException('Renderer disposed', 'AbortError');
        }
        return { worker, connection };
      } catch (error) {
        worker.terminate();
        throw error;
      }
    });
    this.ready = ready.then(({ connection }) => connection.ready);
    void this.ready.catch(() => {});
    this.attach(
      {
        call: (command, payload) => ready.then(({ connection }) => connection.call(command, payload)) as never,
        notify: (command, payload) => ready.then(({ connection }) => connection.notify(command, payload)),
        dispose() {
          disposed = true;
          void ready.then(
            ({ worker, connection }) => {
              connection.dispose();
              worker.terminate();
            },
            () => {},
          );
        },
      },
      options.fonts,
    );
  }
}
