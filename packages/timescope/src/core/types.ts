import type { TimescopeFont } from '#src/bridge/protocol';
import { Decimal, type NumberLike } from '#src/core/decimal';
import type { TimescopeRange } from '#src/core/range';
import type { TextStyleOptions, TimescopeStyle } from '#src/core/style';
import type { TimescopeStateOptions } from '#src/core/TimescopeState';
import type { TimescopeChunkLoader } from './chunk';
import type { TimeLike, TimeUnit } from './time';

type MaybeFn<R, T> = T extends unknown[] ? ((...args: T) => R) | R : R;

type UsingElement<V extends [string, string]> =
  | `${V[1] | '_zero' | '_top' | '_bottom'}@${V[0] | '_minTime' | '_maxTime'}`
  | (V[1] | '_zero' | '_top' | '_bottom')
  | `@${V[0] | '_minTime' | '_maxTime'}`;
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
  /** Number of samples per chunk for tiled loading. */
  chunkSize?: number;
  /** Time offset for chunk indexing. */
  chunkOffset?: NumberLike;
  /**
   * Available resolutions can be used to load data.
   * ie. chunkSize * resolutions = chunk interval
   * */
  resolutions?: NumberLike[];
  zoomLevels?: number[];
};

export type TimescopeSourceOptions = TimescopeSourceCommonOptions &
  ({ url: string } | { data: unknown } | { loader: TimescopeChunkLoader<unknown> });

export type TimescopeSourceInput = string | unknown[] | object | TimescopeChunkLoader<unknown> | TimescopeSourceOptions;

type InferTimeValueKey<T, D extends string> = T extends string
  ? T
  : T extends string[]
    ? T[number]
    : T extends Record<string, unknown>
      ? string & keyof T
      : D;

type InferTimeKey<T> = InferTimeValueKey<T, 'time'>;
type InferValueKey<T> = InferTimeValueKey<T, 'value'>;

type InferSourceType<S> =
  S extends TimescopeChunkLoader<infer X>
    ? X
    : S extends { loader: TimescopeChunkLoader<Response> } & TimescopeSourceOptions
      ? any
      : S extends { loader: TimescopeChunkLoader<infer X> } & TimescopeSourceOptions
        ? X
        : S extends { url: string } & TimescopeSourceOptions
          ? any
          : S extends string
            ? any
            : S extends { data: infer X } & TimescopeSourceOptions
              ? X
              : S;

export type FieldDefLike<D> = string | string[] | Record<string, string | ((data: Record<string, any>) => D)>;

export type TimescopeDomainOptions = {
  scale?: 'linear' | 'log';
  range?:
    | NumberLike
    | TimescopeRange<NumberLike | undefined>
    | { expand?: boolean; shrink?: boolean; default?: NumberLike | TimescopeRange<NumberLike | undefined> };
  expand?: boolean;
  shrink?: boolean;
  unit?: string;
  digits?: number;
};

export type TimescopeOptionsDomains = {
  [name: string]: TimescopeDomainOptions;
};

export type TimescopeSeriesInput<
  Sources = Record<string, unknown>,
  SourceName extends keyof Sources = keyof Sources,
  Track extends string = string,
  T = FieldDefLike<TimeLike<never>>,
  V = FieldDefLike<NumberLike | null>,
  U extends [string, string] = [string, string],
> = TimescopeSeriesDataTimeValue<T, V> & {
  data: {
    source: SourceName;

    parser?: (...args: [InferSourceType<Sources[SourceName]>]) => Record<string, any>[];

    name?: string;

    color?: string;

    domain?: string | TimescopeDomainOptions;

    instantaneous?: {
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
                data: Record<string, any>;
                time: Record<U[0], Decimal>;
                value: Record<U[1], Decimal | null>;
              },
            ],
            U
          >[],
          [
            {
              resolution: Decimal;
              data: Record<string, any>;
              time: Record<U[0], Decimal>;
              value: Record<U[1], Decimal | null>;
            },
          ]
        >;
        links?: MaybeFn<TimescopeChartLink<[opts: { resolution: Decimal }], U>[], [opts: { resolution: Decimal }]>;
      };

  tooltip?:
    | boolean
    | {
        label?: string;
        format?: () => string;
      };

  yAxis?:
    | boolean
    | 'left'
    | 'right'
    | {
        side?: 'left' | 'right';
        label?: string;
      };

  track?: Track;
};

export type TimescopeOptionsSources<Sources extends Record<string, TimescopeSourceInput>> = {
  [K in keyof Sources]: Sources[K];
};

type TimescopeSeriesDataTimeValue<T = FieldDefLike<TimeLike<never>>, V = FieldDefLike<NumberLike | null>> = {
  data: {
    time?: T;
    value?: V;
  };
};

type TimescopeSeriesIdeal<Sources, Series, Track extends string> = {
  [K in keyof Series]: Series[K] extends TimescopeSeriesDataTimeValue<infer T, infer V>
    ? TimescopeSeriesInput<Sources, keyof Sources, Track, T, V, [InferTimeKey<T>, InferValueKey<V>]>
    : TimescopeSeriesInput<
        Sources,
        keyof Sources,
        Track,
        unknown,
        unknown,
        [InferTimeKey<unknown>, InferValueKey<unknown>]
      >;
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

      range?: TimescopeRange<Decimal | undefined> | null;
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

  regions?: {
    timespan: TimescopeRange<Decimal | undefined>;
    color?: string;
  }[];
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
