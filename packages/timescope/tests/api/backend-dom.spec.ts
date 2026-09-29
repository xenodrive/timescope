import { mountCanvas, type TimescopeBackendHost } from '#src/main/backend';
import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => vi.unstubAllGlobals());

it('lets the Canvas backend own DOM layout, input, and cleanup', () => {
  class CanvasElement {
    width = 0;
    height = 0;
    style: Record<string, string> = {};
    removed = false;
    listeners = new Map<string, Set<(event: any) => void>>();

    getContext() {
      return {};
    }

    getBoundingClientRect() {
      return { x: 10, y: 20, width: 200, height: 60 };
    }

    addEventListener(type: string, listener: (event: any) => void) {
      const listeners = this.listeners.get(type) ?? new Set();
      listeners.add(listener);
      this.listeners.set(type, listeners);
    }

    removeEventListener(type: string, listener: (event: any) => void) {
      this.listeners.get(type)?.delete(listener);
    }

    dispatch(type: string, event: object) {
      for (const listener of this.listeners.get(type) ?? []) listener({ ...event, type });
    }

    remove() {
      this.removed = true;
    }
  }

  const canvas = new CanvasElement();
  const appendChild = vi.fn();
  const disconnect = vi.fn();
  let resized!: () => void;
  vi.stubGlobal('HTMLCanvasElement', CanvasElement);
  vi.stubGlobal('document', { createElement: () => canvas });
  vi.stubGlobal('window', { devicePixelRatio: 2, innerHeight: 100, addEventListener: vi.fn() });
  vi.stubGlobal('WheelEvent', { DOM_DELTA_LINE: 1, DOM_DELTA_PAGE: 2 });
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: () => void) {
        resized = callback;
      }
      observe() {}
      disconnect = disconnect;
    },
  );

  const sizeChanged = vi.fn();
  const pointer = vi.fn();
  const wheel = vi.fn();
  let disabled = false;
  const host: TimescopeBackendHost = {
    sizeChanged,
    pointer,
    wheel,
    pointerStyle: async () => undefined,
    isDisabled: () => disabled,
  };

  const mounted = mountCanvas({ appendChild } as unknown as Element, host, { height: '90px' });
  expect(mounted.canvas).toBe(canvas);
  expect(mounted.autoSize).toBe(true);
  expect(appendChild).toHaveBeenCalledWith(canvas);
  expect(canvas.style.height).toBe('90px');
  resized();
  expect(sizeChanged).toHaveBeenCalledWith({ width: 200, height: 60, dpr: 2, x: 10, y: 20 });

  canvas.dispatch('pointerdown', { pointerId: 1, buttons: 1, clientX: 15, clientY: 25, shiftKey: false });
  expect(pointer).toHaveBeenCalledWith(expect.objectContaining({ type: 'down' }));
  expect(pointer.mock.lastCall?.[0].latest.latest).toMatchObject({ x: 5, y: 5 });

  const preventDefault = vi.fn();
  canvas.dispatch('wheel', { deltaY: 2, deltaMode: 1, preventDefault });
  expect(wheel).toHaveBeenCalledWith(32);
  expect(preventDefault).toHaveBeenCalledOnce();

  disabled = true;
  mounted.setDisabled?.(true);
  canvas.dispatch('wheel', { deltaY: 2, deltaMode: 1, preventDefault });
  expect(wheel).toHaveBeenCalledOnce();

  mounted.setStyle?.({ height: '120px' });
  expect(canvas.style.height).toBe('120px');
  mounted.dispose();
  expect(disconnect).toHaveBeenCalledOnce();
  expect(canvas.removed).toBe(true);
  expect(canvas.listeners.get('wheel')?.size).toBe(0);
});
