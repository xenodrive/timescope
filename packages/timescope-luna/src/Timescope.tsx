import { Decimal } from '@kikuchan/decimal';
import { Accessor, effect, onCleanup } from '@luna_ui/luna';
import {
  FieldDefLike,
  Timescope,
  TimescopeNumberLike,
  TimescopeOptions,
  TimescopeOptionsInitial,
  TimescopeOptionsSelection,
  TimescopeOptionsSeries,
  TimescopeOptionsSources,
  TimescopeOptionsTracks,
  TimescopeRange,
  TimescopeSourceInput,
  TimescopeTimeLike,
} from 'timescope';

type MaybeAccessor<T> = (() => T) | T;

type TimescopeProps<
  Source extends Record<string, TimescopeSourceInput>,
  SourceName extends Record<string, keyof Source>,
  TimeDef extends Record<string, FieldDefLike<TimescopeTimeLike<never>>>,
  ValueDef extends Record<string, FieldDefLike<TimescopeNumberLike | null>>,
  Track extends string,
> = {
  width?: MaybeAccessor<string | undefined>;
  height?: MaybeAccessor<string | undefined>;
  background?: MaybeAccessor<string>;

  time?: MaybeAccessor<Decimal | number | null | string | Date | undefined>;
  timeRange?: MaybeAccessor<
    | [Decimal | number | null | string | Date | undefined, Decimal | number | null | string | Date | undefined]
    | undefined
  >;
  zoom?: MaybeAccessor<number | undefined>;
  zoomRange?: MaybeAccessor<[number | undefined, number | undefined] | undefined>;

  sources?: MaybeAccessor<TimescopeOptionsSources<Source> | undefined>;
  series?: MaybeAccessor<TimescopeOptionsSeries<Source, SourceName, TimeDef, ValueDef, Track> | undefined>;
  tracks?: MaybeAccessor<TimescopeOptionsTracks<Track> | undefined>;

  indicator?: MaybeAccessor<boolean | undefined>;
  selection?: MaybeAccessor<TimescopeOptionsSelection | undefined>;

  selectedRange?: MaybeAccessor<TimescopeRange<Decimal> | null | undefined>;

  showFps?: MaybeAccessor<boolean | undefined>;

  fonts?: MaybeAccessor<TimescopeOptionsInitial<Source, SourceName, TimeDef, ValueDef, Track>['fonts'] | undefined>;

  onTimeAnimating?: (v: Decimal | null) => void;
  onTimeChanging?: (v: Decimal | null) => void;
  onTimeChanged?: (v: Decimal | null) => void;
  onZoomAnimating?: (v: number) => void;
  onZoomChanging?: (v: number) => void;
  onZoomChanged?: (v: number) => void;
  onSelectedRangeChanging?: (v: TimescopeRange<Decimal> | null) => void;
  onSelectedRangeChanged?: (v: TimescopeRange<Decimal> | null) => void;
  onEditing?: (v: boolean) => void;
  onAnimating?: (v: boolean) => void;
};

type NormalizedProp<T> = T extends MaybeAccessor<infer A> ? Accessor<A> : T & Accessor<unknown>;
type NormalizedProps<T> = {
  [K in keyof T]: NormalizedProp<T[K]>;
};

function normalizeProps<T extends object>(props: T): NormalizedProps<T> {
  return Object.fromEntries(
    Object.entries(props).map(([k, v]) => [k, typeof v === 'function' ? v : v == null ? v : () => v]),
  ) as NormalizedProps<T>;
}

function TimescopeComponent<
  Source extends Record<string, TimescopeSourceInput>,
  SourceName extends Record<string, keyof Source>,
  TimeDef extends Record<string, FieldDefLike<TimescopeTimeLike<never>>>,
  ValueDef extends Record<string, FieldDefLike<TimescopeNumberLike | null>>,
  Track extends string,
>(props_: TimescopeProps<Source, SourceName, TimeDef, ValueDef, Track>) {
  const props = normalizeProps(props_);
  const timescope = new Timescope({
    time: props.time?.() ?? null,
    timeRange: props.timeRange?.(),
    zoom: props.zoom?.() ?? 0,
    zoomRange: props.zoomRange?.(),
    fonts: props.fonts?.(),
  });

  timescope.on('timeanimating', (e) => props.onTimeAnimating?.(e.value));
  timescope.on('timechanging', (e) => props.onTimeChanging?.(e.value));
  timescope.on('timechanged', (e) => props.onTimeChanged?.(e.value));
  timescope.on('zoomanimating', (e) => props.onZoomAnimating?.(e.value));
  timescope.on('zoomchanging', (e) => props.onZoomChanging?.(e.value));
  timescope.on('zoomchanged', (e) => props.onZoomChanged?.(e.value));
  timescope.on('selectedrangechanging', (e) => props.onSelectedRangeChanging?.(e.value));
  timescope.on('selectedrangechanged', (e) => props.onSelectedRangeChanged?.(e.value));

  let animating = false;
  let editing = false;
  timescope.on('change', () => {
    if (timescope.animating != animating) props.onAnimating?.(timescope.animating);
    animating = timescope.animating;
  });
  timescope.on('change', () => {
    if (timescope.editing != editing) props.onEditing?.(timescope.editing);
    editing = timescope.editing;
  });

  effect(() => {
    if (props.time) timescope.setTime(props.time() ?? null);
  });
  effect(() => {
    timescope.setTimeRange(props.timeRange?.());
  });
  effect(() => {
    if (props.zoom) timescope.setZoom(props.zoom() ?? 0);
  });
  effect(() => {
    timescope.setZoomRange(props.zoomRange?.());
  });
  effect(() => {
    if (props.selectedRange) timescope.setSelectedRange(props.selectedRange() ?? null);
  });
  effect(() => {
    timescope.updateOptions({
      style: { width: props.width?.() ?? '100%', height: props.height?.() ?? '36px', background: props.background?.() },
    });
  });
  effect(() => {
    timescope.updateOptions({ sources: props.sources?.() } as TimescopeOptions);
  });
  effect(() => {
    timescope.updateOptions({ series: props.series?.() } as TimescopeOptions);
  });
  effect(() => {
    timescope.updateOptions({ tracks: props.tracks?.() } as TimescopeOptions);
  });
  effect(() => {
    timescope.updateOptions({ indicator: props.indicator?.() ?? true } as TimescopeOptions);
  });
  effect(() => {
    timescope.updateOptions({ selection: props.selection?.() } as TimescopeOptions);
  });
  effect(() => {
    timescope.updateOptions({ showFps: props.showFps?.() } as TimescopeOptions);
  });

  onCleanup(() => {
    timescope.dispose();
  });

  return (
    <div
      id="timescope"
      ref={(e) => {
        timescope.unmount();
        if (e) timescope.mount(e);
      }}></div>
  );
}

export { TimescopeComponent as default, TimescopeComponent as Timescope };
