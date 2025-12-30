import type { TimescopeAnimationInput } from '#src/core/animation';
import { Decimal } from '#src/core/decimal';
import type { TimescopeRange } from '#src/core/range';
import { parseTimeDomainLike, parseTimeLike, type TimeLike } from '#src/core/time';
import { TimescopeCommittable } from '#src/core/TimescopeCommittable';
import type { ZoomLike } from '#src/core/zoom';
import { TimescopeEvent, TimescopeObservable } from './event';

export interface TimescopeStateOptions {
  time?: TimeLike;
  timeRange?: TimescopeRange<TimeLike | null | undefined>;
  zoom?: ZoomLike;
  zoomRange?: TimescopeRange<ZoomLike | undefined>;
}

export class TimescopeState extends TimescopeObservable<
  | TimescopeEvent<'timechanging', Decimal | null>
  | TimescopeEvent<'timechanged', Decimal | null>
  | TimescopeEvent<'timeanimating', Decimal | null>
  | TimescopeEvent<'zoomchanging', number>
  | TimescopeEvent<'zoomchanged', number>
  | TimescopeEvent<'zoomanimating', number>
> {
  time: TimescopeCommittable<null>;
  zoom: TimescopeCommittable<never>;

  constructor(opts: TimescopeStateOptions) {
    super();
    this.time = new TimescopeCommittable();
    this.zoom = new TimescopeCommittable();

    this.time = new TimescopeCommittable<null>({
      initialValue: parseTimeLike(opts.time ?? null),
      domain: parseTimeDomainLike(opts.timeRange ?? [undefined, null]),
      onNull: () => Date.now() / 1000,
    });
    this.zoom = new TimescopeCommittable<never>({
      initialValue: opts.zoom ?? 0,
      domain: opts.zoomRange,
    });

    this.time.on('change', () => this.changed());
    this.time.on('valuechanging', (e) => this.dispatchEvent(new TimescopeEvent('timechanging', e.value)));
    this.time.on('valuechanged', (e) => this.dispatchEvent(new TimescopeEvent('timechanged', e.value)));
    this.time.on('valueanimating', (e) => this.dispatchEvent(new TimescopeEvent('timeanimating', e.value)));

    this.zoom.on('change', () => this.changed());
    this.zoom.on('valuechanging', (e) => this.dispatchEvent(new TimescopeEvent('zoomchanging', e.value.number())));
    this.zoom.on('valuechanged', (e) => this.dispatchEvent(new TimescopeEvent('zoomchanged', e.value.number())));
    this.zoom.on('valueanimating', (e) => this.dispatchEvent(new TimescopeEvent('zoomanimating', e.value.number())));
  }

  setTime(v: TimeLike | null, animation?: TimescopeAnimationInput) {
    if (typeof v === 'number' && !isFinite(v)) return false;
    if (typeof v === 'number' && isNaN(v)) return false;

    if (animation == null) animation = 'out';

    try {
      this.time.setValue(parseTimeLike(v), animation);
    } catch {
      return false;
    }
    return true;
  }

  setTimeRange(domain?: TimescopeRange<TimeLike | null | undefined>) {
    this.time.domain = parseTimeDomainLike(domain ?? [undefined, null]);
  }

  setPlaybackTime(t: TimeLike<null>) {
    this.time.setNullValue(parseTimeLike(t));
  }

  setZoom(v: ZoomLike, animation?: TimescopeAnimationInput) {
    if (typeof v === 'number' && !isFinite(v)) return false;
    if (typeof v === 'number' && isNaN(v)) return false;

    if (animation == null) {
      animation = {
        animation: 'linear',
        duration: 200,
        lazy: this.zoom.value.lt(v),
      };
    }

    try {
      this.zoom.setValue(Decimal(v), animation);
    } catch {
      return false;
    }
    return true;
  }

  setZoomRange(domain?: TimescopeRange<ZoomLike | undefined>) {
    this.zoom.domain = (domain ?? [undefined, undefined]).map(Decimal) as TimescopeRange<Decimal | undefined>;
  }

  get now() {
    return this.time.nullValue;
  }
}
