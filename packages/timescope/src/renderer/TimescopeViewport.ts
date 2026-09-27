import type { TimescopeSyncMessage } from '#src/bridge/protocol';
import { Decimal, type NumberLike } from '#src/core/decimal';
import { TimescopeEvent, TimescopeObservable } from '#src/core/event';
import type { TimeRange, TimescopeRange } from '#src/core/range';
import type { TimeLike } from '#src/core/time';
import { TimescopeState } from '#src/core/TimescopeState';
import { resolutionFor, zoomFor } from '#src/core/zoom';

type KineticPoint = { x: number; y: number; t: number };

// Adapted from ol/Kinetic with different velocity and stopping-distance behavior.
class Kinetic {
  private points: KineticPoint[] = [];
  private angle_ = 0;
  private distance_ = 0;

  constructor(
    private decay = 0.005,
    private minVelocity = 0,
    private delay = 100,
  ) {}

  begin(): void {
    this.points = [];
  }

  update(x: number, y: number): void {
    const now = Date.now();
    this.points.push({ x, y, t: now });
    const cutoff = now - this.delay;
    while (this.points.length > 1 && this.points[0].t < cutoff) this.points.shift();
  }

  end(): boolean {
    const n = this.points.length;
    if (n < 2) return false;
    const cutoff = Date.now() - this.delay;
    const last = this.points[n - 1];
    if (last.t < cutoff) return false;
    while (this.points.length > 1 && this.points[0].t < cutoff) this.points.shift();
    const first = this.points[0];
    if (last.t < Date.now() - this.delay) return false;
    const dx = last.x - first.x;
    const dy = last.y - first.y;
    const dt = last.t - first.t;
    if (dt < 1000 / 60) return false;
    const velocity = Math.sqrt(dx * dx + dy * dy) / dt;
    this.distance_ = velocity / this.decay;
    this.angle_ = Math.atan2(dy, dx);
    return velocity >= this.minVelocity;
  }

  getDistance(): number {
    return this.distance_;
  }

  getAngle(): number {
    return this.angle_;
  }
}

type PointRange = [number, number];

type TimescopeViewportEvent =
  | 'viewchanged'
  | 'viewchanging'
  | 'viewanimated'
  | TimescopeEvent<'timechanging', Decimal | null>
  | TimescopeEvent<'timechanged', Decimal | null>
  | TimescopeEvent<'zoomchanging', number>
  | TimescopeEvent<'zoomchanged', number>
  | TimescopeEvent<'sync', TimescopeSyncMessage>;

type TimescopeViewportOptions = {
  time?: TimeLike | null;
  timeRange?: TimeRange;

  zoom?: Decimal | number;
  zoomRange?: [number, number];
};

export class TimescopeViewport extends TimescopeObservable<TimescopeViewportEvent> {
  dispose() {
    this.#timezoom.dispose();
    super.dispose();
  }

  #timezoom: TimescopeState;
  #presentationTime: Decimal;

  #state = {
    cursorMode: 'center' as 'center' | 'target',

    axisLength: [0, 0],

    disabled: false,

    dragging: false,

    pinch: null as null | {
      anchorTime: [Decimal, Decimal];
    },
    scrollTime: null as Decimal | null,
  };

  #kinetic = new Kinetic();
  // Zoom is logarithmic (one unit doubles the scale), rather than measured in pixels.
  #zoomKinetic = new Kinetic(0.005, 0.0001);

  constructor(opts: TimescopeViewportOptions = {}) {
    super();

    this.#timezoom = new TimescopeState(opts);
    this.#presentationTime = this.#timezoom.now;

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
    time.on('valueanimated', () => this.dispatchEvent('viewanimated'));
    zoom.on('valueanimated', () => this.dispatchEvent('viewanimated'));
  }

  z(resolution: Decimal): Decimal {
    return Decimal(zoomFor(resolution));
  }

  r(zoom: Decimal): Decimal {
    return resolutionFor(zoom.number());
  }

  /** time -> pixel position */
  p(t: NumberLike | undefined | null, idx?: number): number;
  p(t: TimescopeRange<Decimal | undefined | null>): PointRange;
  p(
    t: (NumberLike | undefined | null) | TimescopeRange<Decimal | undefined | null>,
    idx?: number,
  ): number | PointRange {
    if (Array.isArray(t)) {
      return t.map((t, idx) => this.p(t, idx)) as PointRange;
    }

    if (t === undefined) return idx === 0 ? -100 : this.#state.axisLength[0] + this.#state.axisLength[1] + 100;

    const resolution = this.r(this.#timezoom.zoom.current);
    const centerTime = this.#timezoom.time.current ?? this.#presentationTime;

    const target = t ?? this.#presentationTime;
    const targetDecimal = Decimal(target as NumberLike)!;

    return targetDecimal.sub(centerTime).divRound$(resolution, 3).number() + this.#state.axisLength[0];
  }

  /** pixel position -> time */
  t(p: number): Decimal;
  t(p: PointRange): TimescopeRange<Decimal | undefined | null>;
  t(p: number | PointRange): Decimal | TimescopeRange<Decimal | undefined | null> {
    if (Array.isArray(p)) {
      return p.map((p) => this.t(p)) as TimescopeRange<Decimal | undefined | null>;
    }

    const resolution = this.r(this.#timezoom.zoom.current);
    const centerTime = this.#timezoom.time.current ?? this.#presentationTime;

    // Quantize the displacement to the same 0.001-pixel grid as p(). The coefficient's
    // stored scale is not a measure of screen precision (e.g. resolution = 1024 or 1e3).
    const pixels = Decimal(p - this.#state.axisLength[0]).round(3);
    return resolution.mul(pixels).add(centerTime);
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

  rangeFor(centerTime: Decimal | null, zoom: Decimal): TimescopeRange<Decimal> {
    return [
      (centerTime ?? this.#presentationTime).sub(this.r(zoom).mul(this.#state.axisLength[0])),
      (centerTime ?? this.#presentationTime).add(this.r(zoom).mul(this.#state.axisLength[1])),
    ];
  }

  #scrollStart() {
    this.#timezoom.time.begin();
    this.#kinetic.begin();

    const current = this.#timezoom.time.current ?? this.#timezoom.time.nullValue;
    this.#state.scrollTime = current;
  }

  #resolvedTimeDomain() {
    return this.#timezoom.time.domain.map((value) =>
      value === null ? this.#timezoom.time.nullValue : value,
    ) as TimescopeRange<Decimal | undefined>;
  }

  #scrollUpdate(p: number, delta: number) {
    const scrollTime = this.#state.scrollTime;
    if (!scrollTime) return;

    const resolution = this.r(this.#timezoom.zoom.current);
    const unconstrained = scrollTime.sub(resolution.mul(delta));
    this.#state.scrollTime = unconstrained;

    const [lower, upper] = this.#resolvedTimeDomain();
    let displayed = unconstrained;

    if (lower !== undefined && displayed.lt(lower)) {
      displayed = lower.add(displayed.sub(lower).mul(0.5));
    } else if (upper !== undefined && displayed.gt(upper)) {
      displayed = upper.add(displayed.sub(upper).mul(0.5));
    }

    this.#timezoom.time.update(unconstrained, displayed);
    const springOffset = unconstrained.sub(displayed).div(resolution, 18).number();
    this.#kinetic.update(p + springOffset, 0);
  }

  #scrollEnd() {
    this.#state.scrollTime = null;

    const kinetic = this.#kinetic.end();
    if (!kinetic) {
      this.#timezoom.time.commit();
      return;
    }

    const distance = this.#kinetic.getDistance();
    const delta = distance * Math.cos(this.#kinetic.getAngle());
    const origin = this.#timezoom.time.current ?? this.#timezoom.time.nullValue;
    const value = this.t(this.current.p - delta);
    const [lower, upper] = this.#resolvedTimeDomain();
    let target = value;
    if (lower !== undefined && target.lt(lower)) target = lower;
    if (upper !== undefined && target.gt(upper)) target = upper;

    const targetDisplacement = target.sub(origin);
    const tangent = targetDisplacement.isZero()
      ? 3
      : value.sub(origin).div(targetDisplacement, 18).add(1).mul(1.5).number();

    this.#timezoom.time.commit({
      value,
      animation: 'out',
      tangent,
    });
  }

  click(p: number) {
    this.#timezoom.time.begin(this.t(p));
    this.#timezoom.time.commit();
  }

  dragStart() {
    if (this.disabled) return;

    this.#scrollStart();
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
    this.#zoomKinetic.begin();
    this.#zoomKinetic.update(this.#timezoom.zoom.current.number(), 0);
  }

  pinchUpdate(p: number, q: number) {
    if (this.disabled) return;
    if (!this.#state.pinch) return this.pinchStart(p, q);

    const a = this.#state.pinch.anchorTime[0];
    const b = this.#state.pinch.anchorTime[1];

    if (Math.abs(q - p) > 2) {
      const r = b
        .sub(a)
        .div(q - p, 18)
        .abs();
      const z = this.z(r);
      this.#timezoom.zoom.update(z);
      this.#zoomKinetic.update(z.number(), 0);
    }
  }

  pinchEnd() {
    if (this.disabled) return;
    if (!this.#state.pinch) return;

    this.#state.pinch = null;

    if (this.#zoomKinetic.end()) {
      const delta = this.#zoomKinetic.getDistance() * Math.cos(this.#zoomKinetic.getAngle());
      const zoom = this.#timezoom.zoom;
      let target = zoom.current.add(delta);
      const [lower, upper] = zoom.domain;
      if (lower !== undefined && target.lt(lower)) target = lower;
      if (upper !== undefined && target.gt(upper)) target = upper;

      zoom.commit({ value: target, animation: 'out', tangent: 3 });
      return;
    }

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

  get now() {
    return this.#presentationTime;
  }

  get configuredPlaybackTime() {
    return this.#timezoom.time.configuredNullValue;
  }

  presentAt(time: Decimal) {
    this.#presentationTime = time;
  }

  get axisLength() {
    return this.#state.axisLength;
  }

  handleSyncEvent(sync: TimescopeSyncMessage) {
    if (sync.time) this.#timezoom.time.handleSyncEvent(sync.time);
    if (sync.zoom) this.#timezoom.zoom.handleSyncEvent(sync.zoom);
  }
}
