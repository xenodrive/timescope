import { registerBackends } from '#src/main/backendRegistry';
import { canvasMainBackend } from '#src/main/backends/canvas.main';
import { canvasWorkerBackend } from '#src/main/backends/canvas.worker';
import { Decimal, Timescope } from './index.ts';

registerBackends([
  ['canvas', canvasWorkerBackend],
  ['canvas', canvasMainBackend],
]);

if (typeof window !== 'undefined') {
  const globalScope = window as unknown as Record<string, unknown>;
  globalScope.Decimal = Decimal;
  globalScope.Timescope = Timescope;
}

export * from './index.ts';
