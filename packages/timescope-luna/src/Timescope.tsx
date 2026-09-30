import { Decimal } from '@kikuchan/decimal';
import { effect, onCleanup } from '@luna_ui/luna';
import {
  Timescope,
  TimescopeOptions,
  TimescopeOptionsInitial,
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
  options?: MaybeAccessor<TimescopeOptions<Sources, Series, Track> | undefined>;
  style?: MaybeAccessor<string | undefined>;
  class?: MaybeAccessor<string | undefined>;
  time?: MaybeAccessor<Decimal | number | null | string | Date | undefined>;
  timeRange?: MaybeAccessor<
    | [Decimal | number | null | string | Date | undefined, Decimal | number | null | string | Date | undefined]
    | undefined
  >;
  zoom?: MaybeAccessor<number | undefined>;
  zoomRange?: MaybeAccessor<[number | undefined, number | undefined] | undefined>;
  initialTime?: MaybeAccessor<Decimal | number | null | string | Date | undefined>;
  initialZoom?: MaybeAccessor<number | undefined>;
  initialFit?: MaybeAccessor<
    Extract<TimescopeOptionsInitial<Sources, Series, Track>, { fit: unknown }>['fit'] | undefined
  >;

  selectionRange?: MaybeAccessor<TimescopeRange<Decimal> | null | undefined>;

  renderThread?: MaybeAccessor<TimescopeOptionsInitial<Sources, Series, Track>['renderThread']>;

  fonts?: MaybeAccessor<TimescopeOptionsInitial<Sources, Series, Track>['fonts'] | undefined>;

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
  onEditing?: (v: boolean) => void;
  onAnimating?: (v: boolean) => void;
};

function readProp<T>(prop: MaybeAccessor<T> | undefined): T | undefined {
  return typeof prop === 'function' ? (prop as () => T)() : prop;
}

function TimescopeComponent<
  Sources extends Record<string, TimescopeSourceInput>,
  Series extends Record<string, TimescopeSeriesInput>,
  Track extends string,
>(props_: TimescopeProps<Sources, Series, Track>) {
  const props = props_;
  const initialOptions = readProp(props.options);
  const initialTime = readProp(props.time);
  const initialZoom = readProp(props.zoom);
  const initialFit = readProp(props.initialFit);
  const initialSelectionRange = readProp(props.selectionRange);
  const useFit = initialFit !== undefined && initialTime === undefined && initialZoom === undefined;
  if (
    initialFit !== undefined &&
    (readProp(props.initialTime) !== undefined || readProp(props.initialZoom) !== undefined)
  ) {
    throw new TypeError('initialFit cannot be combined with initialTime or initialZoom');
  }
  const timescope = new Timescope<Sources, Series, Track>({
    ...initialOptions,
    renderThread: readProp(props.renderThread),
    ...(useFit
      ? { fit: initialFit }
      : {
          time: initialTime !== undefined ? initialTime : (readProp(props.initialTime) ?? null),
          zoom: initialZoom ?? readProp(props.initialZoom) ?? 0,
        }),
    timeRange: readProp(props.timeRange),
    zoomRange: readProp(props.zoomRange),
    fonts: readProp(props.fonts),
    selection:
      initialSelectionRange === undefined || initialOptions?.selection === false
        ? initialOptions?.selection
        : {
            ...(typeof initialOptions?.selection === 'object' ? initialOptions.selection : {}),
            range: initialSelectionRange,
          },
  });

  timescope.on('ready', () => props.onReady?.());
  timescope.on('mount', () => props.onMount?.());
  timescope.on('timeanimating', (e) => props.onTimeAnimating?.(e.value));
  timescope.on('timechanging', (e) => props.onTimeChanging?.(e.value));
  timescope.on('timechanged', (e) => props.onTimeChanged?.(e.value));
  timescope.on('zoomanimating', (e) => props.onZoomAnimating?.(e.value));
  timescope.on('zoomchanging', (e) => props.onZoomChanging?.(e.value));
  timescope.on('zoomchanged', (e) => props.onZoomChanged?.(e.value));
  timescope.on('selectionrangechanging', (e) => props.onSelectionRangeChanging?.(e.value));
  timescope.on('selectionrangechanged', (e) => props.onSelectionRangeChanged?.(e.value));

  if (!useFit) {
    if (initialTime === undefined) props.onTimeChanged?.(timescope.time);
    if (initialZoom === undefined) props.onZoomChanged?.(timescope.zoom);
  }

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
    const time = readProp(props.time);
    if (time !== undefined) timescope.setTime(time);
  });
  effect(() => {
    timescope.setTimeRange(readProp(props.timeRange));
  });
  effect(() => {
    const zoom = readProp(props.zoom);
    if (zoom !== undefined) timescope.setZoom(zoom);
  });
  effect(() => {
    timescope.setZoomRange(readProp(props.zoomRange));
  });
  effect(() => {
    if (props.selectionRange !== undefined) timescope.setSelectionRange(readProp(props.selectionRange) ?? null);
  });
  let optionsInitialized = false;
  effect(() => {
    const options = readProp(props.options);
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
      id="timescope"
      style={() => readProp(props.style) ?? ''}
      class={() => readProp(props.class) ?? ''}
      ref={(e) => {
        timescope.unmount();
        if (e) timescope.mount(e);
      }}></div>
  );
}

export { TimescopeComponent as default, TimescopeComponent as Timescope };
