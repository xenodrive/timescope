import { Accessor, effect, onCleanup } from '@luna_ui/luna';
import {
  Decimal,
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

type TimescopeProps<
  Source extends Record<string, TimescopeSourceInput>,
  SourceName extends Record<string, keyof Source>,
  TimeDef extends Record<string, FieldDefLike<TimescopeTimeLike<never>>>,
  ValueDef extends Record<string, FieldDefLike<TimescopeNumberLike | null>>,
  Track extends string,
> = {
  width?: Accessor<string | undefined>;
  height?: Accessor<string | undefined>;

  time?: Accessor<Decimal | number | null | string | Date | undefined>;
  timeRange?: Accessor<
    | [Decimal | number | null | string | Date | undefined, Decimal | number | null | string | Date | undefined]
    | undefined
  >;
  zoom?: Accessor<number | undefined>;
  zoomRange?: Accessor<[number | undefined, number | undefined] | undefined>;

  sources?: Accessor<TimescopeOptionsSources<Source> | undefined>;
  series?: Accessor<TimescopeOptionsSeries<Source, SourceName, TimeDef, ValueDef, Track> | undefined>;
  tracks?: Accessor<TimescopeOptionsTracks<Track> | undefined>;

  indicator?: Accessor<boolean | undefined>;
  selection?: Accessor<TimescopeOptionsSelection | undefined>;

  selectedRange?: Accessor<TimescopeRange<Decimal> | null | undefined>;

  showFps?: Accessor<boolean | undefined>;

  fonts?: Accessor<TimescopeOptionsInitial<Source, SourceName, TimeDef, ValueDef, Track>['fonts'] | undefined>;

  onTimeAnimating?: (v: Decimal | null) => void;
  onTimeChanging?: (v: Decimal | null) => void;
  onTimeChanged?: (v: Decimal | null) => void;
  onZoomAnimating?: (v: number) => void;
  onZoomChanging?: (v: number) => void;
  onZoomChanged?: (v: number) => void;
  onSelectedRangeChanging?: (v: TimescopeRange<Decimal> | null) => void;
  onSelectedRangeChanged?: (v: TimescopeRange<Decimal> | null) => void;
};

function TimescopeComponent<
  Source extends Record<string, TimescopeSourceInput>,
  SourceName extends Record<string, keyof Source>,
  TimeDef extends Record<string, FieldDefLike<TimescopeTimeLike<never>>>,
  ValueDef extends Record<string, FieldDefLike<TimescopeNumberLike | null>>,
  Track extends string,
>({
  width,
  height,
  time,
  timeRange,
  zoom,
  zoomRange,
  sources,
  series,
  tracks,
  indicator,
  selection,
  selectedRange,
  showFps,
  fonts,
  onTimeAnimating,
  onTimeChanging,
  onTimeChanged,
  onZoomAnimating,
  onZoomChanging,
  onZoomChanged,
  onSelectedRangeChanging,
  onSelectedRangeChanged,
}: TimescopeProps<Source, SourceName, TimeDef, ValueDef, Track>) {
  const timescope = new Timescope({
    time: time?.() ?? null,
    timeRange: timeRange?.(),
    zoom: zoom?.() ?? 0,
    zoomRange: zoomRange?.(),
    fonts: fonts?.(),
  });

  timescope.on('timeanimating', (e) => onTimeAnimating?.(e.value));
  timescope.on('timechanging', (e) => onTimeChanging?.(e.value));
  timescope.on('timechanged', (e) => onTimeChanged?.(e.value));
  timescope.on('zoomanimating', (e) => onZoomAnimating?.(e.value));
  timescope.on('zoomchanging', (e) => onZoomChanging?.(e.value));
  timescope.on('zoomchanged', (e) => onZoomChanged?.(e.value));
  timescope.on('selectedrangechanging', (e) => onSelectedRangeChanging?.(e.value));
  timescope.on('selectedrangechanged', (e) => onSelectedRangeChanged?.(e.value));

  effect(() => {
    if (time) timescope.setTime(time() ?? null);
  });
  effect(() => {
    timescope.setTimeRange(timeRange?.());
  });
  effect(() => {
    if (zoom) timescope.setZoom(zoom() ?? 0);
  });
  effect(() => {
    timescope.setZoomRange(zoomRange?.());
  });
  effect(() => {
    if (selectedRange) timescope.setSelectedRange(selectedRange() ?? null);
  });
  effect(() => {
    timescope.updateOptions({
      style: { width: width?.() ?? '100%', height: height?.() ?? '36px' },
    });
  });
  effect(() => {
    timescope.updateOptions({ sources: sources?.() } as TimescopeOptions);
  });
  effect(() => {
    timescope.updateOptions({ series: series?.() } as TimescopeOptions);
  });
  effect(() => {
    timescope.updateOptions({ tracks: tracks?.() } as TimescopeOptions);
  });
  effect(() => {
    timescope.updateOptions({ indicator: indicator?.() ?? true } as TimescopeOptions);
  });
  effect(() => {
    timescope.updateOptions({ selection: selection?.() } as TimescopeOptions);
  });
  effect(() => {
    timescope.updateOptions({ showFps: showFps?.() } as TimescopeOptions);
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
