import type { TimescopeFont } from '#src/bridge/protocol';
import { Decimal, type NumberLike } from '#src/core/decimal';
import type { TimescopeRange } from '#src/core/range';
import type { TextStyleOptions, TimescopeStyle } from '#src/core/style';
import type { TimescopeStateOptions } from '#src/core/TimescopeState';
import type { TimescopeDataRowInput, TimescopeMappings } from '#src/main/TimescopeData';
import type { TimescopeChunkLoader, TimescopeChunkLoaderContext } from './chunk';
import type { TimeUnit } from './time';

type MaybeFn<R, T> = T extends unknown[] ? ((...args: T) => R) | R : R;

type UsingElement<V extends [string, string]> =
  `${V[1] | '#zero' | '#top' | '#bottom'}@${V[0]}` | (V[1] | '#zero' | '#top' | '#bottom') | `@${V[0]}`;
export type Using1<V extends [string, string]> = UsingElement<V> | [UsingElement<V>];
export type Using2<V extends [string, string]> = [UsingElement<V>, UsingElement<V>];
export type Using<V extends [string, string] = [string, string]> = Using1<V> | Using2<V>;

export type StrokeStyle<T = false> = {
  lineWidth?: MaybeFn<number, T>;
  lineColor?: MaybeFn<string, T>;
  lineDashArray?: MaybeFn<number[], T>;
  lineDashOffset?: MaybeFn<number, T>;
};

export type FillStyle<T = false> = {
  fillColor?: MaybeFn<string, T>;
  fillOpacity?: MaybeFn<number, T>;
  fillPost?: boolean;
};

export type SizeStyle<T = false> = { size?: MaybeFn<number, T> };
export type AngleStyle<T = false> = { angle?: MaybeFn<number, T> };
export type PathStyle<T = false> = { path?: MaybeFn<string, T>; origin?: [number, number]; scale?: number };

export type TextStyle<T = false> = {
  fontWeight?: MaybeFn<string, T>;
  fontFamily?: MaybeFn<string, T>;
  textAlign?: MaybeFn<'start' | 'center' | 'end' | 'left' | 'right', T>;
  textBaseline?: MaybeFn<'top' | 'middle' | 'bottom' | 'hanging' | 'alphabetic' | 'ideographic', T>;
  textColor?: MaybeFn<string, T>;
  textOpacity?: MaybeFn<number, T>;
  textOutline?: MaybeFn<boolean, T>;
  textOutlineColor?: MaybeFn<string, T>;
  textOutlineWidth?: MaybeFn<number, T>;

  text?: MaybeFn<string, T>;
};

export type IconStyle<T = false> = {
  iconFontWeight?: MaybeFn<string, T>;
  iconFontFamily?: MaybeFn<string, T>;
  iconAlign?: MaybeFn<'start' | 'center' | 'end' | 'left' | 'right', T>;
  iconBaseline?: MaybeFn<'top' | 'middle' | 'bottom' | 'hanging' | 'alphabetic' | 'ideographic', T>;
  iconColor?: MaybeFn<string, T>;
  iconOpacity?: MaybeFn<number, T>;
  iconOutline?: MaybeFn<boolean, T>;
  iconOutlineColor?: MaybeFn<string, T>;
  iconOutlineWidth?: MaybeFn<number, T>;

  icon?: MaybeFn<string, T>;
};

export type BoxStyle<T = false> = {
  extrude?: MaybeFn<number | [number, number?, number?, number?], T>;
  radius?: MaybeFn<number, T>;
};

export type OffsetStyle<T = false> = {
  offset?: MaybeFn<[number, number], T>;
};

export type TimescopeChartStyleEntry<
  D extends string,
  U extends boolean,
  S,
  T extends unknown[] | false,
  V extends [string, string],
> = {
  draw: MaybeFn<D, T>;
  using?: MaybeFn<U extends true ? Using2<V> : Using1<V>, T>;
  style?: MaybeFn<S, T>;
};

export type TimescopeChartMark<T extends unknown[] | false, V extends [string, string] = [string, string]> =
  | TimescopeChartStyleEntry<'circle', false, StrokeStyle<T> & FillStyle<T> & SizeStyle<T> & OffsetStyle<T>, T, V>
  | TimescopeChartStyleEntry<
      'triangle' | 'square' | 'diamond' | 'star',
      false,
      StrokeStyle<T> & FillStyle<T> & SizeStyle<T> & AngleStyle<T> & OffsetStyle<T>,
      T,
      V
    >
  | TimescopeChartStyleEntry<
      'plus' | 'cross' | 'minus',
      false,
      StrokeStyle<T> & SizeStyle<T> & AngleStyle<T> & OffsetStyle<T>,
      T,
      V
    >
  // -------
  | TimescopeChartStyleEntry<'text', false, SizeStyle<T> & AngleStyle<T> & TextStyle<T> & OffsetStyle<T>, T, V>
  | TimescopeChartStyleEntry<'icon', false, SizeStyle<T> & AngleStyle<T> & IconStyle<T> & OffsetStyle<T>, T, V>
  | TimescopeChartStyleEntry<'path', false, SizeStyle<T> & AngleStyle<T> & PathStyle<T> & OffsetStyle<T>, T, V>
  // -------
  | TimescopeChartStyleEntry<'line', true, StrokeStyle<T> & SizeStyle<T> & OffsetStyle<T>, T, V>
  | TimescopeChartStyleEntry<'section', true, StrokeStyle<T> & SizeStyle<T> & OffsetStyle<T>, T, V>
  | TimescopeChartStyleEntry<
      'bar',
      true,
      StrokeStyle<T> & FillStyle<T> & SizeStyle<T> & BoxStyle<T> & OffsetStyle<T>,
      T,
      V
    >
  | TimescopeChartStyleEntry<'region', true, StrokeStyle<T> & FillStyle<T> & BoxStyle<T> & OffsetStyle<T>, T, V>;

export type TimescopeChartLink<T extends unknown[] | false, V extends [string, string] = [string, string]> =
  | TimescopeChartStyleEntry<'line' | 'curve' | 'step' | 'step-start' | 'step-end', false, StrokeStyle<T>, T, V>
  | TimescopeChartStyleEntry<
      'area' | 'curve-area' | 'step-area' | 'step-area-start' | 'step-area-end',
      true,
      StrokeStyle<T> & FillStyle<T>,
      T,
      V
    >;

export type TimescopeChartType =
  | 'lines'
  | 'lines:filled'
  | 'curves'
  | 'curves:filled'
  | 'steps-start'
  | 'steps-start:filled'
  | 'steps'
  | 'steps:filled'
  | 'steps-end'
  | 'steps-end:filled'
  | 'points'
  | 'linespoints'
  | 'linespoints:filled'
  | 'curvespoints'
  | 'curvespoints:filled'
  | 'stepspoints-start'
  | 'stepspoints-start:filled'
  | 'stepspoints'
  | 'stepspoints:filled'
  | 'stepspoints-end'
  | 'stepspoints-end:filled'
  | 'impulses'
  | 'impulsespoints'
  | 'bars'
  | 'bars:filled';

export type CalendarLevel = 'subsecond' | 'second' | 'minute' | 'hour' | 'day' | 'month' | 'year' | 'relative';

export type TimeFormatFuncOptions = {
  time: Decimal;
  unit: TimeUnit;
  level: CalendarLevel;
  digits: number;
  stride?: bigint;
};
export type TimeFormatFunc = (opts: TimeFormatFuncOptions) => string | undefined;

export type TimescopeSourceCommonOptions = {
  /** Number of selected-resolution intervals per chunk for tiled loading. */
  chunkSize?: number;
  /** Time offset for chunk indexing. */
  chunkOffset?: NumberLike;
  /** Continue loading charts backed by this source during view interactions. */
  immediate?: boolean;
  /**
   * Available source intervals used to load data.
   * A chunk spans `chunkSize * resolution` time units.
   * */
  resolutions?: NumberLike[];
  zoomLevels?: number[];
};

export type TimescopeDataDecoder = (
  payload: any,
) => Promise<readonly TimescopeDataRowInput[]> | readonly TimescopeDataRowInput[];
export type TimescopePercentilesReducer = {
  type: 'percentiles';
  values?: readonly (0.5 | 0.9 | 0.95)[];
  primary?: 0.5 | 0.9 | 0.95;
};
export type TimescopeReducer = 'min-max-avg' | 'percentiles' | 'null' | TimescopePercentilesReducer;
export type TimescopeSnapshotLoader<T = unknown> = (context?: TimescopeChunkLoaderContext) => T | Promise<T>;

type TimescopeSnapshotAcquisition =
  | { url: string; data?: never; loader?: never }
  | { data: unknown; url?: never; loader?: never }
  | { loader: TimescopeSnapshotLoader; url?: never; data?: never; chunked: false };

type TimescopeChunkedAcquisition =
  | { url: string; data?: never; loader?: never }
  | { loader: TimescopeChunkLoader<unknown>; url?: never; data?: never; chunked?: true };

type TimescopeSourceTransform =
  | { decoder: TimescopeDataDecoder; mappings?: never }
  | { decoder?: never; mappings: TimescopeMappings }
  | { decoder?: never; mappings?: never };

export type TimescopeSourceOptions = TimescopeSourceCommonOptions &
  TimescopeSourceTransform &
  (
    | (TimescopeSnapshotAcquisition & { reducer?: TimescopeReducer })
    | (TimescopeChunkedAcquisition & { reducer?: never })
  );

export type TimescopeSourceInput =
  | string
  | readonly TimescopeDataRowInput[]
  | TimescopeChunkLoader<readonly TimescopeDataRowInput[]>
  | TimescopeSourceOptions
  | import('#src/main/TimescopeDataSource').TimescopeDataSource<any>;

type MinMaxAvgSuffix = 'avg' | 'first' | 'last' | 'min' | 'max';
type PercentileSuffix = 'first' | 'last' | 'min' | 'max' | 'p50' | 'p90' | 'p95';

type InferReturnedRow<T> = Awaited<T> extends readonly (infer R)[] ? R : never;
type InferLoaderRow<T> = [InferReturnedRow<T>] extends [never] ? TimescopeDataRowInput : InferReturnedRow<T>;
type InferSourceRow<S> = S extends import('#src/main/TimescopeDataSource').TimescopeDataSource<infer R>
  ? R
  : S extends { mappings: infer M extends TimescopeMappings }
    ? { times: M['times']; values: M['values'] }
    : S extends { decoder: (...args: any[]) => infer R }
      ? InferReturnedRow<R>
      : S extends { loader: (...args: any[]) => infer R }
        ? InferLoaderRow<R>
        : S extends (...args: any[]) => infer R
          ? InferLoaderRow<R>
          : S extends { data: readonly (infer R)[] }
            ? R
            : S extends readonly (infer R)[]
              ? R
              : TimescopeDataRowInput;
type InferTimesKey<R> = R extends { times: infer T extends Record<string, unknown> } ? string & keyof T : 'time';
type InferRawValuesKey<R> = R extends { values: infer V extends Record<string, unknown> } ? string & keyof V : 'value';
type InferRowData<R> = R extends { data?: infer D } ? D : undefined;
type InferSourceData<S> = S extends unknown ? InferRowData<InferSourceRow<S>> : never;
type InferSnapshotValueKey<S, K extends string> = S extends { reducer: 'min-max-avg' }
  ? K | `${K}#${MinMaxAvgSuffix}`
  : S extends { reducer: 'percentiles' | { type: 'percentiles' } }
    ? K | `${K}#${PercentileSuffix}`
    : K;
type InferSourceValueKey<S> =
  InferRawValuesKey<InferSourceRow<S>> extends infer K extends string
    ? S extends import('#src/main/TimescopeDataSource').TimescopeDataSource<any>
      ? K
      : S extends { loader: unknown }
        ? S extends { chunked: false }
          ? InferSnapshotValueKey<S, K>
          : K
        : S extends { url: infer U extends string }
          ? U extends `${string}{${string}}${string}`
            ? K
            : InferSnapshotValueKey<S, K>
          : S extends string
            ? K
            : InferSnapshotValueKey<S, K>
    : never;

export type TimescopeYAxisOptions = {
  side?: 'left' | 'right';
  label?: string;
  color?: string;
};

export type TimescopeDomainOptions = {
  scale?: 'linear' | 'log' | 'linear-symmetric';
  animation?: boolean;
  initialAnimation?: boolean | number;
  range?:
    | NumberLike
    | TimescopeRange<NumberLike | undefined>
    | { expand?: boolean; shrink?: boolean; default?: NumberLike | TimescopeRange<NumberLike | undefined> };
  expand?: boolean;
  shrink?: boolean;
  unit?: string;
  digits?: number;
  floatingGap?: number;
  axis?: boolean | 'left' | 'right' | TimescopeYAxisOptions;
};

export type TimescopeResolutionSnap = 'nearest' | 'floor' | 'ceil';

export type TimescopeResolutionContext = {
  resolution: Decimal;
  resolutions: readonly Decimal[];
};

export type TimescopeResolutionResolver = NumberLike | ((context: TimescopeResolutionContext) => NumberLike);

export type TimescopeDataResolution =
  | TimescopeResolutionSnap
  | TimescopeResolutionResolver
  | {
      resolve?: TimescopeResolutionResolver;
      snap?: TimescopeResolutionSnap;
    };

export type TimescopeOptionsDomains = {
  [name: string]: TimescopeDomainOptions;
};

export type TimescopeSeriesInput<
  Sources = Record<string, unknown>,
  SourceName extends keyof Sources = keyof Sources,
  Track extends string = string,
  U extends [string, string] = [string, string],
  D = unknown,
> = {
  data: {
    source: SourceName;

    name?: string;

    color?: string;

    domain?: string | TimescopeDomainOptions;

    resolution?: TimescopeDataResolution;

    instantaneous?:
      | false
      | {
          using?: Using1<U>;
          zoom?: number;
          resolution?: NumberLike;
        };
  };

  chart?:
    | TimescopeChartType
    | {
        marks?: MaybeFn<
          TimescopeChartMark<
            [
              {
                resolution: Decimal;
                data: D;
                times: Record<U[0], Decimal>;
                values: Record<U[1], Decimal | null>;
              },
            ],
            U
          >[],
          [
            {
              resolution: Decimal;
              data: D;
              times: Record<U[0], Decimal>;
              values: Record<U[1], Decimal | null>;
            },
          ]
        >;
        links?: MaybeFn<TimescopeChartLink<[opts: { resolution: Decimal }], U>[], [opts: { resolution: Decimal }]>;
      };

  tooltip?:
    | boolean
    | {
        label?: string;
        format?: (opts: {
          time: Decimal;
          value: Decimal | null;
          name: string | undefined;
          unit: string;
          digits: number;
        }) => string;
      };

  track?: Track;
};

export type TimescopeOptionsSources<Sources extends Record<string, TimescopeSourceInput>> = {
  [K in keyof Sources]: Sources[K];
};

type TimescopeSeriesIdeal<Sources, Series, Track extends string> = {
  [K in keyof Series]: Series[K] extends { data: { source: infer S extends keyof Sources } }
    ? TimescopeSeriesInput<
        Sources,
        S,
        Track,
        [InferTimesKey<InferSourceRow<Sources[S]>>, InferSourceValueKey<Sources[S]>],
        InferSourceData<Sources[S]>
      >
    : TimescopeSeriesInput<Sources, keyof Sources, Track>;
};

export type TimescopeOptionsSeries<Sources, Series, Track extends string> =
  TimescopeSeriesIdeal<Sources, Series, Track> extends Series ? Series : TimescopeSeriesIdeal<Sources, Series, Track>;

export type TimeFormatLabelerOptions = {
  year: bigint;
  quarter: number;
  month: number;
  day: number;
  hour: number;
  minute: number;

  second: bigint;
  subseconds: Decimal;

  time: Decimal;
  week: number;
  digits: number;
};

export type TimeFormatLabeler = {
  year?: (opts: TimeFormatLabelerOptions) => string;
  month?: (opts: TimeFormatLabelerOptions) => string;
  quarter?: (opts: TimeFormatLabelerOptions) => string;
  date?: (opts: TimeFormatLabelerOptions) => string;
  minutes?: (opts: TimeFormatLabelerOptions) => string; // typically `HH:mm`
  seconds?: (opts: TimeFormatLabelerOptions) => string; // typically `HH:mm:ss.SSS...`
};

export type TimescopeTimeAxisOptions = {
  axis?: false | { color?: string };
  ticks?: false | { color?: string };
  labels?: false | TextStyleOptions;
  relative?: boolean;
  timeFormat?: TimeFormatFunc | TimeFormatLabeler;
  timeUnit?: 's' | 'ms' | 'us' | 'ns';
};

export type TimescopeOptionsTracks<Track extends string> = {
  [K in Track]: {
    height?: number;
    symmetric?: boolean;
    timeAxis?: TimescopeTimeAxisOptions | boolean;
  };
};

export type TimescopeOptionsSelection =
  | boolean
  | {
      resizable?: boolean;
      color?: string;
      invert?: boolean;

      range?: TimescopeRange<Decimal> | null;
    };

export type TimescopeOptions<
  Sources extends Record<string, TimescopeSourceInput> = Record<string, TimescopeSourceInput>,
  Series extends Record<string, TimescopeSeriesInput> = Record<string, TimescopeSeriesInput>,
  Track extends string = string,
> = {
  style?: TimescopeStyle;
  showFps?: boolean;
  padding?: number[];
  indicator?: boolean;

  sources?: TimescopeOptionsSources<Sources>;
  series?: TimescopeOptionsSeries<Sources, Series, Track>;
  tracks?: TimescopeOptionsTracks<Track>;
  domains?: TimescopeOptionsDomains;

  selection?: TimescopeOptionsSelection;
};

export interface TimescopeOptionsInitial<
  Sources extends Record<string, TimescopeSourceInput>,
  Series extends Record<string, TimescopeSeriesInput>,
  Track extends string,
>
  extends TimescopeOptions<Sources, Series, Track>, TimescopeStateOptions {
  target?: HTMLElement | string;
  fonts?: (string | TimescopeFont)[];

  wheelSensitivity?: number;
}

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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    sources?: TimescopeOptionsSources<Sources>,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
export type { TimescopeDataRowInput, TimescopeMappings } from '#src/main/TimescopeData';
