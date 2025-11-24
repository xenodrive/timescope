import type { TextStyle, TextStyleOptions } from '#src/core/style';

/** @internal */
export function parseTextStyle(style: TextStyleOptions | undefined, defaults: TextStyleOptions = {}): TextStyle {
  return {
    font: `${style?.fontWeight ?? defaults?.fontWeight ?? 'normal'} ${
      style?.fontSize ?? defaults?.fontSize ?? '12px'
    } "${style?.fontFamily ?? defaults?.fontFamily ?? 'BIZ UDPGothic'}"`,
    color: style?.color ?? defaults?.color,
  };
}
