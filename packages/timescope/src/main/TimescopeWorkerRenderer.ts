import { connectWorkerRenderer } from '#src/bridge/renderEngine';
import { TimescopeRenderer, type TimescopeRendererOptions } from '#src/main/TimescopeRenderer';
import TimescopeWorker from '../renderer/worker.ts?worker&inline';

export class TimescopeWorkerRenderer extends TimescopeRenderer {
  constructor(options: TimescopeRendererOptions) {
    super();
    const worker = new TimescopeWorker();
    try {
      const canvas = options.canvas.transferControlToOffscreen();
      const connection = connectWorkerRenderer(worker, this.callbacks, canvas);
      this.attach(
        {
          call: connection.call,
          notify: connection.notify,
          dispose() {
            connection.dispose();
            worker.terminate();
          },
        },
        options.fonts,
      );
    } catch (error) {
      worker.terminate();
      throw error;
    }
  }
}
