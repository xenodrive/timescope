import type { TimescopeAnimationInput } from '#src/core/animation';
import { Decimal } from '#src/core/decimal';
import { TimescopeEvent, TimescopeObservable } from '#src/core/event';
import { mergeOptions } from '#src/core/options';
import type { TimescopeRange } from '#src/core/range';
import { parseTimeLike, type TimeLike } from '#src/core/time';
import { TimescopeState } from '#src/core/TimescopeState';
import { zoomFor, type ZoomLike } from '#src/core/zoom';
import type {
  TimescopeBackendChoice,
  TimescopeBackendMount,
  TimescopeBackendTarget,
  TimescopeRenderThread,
} from '#src/main/backend';
import { resolveBackends } from '#src/main/backendRegistry';
import type { TimescopeFont } from '#src/main/font';
import { mergeTimescopeOptions, validateTimescopeOptions } from '#src/main/optionRuntime';
import type {
  TimescopeOptions,
  TimescopeOptionsInitial,
  TimescopeSeriesInput,
  TimescopeSourceInput,
} from '#src/main/options';
import type { TimescopeUpdateOptions } from '#src/main/options';
import { TimescopeMainThreadRenderer } from '#src/main/TimescopeMainThreadRenderer';
import type { TimescopeCanvas, TimescopeEnvironment, TimescopeRenderer } from '#src/main/TimescopeRenderer';
import { TimescopeWorkerRenderer } from '#src/main/TimescopeWorkerRenderer';

function copyOptions(options: TimescopeOptions): TimescopeOptions {
  return mergeOptions({}, options) as TimescopeOptions;
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

export type TimescopePreparedView = {
  readonly signal: AbortSignal;
  setTime(value: TimeLike | null, animation?: TimescopeAnimationInput): boolean;
  setZoom(value: ZoomLike, animation?: TimescopeAnimationInput): boolean;
  setPlaybackTime(value: TimeLike<null>): void;
  fetch(): Promise<void>;
  abort(reason?: unknown): void;
};

type ActivePreparedView = {
  controller: AbortController;
  state: 'draft' | 'fetching' | 'finished';
  locked?: boolean;
  reject?: (reason: unknown) => void;
  promise?: Promise<void>;
};

function abortError() {
  return new DOMException('The prepared view was aborted', 'AbortError');
}

export class Timescope<
  Sources extends Record<string, TimescopeSourceInput> = Record<string, TimescopeSourceInput>,
  Series extends Record<string, TimescopeSeriesInput> = Record<string, TimescopeSeriesInput>,
  Track extends string = string,
> extends TimescopeObservable<
  | 'ready'
  | 'mount'
  | 'unmount'
  | 'resize'
  | TimescopeEvent<'error', Error>
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
  #canvas: TimescopeCanvas | null = null;
  #renderer: TimescopeRenderer | null = null;
  #backendMount: TimescopeBackendMount | null = null;
  #backendInitialized = false;
  #mountController: AbortController | null = null;
  #mountGeneration = 0;
  #backendReady: Promise<void> = Promise.resolve();
  #mountReady: Promise<void> = Promise.resolve();
  #resolveMount: (() => void) | null = null;
  #rejectMount: ((reason: unknown) => void) | null = null;
  #pendingAutoMount = false;
  #resizeAcknowledged: Promise<void> | null = null;
  #mounted = false;
  #readyEmitted = false;
  #pendingSize: { width: number; height: number; dpr: number; x?: number; y?: number } | null = null;

  #state: TimescopeState;
  #selectionRange: TimescopeRange<Decimal> | null = null;
  #selectionRangeChanging: TimescopeRange<Decimal> | null = null;

  #options: TimescopeOptions;
  #fonts: (string | TimescopeFont)[] | undefined;
  #environment: TimescopeEnvironment | undefined;
  #backends: ReturnType<typeof resolveBackends>;
  #backendChoice: TimescopeBackendChoice | readonly TimescopeBackendChoice[] | undefined;
  #renderThread: TimescopeRenderThread | undefined;

  #wheelSensitivity;

  #fetchingView: ActivePreparedView | null = null;
  #disposing = false;
  #initialFit: {
    range: TimescopeRange<TimeLike<never>>;
    padding?: TimescopeFitOptions['padding'];
    animation?: boolean;
  } | null = null;

  get time(): Decimal | null {
    return this.#state.time.committing?.clone() ?? null;
  }

  set time(v: TimeLike | null) {
    this.setTime(v);
  }

  setTime(v: TimeLike | null, animation?: TimescopeAnimationInput) {
    this.#initialFit = null;
    this.#abortFetchingView();
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
    this.#abortFetchingView();
    this.#state.setTimeRange(domain);
  }

  setPlaybackTime(t: TimeLike<null>) {
    this.#abortFetchingView();
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
    this.#abortFetchingView();
    return this.#state.setZoom(v, animation);
  }

  prepareView(): TimescopePreparedView {
    const view: ActivePreparedView = {
      controller: new AbortController(),
      state: 'draft',
    };
    let time: { value: Decimal | null; animation: TimescopeAnimationInput } | undefined;
    let zoomInput: { value: Decimal; animation?: TimescopeAnimationInput } | undefined;
    let playbackTime: Decimal | null | undefined;
    const assertDraft = () => {
      if (view.state !== 'draft') throw new DOMException('The view is no longer editable', 'InvalidStateError');
    };

    const fetch = () => {
      if (view.promise) return view.promise;
      if (view.state === 'finished') return Promise.reject(view.controller.signal.reason ?? abortError());
      if (!this.#renderer && !this.#mountController && !this.#pendingAutoMount)
        return Promise.reject(new DOMException('Timescope is not mounted', 'InvalidStateError'));
      if (this.#fetchingView) {
        return Promise.reject(new DOMException('Another view is being fetched', 'InvalidStateError'));
      }
      view.state = 'fetching';
      this.#fetchingView = view;
      const transaction = Promise.resolve().then(async () => {
        await this.#backendReady;
        view.controller.signal.throwIfAborted();
        const generation = this.#mountGeneration;
        await this.#mountReady;
        view.controller.signal.throwIfAborted();
        if (!this.#renderer || generation !== this.#mountGeneration)
          throw new DOMException('Timescope is not mounted', 'InvalidStateError');
        const zoom = zoomInput && this.#state.resolveZoomTarget(zoomInput.value, zoomInput.animation);
        view.locked = true;
        this.#renderer!.latchFrame();
        const prepared = await this.#renderer!.prepareFrame(
          {
            ...(time ? { time: time.value } : {}),
            ...(zoom ? { zoom: zoom.value } : {}),
            ...(playbackTime !== undefined ? { playbackTime } : {}),
          },
          view.controller.signal,
        );
        if (!prepared.ok) throw view.controller.signal.reason ?? new Error(prepared.message);
        view.controller.signal.throwIfAborted();

        if (playbackTime !== undefined) this.#state.setPlaybackTime(playbackTime);
        if (time) this.#state.setTime(time.value, time.animation);
        if (zoom) this.#state.setZoom(zoom.value, zoom.animation);

        // State sync events use microtasks. Flush them before committing so the
        // worker applies the transaction state before presenting the frame.
        await Promise.resolve();
        const presented = await this.#renderer!.commitFrame();
        if (!presented.ok) throw view.controller.signal.reason ?? new Error(presented.message);
        view.controller.signal.throwIfAborted();
      });
      const forceAborted = new Promise<never>((_, reject) => {
        view.reject = reject;
      });
      view.promise = Promise.race([transaction, forceAborted])
        .catch((error) => {
          this.#abortPreparedView(view, error);
          throw error;
        })
        .finally(() => {
          view.reject = undefined;
          view.state = 'finished';
          if (this.#fetchingView === view) this.#fetchingView = null;
        });
      return view.promise;
    };

    return {
      signal: view.controller.signal,
      setTime: (value, animation) => {
        assertDraft();
        const target = this.#state.resolveTimeTarget(value, animation);
        if (!target) return false;
        time = target;
        return true;
      },
      setZoom: (value, animation) => {
        assertDraft();
        const target = this.#state.resolveZoomTarget(value, animation);
        if (!target) return false;
        zoomInput = { value: target.value, animation };
        return true;
      },
      setPlaybackTime: (value) => {
        assertDraft();
        playbackTime = parseTimeLike(value);
      },
      fetch,
      abort: (reason?: unknown) => this.#abortPreparedView(view, reason),
    };
  }

  #abortPreparedView(view: ActivePreparedView, reason: unknown = abortError()) {
    if (view.state === 'finished') return;
    const fetching = view.state === 'fetching';
    view.state = 'finished';
    view.controller.abort(reason);
    if (fetching && view.locked) this.#renderer?.abortFrame();
    view.reject?.(reason);
    if (this.#fetchingView === view) this.#fetchingView = null;
  }

  #abortFetchingView() {
    if (this.#fetchingView) this.#abortPreparedView(this.#fetchingView);
  }

  get zoomChanging() {
    return this.#state.zoom.candidate.number();
  }

  get zoomAnimating() {
    return this.#state.zoom.current.number();
  }

  fitTo(range: TimescopeRange<TimeLike<never>>, opts?: TimescopeFitOptions) {
    const [left, right] = typeof opts?.padding === 'number' ? [opts.padding, opts.padding] : (opts?.padding ?? [0, 0]);
    const padding = left + right;
    if (!Number.isFinite(left) || !Number.isFinite(right) || left < 0 || right < 0 || !Number.isFinite(padding))
      return false;
    const rangeDecimal = range.map((t) => parseTimeLike(t)) as TimescopeRange<Decimal>;
    if (!rangeDecimal[1].gt(rangeDecimal[0])) return false;

    if (!this.#size.width || !this.#size.height) {
      this.#initialFit = { range: rangeDecimal, padding: opts?.padding, animation: opts?.animation };
      return true;
    }
    if (this.#size.width <= padding) return false;

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
    this.#abortFetchingView();
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

  get canvas(): TimescopeCanvas | null {
    return this.#canvas;
  }

  get target(): Element | TimescopeCanvas | null {
    return this.#backendMount?.canvas ?? null;
  }

  async resize(width: number, height: number, dpr = 1): Promise<boolean> {
    try {
      await this.#backendReady;
      if (!this.#backendMount || this.#backendMount.autoSize) return false;
      await this.#setSize(width, height, dpr);
      return true;
    } catch {
      return false;
    }
  }

  #disabled = false;
  set disabled(v: boolean) {
    this.#disabled = v;
    this.#backendMount?.setDisabled?.(v);
  }

  get disabled() {
    return this.#disabled;
  }

  get options() {
    return this.#options;
  }

  setOptions(opts: TimescopeOptions<Sources, Series, Track>) {
    if ('backend' in opts || 'renderThread' in opts)
      throw new Error('backend and renderThread are constructor-only options');
    validateTimescopeOptions(opts);
    this.#abortFetchingView();
    this.#options = { style: undefined, ...opts } as TimescopeOptions;
    this.#applyOptions(this.#options, true);
  }

  updateOptions(opts: TimescopeUpdateOptions<Sources, Series, Track>) {
    if ('backend' in opts || 'renderThread' in opts)
      throw new Error('backend and renderThread are constructor-only options');
    const next = mergeTimescopeOptions(copyOptions(this.#options), opts as TimescopeUpdateOptions);
    validateTimescopeOptions(next);
    this.#abortFetchingView();
    this.#options = next;
    this.#applyOptions(opts as TimescopeOptions, false);
  }

  #applyOptions(opts: TimescopeOptions | TimescopeUpdateOptions<Sources, Series, Track>, set: boolean) {
    if ('selection' in opts && opts.selection === false) {
      this.#selectionRange = null;
      this.#selectionRangeChanging = null;
    }
    if (!this.#backendMount || !this.#renderer) return;

    if ('style' in opts) this.#backendMount.setStyle?.(opts.style);

    if (set) {
      this.#renderer.setOptions(opts as TimescopeOptions);
    } else {
      this.#renderer.updateOptions(opts as TimescopeOptions);
    }
  }

  #setSize(width: number, height: number, dpr: number, x = 0, y = 0) {
    if (!this.#renderer) return;
    if (
      this.#size.width === width &&
      this.#size.height === height &&
      this.#size.dpr === dpr &&
      this.#size.x === x &&
      this.#size.y === y
    )
      return;
    if (this.#fetchingView?.locked) this.#abortFetchingView();

    this.#size = { x, y, width, height, dpr };

    const resized = this.#renderer.resize({ size: { width, height }, context: { dpr } });
    this.#resizeAcknowledged = resized;
    const generation = this.#mountGeneration;
    void resized.then(
      () => {
        if (generation === this.#mountGeneration && this.#resizeAcknowledged === resized) this.#notifyMounted();
      },
      () => {},
    );
    void resized.catch(() => {});

    if (
      this.#initialFit &&
      width > 0 &&
      height > 0 &&
      this.fitTo(this.#initialFit.range, {
        padding: this.#initialFit.padding,
        animation: this.#initialFit.animation,
      })
    ) {
      this.#initialFit = null;
    }

    this.dispatchEvent('resize');

    return resized;
  }

  #notifyMounted() {
    if (!this.#mounted && this.#backendInitialized && this.#size.width > 0 && this.#size.height > 0) {
      this.#mounted = true;
      this.#resolveMount?.();
      this.#resolveMount = null;
      this.#rejectMount = null;
      this.dispatchEvent('mount');
      if (!this.#readyEmitted) {
        this.#readyEmitted = true;
        this.dispatchEvent('ready');
      }
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

  #onWheel(deltaY: number) {
    if (this.#disabled) return;
    this.#abortFetchingView();
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
      this.#initialFit = { range: fit.range, padding, animation: false };
      this.#state = new TimescopeState({ ..._opts, time: start.add(end).divExact(2) });
    } else {
      this.#state = new TimescopeState(_opts);
    }
    this.#installTimeZoomEventHandler();

    const {
      target: _target,
      fonts: _fonts,
      environment: _environment,
      backend: _backend,
      renderThread: _renderThread,
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
    this.#environment = _opts.environment;
    this.#backendChoice = _backend;
    this.#backends = resolveBackends(_backend);
    this.#renderThread = _renderThread;

    this.#wheelSensitivity = _opts.wheelSensitivity ?? 200;

    if (_opts.target) {
      this.#pendingAutoMount = true;
      const generation = this.#mountGeneration;
      this.#backendReady = Promise.resolve().then(() => {
        this.#pendingAutoMount = false;
        if (this.#disposing || generation !== this.#mountGeneration) return;
        this.mount(_opts.target);
        return this.#backendReady;
      });
      void this.#backendReady.catch(() => {});
    }
  }

  async reload(sources?: (keyof Sources & string)[]): Promise<boolean> {
    try {
      await this.#backendReady;
      if (!this.#renderer) return false;
      await this.#renderer.invalidateSources(sources);
      return true;
    } catch {
      return false;
    }
  }

  redraw(): Promise<void> {
    return this.#backendReady.then(() => this.#renderer?.redraw());
  }

  async nextFrame(): Promise<void> {
    await this.#backendReady;
    const generation = this.#mountGeneration;
    await this.#mountReady;
    if (!this.#renderer || !this.#mounted || generation !== this.#mountGeneration)
      throw new DOMException('Timescope is not mounted', 'InvalidStateError');
    await this.#renderer.redraw();
  }

  mount(target?: TimescopeBackendTarget) {
    if (this.#disposing) throw new Error('Timescope is disposed');
    if (this.#mountController) this.unmount();
    this.#mountGeneration++;
    const options = {
      backend: typeof this.#backendChoice === 'string' ? this.#backendChoice : undefined,
      target,
      renderThread: this.#renderThread,
      fonts: this.#fonts,
      environment: this.#environment,
      style: this.#options.style,
    };
    const controller = new AbortController();
    this.#mountController = controller;
    this.#mountReady = new Promise<void>((resolve, reject) => {
      this.#resolveMount = resolve;
      this.#rejectMount = reject;
    });
    void this.#mountReady.catch(() => {});
    const prepare = async () => {
      const reasons: string[] = [];
      for (const candidate of this.#backends) {
        const reason = await candidate.probe(options);
        controller.signal.throwIfAborted();
        if (reason !== undefined) {
          reasons.push(reason);
          continue;
        }
        const generation = this.#mountGeneration;
        const mounted = await candidate.mount(options, {
          fontsChanged: async (fonts) => {
            if (generation !== this.#mountGeneration || controller.signal.aborted) return;
            await this.#renderer?.setFonts(fonts);
          },
          sizeChanged: (size) => {
            if (generation !== this.#mountGeneration || controller.signal.aborted) return;
            if (!this.#renderer) this.#pendingSize = size;
            else this.#setSize(size.width, size.height, size.dpr, size.x, size.y);
          },
          pointer: (info) => {
            if (generation !== this.#mountGeneration || controller.signal.aborted || this.#disabled) return;
            if (info.type === 'down') this.#abortFetchingView();
            this.#renderer?.onPointerEvent(info);
          },
          wheel: (deltaY) => {
            if (generation === this.#mountGeneration && !controller.signal.aborted) this.#onWheel(deltaY);
          },
          pointerStyle: async (info) => {
            if (generation !== this.#mountGeneration || controller.signal.aborted || this.#disabled) return;
            return (await this.#renderer?.pointerStyle(info)) ?? undefined;
          },
          isDisabled: () => controller.signal.aborted || this.#disabled,
        });
        if (controller.signal.aborted) {
          mounted.dispose();
          controller.signal.throwIfAborted();
        }
        try {
          const renderer = this.#finishMount(mounted, options);
          await renderer.ready;
        } catch (error) {
          if (this.#backendMount === mounted) {
            this.#renderer?.dispose();
            mounted.dispose();
            this.#renderer = null;
            this.#backendMount = null;
            this.#canvas = null;
            this.#resizeAcknowledged = null;
            this.#pendingSize = null;
          } else if (!controller.signal.aborted) {
            mounted.dispose();
          }
          throw error;
        }
        controller.signal.throwIfAborted();
        this.#backendInitialized = true;
        if (this.#resizeAcknowledged)
          void this.#resizeAcknowledged.then(
            () => this.#notifyMounted(),
            () => {},
          );
        return;
      }
      throw new Error(`No rendering backend supports this target: ${reasons.join('; ')}`);
    };
    let rejectAborted: (reason: unknown) => void = () => {};
    const aborted = new Promise<never>((_, reject) => {
      rejectAborted = reject;
    });
    const onAbort = () => rejectAborted(controller.signal.reason);
    controller.signal.addEventListener('abort', onAbort, { once: true });
    this.#backendReady = Promise.race([prepare(), aborted]).finally(() => {
      controller.signal.removeEventListener('abort', onAbort);
    });
    void this.#backendReady.catch((reason) => {
      if (this.#mountController === controller) {
        this.#rejectMount?.(reason);
        this.dispatchEvent(new TimescopeEvent('error', reason instanceof Error ? reason : new Error(String(reason))));
      }
    });
    return this;
  }

  #finishMount(mounted: TimescopeBackendMount, options: { environment?: TimescopeEnvironment }) {
    const renderer =
      mounted.renderThread === 'worker'
        ? new TimescopeWorkerRenderer({ canvas: mounted.canvas, fonts: mounted.fonts })
        : new TimescopeMainThreadRenderer({
            canvas: mounted.canvas,
            fonts: mounted.fonts,
            environment: mounted.environment ?? options.environment,
          });
    this.#canvas = mounted.canvas;
    this.#renderer = renderer;
    this.#backendMount = mounted;

    renderer.setOptions(this.#options as TimescopeOptions);
    if (this.#selectionRange) renderer.setSelectionRange(this.#selectionRange);

    this.#state.time.restore();
    this.#state.zoom.restore();

    const size = this.#pendingSize;
    this.#pendingSize = null;
    if (size) this.#setSize(size.width, size.height, size.dpr, size.x, size.y);
    else if (!mounted.autoSize) this.#setSize(mounted.canvas.width, mounted.canvas.height, 1);

    renderer.on('change', () => this.changed());

    renderer.on('sync', (e) => {
      if (e.value.time) {
        this.#state.time.handleSyncEvent(e.value.time);
        this.#state.time.dispatchEvent(new TimescopeEvent('sync', e.value.time, e.origin));
      }
      if (e.value.zoom) {
        this.#state.zoom.handleSyncEvent(e.value.zoom);
        this.#state.zoom.dispatchEvent(new TimescopeEvent('sync', e.value.zoom, e.origin));
      }
    });

    renderer.on('renderer:event', (e) => {
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

    return renderer;
  }

  unmount() {
    const mounted = this.#mounted;
    this.#rejectMount?.(new DOMException('Mount was aborted', 'AbortError'));
    this.#resolveMount = null;
    this.#rejectMount = null;
    this.#mountReady = Promise.resolve();
    this.#mountGeneration++;
    this.#pendingAutoMount = false;
    this.#backendInitialized = false;
    this.#mounted = false;
    this.#resizeAcknowledged = null;
    this.#mountController?.abort(new DOMException('Mount was aborted', 'AbortError'));
    this.#mountController = null;
    this.#backendReady = Promise.resolve();
    this.#abortFetchingView();
    this.#renderer?.dispose();
    this.#backendMount?.dispose();

    this.#renderer = null;
    this.#backendMount = null;
    this.#canvas = null;
    this.#pendingSize = null;
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
