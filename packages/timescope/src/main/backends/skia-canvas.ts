import type { TimescopeBackend } from '#src/main/backend';
import type { TimescopeCanvas, TimescopeEnvironment } from '#src/main/TimescopeRenderer';
import { fileURLToPath } from 'node:url';

type SkiaCanvasModule = typeof import('skia-canvas');
let skiaCanvas: SkiaCanvasModule | undefined;

export const skiaCanvasBackend: TimescopeBackend = {
  async probe({ backend, target, renderThread }) {
    if (backend && backend !== 'skia-canvas') return `Backend ${backend} was requested`;
    if (renderThread === 'worker') return 'skia-canvas does not support Worker rendering';
    if (typeof process === 'undefined' || !process.versions?.node) return 'skia-canvas is only available in Node.js';
    if (!target || typeof target === 'string') return 'skia-canvas requires a skia-canvas Canvas target';
    if (typeof (target as TimescopeCanvas).getContext !== 'function') return 'skia-canvas requires a canvas target';

    try {
      const moduleName: string = 'skia-canvas';
      skiaCanvas ??= (await import(/* @vite-ignore */ moduleName)) as SkiaCanvasModule;
    } catch (error) {
      return `Unable to load skia-canvas: ${error instanceof Error ? error.message : String(error)}`;
    }
    if (!(target instanceof skiaCanvas.Canvas)) return 'skia-canvas requires a skia-canvas Canvas target';
  },
  mount({ target }) {
    if (!skiaCanvas || !target || !(target instanceof skiaCanvas.Canvas))
      throw new Error('skia-canvas was not prepared');
    skiaCanvas.FontLibrary.use('Timescope', [fileURLToPath(import.meta.resolve('timescope/Timescope.woff2'))]);
    const canvas = target as TimescopeCanvas;
    const environment: TimescopeEnvironment = { Path2D: skiaCanvas.Path2D as TimescopeEnvironment['Path2D'] };
    return {
      canvas,
      fonts: [],
      environment,
      dispose() {},
    };
  },
};
