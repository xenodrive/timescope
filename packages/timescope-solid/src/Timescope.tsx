import { createEffect, onCleanup } from 'solid-js';
import { Decimal, Timescope, TimescopeRange } from 'timescope';

type TimescopeProps = {
  time?: Decimal | null;
  zoom?: number;
  selectedRange?: [Decimal, Decimal] | null;
  onTimeAnimating?: (v: Decimal | null) => void;
  onTimeChanging?: (v: Decimal | null) => void;
  onTimeChanged?: (v: Decimal | null) => void;
  onZoomAnimating?: (v: number) => void;
  onZoomChanging?: (v: number) => void;
  onZoomChanged?: (v: number) => void;
  onSelectedRangeChanging?: (v: TimescopeRange<Decimal> | null) => void;
  onSelectedRangeChanged?: (v: TimescopeRange<Decimal> | null) => void;
  style?: any;
  class?: any;
};

function TimescopeComponent(props: TimescopeProps) {
  const timescope = new Timescope({
    // eslint-disable-next-line solid/reactivity
    time: props.time ?? null,
    // eslint-disable-next-line solid/reactivity
    zoom: props.zoom ?? 0,
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

    onCleanup(() => {
      for (const un of uns) un();
    });
  });

  createEffect(() => {
    if (props.time !== undefined) timescope.setTime(props.time);
  });
  createEffect(() => {
    if (props.zoom !== undefined) timescope.setZoom(props.zoom);
  });
  createEffect(() => {
    if (props.selectedRange !== undefined) timescope.setSelectedRange(props.selectedRange);
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
