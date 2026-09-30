import { defaultOptions } from '#src/core/defaults';
import type { TimescopeFont } from '#src/main/font';
import type { InteractionInfo } from '#src/main/interaction';
import { InteractionManager } from '#src/main/InteractionManager';
import type { TimescopeOptions } from '#src/main/options';
import type { TimescopeCanvas, TimescopeEnvironment } from '#src/main/TimescopeRenderer';

export type TimescopeBackendTarget = Element | string | TimescopeCanvas;
export type TimescopeRenderThread = 'main' | 'worker';

export type TimescopeBackendMount = {
  canvas: TimescopeCanvas;
  /** Resolved fonts to load with FontFace in the rendering thread. Use [] for other font APIs. */
  fonts: TimescopeFont[];
  environment?: TimescopeEnvironment;
  renderThread?: TimescopeRenderThread;
  autoSize?: boolean;
  setStyle?(style: TimescopeOptions['style']): void;
  setDisabled?(disabled: boolean): void;
  dispose(): void;
};

export type TimescopeBackendHost = {
  fontsChanged(fonts: TimescopeFont[]): Promise<void>;
  sizeChanged(size: { width: number; height: number; dpr: number; x?: number; y?: number }): void;
  pointer(info: InteractionInfo): void;
  wheel(deltaY: number): void;
  pointerStyle(info: InteractionInfo): Promise<string | void>;
  isDisabled(): boolean;
};

export type TimescopeBackendOptions = {
  fonts?: (string | TimescopeFont)[];
  backend?: string;
  target?: TimescopeBackendTarget;
  renderThread?: TimescopeRenderThread;
  environment?: TimescopeEnvironment;
  style?: TimescopeOptions['style'];
};

export type TimescopeBackend = {
  probe(options: TimescopeBackendOptions): string | undefined | Promise<string | undefined>;
  mount(
    options: TimescopeBackendOptions,
    host: TimescopeBackendHost,
  ): TimescopeBackendMount | Promise<TimescopeBackendMount>;
};

export type TimescopeBackendChoice = 'canvas' | 'skia-canvas';

type CanvasTarget = { container: Element | TimescopeCanvas; direct: boolean };

export function resolveCanvasTarget(target?: TimescopeBackendTarget): CanvasTarget | string {
  if (!target) return 'Canvas rendering requires a target';
  if (typeof target === 'string' && typeof document === 'undefined')
    return 'A DOM is required to resolve a target selector';
  const container = typeof target === 'string' ? document.querySelector(target) : target;
  if (!container) return 'mount failed';
  const direct = typeof (container as TimescopeCanvas).getContext === 'function';
  if (!direct && typeof document === 'undefined') return 'A DOM is required to create a canvas';
  return { container, direct };
}

export function canUseCanvasWorker({ container, direct }: CanvasTarget): boolean {
  if (typeof Worker === 'undefined') return false;
  if (direct) return typeof (container as HTMLCanvasElement).transferControlToOffscreen === 'function';
  return (
    typeof HTMLCanvasElement !== 'undefined' &&
    typeof HTMLCanvasElement.prototype.transferControlToOffscreen === 'function'
  );
}

export function mountCanvas(
  target: TimescopeBackendTarget | undefined,
  host: TimescopeBackendHost,
  style?: TimescopeOptions['style'],
  renderThread?: TimescopeRenderThread,
): TimescopeBackendMount {
  const resolved = resolveCanvasTarget(target);
  if (typeof resolved === 'string') throw new Error(resolved);
  const { container, direct } = resolved;
  const canvas = direct ? (container as TimescopeCanvas) : document.createElement('canvas');
  const element = typeof HTMLCanvasElement !== 'undefined' && canvas instanceof HTMLCanvasElement ? canvas : null;
  let observer: ResizeObserver | undefined;
  let interaction: InteractionManager | undefined;
  let onWheel: ((event: WheelEvent) => void) | undefined;
  let canvasStyle = style;
  let updateSize: (() => void) | undefined;
  const dispose = () => {
    observer?.disconnect();
    interaction?.detach();
    if (element && onWheel) element.removeEventListener('wheel', onWheel);
    if (!direct) element?.remove();
  };

  try {
    if (!direct && element) {
      element.style.all = 'unset';
      element.style.display = 'block';
      element.style.touchAction = 'none';
      element.style.width = canvasStyle?.width ?? defaultOptions.style.width;
      element.style.height = canvasStyle?.height ?? defaultOptions.style.height;
      element.style.background = canvasStyle?.background ?? defaultOptions.style.background;
      if ('appendChild' in container) container.appendChild(element);
      updateSize = () => {
        element.style.width = canvasStyle?.width ?? defaultOptions.style.width;
        element.style.height = canvasStyle?.height ?? defaultOptions.style.height;
        element.style.position = 'relative';
        element.style.left = '0px';
        element.style.top = '0px';
        const rect = element.getBoundingClientRect();
        const dpr = window.devicePixelRatio;
        const width = Math.round(rect.width * dpr) / dpr;
        const height = Math.round(rect.height * dpr) / dpr;
        const left = (Math.round(rect.x * dpr) - rect.x * dpr) / dpr;
        const top = (Math.round(rect.y * dpr) - rect.y * dpr) / dpr;
        element.style.width = `${width}px`;
        element.style.height = `${height}px`;
        element.style.left = `${left}px`;
        element.style.top = `${top}px`;
        host.sizeChanged({
          width,
          height,
          dpr,
          x: rect.x + left,
          y: rect.y + top,
        });
      };
      observer = new ResizeObserver(updateSize);
      observer.observe(container as Element);
    }

    if (element && typeof window !== 'undefined') {
      interaction = new InteractionManager({
        element,
        transform: (point) => {
          const rect = element.getBoundingClientRect();
          return point.sub([rect.x, rect.y]);
        },
        handler: host.pointer,
        cursor: host.pointerStyle,
      });
      interaction.disabled = host.isDisabled();
      onWheel = (event) => {
        if (host.isDisabled()) return;
        event.preventDefault();
        const delta = event.deltaY;
        const amount =
          event.deltaMode === WheelEvent.DOM_DELTA_LINE
            ? delta * 16
            : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
              ? delta * window.innerHeight
              : delta;
        host.wheel(amount);
      };
      element.addEventListener('wheel', onWheel, { passive: false });
    }
  } catch (error) {
    dispose();
    throw error;
  }

  return {
    canvas,
    fonts: [],
    renderThread,
    autoSize: !direct,
    setStyle:
      !direct && element
        ? (value) => {
            canvasStyle = value;
            element.style.background = value?.background ?? defaultOptions.style.background;
            updateSize?.();
          }
        : undefined,
    setDisabled: (disabled) => {
      if (interaction) interaction.disabled = disabled;
    },
    dispose,
  };
}
