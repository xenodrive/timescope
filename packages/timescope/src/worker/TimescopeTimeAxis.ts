import type { TimescopeSyncMessage } from '#src/bridge/protocol';
import { Decimal, type NumberLike } from '#src/core/decimal';
import { TimescopeEvent, TimescopeObservable } from '#src/core/event';
import type { Range, TimeRange } from '#src/core/range';
import type { TimeLike } from '#src/core/time';
import { TimescopeState } from '#src/core/TimescopeState';
import { resolutionFor, zoomFor } from '#src/core/zoom';
import { Kinetic } from '#src/worker/kinetic';

type PointRange = [number, number];

type TimescopeTimeAxisEvent =
  | 'viewchanged'
  | 'viewchanging'
  | TimescopeEvent<'timechanging', Decimal | null>
  | TimescopeEvent<'timechanged', Decimal | null>
  | TimescopeEvent<'zoomchanging', number>
  | TimescopeEvent<'zoomchanged', number>
  | TimescopeEvent<'sync', TimescopeSyncMessage>;

type TimescopeTimeAxisOptions = {
  time?: TimeLike | null;
  timeRange?: TimeRange;

  zoom?: Decimal | number;
  zoomRange?: [number, number];
};

export class TimescopeTimeAxis extends TimescopeObservable<TimescopeTimeAxisEvent> {
  #timezoom: TimescopeState;

  #state = {
    cursorMode: 'center' as 'center' | 'target',

    axisLength: [0, 0],

    disabled: false,

    dragging: false,

    pinch: null as null | {
      anchorTime: [Decimal, Decimal];
    },
  };

  #kinetic = new Kinetic();

  constructor(opts: TimescopeTimeAxisOptions = {}) {
    super();

    this.#timezoom = new TimescopeState(opts);

    const { time, zoom } = this.#timezoom;
    time.on('change', () => this.changed());
    time.on('valuechanged', (e) => this.dispatchEvent(new TimescopeEvent('timechanged', e.value)));
    time.on('valuechanging', (e) => this.dispatchEvent(new TimescopeEvent('timechanging', e.value)));
    time.on('sync', (e) => this.dispatchEvent(new TimescopeEvent('sync', { time: e.value })));

    zoom.on('change', () => this.changed());
    zoom.on('valuechanged', (e) => this.dispatchEvent(new TimescopeEvent('zoomchanged', e.value.number())));
    zoom.on('valuechanging', (e) => this.dispatchEvent(new TimescopeEvent('zoomchanging', e.value.number())));
    zoom.on('sync', (e) => this.dispatchEvent(new TimescopeEvent('sync', { zoom: e.value })));

    time.on('valuechanged', () => this.dispatchEvent('viewchanged'));
    zoom.on('valuechanged', () => this.dispatchEvent('viewchanged'));
    time.on('valuechanging', () => this.dispatchEvent('viewchanging'));
    zoom.on('valuechanging', () => this.dispatchEvent('viewchanging'));
  }

  z(resolution: Decimal): Decimal {
    return Decimal(zoomFor(resolution));
  }

  r(zoom: Decimal): Decimal {
    return resolutionFor(zoom.number());
  }

  /** time -> pixel position */
  p(t: NumberLike | undefined | null, idx?: number): number;
  p(t: Range<Decimal | undefined | null>): PointRange;
  p(t: (NumberLike | undefined | null) | Range<Decimal | undefined | null>, idx?: number): number | PointRange {
    if (Array.isArray(t)) {
      return t.map((t, idx) => this.p(t, idx)) as PointRange;
    }

    if (t === undefined) return idx === 0 ? -100 : this.#state.axisLength[0] + this.#state.axisLength[1] + 100;

    const resolution = this.r(this.#timezoom.zoom.current);
    const centerTime = this.#timezoom.time.current ?? this.now;

    const target = t ?? this.now;
    const targetDecimal = Decimal(target as NumberLike)!;

    return targetDecimal.sub(centerTime).div$(resolution, 3).number() + this.#state.axisLength[0];
  }

  /** pixel position -> time */
  t(p: number): Decimal;
  t(p: PointRange): Range<Decimal | undefined | null>;
  t(p: number | PointRange): Decimal | Range<Decimal | undefined | null> {
    if (Array.isArray(p)) {
      return p.map((p) => this.t(p)) as Range<Decimal | undefined | null>;
    }

    const resolution = this.r(this.#timezoom.zoom.current);
    const centerTime = this.#timezoom.time.current ?? this.now;

    return resolution
      .mul(p - this.#state.axisLength[0])
      .add(centerTime)
      .round(resolution.digits);
  }

  set disabled(v) {
    this.#state.disabled = v;
  }

  get disabled() {
    return this.#state.disabled;
  }

  get editing() {
    return this.#timezoom.time.editing || this.#timezoom.zoom.editing;
  }

  get dragging() {
    return this.#state.dragging;
  }

  get animating() {
    return this.#timezoom.time.animating || this.#timezoom.zoom.animating;
  }

  get current() {
    return {
      time: this.#timezoom.time.current,
      zoom: this.#timezoom.zoom.current,
      resolution: this.r(this.#timezoom.zoom.current),
      range: this.rangeFor(this.#timezoom.time.current, this.#timezoom.zoom.current),
      p: this.p(this.#timezoom.time.current),
    };
  }

  get candidate() {
    return {
      time: this.#timezoom.time.candidate,
      zoom: this.#timezoom.zoom.candidate,
      resolution: this.r(this.#timezoom.zoom.candidate),
      range: this.rangeFor(this.#timezoom.time.candidate, this.#timezoom.zoom.candidate),
      p: this.p(this.#timezoom.time.candidate),
    };
  }

  get value() {
    return {
      time: this.#timezoom.time.value,
      zoom: this.#timezoom.zoom.value,
      resolution: this.r(this.#timezoom.zoom.value),
      range: this.rangeFor(this.#timezoom.time.value, this.#timezoom.zoom.value),
      p: this.p(this.#timezoom.time.value),
    };
  }

  get committing() {
    return {
      time: this.#timezoom.time.committing,
      zoom: this.#timezoom.zoom.committing,
      resolution: this.r(this.#timezoom.zoom.committing),
      range: this.rangeFor(this.#timezoom.time.committing, this.#timezoom.zoom.committing),
      p: this.p(this.#timezoom.time.committing),
    };
  }

  public get committed() {
    return {
      time: this.#timezoom.time.committed,
      zoom: this.#timezoom.zoom.committed,
      resolution: this.r(this.#timezoom.zoom.committed),
      range: this.rangeFor(this.#timezoom.time.committed, this.#timezoom.zoom.committed),
      p: this.p(this.#timezoom.time.committed),
    };
  }

  get cursor() {
    return {
      time: this.#timezoom.time.cursor,
      p: this.p(this.#timezoom.time.cursor),
    };
  }

  get range() {
    return {
      time: this.#timezoom.time.domain,
      p: this.p(this.#timezoom.time.domain),
    };
  }

  rangeFor(centerTime: Decimal | null, zoom: Decimal): Range<Decimal> {
    return [
      (centerTime ?? this.now).sub(this.r(zoom).mul(this.#state.axisLength[0])),
      (centerTime ?? this.now).add(this.r(zoom).mul(this.#state.axisLength[1])),
    ];
  }

  #scrollStart(p: number) {
    this.#timezoom.time.begin(this.t(p));
    this.#kinetic.begin();
  }

  #scrollUpdate(p: number, delta: number) {
    this.#timezoom.time.update(this.t(this.current.p - delta));
    this.#kinetic.update(p, 0);
  }

  #scrollEnd() {
    if (this.#kinetic.end()) {
      const distance = this.#kinetic.getDistance();
      const angle = this.#kinetic.getAngle();
      const delta = distance * Math.cos(angle);

      this.#timezoom.time.commit({
        value: this.t(this.current.p - delta),
      });
    } else {
      this.#timezoom.time.commit();
    }
  }

  click(p: number) {
    this.#timezoom.time.begin(this.t(p));
    this.#timezoom.time.commit();
  }

  dragStart(p: number) {
    if (this.disabled) return;

    this.#scrollStart(p);
    this.#state.dragging = true;
  }

  dragUpdate(p: number, delta: number) {
    if (!this.#state.dragging || this.disabled) return;

    this.#scrollUpdate(p, delta);
  }

  dragEnd() {
    if (!this.#state.dragging || this.disabled) return;

    this.#scrollEnd();

    this.#state.dragging = false;
  }

  dragCancel() {
    this.#state.dragging = false;
  }

  pinchStart(p: number, q: number) {
    if (this.disabled) return;

    this.#timezoom.time.update(this.#timezoom.time.current);

    this.#state.pinch = {
      anchorTime: [this.t(p), this.t(q)],
    };
    if (this.#state.pinch.anchorTime[0].eq(this.#state.pinch.anchorTime[1])) {
      this.#state.pinch = null;
      return;
    }
    this.#timezoom.zoom.begin(this.#timezoom.zoom.current);
  }

  pinchUpdate(p: number, q: number) {
    if (this.disabled) return;
    if (!this.#state.pinch) return this.pinchStart(p, q);

    const a = this.#state.pinch.anchorTime[0];
    const b = this.#state.pinch.anchorTime[1];

    if (Math.abs(q - p) > 2) {
      const r = b
        .sub(a)
        .div(q - p)
        .abs();
      const z = this.z(r);
      this.#timezoom.zoom.update(z);
    }
  }

  pinchEnd() {
    if (this.disabled) return;
    if (!this.#state.pinch) return;

    this.#state.pinch = null;

    this.#timezoom.zoom.commit({
      animation: 'linear',
      duration: 200,
    });
  }

  setAxisLength(l: [number, number]) {
    this.#state.axisLength = l;
    this.changed();
    this.dispatchEvent('viewchanged');
    this.dispatchEvent('viewchanging');
  }

  get axisLength() {
    return this.#state.axisLength;
  }

  get now() {
    return Decimal(Date.now() / 1000.0);
  }

  handleSyncEvent(sync: TimescopeSyncMessage) {
    if (sync.time) this.#timezoom.time.handleSyncEvent(sync.time);
    if (sync.zoom) this.#timezoom.zoom.handleSyncEvent(sync.zoom);
  }
}
