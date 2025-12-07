import type { TimescopeFont } from '#src/bridge/protocol';
import type { TimescopeAnimationInput } from '#src/core/animation';
import config from '#src/core/config';
import { Decimal, type NumberLike } from '#src/core/decimal';
import { TimescopeEvent, TimescopeObservable } from '#src/core/event';
import type { Range } from '#src/core/range';
import { parseTimeLike, type TimeLike } from '#src/core/time';
import { TimescopeState } from '#src/core/TimescopeState';
import type {
  FieldDefLike,
  TimescopeOptions,
  TimescopeOptionsInitial,
  TimescopeSeriesInput,
  TimescopeSourceInput,
} from '#src/core/types';
import { mergeOptions } from '#src/core/utils';
import { zoomFor, type ZoomLike } from '#src/core/zoom';
import { InteractionManager } from '#src/main/InteractionManager';
import { TimescopeWorkerRenderer } from '#src/main/TimescopeWorkerRenderer';

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
};

type TimescopeUpdateOptions<
  Source extends Record<string, TimescopeSourceInput>,
  SourceName extends Record<string, keyof Source>,
  TimeDef extends Record<string, FieldDefLike<TimeLike<never>>>,
  ValueDef extends Record<string, FieldDefLike<NumberLike | null>>,
  Track extends string,
> = Omit<TimescopeOptions<Source, SourceName, TimeDef, ValueDef, Track>, 'series'> & {
  series?: {
    [K in keyof SourceName & keyof TimeDef & keyof ValueDef]: Omit<
      TimescopeSeriesInput<Source, SourceName[K] & string, TimeDef[K], ValueDef[K], Track>,
      'data'
    > & {
      data: Omit<
        TimescopeSeriesInput<Source, SourceName[K] & string, TimeDef[K], ValueDef[K], Track>['data'],
        'source'
      > & {
        source?: TimescopeSeriesInput<Source, SourceName[K] & string, TimeDef[K], ValueDef[K], Track>['data']['source'];
      };
    };
  };
};

export type TimescopeFitOptions = {
  animation?: boolean;
  padding?: number | [l: number, r: number];
};

export class Timescope<
  Source extends Record<string, TimescopeSourceInput> = Record<string, TimescopeSourceInput>,
  SourceName extends Record<string, keyof Source> = Record<string, keyof Source>,
  TimeDef extends Record<string, FieldDefLike<TimeLike<never>>> = Record<string, FieldDefLike<TimeLike<never>>>,
  ValueDef extends Record<string, FieldDefLike<NumberLike | null>> = Record<string, FieldDefLike<NumberLike | null>>,
  Track extends string = string,
> extends TimescopeObservable<
  | TimescopeEvent<'timechanging', Decimal | null>
  | TimescopeEvent<'timechanged', Decimal | null>
  | TimescopeEvent<'timeanimating', Decimal | null>
  | TimescopeEvent<'zoomchanging', number>
  | TimescopeEvent<'zoomchanged', number>
  | TimescopeEvent<'zoomanimating', number>
  | TimescopeEvent<'rangechanging', Range<Decimal>>
  | TimescopeEvent<'rangechanged', Range<Decimal> | null>
> {
  #element: HTMLCanvasElement | null = null;
  #renderer: TimescopeWorkerRenderer | null = null;
  #interactionManager: InteractionManager | null = null;

  #state: TimescopeState;

  #options: TimescopeOptions;
  #fonts: (string | TimescopeFont)[];

  #wheelSensitivity;

  get time(): Decimal | null {
    return this.#state.time.value?.clone() ?? null;
  }

  set time(v: TimeLike | null) {
    this.setTime(v);
  }

  setTime(v: TimeLike | null, animation?: TimescopeAnimationInput) {
    this.#state.setTime(v, animation);
  }

  get timeChanging() {
    return this.#state.time.candidate?.clone() ?? null;
  }

  get timeAnimating() {
    return this.#state.time.current?.clone() ?? null;
  }

  get timeRange(): Range<Decimal | null | undefined> {
    return this.#state.time.domain.map((x) => (x == null ? x : x.clone())) as Range<Decimal | null | undefined>;
  }

  setTimeRange(domain?: Range<TimeLike | null | undefined>) {
    this.#state.setTimeRange(domain);
  }

  get zoom(): number {
    return this.#state.zoom.value.number();
  }

  set zoom(v: ZoomLike) {
    this.setZoom(v);
  }

  setZoom(v: ZoomLike, animation?: TimescopeAnimationInput) {
    return this.#state.setZoom(v, animation);
  }

  get zoomChanging() {
    return this.#state.zoom.candidate.number();
  }

  get zoomAnimating() {
    return this.#state.zoom.current.number();
  }

  fitTo(range: Range<TimeLike<never>>, opts?: TimescopeFitOptions) {
    if (!this.#size.width) return false;

    const padding =
      typeof opts?.padding === 'number'
        ? opts.padding * 2
        : Array.isArray(opts?.padding)
          ? opts.padding.reduce((acc, val) => acc + val)
          : 0;

    const rangeDecimal = range.map((t) => parseTimeLike(t));
    const resolution = rangeDecimal[1]
      .sub(rangeDecimal[0])
      .div(this.#size.width - padding)
      .abs();

    const zoom = zoomFor(resolution);
    const time = rangeDecimal[0].add(rangeDecimal[1]).div(2);

    this.setZoom(zoom, opts?.animation !== false ? undefined : false);
    this.setTime(time, opts?.animation !== false ? undefined : false);
  }

  get zoomRange(): Range<number | undefined> {
    return this.#state.zoom.domain.map((x) => (x == null ? x : x.number())) as Range<number | undefined>;
  }

  setZoomRange(domain?: Range<ZoomLike | undefined>) {
    this.#state.setZoomRange(domain);
  }

  setSelection(domain: Range<TimeLike<undefined>> | null) {
    if (this.#options.selection === false) return;

    const range = (domain?.map((t) => parseTimeLike(t)) ?? null) as Range<Decimal | undefined> | null;

    this.#renderer?.updateOptions({
      selection: {
        range,
      },
    });
  }

  clearSelection() {
    this.setSelection(null);
  }

  get animating() {
    return this.#state.time.animating;
  }

  get editing() {
    return this.#state.time.editing;
  }

  #size = {
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    dpr: 0,
  };

  get size() {
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

  setOptions(opts: TimescopeOptions) {
    this.#options = { style: undefined, ...opts };
    this.#applyOptions(this.#options, true);
  }

  updateOptions(opts: TimescopeUpdateOptions<Source, SourceName, TimeDef, ValueDef, Track>) {
    mergeOptions(this.#options, opts);
    this.#applyOptions(opts, false);
  }

  #applyOptions(
    opts: TimescopeOptions | TimescopeUpdateOptions<Source, SourceName, TimeDef, ValueDef, Track>,
    set: boolean,
  ) {
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
  }

  #installTimeZoomEventHandler() {
    const time = this.#state.time;
    const zoom = this.#state.zoom;
    this.#state.on('change', () => this.changed());
    this.#state.on('timechanging', (e) => this.dispatchEvent(e));
    this.#state.on('timechanged', (e) => this.dispatchEvent(e));
    this.#state.on('timeanimating', (e) => this.dispatchEvent(e));
    this.#state.on('zoomchanging', (e) => this.dispatchEvent(e));
    this.#state.on('zoomchanged', (e) => this.dispatchEvent(e));
    this.#state.on('zoomanimating', (e) => this.dispatchEvent(e));

    time.on('sync', (e) => this.#renderer?.sync({ time: e.value }, e.origin));
    zoom.on('sync', (e) => this.#renderer?.sync({ zoom: e.value }, e.origin));
  }

  #onWheel(e: WheelEvent) {
    if (this.#disabled) return;
    e.preventDefault();

    const deltaY = normalizeWheel(e);
    this.#state.setZoom(this.#state.zoom.committing.add(-deltaY / this.#wheelSensitivity));
  }

  constructor(opts?: TimescopeOptionsInitial<Source, SourceName, TimeDef, ValueDef, Track>) {
    super();

    const _opts = opts ?? {};
    this.#state = new TimescopeState(_opts);
    this.#installTimeZoomEventHandler();

    this.#options = { style: undefined, ..._opts } as TimescopeOptions;
    this.#fonts = _opts.fonts ?? [];

    if (_opts.target) this.mount(_opts.target);
    this.#wheelSensitivity = _opts.wheelSensitivity ?? config.wheelSensitivity;
  }

  reload(sources?: (keyof SourceName & string)[]) {
    this.#renderer?.invalidateSources(sources);
  }

  mount(target: HTMLElement | string) {
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

    this.#renderer = new TimescopeWorkerRenderer({
      canvas: this.#element,
      fonts: this.#fonts,
    });

    this.#renderer.setOptions(this.#options as TimescopeOptions);

    // sync the renderer
    this.#state.time.restore();
    this.#state.zoom.restore();

    new ResizeObserver(() => this.#resize()).observe(this.#element);
    this.#resize();

    // change event chain
    this.#renderer.on('change', () => this.changed());

    // time state sync
    this.#renderer.on('sync', (e) => {
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
        this.dispatchEvent(
          new TimescopeEvent(
            e.value.resizing ? 'rangechanging' : 'rangechanged',
            e.value.range as Range<Decimal>,
            e.origin,
          ),
        );
      }
    });

    // pointer-events
    this.#interactionManager = new InteractionManager({
      element: this.#element,

      transform: (p) => p.sub([this.#size.x, this.#size.y]),

      handler: (info) => {
        this.#renderer?.onPointerEvent(info);
      },

      cursor: async (info) => {
        return (await this.#renderer?.pointerStyle(info)) ?? undefined;
      },
    });

    // wheel zoom
    this.#element.addEventListener('wheel', this.#onWheel.bind(this));

    el.appendChild(this.#element);

    return this;
  }

  unmount() {
    this.#element?.remove();
    this.#interactionManager?.detach();
    this.#renderer?.dispose();

    this.#renderer = null;
    this.#element = null;
    this.#interactionManager = null;
  }

  dispose() {
    this.unmount();
  }
}
