import { registerBackends } from '#src/main/backendRegistry';
import { skiaCanvasBackend } from '#src/main/backends/skia-canvas';

registerBackends([['skia-canvas', skiaCanvasBackend]]);

export * from './index.ts';
