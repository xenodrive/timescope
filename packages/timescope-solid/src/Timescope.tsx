import type { Decimal } from '@kikuchan/decimal';
import { createEffect, onCleanup, untrack } from 'solid-js';
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

type TimescopeProps<
  Sources extends Record<string, TimescopeSourceInput>,
  Series extends Record<string, TimescopeSeriesInput>,
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

  sources?: TimescopeOptionsSources<Sources>;
  series?: TimescopeOptionsSeries<Sources, Series, Track>;
  tracks?: TimescopeOptionsTracks<Track>;

  cursor?: TimescopeOptions['cursor'];
  selection?: TimescopeOptionsSelection;

  selectionRange?: TimescopeRange<Decimal> | null;

  showFps?: boolean;
  renderThread?: TimescopeOptions['renderThread'];

  fonts?: TimescopeOptionsInitial<Sources, Series, Track>['fonts'];

  onTimeAnimating?: (v: Decimal | null) => void;
  onTimeChanging?: (v: Decimal | null) => void;
  onTimeChanged?: (v: Decimal | null) => void;
  onZoomAnimating?: (v: number) => void;
  onZoomChanging?: (v: number) => void;
  onZoomChanged?: (v: number) => void;
  onSelectionRangeChanging?: (v: TimescopeRange<Decimal> | null) => void;
  onSelectionRangeChanged?: (v: TimescopeRange<Decimal> | null) => void;
  onAnimating?: (v: boolean) => void;
  onEditing?: (v: boolean) => void;
  style?: any;
  class?: any;
};

function TimescopeComponent<
  Sources extends Record<string, TimescopeSourceInput>,
  Series extends Record<string, TimescopeSeriesInput>,
  Track extends string,
>(props: TimescopeProps<Sources, Series, Track>) {
  const timescope = new Timescope<Sources, Series, Track>({
    renderThread: untrack(() => props.renderThread),
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
    const onSelectionRangeChanging = props.onSelectionRangeChanging;
    const onSelectionRangeChanged = props.onSelectionRangeChanged;
    const onAnimating = props.onAnimating;
    const onEditing = props.onEditing;

    const uns = [
      timescope.on('timeanimating', (e) => onTimeAnimating?.(e.value)),
      timescope.on('timechanging', (e) => onTimeChanging?.(e.value)),
      timescope.on('timechanged', (e) => onTimeChanged?.(e.value)),
      timescope.on('zoomanimating', (e) => onZoomAnimating?.(e.value)),
      timescope.on('zoomchanging', (e) => onZoomChanging?.(e.value)),
      timescope.on('zoomchanged', (e) => onZoomChanged?.(e.value)),
      timescope.on('selectionrangechanging', (e) => onSelectionRangeChanging?.(e.value)),
      timescope.on('selectionrangechanged', (e) => onSelectionRangeChanged?.(e.value)),
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
    if (props.selectionRange !== undefined) timescope.setSelectionRange(props.selectionRange);
  });
  createEffect(() => {
    timescope.updateOptions({
      style: { width: props.width ?? '100%', height: props.height ?? '36px', background: props.background },
    });
  });
  createEffect(() => {
    timescope.updateOptions({ sources: props.sources });
  });
  createEffect(() => {
    timescope.updateOptions({ series: props.series });
  });
  createEffect(() => {
    timescope.updateOptions({ tracks: props.tracks });
  });
  createEffect(() => {
    timescope.updateOptions({ cursor: props.cursor ?? true });
  });
  createEffect(() => {
    timescope.updateOptions({ selection: props.selection });
  });
  createEffect(() => {
    timescope.updateOptions({ showFps: props.showFps, renderThread: props.renderThread });
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
