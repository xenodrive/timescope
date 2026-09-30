import { canUseCanvasWorker, mountCanvas, resolveCanvasTarget, type TimescopeBackend } from '#src/main/backend';
import { defaultBrowserFont } from '#src/main/defaultFont.browser';
import { resolveBrowserFonts, watchDocumentFonts } from '#src/main/font';

export const canvasWorkerBackend: TimescopeBackend = {
  probe({ backend, target, renderThread, environment }) {
    if (backend && backend !== 'canvas') return `Backend ${backend} was requested`;
    if (renderThread === 'main') return 'Main-thread rendering was requested';
    const resolved = resolveCanvasTarget(target);
    if (typeof resolved === 'string') return resolved;
    if (!canUseCanvasWorker(resolved)) return 'Worker rendering is unavailable for this canvas';
    if (environment) return 'A main-thread environment cannot be used with Worker rendering';
  },
  async mount(options, host) {
    const fonts = [defaultBrowserFont(), ...(await resolveBrowserFonts(options.fonts))];
    const { target } = options;
    const mounted = mountCanvas(target, host, 'worker');
    const stopWatchingFonts = options.fonts ? undefined : watchDocumentFonts(host.fontsChanged);
    return {
      ...mounted,
      fonts,
      dispose() {
        stopWatchingFonts?.();
        mounted.dispose();
      },
    };
  },
};
