import { mountCanvas, type TimescopeBackendHost } from '#src/main/backend';
import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => vi.unstubAllGlobals());

class CanvasElement {
  width = 0;
  height = 0;
  style: Record<string, string> = {};
  layout = { x: 10, y: 20, width: 200, height: 36 };
  removed = false;
  listeners = new Map<string, Set<(event: any) => void>>();

  getContext() {
    return {};
  }

  getBoundingClientRect() {
    const scale = this.style.transform?.match(/^scale\(([^,]+), ([^)]+)\)$/);
    return {
      x: this.layout.x + Number.parseFloat(this.style.left || '0'),
      y: this.layout.y + Number.parseFloat(this.style.top || '0'),
      width:
        (this.style.width === '100%' ? this.layout.width : Number.parseFloat(this.style.width)) *
        Number(scale?.[1] ?? 1),
      height:
        (this.style.height === '100%' ? this.layout.height : Number.parseFloat(this.style.height)) *
        Number(scale?.[2] ?? 1),
    };
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

it('lets the Canvas backend own DOM layout, input, and cleanup', () => {
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
    fontsChanged: async () => {},
    sizeChanged,
    pointer,
    wheel,
    pointerStyle: async () => undefined,
    isDisabled: () => disabled,
  };

  canvas.layout.height = 90;
  const mounted = mountCanvas({ appendChild } as unknown as Element, host);
  expect(mounted.canvas).toBe(canvas);
  expect(mounted.autoSize).toBe(true);
  expect(appendChild).toHaveBeenCalledWith(canvas);
  resized();
  expect(sizeChanged).toHaveBeenCalledWith({ width: 200, height: 90, dpr: 2, x: 10, y: 20 });

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

  canvas.layout.height = 120;
  resized();
  expect(canvas.getBoundingClientRect().height).toBe(120);
  mounted.dispose();
  expect(disconnect).toHaveBeenCalledOnce();
  expect(canvas.removed).toBe(true);
  expect(canvas.listeners.get('wheel')?.size).toBe(0);
});

it('matches canvas bitmap size and position to device pixels as its container resizes', () => {
  const canvas = new CanvasElement();
  canvas.layout = { x: 485.1875, y: 20.3125, width: 686.8125, height: 320 };
  const container = { appendChild: vi.fn() } as unknown as Element;
  let resized!: () => void;
  const observe = vi.fn();
  vi.stubGlobal('HTMLCanvasElement', CanvasElement);
  vi.stubGlobal('document', { createElement: () => canvas });
  vi.stubGlobal('window', { devicePixelRatio: 2, innerHeight: 100, addEventListener: vi.fn() });
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: () => void) {
        resized = callback;
      }
      observe = observe;
      disconnect() {}
    },
  );

  const sizeChanged = vi.fn();
  const mounted = mountCanvas(container, {
    fontsChanged: async () => {},
    sizeChanged,
    pointer: () => {},
    wheel: () => {},
    pointerStyle: async () => undefined,
    isDisabled: () => false,
  });
  expect(observe).toHaveBeenCalledWith(container);
  resized();
  expect(sizeChanged).toHaveBeenLastCalledWith({ width: 687, height: 320, dpr: 2, x: 485, y: 20.5 });
  expect(canvas.getBoundingClientRect()).toMatchObject({ x: 485, y: 20.5, width: 687, height: 320 });

  canvas.layout.width = 900.4;
  resized();
  expect(sizeChanged).toHaveBeenLastCalledWith({ width: 900.5, height: 320, dpr: 2, x: 485, y: 20.5 });
  expect(canvas.getBoundingClientRect().width).toBe(900.5);
  resized();
  expect(sizeChanged).toHaveBeenLastCalledWith({ width: 900.5, height: 320, dpr: 2, x: 485, y: 20.5 });
  mounted.dispose();
});
