import type { TimescopeAnimationInput } from '#src/core/animation';
import { Decimal } from '#src/core/decimal';
import { defaultOptions } from '#src/core/defaults';
import type { TimescopeRange } from '#src/core/range';
import { parseTimeDomainLike, parseTimeLike, type TimeLike } from '#src/core/time';
import { TimescopeCommittable } from '#src/core/TimescopeCommittable';
import type { ZoomLike } from '#src/core/zoom';
import { TimescopeEvent, TimescopeObservable } from './event.ts';

export interface TimescopeStateOptions {
  time?: TimeLike;
  timeRange?: TimescopeRange<TimeLike | null | undefined>;
  zoom?: ZoomLike;
  zoomRange?: TimescopeRange<ZoomLike | undefined>;
}

export type TimescopeViewportSnapshot = {
  current: { center: Decimal; resolution: Decimal };
  candidate: { center: Decimal; resolution: Decimal };
  cursor: { center: Decimal };
  axisSize: readonly [number, number];
  editing: boolean;
  animating: boolean;
};

export class TimescopeViewState extends TimescopeObservable {
  range: TimescopeRange<Decimal> | null = null;
  resolution: Decimal | null = null;

  set(range: TimescopeRange<Decimal>, resolution: Decimal) {
    this.range = range;
    this.resolution = resolution;
    this.changed();
  }
}

export class TimescopeState extends TimescopeObservable<
  | TimescopeEvent<'timechanging', Decimal | null>
  | TimescopeEvent<'timechanged', Decimal | null>
  | TimescopeEvent<'timeanimating', Decimal | null>
  | TimescopeEvent<'timeanimated', Decimal | null>
  | TimescopeEvent<'zoomchanging', number>
  | TimescopeEvent<'zoomchanged', number>
  | TimescopeEvent<'zoomanimating', number>
  | TimescopeEvent<'zoomanimated', number>
> {
  time: TimescopeCommittable<null>;
  zoom: TimescopeCommittable<never>;

  constructor(opts: TimescopeStateOptions) {
    super();
    this.time = new TimescopeCommittable<null>({
      initialValue: parseTimeLike(opts.time ?? defaultOptions.time),
      domain: parseTimeDomainLike(opts.timeRange ?? [undefined, null]),
      onNull: () => Date.now() / 1000,
    });
    this.zoom = new TimescopeCommittable<never>({
      initialValue: opts.zoom ?? defaultOptions.zoom,
      domain: opts.zoomRange,
    });

    this.time.on('change', () => this.changed());
    this.time.on('valuechanging', (e) => this.dispatchEvent(new TimescopeEvent('timechanging', e.value)));
    this.time.on('valuechanged', (e) => this.dispatchEvent(new TimescopeEvent('timechanged', e.value)));
    this.time.on('valueanimating', (e) => this.dispatchEvent(new TimescopeEvent('timeanimating', e.value)));
    this.time.on('valueanimated', (e) => this.dispatchEvent(new TimescopeEvent('timeanimated', e.value)));

    this.zoom.on('change', () => this.changed());
    this.zoom.on('valuechanging', (e) => this.dispatchEvent(new TimescopeEvent('zoomchanging', e.value.number())));
    this.zoom.on('valuechanged', (e) => this.dispatchEvent(new TimescopeEvent('zoomchanged', e.value.number())));
    this.zoom.on('valueanimating', (e) => this.dispatchEvent(new TimescopeEvent('zoomanimating', e.value.number())));
    this.zoom.on('valueanimated', (e) => this.dispatchEvent(new TimescopeEvent('zoomanimated', e.value.number())));
  }

  setTime(v: TimeLike | null, animation?: TimescopeAnimationInput) {
    const target = this.resolveTimeTarget(v, animation);
    if (!target) return false;
    this.time.setValue(target.value, target.animation);
    return true;
  }

  resolveTimeTarget(v: TimeLike | null, animation?: TimescopeAnimationInput) {
    if (typeof v === 'number' && !isFinite(v)) return undefined;
    if (typeof v === 'number' && isNaN(v)) return undefined;

    if (animation == null) animation = 'out';

    try {
      return { value: parseTimeLike(v), animation };
    } catch {
      return undefined;
    }
  }

  setTimeRange(domain?: TimescopeRange<TimeLike | null | undefined>) {
    this.time.domain = parseTimeDomainLike(domain ?? [undefined, null]);
  }

  setPlaybackTime(t: TimeLike<null>) {
    this.time.setNullValue(parseTimeLike(t));
  }

  setZoom(v: ZoomLike, animation?: TimescopeAnimationInput) {
    const target = this.resolveZoomTarget(v, animation);
    if (!target) return false;
    this.zoom.setValue(target.value, target.animation);
    return true;
  }

  resolveZoomTarget(v: ZoomLike, animation?: TimescopeAnimationInput) {
    if (typeof v === 'number' && !isFinite(v)) return undefined;
    if (typeof v === 'number' && isNaN(v)) return undefined;

    if (animation == null) {
      animation = {
        animation: 'linear',
        duration: 200,
        lazy: this.zoom.value.lt(v),
      };
    }

    try {
      return { value: Decimal(v), animation };
    } catch {
      return undefined;
    }
  }

  setZoomRange(domain?: TimescopeRange<ZoomLike | undefined>) {
    this.zoom.domain = (domain ?? [undefined, undefined]).map(Decimal) as TimescopeRange<Decimal | undefined>;
  }

  get now() {
    return this.time.nullValue;
  }

  dispose() {
    this.time.dispose();
    this.zoom.dispose();
    super.dispose();
  }
}
