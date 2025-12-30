import { Accessor, effect, onCleanup } from '@luna_ui/luna';
import { Decimal, Timescope, TimescopeRange } from 'timescope';

type TimescopeProps = {
  time?: Accessor<Decimal | null>;
  zoom?: Accessor<number>;
  selectedRange?: Accessor<[Decimal, Decimal] | null>;

  onTimeAnimating?: (v: Decimal | null) => void;
  onTimeChanging?: (v: Decimal | null) => void;
  onTimeChanged?: (v: Decimal | null) => void;
  onZoomAnimating?: (v: number) => void;
  onZoomChanging?: (v: number) => void;
  onZoomChanged?: (v: number) => void;
  onSelectedRangeChanging?: (v: TimescopeRange<Decimal> | null) => void;
  onSelectedRangeChanged?: (v: TimescopeRange<Decimal> | null) => void;
};

function TimescopeComponent({
  time,
  zoom,
  selectedRange,
  onTimeAnimating,
  onTimeChanging,
  onTimeChanged,
  onZoomAnimating,
  onZoomChanging,
  onZoomChanged,
  onSelectedRangeChanging,
  onSelectedRangeChanged,
}: TimescopeProps) {
  const timescope = new Timescope({
    time: time?.(),
    zoom: zoom?.() ?? 0,
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
    if (time) timescope.setTime(time());
  });
  effect(() => {
    if (zoom) timescope.setZoom(zoom());
  });
  effect(() => {
    if (selectedRange) timescope.setSelectedRange(selectedRange());
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
