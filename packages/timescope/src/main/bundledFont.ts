import type { TimescopeFont } from '#src/main/font';
import fontDataUrl from '../assets/fonts/Timescope.woff2?inline';

let font: TimescopeFont | undefined;

export function bundledFont(): TimescopeFont {
  return (font ??= {
    family: 'Timescope',
    source: Uint8Array.from(atob(fontDataUrl.slice(fontDataUrl.indexOf(',') + 1)), (character) =>
      character.charCodeAt(0),
    ),
  });
}
