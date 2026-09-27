import type { TimescopeRange } from '#src/core/range';
import type { TimeLike } from '#src/core/time';
import type { TimescopeStateOptions } from '#src/core/TimescopeState';
import type { TimescopeOptionsSelection } from '#src/main/chart';
import type { TimescopeFont } from '#src/main/font';
import type { TimescopeTimeAxisOptions } from '#src/main/layers/TimescopeTimeAxis';
import type { TimescopeOptionsSeries, TimescopeSeriesInput } from '#src/main/TimescopeDataSeries';
import type { TimescopeOptionsSources, TimescopeSourceInput } from '#src/main/TimescopeDataSource';
import type { TimescopeDomainOptions } from '#src/main/TimescopeDomain';

type TimescopeStyle = { width?: string; height?: string; background?: string };

export type TimescopeOptionsDomains = { [name: string]: TimescopeDomainOptions };
export type TimescopeOptionsTracks<Track extends string> = {
  [K in Track]: { height?: number; symmetric?: boolean; timeAxis?: TimescopeTimeAxisOptions | boolean };
};

export type TimescopeOptions<
  Sources extends Record<string, TimescopeSourceInput> = Record<string, TimescopeSourceInput>,
  Series extends Record<string, TimescopeSeriesInput> = Record<string, TimescopeSeriesInput>,
  Track extends string = string,
> = {
  style?: TimescopeStyle;
  /** Thread used by the render engine. Selected on mount; defaults to 'worker'. */
  renderThread?: 'worker' | 'main';
  showFps?: boolean;
  cursor?: boolean | { color?: string; borderColor?: string };
  sources?: TimescopeOptionsSources<Sources>;
  series?: TimescopeOptionsSeries<Sources, Series, Track>;
  tracks?: TimescopeOptionsTracks<Track>;
  domains?: TimescopeOptionsDomains;
  selection?: TimescopeOptionsSelection;
};

export type TimescopeOptionsInitial<
  Sources extends Record<string, TimescopeSourceInput>,
  Series extends Record<string, TimescopeSeriesInput>,
  Track extends string,
> = TimescopeOptions<Sources, Series, Track> &
  Omit<TimescopeStateOptions, 'time' | 'zoom'> & {
    target?: HTMLElement | string;
    fonts?: (string | TimescopeFont)[];
    wheelSensitivity?: number;
  } & (
    | { time?: TimeLike; zoom?: TimescopeStateOptions['zoom']; fit?: never }
    | {
        fit:
          | TimescopeRange<TimeLike<never>>
          | { range: TimescopeRange<TimeLike<never>>; padding?: number | [number, number] };
        time?: never;
        zoom?: never;
      }
  );

export function createDefineTimescopeOptions(wrapper?: (opts: object) => object) {
  return function <
    const Sources extends Record<string, TimescopeSourceInput>,
    const Series extends Record<string, TimescopeSeriesInput>,
    const Track extends string,
  >(opts: TimescopeOptions<Sources, Series, Track>) {
    return (wrapper ? wrapper(opts) : opts) as typeof opts;
  };
}

export function createDefineTimescopeSources(wrapper?: (opts: object) => object) {
  return function <const Sources extends Record<string, TimescopeSourceInput>>(opts: TimescopeOptionsSources<Sources>) {
    return (wrapper ? wrapper(opts) : opts) as typeof opts;
  };
}

export function createDefineTimescopeTracks(wrapper?: (opts: object) => object) {
  return function <const Track extends string>(opts: TimescopeOptionsTracks<Track>) {
    return (wrapper ? wrapper(opts) : opts) as typeof opts;
  };
}

export function createDefineTimescopeSeries(wrapper?: (opts: object) => object) {
  return function <
    const Sources extends Record<string, TimescopeSourceInput>,
    const Series extends Record<string, TimescopeSeriesInput>,
    const Track extends string = 'default',
  >(
    opts: TimescopeOptionsSeries<Sources, Series, Track>,
    // oxlint-disable-next-line no-unused-vars
    sources?: TimescopeOptionsSources<Sources>,
    // oxlint-disable-next-line no-unused-vars
    tracks?: TimescopeOptionsTracks<Track>,
  ) {
    return (wrapper ? wrapper(opts) : opts) as typeof opts;
  };
}

export const defineTimescopeOptions = createDefineTimescopeOptions();
export const defineTimescopeSources = createDefineTimescopeSources();
export const defineTimescopeTracks = createDefineTimescopeTracks();
export const defineTimescopeSeries = createDefineTimescopeSeries();

export type { NumberLike as TimescopeNumberLike } from '#src/core/decimal';
export type { TimeLike as TimescopeTimeLike } from '#src/core/time';
export type {
  TimescopeDataResolution,
  TimescopeResolutionContext,
  TimescopeResolutionResolver,
  TimescopeResolutionSnap,
} from '#src/core/zoom';
export type { TimescopeDataRowInput, TimescopeMappings } from '#src/main/TimescopeData';
export type { TimescopeOptionsSeries, TimescopeSeriesInput } from '#src/main/TimescopeDataSeries';
export type {
  TimescopeDataDecoder,
  TimescopeOptionsSources,
  TimescopePercentileOptions,
  TimescopeSnapshotLoader,
  TimescopeSourceCommonOptions,
  TimescopeSourceInput,
  TimescopeSourceOptions,
} from '#src/main/TimescopeDataSource';
export type { TimescopeDomainOptions, TimescopeYAxisOptions } from '#src/main/TimescopeDomain';
export type {
  CalendarLevel,
  TimeFormatFunc,
  TimeFormatFuncOptions,
  TimeFormatLabeler,
  TimeFormatLabelerOptions,
  TimescopeTimeAxisOptions,
} from '#src/main/layers/TimescopeTimeAxis';
export type {
  AngleStyle,
  BoxStyle,
  FillStyle,
  IconStyle,
  OffsetStyle,
  PathStyle,
  SizeStyle,
  StrokeStyle,
  TextStyle,
  TimescopeChartLink,
  TimescopeChartMark,
  TimescopeChartStyleEntry,
  TimescopeChartType,
  TimescopeOptionsSelection,
  Using,
  Using1,
  Using2,
} from '#src/main/chart';
