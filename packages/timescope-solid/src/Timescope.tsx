import type { Decimal } from '@kikuchan/decimal';
import { createEffect, onCleanup, untrack } from 'solid-js';
import {
  Timescope,
  TimescopeOptions,
  TimescopeOptionsInitial,
  TimescopeRange,
  TimescopeSeriesInput,
  TimescopeSourceInput,
} from 'timescope';

type TimescopeProps<
  Sources extends Record<string, TimescopeSourceInput>,
  Series extends Record<string, TimescopeSeriesInput>,
  Track extends string,
> = {
  options?: TimescopeOptions<Sources, Series, Track>;
  time?: Decimal | number | null | string | Date;
  timeRange?: [
    Decimal | number | null | string | Date | undefined,
    Decimal | number | null | string | Date | undefined,
  ];
  zoom?: number;
  zoomRange?: [number | undefined, number | undefined];
  initialTime?: Decimal | number | null | string | Date;
  initialZoom?: number;
  initialFit?: Extract<TimescopeOptionsInitial<Sources, Series, Track>, { fit: unknown }>['fit'];

  selectionRange?: TimescopeRange<Decimal> | null;

  renderThread?: TimescopeOptionsInitial<Sources, Series, Track>['renderThread'];

  fonts?: TimescopeOptionsInitial<Sources, Series, Track>['fonts'];

  onReady?: () => void;
  onMount?: () => void;
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
  const initial = untrack(() => ({
    options: props.options,
    time: props.time,
    zoom: props.zoom,
    initialTime: props.initialTime,
    initialZoom: props.initialZoom,
    initialFit: props.initialFit,
    timeRange: props.timeRange,
    zoomRange: props.zoomRange,
    selectionRange: props.selectionRange,
    renderThread: props.renderThread,
    fonts: props.fonts,
  }));
  const useFit = initial.initialFit !== undefined && initial.time === undefined && initial.zoom === undefined;
  if (initial.initialFit !== undefined && (initial.initialTime !== undefined || initial.initialZoom !== undefined)) {
    throw new TypeError('initialFit cannot be combined with initialTime or initialZoom');
  }
  const timescope = new Timescope<Sources, Series, Track>({
    ...initial.options,
    renderThread: initial.renderThread,
    ...(useFit
      ? { fit: initial.initialFit }
      : {
          time: initial.time !== undefined ? initial.time : (initial.initialTime ?? null),
          zoom: initial.zoom ?? initial.initialZoom ?? 0,
        }),
    timeRange: initial.timeRange,
    zoomRange: initial.zoomRange,
    fonts: initial.fonts,
    selection:
      initial.selectionRange === undefined || initial.options?.selection === false
        ? initial.options?.selection
        : {
            ...(typeof initial.options?.selection === 'object' ? initial.options.selection : {}),
            range: initial.selectionRange,
          },
  });

  let initialNotified = false;
  createEffect(() => {
    const onTimeChanged = props.onTimeChanged;
    const onZoomChanged = props.onZoomChanged;
    if (initialNotified) return;
    initialNotified = true;
    if (!useFit) {
      if (initial.time === undefined) onTimeChanged?.(timescope.time);
      if (initial.zoom === undefined) onZoomChanged?.(timescope.zoom);
    }
  });

  createEffect(() => {
    const onReady = props.onReady;
    const onMount = props.onMount;
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
      timescope.on('ready', () => onReady?.()),
      timescope.on('mount', () => onMount?.()),
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
  let optionsInitialized = false;
  createEffect(() => {
    const options = props.options;
    if (!optionsInitialized) {
      optionsInitialized = true;
      return;
    }
    timescope.setOptions(options ?? {});
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
