import { mountCanvas, resolveCanvasTarget, type TimescopeBackend } from '#src/main/backend';

export const canvasMainBackend: TimescopeBackend = {
  probe({ backend, target, renderThread, environment }) {
    if (backend && backend !== 'canvas') return `Backend ${backend} was requested`;
    if (renderThread === 'worker') return 'Worker rendering was requested';
    const resolved = resolveCanvasTarget(target);
    if (typeof resolved === 'string') return resolved;
    if (!environment?.Path2D && typeof globalThis.Path2D === 'undefined')
      return 'Canvas rendering requires a Path2D constructor on the current thread';
  },
  mount({ target, style, environment }, host) {
    return { ...mountCanvas(target, host, style), environment };
  },
};
