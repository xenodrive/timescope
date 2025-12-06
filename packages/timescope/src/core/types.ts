import type { TimescopeFont } from '#src/bridge/protocol';
import { Decimal, type NumberLike } from '#src/core/decimal';
import type { Range } from '#src/core/range';
import type { TextStyleOptions, TimescopeStyle } from '#src/core/style';
import type { TimescopeStateOptions } from '#src/core/TimescopeState';
import type { TimescopeDataChunkLoader } from './chunk';
import type { TimeLike, TimeUnit } from './time';

type MaybeFn<R, T> = T extends unknown[] ? ((...args: T) => R) | R : R;

type UsingElement<V extends [string, string]> = `${V[1]}@${V[0]}` | V[1] | `@${V[0]}`;
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
  padding?: MaybeFn<number | [number, number?, number?, number?], T>;
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
      'box',
      true,
      StrokeStyle<T> & FillStyle<T> & SizeStyle<T> & BoxStyle<T> & OffsetStyle<T>,
      T,
      V
    >;

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
  | 'boxes'
  | 'boxes:filled';

export type CalendarLevel = 'subsecond' | 'second' | 'minute' | 'hour' | 'day' | 'month' | 'year' | 'relative';

export type TimeFormatFuncOptions = {
  time: Decimal;
  unit: TimeUnit;
  level: CalendarLevel;
  digits: number;
  stride?: bigint;
};
export type TimeFormatFunc = (opts: TimeFormatFuncOptions) => string | undefined;

export interface TimescopeSourceCommonOptions {
  /** Available zoom levels used to quantize resolution. */
  zoomLevels?: number[];
  /** Number of samples per chunk for tiled loading. */
  chunkSize?: number;
}

export type TimescopeSourceOptions = TimescopeSourceCommonOptions &
  ({ url: string } | { data: unknown } | { loader: TimescopeDataChunkLoader<unknown> });

export type TimescopeSourceInput =
  | string
  | unknown[]
  | object
  | TimescopeDataChunkLoader<unknown>
  | TimescopeSourceOptions;

type InferTimeKey<T> = T extends string[] ? T[number] : T extends Record<string, unknown> ? keyof T : 'time';
type InferValueKey<T> = T extends string[] ? T[number] : T extends Record<string, unknown> ? keyof T : 'value';
type InferSourceType<S> = S extends unknown[]
  ? S
  : S extends TimescopeDataChunkLoader<infer X>
    ? X
    : S extends { url: string }
      ? unknown
      : S extends string
        ? unknown
        : S extends { data: infer X }
          ? X
          : S extends { loader: TimescopeDataChunkLoader<infer X> }
            ? X
            : S;

export type FieldDefLike<D> = string | string[] | Record<string, string | ((data: Record<string, any>) => D)>;

export type TimescopeSeriesInput<
  Source extends Record<string, TimescopeSourceInput>,
  SourceName extends keyof Source,
  TimeDef extends FieldDefLike<TimeLike<never>>,
  ValueDef extends FieldDefLike<NumberLike | null>,
  Track extends string,
> = {
  data: {
    source: SourceName;

    parser?: (...args: [InferSourceType<Source[SourceName]>]) => Record<string, any>[];
    time?: TimeDef;
    value?: ValueDef;

    name?: string;
    unit?: string;
    digits?: number;

    color?: string;

    scale?: 'linear' | 'log';
    range?:
      | NumberLike
      | Range<NumberLike | undefined>
      | { expand?: boolean; shrink?: boolean; default?: NumberLike | Range<NumberLike | undefined> };

    instantaneous?: {
      using?: Using1<[InferTimeKey<TimeDef>, InferValueKey<ValueDef>]>;
      zoom?: number;
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
                time: Record<InferTimeKey<TimeDef>, Decimal>;
                value: Record<InferValueKey<ValueDef>, Decimal | null>;
              },
            ],
            [InferTimeKey<TimeDef>, InferValueKey<ValueDef>]
          >[],
          [
            {
              resolution: Decimal;
              data: Record<string, any>;
              time: Record<InferTimeKey<TimeDef>, Decimal>;
              value: Record<InferValueKey<ValueDef>, Decimal | null>;
            },
          ]
        >;
        links?: MaybeFn<
          TimescopeChartLink<[opts: { resolution: Decimal }], [InferTimeKey<TimeDef>, InferValueKey<ValueDef>]>[],
          [opts: { resolution: Decimal }]
        >;
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

export type TimescopeOptionsSources<Source extends Record<string, TimescopeSourceInput>> = {
  [K in keyof Source]: Source[K];
};

export type TimescopeOptionsSeries<
  Source extends Record<string, TimescopeSourceInput>,
  SourceName extends Record<string, keyof Source>,
  TimeDef extends Record<string, FieldDefLike<TimeLike<never>>>,
  ValueDef extends Record<string, FieldDefLike<NumberLike | null>>,
  Track extends string,
> = {
  [K in keyof SourceName & keyof TimeDef & keyof ValueDef]: TimescopeSeriesInput<
    Source,
    SourceName[K] & string,
    TimeDef[K],
    ValueDef[K],
    Track
  >;
};

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
  [K in Track]: { height?: number; symmetric?: boolean; timeAxis?: TimescopeTimeAxisOptions | boolean };
};

export type TimescopeOptionsSelection =
  | boolean
  | {
      resizable?: boolean;
      color?: string;
      invert?: boolean;

      range?: Range<Decimal | undefined> | null;
    };

export type TimescopeOptions<
  Source extends Record<string, TimescopeSourceInput> = Record<string, TimescopeSourceInput>,
  SourceName extends Record<string, keyof Source> = Record<string, keyof Source>,
  TimeDef extends Record<string, FieldDefLike<TimeLike<never>>> = Record<string, FieldDefLike<TimeLike<never>>>,
  ValueDef extends Record<string, FieldDefLike<NumberLike | null>> = Record<string, FieldDefLike<NumberLike | null>>,
  Track extends string = string,
> = {
  style?: TimescopeStyle;
  showFps?: boolean;
  padding?: readonly number[];
  indicator?: boolean;

  sources?: TimescopeOptionsSources<Source>;
  series?: TimescopeOptionsSeries<Source, SourceName, TimeDef, ValueDef, Track>;
  tracks?: TimescopeOptionsTracks<Track>;

  selection?: TimescopeOptionsSelection;
};

export interface TimescopeOptionsInitial<
  Source extends Record<string, TimescopeSourceInput>,
  SourceName extends Record<string, keyof Source>,
  TimeDef extends Record<string, FieldDefLike<TimeLike<never>>>,
  ValueDef extends Record<string, FieldDefLike<NumberLike | null>>,
  Track extends string,
>
  extends TimescopeOptions<Source, SourceName, TimeDef, ValueDef, Track>, TimescopeStateOptions {
  target?: HTMLElement | string;
  fonts?: (string | TimescopeFont)[];

  wheelSensitivity?: number;
}

export function createDefineTimescopeOptions(wrapper?: (opts: object) => object) {
  return function <
    Source extends Record<string, TimescopeSourceInput>,
    SourceName extends Record<string, keyof Source>,
    TimeDef extends Record<string, FieldDefLike<TimeLike<never>>>,
    ValueDef extends Record<string, FieldDefLike<NumberLike | null>>,
    Track extends string,
  >(opts: TimescopeOptions<Source, SourceName, TimeDef, ValueDef, Track>) {
    return (wrapper ? wrapper(opts) : opts) as typeof opts;
  };
}

export function createDefineTimescopeSources(wrapper?: (opts: object) => object) {
  return function <Source extends Record<string, TimescopeSourceInput>>(opts: TimescopeOptionsSources<Source>) {
    return (wrapper ? wrapper(opts) : opts) as typeof opts;
  };
}

export function createDefineTimescopeTracks(wrapper?: (opts: object) => object) {
  return function <Track extends string>(opts: TimescopeOptionsTracks<Track>) {
    return (wrapper ? wrapper(opts) : opts) as typeof opts;
  };
}

export function createDefineTimescopeSeries(wrapper?: (opts: object) => object) {
  return function <
    Source extends Record<string, TimescopeSourceInput>,
    SourceName extends Record<string, keyof Source>,
    TimeDef extends Record<string, FieldDefLike<TimeLike<never>>>,
    ValueDef extends Record<string, FieldDefLike<NumberLike | null>>,
    Track extends string = 'default',
  >(
    opts: TimescopeOptionsSeries<Source, SourceName, TimeDef, ValueDef, Track>,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    sources?: TimescopeOptionsSources<Source>,
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
