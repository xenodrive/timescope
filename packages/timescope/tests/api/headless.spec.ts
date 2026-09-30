import { Timescope } from '#src/index.node';
import type { TimescopeBackendMount } from '#src/main/backend';
import { registerBackends, resolveBackends } from '#src/main/backendRegistry';
import { canvasMainBackend } from '#src/main/backends/canvas.main';
import { canvasWorkerBackend } from '#src/main/backends/canvas.worker';
import { skiaCanvasBackend } from '#src/main/backends/skia-canvas';
import { TimescopeRenderEngine } from '#src/renderer/TimescopeRenderEngine';
import { TimescopeViewport } from '#src/renderer/TimescopeViewport';
import { fileURLToPath } from 'node:url';
import { Canvas, FontLibrary, Path2D } from 'skia-canvas';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => registerBackends([['skia-canvas', skiaCanvasBackend]]));

describe('canvas targets', () => {
  it('registers only Skia in the Node entry point', () => {
    expect(resolveBackends()).toEqual([skiaCanvasBackend]);
    expect(() => resolveBackends('canvas')).toThrow('Unknown backend: canvas');
  });
  it('registers the bundled Skia font without reading input fonts or calling FontFace, including on remount', async () => {
    const use = vi.spyOn(FontLibrary, 'use');
    const fontFace = vi.fn(() => {
      throw new Error('FontFace must not be called');
    });
    vi.stubGlobal('FontFace', fontFace);
    const input = {
      family: 'ignored',
      get source(): string {
        throw new Error('Input fonts must not be read');
      },
    };
    const timescope = new Timescope({
      target: new Canvas(80, 40),
      backend: 'skia-canvas',
      fonts: ['invalid stylesheet', input],
    });
    try {
      await timescope.nextFrame();
      expect(use).toHaveBeenCalledWith('Timescope', [fileURLToPath(import.meta.resolve('timescope/Timescope.woff2'))]);
      expect(FontLibrary.has('Timescope')).toBe(true);
      timescope.unmount();
      timescope.mount(new Canvas(80, 40));
      await timescope.nextFrame();
      expect(fontFace).not.toHaveBeenCalled();
    } finally {
      timescope.dispose();
      use.mockRestore();
      vi.unstubAllGlobals();
    }
  });

  it('resolves canvas to Worker then main-thread candidates without silently downgrading explicit Worker requests', () => {
    const canvas = { width: 20, height: 10, getContext: () => ({}), transferControlToOffscreen: () => ({}) };
    const [worker, main] = [canvasWorkerBackend, canvasMainBackend];
    try {
      vi.stubGlobal('Worker', class {});
      vi.stubGlobal('Path2D', Path2D);
      expect(worker.probe({ backend: 'canvas', target: canvas })).toBeUndefined();
      expect(worker.probe({ backend: 'canvas', target: canvas, renderThread: 'main' })).toBeTypeOf('string');
      expect(main.probe({ backend: 'canvas', target: canvas, renderThread: 'main' })).toBeUndefined();

      vi.stubGlobal('Worker', undefined);
      expect(worker.probe({ backend: 'canvas', target: canvas, renderThread: 'worker' })).toContain('unavailable');
      expect(main.probe({ backend: 'canvas', target: canvas, renderThread: 'worker' })).toBeTypeOf('string');
      expect(main.probe({ backend: 'canvas', target: canvas })).toBeUndefined();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('rejects unsupported backend and thread combinations without mounting', async () => {
    const timescope = new Timescope({ backend: 'skia-canvas', renderThread: 'worker' });
    try {
      timescope.mount(new Canvas(20, 10));
      await expect(timescope.nextFrame()).rejects.toThrow('skia-canvas does not support Worker rendering');
      expect(timescope.target).toBeNull();
    } finally {
      timescope.dispose();
    }
  });

  it('tries predefined backends in order', async () => {
    registerBackends([
      ['canvas', canvasWorkerBackend],
      ['canvas', canvasMainBackend],
      ['skia-canvas', skiaCanvasBackend],
    ]);
    const canvas = new Canvas(20, 10);
    const timescope = new Timescope({ target: canvas, backend: ['canvas', 'skia-canvas'], fonts: [] });
    try {
      await timescope.redraw();
      expect(timescope.target).toBe(canvas);
    } finally {
      timescope.dispose();
    }
  });

  it('waits for a predefined backend probe without falling back after its mount fails', async () => {
    registerBackends([
      ['skia-canvas', skiaCanvasBackend],
      ['canvas', canvasWorkerBackend],
      ['canvas', canvasMainBackend],
    ]);
    let finishProbe!: (reason: string | undefined) => void;
    const probe = vi
      .spyOn(skiaCanvasBackend, 'probe')
      .mockImplementation(() => new Promise((resolve) => (finishProbe = resolve)));
    const mount = vi.spyOn(skiaCanvasBackend, 'mount').mockImplementation(() => {
      throw new Error('Selected mount failed');
    });
    const fallback = vi.spyOn(resolveBackends('canvas')[0], 'probe');
    const timescope = new Timescope({ target: new Canvas(20, 10), backend: ['skia-canvas', 'canvas'] });
    try {
      const pending = timescope.redraw();
      await Promise.resolve();
      expect(probe).toHaveBeenCalledOnce();
      finishProbe(undefined);
      await expect(pending).rejects.toThrow('Selected mount failed');
      expect(fallback).not.toHaveBeenCalled();
    } finally {
      timescope.dispose();
      probe.mockRestore();
      mount.mockRestore();
      fallback.mockRestore();
    }
  });

  it('disposes an asynchronous mount that finishes after unmount without creating a renderer', async () => {
    let finishMount!: (mounted: TimescopeBackendMount) => void;
    const mount = vi.spyOn(skiaCanvasBackend, 'mount').mockImplementation(
      () =>
        new Promise((resolve) => {
          finishMount = resolve;
        }),
    );
    const dispose = vi.fn();
    const canvas = new Canvas(20, 10);
    const getContext = vi.spyOn(canvas, 'getContext');
    const timescope = new Timescope({ target: canvas, backend: 'skia-canvas' });
    try {
      const pending = timescope.nextFrame();
      const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
      await vi.waitFor(() => expect(mount).toHaveBeenCalledOnce());
      timescope.unmount();
      await rejected;
      finishMount({ canvas, fonts: [], dispose });
      await vi.waitFor(() => expect(dispose).toHaveBeenCalledOnce());
      expect(getContext).not.toHaveBeenCalled();
      expect(timescope.target).toBeNull();
    } finally {
      timescope.dispose();
      mount.mockRestore();
      getContext.mockRestore();
    }
  });

  it('keeps a pending view fetch through initial backend sizing', async () => {
    const timescope = new Timescope({ target: new Canvas(80, 40), fonts: [] });
    try {
      await expect(timescope.prepareView().fetch()).resolves.toBeUndefined();
    } finally {
      timescope.dispose();
    }
  });

  it('announces mount after a positive size is ready, once per mount', async () => {
    const canvas = new Canvas(80, 40);
    const timescope = new Timescope({ target: canvas, fonts: [] });
    const mounted = vi.fn();
    const ready = vi.fn();
    timescope.on('mount', mounted);
    timescope.on('ready', ready);
    try {
      await timescope.nextFrame();
      expect(mounted).toHaveBeenCalledOnce();
      expect(ready).toHaveBeenCalledOnce();
      timescope.unmount();
      timescope.mount(canvas);
      await timescope.nextFrame();
      expect(mounted).toHaveBeenCalledTimes(2);
      expect(ready).toHaveBeenCalledOnce();
    } finally {
      timescope.dispose();
    }
  });

  it('restores playback time set before asynchronous mount and after remount', async () => {
    const canvas = new Canvas(80, 40);
    const handleSyncEvent = TimescopeViewport.prototype.handleSyncEvent;
    let viewport: TimescopeViewport | undefined;
    const sync = vi.spyOn(TimescopeViewport.prototype, 'handleSyncEvent').mockImplementation(function (
      this: TimescopeViewport,
      message,
    ) {
      handleSyncEvent.call(this, message);
      viewport = this;
    });
    const timescope = new Timescope({ target: canvas, time: 5.99, fonts: [] });
    try {
      timescope.setPlaybackTime(5.99);
      await timescope.nextFrame();
      expect(viewport?.configuredPlaybackTime?.eq(5.99)).toBe(true);

      timescope.unmount();
      timescope.mount(canvas);
      await timescope.nextFrame();
      expect(viewport?.configuredPlaybackTime?.eq(5.99)).toBe(true);

      timescope.setPlaybackTime(null);
      timescope.unmount();
      timescope.mount(canvas);
      await timescope.nextFrame();
      expect(viewport?.configuredPlaybackTime).toBeNull();
    } finally {
      timescope.dispose();
      sync.mockRestore();
    }
  });

  it('does not announce mount until a zero-sized target can be rendered', async () => {
    const canvas = new Canvas(0, 0);
    const timescope = new Timescope({ target: canvas, fonts: [] });
    const mounted = vi.fn();
    const ready = vi.fn();
    timescope.on('mount', mounted);
    timescope.on('ready', ready);
    try {
      const rendered = timescope.nextFrame();
      const completed = vi.fn();
      void rendered.then(completed);
      await Promise.resolve();
      expect(completed).not.toHaveBeenCalled();
      expect(mounted).not.toHaveBeenCalled();
      expect(ready).not.toHaveBeenCalled();
      expect(await timescope.resize(40, 20)).toBe(true);
      await rendered;
      await Promise.resolve();
      expect(mounted).toHaveBeenCalledOnce();
      expect(ready).toHaveBeenCalledOnce();
    } finally {
      timescope.dispose();
    }
  });

  it('ignores the result of a probe after unmounting', async () => {
    let finishProbe!: (reason: string | undefined) => void;
    const probe = vi
      .spyOn(skiaCanvasBackend, 'probe')
      .mockImplementation(() => new Promise((resolve) => (finishProbe = resolve)));
    const mount = vi.spyOn(skiaCanvasBackend, 'mount');
    const timescope = new Timescope({
      backend: 'skia-canvas',
    });
    try {
      timescope.mount();
      const pending = timescope.nextFrame();
      timescope.unmount();
      await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
      finishProbe(undefined);
      await Promise.resolve();
      expect(mount).not.toHaveBeenCalled();
    } finally {
      timescope.dispose();
      probe.mockRestore();
      mount.mockRestore();
    }
  });

  it('renders to a Node canvas without a DOM and leaves the canvas owned by the caller', async () => {
    const canvas = new Canvas(300, 80);
    const timescope = new Timescope({
      target: canvas,
      time: 5,
      zoom: 4,
      fonts: [],
      sources: {
        values: [
          { time: 0, value: 1 },
          { time: 5, value: 2 },
          { time: 10, value: 1 },
        ],
      },
      series: {
        values: {
          data: { source: 'values', domain: { animation: false } },
          chart: { marks: [{ draw: 'path', style: { path: 'M0 0 L1 1' } }] },
        },
      },
      tracks: { default: { timeAxis: false } },
    });
    try {
      await timescope.nextFrame();
      expect(timescope.target).toBe(canvas);
      await vi.waitFor(async () => {
        await timescope.redraw();
        const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
        expect(pixels.some((value, index) => index % 4 === 3 && value !== 0)).toBe(true);
      });
      expect((await canvas.toBuffer('png')).length).toBeGreaterThan(100);
      expect(await timescope.resize(150, 60)).toBe(true);
      await timescope.redraw();
      expect([canvas.width, canvas.height]).toEqual([150, 60]);
    } finally {
      timescope.dispose();
    }
    expect(timescope.target).toBeNull();
  });

  it('acknowledges redraw after drawing, not when the frame is scheduled', async () => {
    const frames: (() => void)[] = [];
    const canvas = new Canvas(20, 10);
    const engine = new TimescopeRenderEngine({
      call: async () => undefined as never,
      layers: [],
      requestAnimationFrame: (callback) => {
        frames.push(callback);
      },
      Path2D,
    });
    try {
      engine.commands.init({ canvas: canvas as unknown as HTMLCanvasElement });
      const completed = vi.fn();
      const pending = engine.commands.redraw().then(completed);
      expect(completed).not.toHaveBeenCalled();
      expect(frames.length).toBeGreaterThan(0);
      frames.shift()!();
      await pending;
      expect(completed).toHaveBeenCalledOnce();
      engine.commands['frame:latch']();
      await expect(engine.commands.redraw()).rejects.toMatchObject({ name: 'InvalidStateError' });
      engine.commands['frame:abort']();
    } finally {
      engine.dispose();
    }
  });
});
