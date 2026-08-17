import { Decimal } from '@kikuchan/decimal';
import { Accessor, effect, onCleanup } from '@luna_ui/luna';
import {
  Timescope,
  TimescopeOptions,
  TimescopeOptionsInitial,
  TimescopeOptionsSelection,
  TimescopeOptionsSeries,
  TimescopeOptionsSources,
  TimescopeOptionsTracks,
  TimescopeRange,
  TimescopeSeriesInput,
  TimescopeSourceInput,
} from 'timescope';

type MaybeAccessor<T> = (() => T) | T;

type TimescopeProps<
  Sources extends Record<string, TimescopeSourceInput>,
  Series extends Record<string, TimescopeSeriesInput>,
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

  sources?: MaybeAccessor<TimescopeOptionsSources<Sources> | undefined>;
  series?: MaybeAccessor<TimescopeOptionsSeries<Sources, Series, Track> | undefined>;
  tracks?: MaybeAccessor<TimescopeOptionsTracks<Track> | undefined>;

  indicator?: MaybeAccessor<boolean | undefined>;
  selection?: MaybeAccessor<TimescopeOptionsSelection | undefined>;

  selectionRange?: MaybeAccessor<TimescopeRange<Decimal> | null | undefined>;

  showFps?: MaybeAccessor<boolean | undefined>;

  fonts?: MaybeAccessor<TimescopeOptionsInitial<Sources, Series, Track>['fonts'] | undefined>;

  onTimeAnimating?: (v: Decimal | null) => void;
  onTimeChanging?: (v: Decimal | null) => void;
  onTimeChanged?: (v: Decimal | null) => void;
  onZoomAnimating?: (v: number) => void;
  onZoomChanging?: (v: number) => void;
  onZoomChanged?: (v: number) => void;
  onSelectionRangeChanging?: (v: TimescopeRange<Decimal> | null) => void;
  onSelectionRangeChanged?: (v: TimescopeRange<Decimal> | null) => void;
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
  Sources extends Record<string, TimescopeSourceInput>,
  Series extends Record<string, TimescopeSeriesInput>,
  Track extends string,
>(props_: TimescopeProps<Sources, Series, Track>) {
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
  timescope.on('selectionrangechanging', (e) => props.onSelectionRangeChanging?.(e.value));
  timescope.on('selectionrangechanged', (e) => props.onSelectionRangeChanged?.(e.value));

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
    if (props.selectionRange) timescope.setSelectionRange(props.selectionRange() ?? null);
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
