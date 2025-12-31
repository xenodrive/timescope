import { createEffect, onCleanup, untrack } from 'solid-js';
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
import type { Decimal } from '@kikuchan/decimal';

type TimescopeProps<
  Source extends Record<string, TimescopeSourceInput>,
  SourceName extends Record<string, keyof Source>,
  TimeDef extends Record<string, FieldDefLike<TimescopeTimeLike<never>>>,
  ValueDef extends Record<string, FieldDefLike<TimescopeNumberLike | null>>,
  Track extends string,
> = {
  width?: string;
  height?: string;
  background?: string;

  time?: Decimal | number | null | string | Date;
  timeRange?: [
    Decimal | number | null | string | Date | undefined,
    Decimal | number | null | string | Date | undefined,
  ];
  zoom?: number;
  zoomRange?: [number | undefined, number | undefined];

  sources?: TimescopeOptionsSources<Source>;
  series?: TimescopeOptionsSeries<Source, SourceName, TimeDef, ValueDef, Track>;
  tracks?: TimescopeOptionsTracks<Track>;

  indicator?: boolean;
  selection?: TimescopeOptionsSelection;

  selectedRange?: TimescopeRange<Decimal> | null;

  showFps?: boolean;

  fonts?: TimescopeOptionsInitial<Source, SourceName, TimeDef, ValueDef, Track>['fonts'];

  onTimeAnimating?: (v: Decimal | null) => void;
  onTimeChanging?: (v: Decimal | null) => void;
  onTimeChanged?: (v: Decimal | null) => void;
  onZoomAnimating?: (v: number) => void;
  onZoomChanging?: (v: number) => void;
  onZoomChanged?: (v: number) => void;
  onSelectedRangeChanging?: (v: TimescopeRange<Decimal> | null) => void;
  onSelectedRangeChanged?: (v: TimescopeRange<Decimal> | null) => void;
  onAnimating?: (v: boolean) => void;
  onEditing?: (v: boolean) => void;
  style?: any;
  class?: any;
};

function TimescopeComponent<
  Source extends Record<string, TimescopeSourceInput>,
  SourceName extends Record<string, keyof Source>,
  TimeDef extends Record<string, FieldDefLike<TimescopeTimeLike<never>>>,
  ValueDef extends Record<string, FieldDefLike<TimescopeNumberLike | null>>,
  Track extends string,
>(props: TimescopeProps<Source, SourceName, TimeDef, ValueDef, Track>) {
  const timescope = new Timescope({
    time: untrack(() => props.time ?? null),
    timeRange: untrack(() => props.timeRange),
    zoom: untrack(() => props.zoom ?? 0),
    zoomRange: untrack(() => props.zoomRange),
    fonts: untrack(() => props.fonts),
  });

  createEffect(() => {
    const onTimeAnimating = props.onTimeAnimating;
    const onTimeChanging = props.onTimeChanging;
    const onTimeChanged = props.onTimeChanged;
    const onZoomAnimating = props.onZoomAnimating;
    const onZoomChanging = props.onZoomChanging;
    const onZoomChanged = props.onZoomChanged;
    const onSelectedRangeChanging = props.onSelectedRangeChanging;
    const onSelectedRangeChanged = props.onSelectedRangeChanged;
    const onAnimating = props.onAnimating;
    const onEditing = props.onEditing;

    const uns = [
      timescope.on('timeanimating', (e) => onTimeAnimating?.(e.value)),
      timescope.on('timechanging', (e) => onTimeChanging?.(e.value)),
      timescope.on('timechanged', (e) => onTimeChanged?.(e.value)),
      timescope.on('zoomanimating', (e) => onZoomAnimating?.(e.value)),
      timescope.on('zoomchanging', (e) => onZoomChanging?.(e.value)),
      timescope.on('zoomchanged', (e) => onZoomChanged?.(e.value)),
      timescope.on('selectedrangechanging', (e) => onSelectedRangeChanging?.(e.value)),
      timescope.on('selectedrangechanged', (e) => onSelectedRangeChanged?.(e.value)),
    ];

    let animating = timescope.animating;
    let editing = timescope.editing;
    uns.push(
      timescope.on('change', () => {
        if (timescope.animating !== animating) {
          animating = timescope.animating;
          onAnimating?.(animating);
        }
        if (timescope.editing !== editing) {
          editing = timescope.editing;
          onEditing?.(editing);
        }
      }),
    );

    onCleanup(() => {
      for (const un of uns) un();
    });
  });

  createEffect(() => {
    if (props.time !== undefined) timescope.setTime(props.time);
  });
  createEffect(() => {
    timescope.setTimeRange(props.timeRange);
  });
  createEffect(() => {
    if (props.zoom !== undefined) timescope.setZoom(props.zoom);
  });
  createEffect(() => {
    timescope.setZoomRange(props.zoomRange);
  });
  createEffect(() => {
    if (props.selectedRange !== undefined) timescope.setSelectedRange(props.selectedRange);
  });
  createEffect(() => {
    timescope.updateOptions({
      style: { width: props.width ?? '100%', height: props.height ?? '36px', background: props.background },
    });
  });
  createEffect(() => {
    timescope.updateOptions({ sources: props.sources } as TimescopeOptions);
  });
  createEffect(() => {
    timescope.updateOptions({ series: props.series } as TimescopeOptions);
  });
  createEffect(() => {
    timescope.updateOptions({ tracks: props.tracks } as TimescopeOptions);
  });
  createEffect(() => {
    timescope.updateOptions({ indicator: props.indicator ?? true } as TimescopeOptions);
  });
  createEffect(() => {
    timescope.updateOptions({ selection: props.selection } as TimescopeOptions);
  });
  createEffect(() => {
    timescope.updateOptions({ showFps: props.showFps } as TimescopeOptions);
  });

  onCleanup(() => {
    timescope.dispose();
  });

  return (
    <div
      class={props.class}
      style={props.style}
      ref={(e) => {
        timescope.unmount();
        if (e) timescope.mount(e);
      }}
    />
  );
}

export { TimescopeComponent as default, TimescopeComponent as Timescope };
