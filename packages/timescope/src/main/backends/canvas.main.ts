import { mountCanvas, resolveCanvasTarget, type TimescopeBackend } from '#src/main/backend';
import { defaultBrowserFont } from '#src/main/defaultFont.browser';
import { resolveBrowserFonts, watchDocumentFonts } from '#src/main/font';

export const canvasMainBackend: TimescopeBackend = {
  probe({ backend, target, renderThread, environment }) {
    if (backend && backend !== 'canvas') return `Backend ${backend} was requested`;
    if (renderThread === 'worker') return 'Worker rendering was requested';
    const resolved = resolveCanvasTarget(target);
    if (typeof resolved === 'string') return resolved;
    if (!environment?.Path2D && typeof globalThis.Path2D === 'undefined')
      return 'Canvas rendering requires a Path2D constructor on the current thread';
  },
  async mount(options, host) {
    const fonts = [defaultBrowserFont(), ...(await resolveBrowserFonts(options.fonts))];
    const { target, environment } = options;
    const mounted = mountCanvas(target, host);
    const stopWatchingFonts = options.fonts ? undefined : watchDocumentFonts(host.fontsChanged);
    return {
      ...mounted,
      environment,
      fonts,
      dispose() {
        stopWatchingFonts?.();
        mounted.dispose();
      },
    };
  },
};
