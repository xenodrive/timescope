export type TextStyleOptions = {
  color?: string;
  fontWeight?: string;
  fontSize?: string;
  fontFamily?: string;
};

export type MaybeFn<R, T> = T extends unknown[] ? ((...args: T) => R) | R : R;
type UsingElement<V extends [string, string]> =
  | `${V[1] | '#zero' | '#top' | '#bottom'}@${V[0]}`
  | (V[1] | '#zero' | '#top' | '#bottom')
  | `@${V[0]}`;
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
  /** Explicit fill color, used as-is instead of the fill derived from the series color. */
  fillColor?: MaybeFn<string, T>;
  /** Multiplies the resolved fill alpha (0–1). Defaults to 1. */
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
export type OffsetStyle<T = false> = { offset?: MaybeFn<[number, number], T> };

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
  | TimescopeChartStyleEntry<'text', false, SizeStyle<T> & AngleStyle<T> & TextStyle<T> & OffsetStyle<T>, T, V>
  | TimescopeChartStyleEntry<'icon', false, SizeStyle<T> & AngleStyle<T> & IconStyle<T> & OffsetStyle<T>, T, V>
  | TimescopeChartStyleEntry<'path', false, SizeStyle<T> & AngleStyle<T> & PathStyle<T> & OffsetStyle<T>, T, V>
  | TimescopeChartStyleEntry<'line', true, StrokeStyle<T> & SizeStyle<T> & OffsetStyle<T>, T, V>
  | TimescopeChartStyleEntry<'section', true, StrokeStyle<T> & SizeStyle<T> & OffsetStyle<T>, T, V>
  | TimescopeChartStyleEntry<
      'bar',
      true,
      StrokeStyle<T> & FillStyle<T> & SizeStyle<T> & BoxStyle<T> & OffsetStyle<T>,
      T,
      V
    >
  | TimescopeChartStyleEntry<'region', true, StrokeStyle<T> & FillStyle<T> & BoxStyle<T>, T, V>;
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

export type TimescopeOptionsSelection =
  | boolean
  | {
      resizable?: boolean;
      color?: string;
      invert?: boolean;
    };
