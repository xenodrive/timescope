import type { TimescopeFont } from '#src/main/font';
import fontData from '../assets/fonts/Timescope.woff2.json' with { type: 'json' };

let font: TimescopeFont | undefined;

/** Only browser backends import the embedded font; Skia resolves the exported font file. */
export function defaultBrowserFont(): TimescopeFont {
  return (font ??= { family: 'Timescope', source: Uint8Array.fromBase64(fontData) });
}
