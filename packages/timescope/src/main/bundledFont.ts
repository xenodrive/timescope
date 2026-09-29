import type { TimescopeFont } from '#src/main/font';
import fontDataUrl from '../assets/fonts/Timescope.woff2.json' with { type: 'json' };

let font: TimescopeFont | undefined;

export function bundledFont(): TimescopeFont {
  return (font ??= {
    family: 'Timescope',
    source: Uint8Array.fromBase64(fontDataUrl),
  });
}
