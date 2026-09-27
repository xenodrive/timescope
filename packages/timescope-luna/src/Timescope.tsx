import { Decimal } from '@kikuchan/decimal';
import { effect, onCleanup } from '@luna_ui/luna';
import {
  Timescope,
  TimescopeOptions,
  TimescopeOptionsDomains,
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
  domains?: MaybeAccessor<TimescopeOptionsDomains | undefined>;

  cursor?: MaybeAccessor<TimescopeOptions['cursor']>;
  selection?: MaybeAccessor<TimescopeOptionsSelection | undefined>;

  selectionRange?: MaybeAccessor<TimescopeRange<Decimal> | null | undefined>;

  showFps?: MaybeAccessor<boolean | undefined>;
  renderThread?: MaybeAccessor<TimescopeOptions['renderThread']>;

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

function readProp<T>(prop: MaybeAccessor<T> | undefined): T | undefined {
  return typeof prop === 'function' ? (prop as () => T)() : prop;
}

function TimescopeComponent<
  Sources extends Record<string, TimescopeSourceInput>,
  Series extends Record<string, TimescopeSeriesInput>,
  Track extends string,
>(props_: TimescopeProps<Sources, Series, Track>) {
  const props = props_;
  const timescope = new Timescope<Sources, Series, Track>({
    renderThread: readProp(props.renderThread),
    time: readProp(props.time) ?? null,
    timeRange: readProp(props.timeRange),
    zoom: readProp(props.zoom) ?? 0,
    zoomRange: readProp(props.zoomRange),
    fonts: readProp(props.fonts),
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
    if (props.time !== undefined) timescope.setTime(readProp(props.time) ?? null);
  });
  effect(() => {
    timescope.setTimeRange(readProp(props.timeRange));
  });
  effect(() => {
    if (props.zoom !== undefined) timescope.setZoom(readProp(props.zoom) ?? 0);
  });
  effect(() => {
    timescope.setZoomRange(readProp(props.zoomRange));
  });
  effect(() => {
    if (props.selectionRange !== undefined) timescope.setSelectionRange(readProp(props.selectionRange) ?? null);
  });
  effect(() => {
    timescope.updateOptions({
      style: {
        width: readProp(props.width) ?? '100%',
        height: readProp(props.height) ?? '36px',
        background: readProp(props.background),
      },
    });
  });
  effect(() => {
    timescope.updateOptions({ sources: readProp(props.sources) });
  });
  effect(() => {
    timescope.updateOptions({ series: readProp(props.series) });
  });
  effect(() => {
    timescope.updateOptions({ tracks: readProp(props.tracks) });
  });
  effect(() => {
    timescope.updateOptions({ domains: readProp(props.domains) });
  });
  effect(() => {
    timescope.updateOptions({ cursor: readProp(props.cursor) ?? true });
  });
  effect(() => {
    if (props.selection !== undefined) timescope.updateOptions({ selection: readProp(props.selection) });
  });
  effect(() => {
    timescope.updateOptions({ showFps: readProp(props.showFps), renderThread: readProp(props.renderThread) });
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
