import { registerBackends } from '#src/main/backendRegistry';
import { canvasMainBackend } from '#src/main/backends/canvas.main';
import { canvasWorkerBackend } from '#src/main/backends/canvas.worker';

registerBackends([
  ['canvas', canvasWorkerBackend],
  ['canvas', canvasMainBackend],
]);

export * from './index.ts';
