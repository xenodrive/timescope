export type TimescopeFontStyle =
  | string
  | {
      style?: string;
      variant?: string;
      weight?: string;
      stretch?: string;
      size?: number | string;
      lineHeight?: number | string;
      family?: string;
    };

type FontDefaults = { size: number | string; weight: string; family: string };

function formatFontFamily(family: string): string {
  const names: string[] = [];
  let quote: '"' | "'" | undefined;
  let escaped = false;
  let start = 0;

  for (let i = 0; i < family.length; i++) {
    const char = family[i];
    if (escaped) {
      escaped = false;
    } else if (char === '\\') {
      escaped = true;
    } else if (char === quote) {
      quote = undefined;
    } else if (!quote && (char === '"' || char === "'") && !family.slice(start, i).trim()) {
      quote = char;
    } else if (!quote && char === ',') {
      names.push(family.slice(start, i).trim());
      start = i + 1;
    }
  }
  names.push(family.slice(start).trim());

  return names
    .map((name) => {
      if (/^(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')$/.test(name)) return name;
      if (/^[-_a-zA-Z\u0080-\uFFFF][-_a-zA-Z0-9\u0080-\uFFFF]*$/.test(name)) return name;
      const escapedName = name.replace(/[\x00-\x1f\x7f"\\]/g, (char) =>
        char === '"' || char === '\\' ? `\\${char}` : `\\${char.charCodeAt(0).toString(16)} `,
      );
      return `"${escapedName}"`;
    })
    .join(', ');
}

export function resolveFont(font: TimescopeFontStyle | undefined, defaults: FontDefaults): string {
  if (typeof font === 'string') return font;
  const size = font?.size ?? defaults.size;
  const family = font?.family ?? defaults.family;
  const formattedFamily = formatFontFamily(family);
  const modifiers = [font?.style, font?.variant, font?.weight ?? defaults.weight, font?.stretch].filter(
    (value) => value !== undefined,
  );
  const formattedSize = typeof size === 'number' ? `${size}px` : size;
  return `${modifiers.join(' ')} ${formattedSize}${font?.lineHeight === undefined ? '' : `/${font.lineHeight}`} ${formattedFamily}`;
}
