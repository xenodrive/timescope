import type { TimescopeAnimationInput } from '#src/core/animation';
import { Decimal } from '#src/core/decimal';
import { TimescopeEvent, TimescopeObservable } from '#src/core/event';
import { mergeOptions } from '#src/core/options';
import type { TimescopeRange } from '#src/core/range';
import { parseTimeLike, type TimeLike } from '#src/core/time';
import { TimescopeState } from '#src/core/TimescopeState';
import { zoomFor, type ZoomLike } from '#src/core/zoom';
import type { TimescopeFont } from '#src/main/font';
import { InteractionManager } from '#src/main/InteractionManager';
import { mergeTimescopeOptions, validateTimescopeOptions } from '#src/main/optionRuntime';
import type {
  TimescopeOptions,
  TimescopeOptionsInitial,
  TimescopeSeriesInput,
  TimescopeSourceInput,
} from '#src/main/options';
import type { TimescopeUpdateOptions } from '#src/main/options';
import { TimescopeMainThreadRenderer } from '#src/main/TimescopeMainThreadRenderer';
import type { TimescopeRenderer } from '#src/main/TimescopeRenderer';
import { TimescopeWorkerRenderer } from '#src/main/TimescopeWorkerRenderer';

function copyOptions(options: TimescopeOptions): TimescopeOptions {
  return mergeOptions({}, options) as TimescopeOptions;
}

function normalizeWheel(e: WheelEvent) {
  const delta = e.deltaY;

  switch (e.deltaMode) {
    case WheelEvent.DOM_DELTA_LINE:
      return delta * 16;
    case WheelEvent.DOM_DELTA_PAGE:
      return delta * window.innerHeight;
  }

  return delta;
}

export type TimescopeSize = {
  /** Canvas x position in the viewport. */
  x: number;
  /** Canvas y position in the viewport. */
  y: number;
  /** Canvas width in CSS pixels. */
  width: number;
  /** Canvas height in CSS pixels. */
  height: number;
  /** Device pixel ratio used for rendering. */
  dpr: number;
};

export type TimescopeFitOptions = {
  animation?: boolean;
  padding?: number | [l: number, r: number];
};

export type TimescopeFrameLatch = {
  readonly signal: AbortSignal;
  commit(): Promise<void>;
  abort(reason?: unknown): void;
};

type ActiveFrameLatch = {
  controller: AbortController;
  state: 'open' | 'committing' | 'finished';
  superseded?: boolean;
  reject?: (reason: unknown) => void;
  time?: { value: Decimal | null; animation: TimescopeAnimationInput };
  zoom?: { value: Decimal; animation: TimescopeAnimationInput };
  playbackTime?: Decimal | null;
  promise?: Promise<void>;
};

function abortError() {
  return new DOMException('The frame latch was aborted', 'AbortError');
}

export class Timescope<
  Sources extends Record<string, TimescopeSourceInput> = Record<string, TimescopeSourceInput>,
  Series extends Record<string, TimescopeSeriesInput> = Record<string, TimescopeSeriesInput>,
  Track extends string = string,
> extends TimescopeObservable<
  | 'load'
  | 'mount'
  | 'unmount'
  | 'resize'
  | TimescopeEvent<'timechanging', Decimal | null>
  | TimescopeEvent<'timechanged', Decimal | null>
  | TimescopeEvent<'timeanimating', Decimal | null>
  | TimescopeEvent<'timeanimated', Decimal | null>
  | TimescopeEvent<'zoomchanging', number>
  | TimescopeEvent<'zoomchanged', number>
  | TimescopeEvent<'zoomanimating', number>
  | TimescopeEvent<'zoomanimated', number>
  | TimescopeEvent<'selectionrangechanging', TimescopeRange<Decimal> | null>
  | TimescopeEvent<'selectionrangechanged', TimescopeRange<Decimal> | null>
> {
  #element: HTMLCanvasElement | null = null;
  #renderer: TimescopeRenderer | null = null;
  #interactionManager: InteractionManager | null = null;
  #resizeObserver: ResizeObserver | null = null;

  #state: TimescopeState;
  #selectionRange: TimescopeRange<Decimal> | null = null;
  #selectionRangeChanging: TimescopeRange<Decimal> | null = null;

  #options: TimescopeOptions;
  #fonts: (string | TimescopeFont)[] | undefined;

  #wheelSensitivity;

  #loaded = false;
  #frameLatch: ActiveFrameLatch | null = null;
  #disposing = false;
  #initialFit: { range: TimescopeRange<TimeLike<never>>; padding?: TimescopeFitOptions['padding'] } | null = null;

  get time(): Decimal | null {
    return this.#state.time.committing?.clone() ?? null;
  }

  set time(v: TimeLike | null) {
    this.setTime(v);
  }

  setTime(v: TimeLike | null, animation?: TimescopeAnimationInput) {
    this.#initialFit = null;
    if (this.#frameLatch?.state === 'committing') this.#supersedeFrameLatch();
    else if (this.#frameLatch?.state === 'finished') this.#frameLatch.superseded = true;
    if (this.#frameLatch?.state === 'open') {
      const target = this.#state.resolveTimeTarget(v, animation);
      if (!target) return false;
      this.#frameLatch.time = target;
      return true;
    }
    return this.#state.setTime(v, animation);
  }

  get timeChanging() {
    return this.#state.time.candidate?.clone() ?? null;
  }

  get timeAnimating() {
    return this.#state.time.current?.clone() ?? null;
  }

  get timeRange(): TimescopeRange<Decimal | null | undefined> {
    return this.#state.time.domain.map((x) => (x == null ? x : x.clone())) as TimescopeRange<
      Decimal | null | undefined
    >;
  }

  setTimeRange(domain?: TimescopeRange<TimeLike | null | undefined>) {
    if (this.#frameLatch) this.#supersedeFrameLatch();
    this.#state.setTimeRange(domain);
  }

  setPlaybackTime(t: TimeLike<null>) {
    if (this.#frameLatch?.state === 'committing') this.#supersedeFrameLatch();
    else if (this.#frameLatch?.state === 'finished') this.#frameLatch.superseded = true;
    if (this.#frameLatch?.state === 'open') {
      this.#frameLatch.playbackTime = parseTimeLike(t);
      return;
    }
    this.#state.setPlaybackTime(t);
  }

  get zoom(): number {
    return this.#state.zoom.committing.number();
  }

  set zoom(v: ZoomLike) {
    this.setZoom(v);
  }

  setZoom(v: ZoomLike, animation?: TimescopeAnimationInput) {
    this.#initialFit = null;
    if (this.#frameLatch?.state === 'committing') this.#supersedeFrameLatch();
    else if (this.#frameLatch?.state === 'finished') this.#frameLatch.superseded = true;
    if (this.#frameLatch?.state === 'open') {
      const target = this.#state.resolveZoomTarget(v, animation);
      if (!target) return false;
      this.#frameLatch.zoom = target;
      return true;
    }
    return this.#state.setZoom(v, animation);
  }

  latchFrame(): TimescopeFrameLatch {
    if (this.#frameLatch) throw new DOMException('A frame latch is already active', 'InvalidStateError');
    if (!this.#renderer) throw new DOMException('Timescope is not mounted', 'InvalidStateError');

    const latch: ActiveFrameLatch = {
      controller: new AbortController(),
      state: 'open',
    };
    this.#frameLatch = latch;

    const commit = () => {
      if (latch.promise) return latch.promise;
      if (latch.state === 'finished') {
        latch.promise = Promise.reject(latch.controller.signal.reason ?? abortError());
        return latch.promise;
      }

      latch.state = 'committing';
      const transaction = Promise.resolve().then(async () => {
        latch.controller.signal.throwIfAborted();
        this.#renderer!.latchFrame();
        const prepared = await this.#renderer!.prepareFrame(
          {
            ...(latch.time ? { time: latch.time.value } : {}),
            ...(latch.zoom ? { zoom: latch.zoom.value } : {}),
            ...(latch.playbackTime !== undefined ? { playbackTime: latch.playbackTime } : {}),
          },
          latch.controller.signal,
        );
        if (!prepared.ok) throw latch.controller.signal.reason ?? new Error(prepared.message);
        if (latch.superseded) throw latch.controller.signal.reason ?? abortError();

        if (latch.playbackTime !== undefined) this.#state.setPlaybackTime(latch.playbackTime);
        if (latch.time) this.#state.setTime(latch.time.value, latch.time.animation);
        if (latch.zoom) this.#state.setZoom(latch.zoom.value, latch.zoom.animation);

        // State sync events use microtasks. Flush them before committing so the
        // worker applies the transaction state before presenting the frame.
        await Promise.resolve();
        const presented = await this.#renderer!.commitFrame();
        if (!presented.ok) throw latch.controller.signal.reason ?? new Error(presented.message);
        if (latch.superseded) throw latch.controller.signal.reason ?? abortError();
      });
      const forceAborted = new Promise<never>((_, reject) => {
        latch.reject = reject;
      });
      latch.promise = Promise.race([transaction, forceAborted])
        .catch((error) => {
          this.#abortFrameLatch(latch, error);
          throw error;
        })
        .finally(() => {
          latch.reject = undefined;
          latch.state = 'finished';
          if (this.#frameLatch === latch) this.#frameLatch = null;
        });
      return latch.promise;
    };

    return {
      signal: latch.controller.signal,
      commit,
      abort: (reason?: unknown) => this.#abortFrameLatch(latch, reason),
    };
  }

  #abortFrameLatch(latch = this.#frameLatch, reason: unknown = abortError(), force = false) {
    if (!latch) return;
    if (latch.state === 'finished') {
      if (force) latch.reject?.(reason);
      return;
    }
    latch.state = 'finished';
    latch.controller.abort(reason);
    this.#renderer?.abortFrame();
    latch.reject?.(reason);
    if (!latch.promise && this.#frameLatch === latch) this.#frameLatch = null;
  }

  #supersedeFrameLatch() {
    if (this.#frameLatch) this.#frameLatch.superseded = true;
    this.#abortFrameLatch();
  }

  get zoomChanging() {
    return this.#state.zoom.candidate.number();
  }

  get zoomAnimating() {
    return this.#state.zoom.current.number();
  }

  fitTo(range: TimescopeRange<TimeLike<never>>, opts?: TimescopeFitOptions) {
    if (!this.#size.width) return false;

    const [left, right] = typeof opts?.padding === 'number' ? [opts.padding, opts.padding] : (opts?.padding ?? [0, 0]);
    const padding = left + right;
    if (!Number.isFinite(padding) || padding < 0 || this.#size.width <= padding) return false;

    const rangeDecimal = range.map((t) => parseTimeLike(t));
    const resolution = rangeDecimal[1]
      .sub(rangeDecimal[0])
      .div(this.#size.width - padding, 18)
      .abs();

    const zoom = zoomFor(resolution);
    const time = rangeDecimal[0]
      .add(rangeDecimal[1])
      .divExact(2)
      .add(resolution.mul((right - left) / 2));

    let r = true;
    r &&= this.setZoom(zoom, opts?.animation !== false ? undefined : false);
    r &&= this.setTime(time, opts?.animation !== false ? undefined : false);

    return r;
  }

  get zoomRange(): TimescopeRange<number | undefined> {
    return this.#state.zoom.domain.map((x) => (x == null ? x : x.number())) as TimescopeRange<number | undefined>;
  }

  setZoomRange(domain?: TimescopeRange<ZoomLike | undefined>) {
    if (this.#frameLatch) this.#supersedeFrameLatch();
    this.#state.setZoomRange(domain);
  }

  setSelectionRange(domain: TimescopeRange<TimeLike<never>> | null) {
    if (this.#options.selection === false) return;

    const range = (domain?.map((t) => parseTimeLike(t)) ?? null) as TimescopeRange<Decimal> | null;

    if (
      range === this.#selectionRange ||
      (range && this.#selectionRange && range.every((v, i) => v.eq(this.#selectionRange![i])))
    ) {
      return;
    }

    this.#selectionRange = range;
    this.#selectionRangeChanging = range;
    this.#renderer?.setSelectionRange(range);
    if (!this.#renderer) {
      this.dispatchEvent(new TimescopeEvent('selectionrangechanging', range));
      this.dispatchEvent(new TimescopeEvent('selectionrangechanged', range));
    }
  }

  clearSelectionRange() {
    this.setSelectionRange(null);
  }

  get selectionRange() {
    return this.#selectionRange;
  }

  get selectionRangeChanging() {
    return this.#selectionRangeChanging;
  }

  get animating() {
    return this.#state.time.animating;
  }

  get editing() {
    return this.#state.time.editing;
  }

  #size: TimescopeSize = {
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    dpr: 0,
  };

  get size(): TimescopeSize {
    return { ...this.#size };
  }

  #disabled = false;
  set disabled(v: boolean) {
    this.#disabled = v;
    if (this.#interactionManager) this.#interactionManager.disabled = v;
  }

  get disabled() {
    return this.#disabled;
  }

  get options() {
    return this.#options;
  }

  setOptions(opts: TimescopeOptions<Sources, Series, Track>) {
    validateTimescopeOptions(opts);
    if (this.#frameLatch) this.#supersedeFrameLatch();
    this.#options = { style: undefined, ...opts } as TimescopeOptions;
    this.#applyOptions(this.#options, true);
  }

  updateOptions(opts: TimescopeUpdateOptions<Sources, Series, Track>) {
    const next = mergeTimescopeOptions(copyOptions(this.#options), opts as TimescopeUpdateOptions);
    validateTimescopeOptions(next);
    if (this.#frameLatch) this.#supersedeFrameLatch();
    this.#options = next;
    this.#applyOptions(opts as TimescopeOptions, false);
  }

  #applyOptions(opts: TimescopeOptions | TimescopeUpdateOptions<Sources, Series, Track>, set: boolean) {
    if ('selection' in opts && opts.selection === false) {
      this.#selectionRange = null;
      this.#selectionRangeChanging = null;
    }
    if (!this.#element || !this.#renderer) return;

    if ('style' in opts) {
      this.#element.style.width = opts.style?.width ?? '100%';
      this.#element.style.height = opts.style?.height ?? '36px';
      this.#element.style.background = opts.style?.background ?? '#fff';
    }

    if (set) {
      this.#renderer.setOptions(opts as TimescopeOptions);
    } else {
      this.#renderer.updateOptions(opts as TimescopeOptions);
    }

    this.#resize();
  }

  #resize() {
    if (!this.#element || !this.#renderer) return;

    const dpr = window.devicePixelRatio;
    const rect = this.#element.getBoundingClientRect();

    if (this.#size.width === rect.width && this.#size.height === rect.height && this.#size.dpr === dpr) return;
    if (this.#frameLatch) this.#supersedeFrameLatch();

    this.#size = {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      dpr,
    };

    const width = this.#size.width;
    const height = this.#size.height;

    this.#renderer.resize({ size: { width, height }, context: { dpr } });

    if (
      this.#initialFit &&
      width > 0 &&
      height > 0 &&
      this.fitTo(this.#initialFit.range, { padding: this.#initialFit.padding, animation: false })
    ) {
      this.#initialFit = null;
    }

    this.dispatchEvent('resize');

    if (!this.#loaded && width > 0 && height > 0) {
      this.dispatchEvent('load');
      this.#loaded = true;
    }
  }

  #installTimeZoomEventHandler() {
    const time = this.#state.time;
    const zoom = this.#state.zoom;
    this.#state.on('change', () => this.changed());
    this.#state.on('timechanging', (e) => this.dispatchEvent(e));
    this.#state.on('timechanged', (e) => this.dispatchEvent(e));
    this.#state.on('timeanimating', (e) => this.dispatchEvent(e));
    this.#state.on('timeanimated', (e) => this.dispatchEvent(e));
    this.#state.on('zoomchanging', (e) => this.dispatchEvent(e));
    this.#state.on('zoomchanged', (e) => this.dispatchEvent(e));
    this.#state.on('zoomanimating', (e) => this.dispatchEvent(e));
    this.#state.on('zoomanimated', (e) => this.dispatchEvent(e));

    time.on('sync', (e) => this.#renderer?.sync({ time: e.value }, e.origin));
    zoom.on('sync', (e) => this.#renderer?.sync({ zoom: e.value }, e.origin));
  }

  #onWheel(e: WheelEvent) {
    if (this.#disabled) return;
    e.preventDefault();
    this.#supersedeFrameLatch();

    const deltaY = normalizeWheel(e);
    this.#state.setZoom(this.#state.zoom.committing.add(-deltaY / this.#wheelSensitivity));
  }

  constructor(opts?: TimescopeOptionsInitial<Sources, Series, Track>) {
    super();

    const _opts = opts ?? {};
    if (_opts.fit !== undefined) {
      if ('time' in _opts || 'zoom' in _opts) throw new TypeError('fit cannot be combined with time or zoom');
      const fit = Array.isArray(_opts.fit) ? { range: _opts.fit } : _opts.fit;
      const [start, end] = fit.range.map((value) => parseTimeLike(value));
      if (!end.gt(start)) throw new RangeError('fit range must be increasing');
      const padding = fit.padding;
      if (
        padding !== undefined &&
        (typeof padding === 'number'
          ? !Number.isFinite(padding) || padding < 0
          : padding.length !== 2 || padding.some((value) => !Number.isFinite(value) || value < 0))
      ) {
        throw new RangeError('fit padding must be non-negative and finite');
      }
      this.#initialFit = { range: fit.range, padding };
      this.#state = new TimescopeState({ ..._opts, time: start.add(end).divExact(2) });
    } else {
      this.#state = new TimescopeState(_opts);
    }
    this.#installTimeZoomEventHandler();

    const {
      target: _target,
      fonts: _fonts,
      wheelSensitivity: _wheelSensitivity,
      time: _time,
      timeRange: _timeRange,
      zoom: _zoom,
      zoomRange: _zoomRange,
      fit: _fit,
      selection: initialSelection,
      ...options
    } = _opts;
    this.#options = {
      style: undefined,
      ...options,
      ...(initialSelection !== undefined && {
        selection:
          typeof initialSelection === 'object'
            ? (({ range: _range, ...settings }) => settings)(initialSelection)
            : initialSelection,
      }),
    } as TimescopeOptions;
    validateTimescopeOptions(this.#options);
    if (typeof initialSelection === 'object' && initialSelection.range != null) {
      this.#selectionRange = initialSelection.range.map(parseTimeLike) as TimescopeRange<Decimal>;
      this.#selectionRangeChanging = this.#selectionRange;
    }
    this.#fonts = _opts.fonts;

    this.#wheelSensitivity = _opts.wheelSensitivity ?? 200;

    queueMicrotask(() => {
      if (_opts.target && !this.#disposing) this.mount(_opts.target);
    });
  }

  reload(sources?: (keyof Sources & string)[]) {
    this.#renderer?.invalidateSources(sources);
  }

  redraw() {
    this.#renderer?.redraw();
  }

  mount(target: HTMLElement | string) {
    if (this.#disposing) throw new Error('Timescope is disposed');
    const el = typeof target === 'string' ? document.querySelector(target) : target;
    if (!el) throw new Error('mount failed');

    if (this.#element || this.#renderer || this.#interactionManager) {
      console.warn('Timescope: mounted twice');
    }

    this.#element?.remove();

    this.#element = document.createElement('canvas');
    this.#element.style.all = 'unset';
    this.#element.style.display = 'block';
    this.#element.style.touchAction = 'none';
    this.#element.style.width = this.#options.style?.width ?? '100%';
    this.#element.style.height = this.#options.style?.height ?? '36px';
    this.#element.style.background = this.#options.style?.background ?? '#fff';

    const Renderer = this.#options.renderThread === 'main' ? TimescopeMainThreadRenderer : TimescopeWorkerRenderer;
    this.#renderer = new Renderer({
      canvas: this.#element,
      fonts: this.#fonts,
    });

    this.#renderer.setOptions(this.#options as TimescopeOptions);
    if (this.#selectionRange) this.#renderer.setSelectionRange(this.#selectionRange);

    // sync the renderer
    this.#state.time.restore();
    this.#state.zoom.restore();

    this.#resizeObserver = new ResizeObserver(() => this.#resize());
    this.#resizeObserver.observe(this.#element);

    // change event chain
    this.#renderer.on('change', () => this.changed());

    // time state sync
    this.#renderer.on('sync', (e) => {
      if (this.#frameLatch?.state === 'finished') this.#frameLatch.superseded = true;
      if (e.value.time) {
        this.#state.time.handleSyncEvent(e.value.time);
        this.#state.time.dispatchEvent(new TimescopeEvent('sync', e.value.time, e.origin));
      }
      if (e.value.zoom) {
        this.#state.zoom.handleSyncEvent(e.value.zoom);
        this.#state.zoom.dispatchEvent(new TimescopeEvent('sync', e.value.zoom, e.origin));
      }
    });

    this.#renderer.on('renderer:event', (e) => {
      if (typeof e.value === 'object' && e.value && 'range' in e.value && 'resizing' in e.value) {
        this.#selectionRangeChanging = e.value.range as TimescopeRange<Decimal> | null;
        this.dispatchEvent(
          new TimescopeEvent('selectionrangechanging', e.value.range as TimescopeRange<Decimal> | null, e.origin),
        );
        if (!e.value.resizing) {
          this.#selectionRange = e.value.range as TimescopeRange<Decimal> | null;
          this.dispatchEvent(
            new TimescopeEvent('selectionrangechanged', e.value.range as TimescopeRange<Decimal> | null, e.origin),
          );
        }
      }
    });

    // pointer-events
    this.#interactionManager = new InteractionManager({
      element: this.#element,

      transform: (p) => p.sub([this.#size.x, this.#size.y]),

      handler: (info) => {
        if (info.type === 'down') this.#supersedeFrameLatch();
        this.#renderer?.onPointerEvent(info);
      },

      cursor: async (info) => {
        return (await this.#renderer?.pointerStyle(info)) ?? undefined;
      },
    });

    // wheel zoom
    this.#element.addEventListener('wheel', this.#onWheel.bind(this));

    el.appendChild(this.#element);

    this.dispatchEvent('mount');

    return this;
  }

  unmount() {
    if (this.#frameLatch) this.#frameLatch.superseded = true;
    this.#abortFrameLatch(this.#frameLatch, abortError(), true);
    const mounted = Boolean(this.#element);

    this.#element?.remove();
    this.#resizeObserver?.disconnect();
    this.#resizeObserver = null;
    this.#interactionManager?.detach();
    this.#renderer?.dispose();

    this.#renderer = null;
    this.#element = null;
    this.#interactionManager = null;
    this.#size = { x: 0, y: 0, width: 0, height: 0, dpr: 0 };

    if (mounted) this.dispatchEvent('unmount');
  }

  dispose() {
    if (this.#disposing) return;
    this.unmount();
    this.#disposing = true;
    queueMicrotask(() => {
      this.#state.dispose();
      super.dispose();
    });
  }
}
