import { canUseCanvasWorker, mountCanvas, resolveCanvasTarget, type TimescopeBackend } from '#src/main/backend';

export const canvasWorkerBackend: TimescopeBackend = {
  probe({ backend, target, renderThread, environment }) {
    if (backend && backend !== 'canvas') return `Backend ${backend} was requested`;
    if (renderThread === 'main') return 'Main-thread rendering was requested';
    const resolved = resolveCanvasTarget(target);
    if (typeof resolved === 'string') return resolved;
    if (!canUseCanvasWorker(resolved)) return 'Worker rendering is unavailable for this canvas';
    if (environment) return 'A main-thread environment cannot be used with Worker rendering';
  },
  mount({ target, style }, host) {
    return mountCanvas(target, host, style, 'worker');
  },
};
