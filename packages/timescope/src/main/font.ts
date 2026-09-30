export type TimescopeFont = {
  family: string;
  source: string | BufferSource;
  desc?: FontFaceDescriptors;
};

/** Resolve explicit inputs, or document fonts when inputs are omitted. Defaults belong to the backend. */
export async function resolveBrowserFonts(fonts?: (string | TimescopeFont)[]): Promise<TimescopeFont[]> {
  return fonts ? resolveFonts(fonts) : resolveDocumentFonts();
}

/** Watch document-derived fonts. The caller owns the initial font load and invokes the returned cleanup. */
export function watchDocumentFonts(onFonts: (fonts: TimescopeFont[]) => Promise<void>): () => void {
  if (typeof document === 'undefined') return () => {};
  let disposed = false;
  let refreshHandle: ReturnType<typeof setTimeout> | undefined;
  async function refresh() {
    try {
      // Resending the bundled binary source would reload it on every font event.
      const fonts = await resolveDocumentFonts();
      if (!disposed) await onFonts(fonts);
    } catch (error) {
      if (!disposed) console.error('Failed to resolve document fonts', error);
    }
  }
  function scheduleRefresh() {
    if (disposed || refreshHandle !== undefined) return;
    refreshHandle = setTimeout(() => {
      refreshHandle = undefined;
      void refresh();
    }, 0);
  }
  const fontFaceSet = document.fonts;
  const events = ['loading', 'loadingdone', 'loadingerror'] as const;
  for (const event of events) fontFaceSet?.addEventListener(event, scheduleRefresh);
  const observer =
    typeof MutationObserver === 'undefined'
      ? undefined
      : new MutationObserver((mutations) => {
          for (const mutation of mutations) {
            if (
              (mutation.type === 'attributes' && isStyleSheetNode(mutation.target)) ||
              (mutation.type === 'childList' &&
                [...mutation.addedNodes, ...mutation.removedNodes].some(isStyleSheetNode))
            ) {
              scheduleRefresh();
              return;
            }
          }
        });
  try {
    observer?.observe(document.head ?? document.documentElement ?? document, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['rel', 'href'],
    });
  } catch {
    observer?.disconnect();
  }
  return () => {
    if (disposed) return;
    disposed = true;
    if (refreshHandle !== undefined) clearTimeout(refreshHandle);
    for (const event of events) fontFaceSet?.removeEventListener(event, scheduleRefresh);
    observer?.disconnect();
  };
}

function isStyleSheetNode(node: Node): boolean {
  if (typeof HTMLStyleElement !== 'undefined' && node instanceof HTMLStyleElement) return true;
  return (
    typeof HTMLLinkElement !== 'undefined' &&
    node instanceof HTMLLinkElement &&
    node.rel?.toLowerCase() === 'stylesheet'
  );
}

type FontExtractionContext = {
  visited: Set<string>;
};

const descriptorMap: readonly [string, string][] = [
  ['font-style', 'style'],
  ['font-weight', 'weight'],
  ['font-stretch', 'stretch'],
  ['unicode-range', 'unicodeRange'],
  ['font-variant', 'variant'],
  ['font-feature-settings', 'featureSettings'],
  ['font-display', 'display'],
  ['ascent-override', 'ascentOverride'],
  ['descent-override', 'descentOverride'],
  ['line-gap-override', 'lineGapOverride'],
];

function createContext(): FontExtractionContext {
  return { visited: new Set<string>() };
}

function stripQuotes(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) return trimmed.slice(1, -1);
  if (trimmed.startsWith("'") && trimmed.endsWith("'")) return trimmed.slice(1, -1);
  return trimmed;
}

function normalizeSrc(src: string, baseUrl: string): string {
  const urlPattern = /url\(([^)]+)\)/gi;
  return src.replace(urlPattern, (_, raw) => {
    const trimmed = raw.trim();
    const unquoted = stripQuotes(trimmed);
    if (!unquoted) return `url(${raw})`;
    try {
      const absolute = new URL(unquoted, baseUrl).toString();
      const quote = trimmed.startsWith('"') ? '"' : trimmed.startsWith("'") ? "'" : '';
      return `url(${quote}${absolute}${quote})`;
    } catch {
      return `url(${raw})`;
    }
  });
}

function toFontFace(rule: CSSFontFaceRule, baseUrl: string | undefined): TimescopeFont | null {
  const familyValue = rule.style.getPropertyValue('font-family');
  const srcValue = rule.style.getPropertyValue('src');
  const family = stripQuotes(familyValue);
  if (!family || !srcValue) return null;
  const desc: FontFaceDescriptors = {};
  for (const [cssProp, key] of descriptorMap) {
    const value = rule.style.getPropertyValue(cssProp);
    if (value.trim()) (desc as Record<string, string>)[key] = value.trim();
  }
  return {
    family,
    source: baseUrl ? normalizeSrc(srcValue, baseUrl) : srcValue,
    desc,
  };
}

function resolveDocumentBase(): string | undefined {
  if (typeof document !== 'undefined' && document.baseURI) return document.baseURI;
  if (typeof location !== 'undefined' && location.href) return location.href;
  return undefined;
}

function tryResolveUrl(url: string, baseUrl: string | undefined): string | null {
  try {
    if (baseUrl) return new URL(url, baseUrl).toString();
    return new URL(url).toString();
  } catch {
    return null;
  }
}

function getCssRules(sheet: CSSStyleSheet): CSSRule[] | null {
  try {
    const rules = sheet.cssRules;
    return Array.from(rules);
  } catch {
    return null;
  }
}

async function extractFontsFromRules(
  rules: CSSRule[],
  baseUrl: string | undefined,
  ctx: FontExtractionContext,
): Promise<TimescopeFont[]> {
  const fonts: TimescopeFont[] = [];
  const effectiveBase = baseUrl ?? resolveDocumentBase();

  for (const rule of rules) {
    if (rule.type === CSSRule.FONT_FACE_RULE) {
      const font = toFontFace(rule as CSSFontFaceRule, effectiveBase);
      if (font) fonts.push(font);
      continue;
    }

    if (rule.type === CSSRule.IMPORT_RULE) {
      const importRule = rule as CSSImportRule;
      const resolved = tryResolveUrl(importRule.href, effectiveBase);
      if (!resolved) continue;
      fonts.push(...(await extractFontsFromUrl(resolved, ctx)));
    }
  }

  return fonts;
}

async function extractFontsFromSheet(
  sheet: CSSStyleSheet,
  baseUrl: string | undefined,
  ctx: FontExtractionContext,
): Promise<TimescopeFont[]> {
  const rules = getCssRules(sheet);
  if (!rules) {
    if (sheet.href) return await extractFontsFromUrl(sheet.href, ctx, baseUrl);
    return [];
  }

  const effectiveBase = baseUrl ?? sheet.href ?? resolveDocumentBase();
  return await extractFontsFromRules(rules, effectiveBase, ctx);
}

async function extractFontsFromUrl(
  url: string,
  ctx: FontExtractionContext,
  baseUrl?: string,
): Promise<TimescopeFont[]> {
  const resolved = tryResolveUrl(url, baseUrl);
  if (!resolved) return [];
  if (ctx.visited.has(resolved)) return [];
  ctx.visited.add(resolved);

  if (typeof fetch === 'undefined' || typeof CSSStyleSheet === 'undefined') {
    throw new Error(`Failed to load CSS: ${resolved}`);
  }

  try {
    const response = await fetch(resolved);
    if (!response.ok) throw new Error();
    const cssText = await response.text();
    const sheet = new CSSStyleSheet();
    await sheet.replace(cssText);
    return await extractFontsFromSheet(sheet, response.url, ctx);
  } catch {
    throw new Error(`Failed to load CSS: ${resolved}`);
  }
}

export async function resolveFonts(fonts: (string | TimescopeFont)[]): Promise<TimescopeFont[]> {
  const ctx = createContext();
  const result: TimescopeFont[] = [];

  for (let font of fonts) {
    if (typeof font === 'string') {
      const extracted = await extractFontsFromUrl(font, ctx);
      result.push(...extracted);
      continue;
    } else {
      if (typeof font.source === 'string') {
        const baseUrl = resolveDocumentBase();
        if (baseUrl) font = { ...font, source: normalizeSrc(font.source, baseUrl) };
      }
    }

    result.push(font);
  }

  return result;
}

export async function resolveDocumentFonts(): Promise<TimescopeFont[]> {
  if (typeof document === 'undefined' || !document.styleSheets) return [];

  const ctx = createContext();
  const result: TimescopeFont[] = [];
  const fallbackBase = resolveDocumentBase();

  for (const sheet of Array.from(document.styleSheets)) {
    let cssSheet: CSSStyleSheet;
    try {
      cssSheet = sheet as CSSStyleSheet;
    } catch {
      continue;
    }

    const baseUrl = cssSheet.href ?? fallbackBase;

    try {
      const extracted = await extractFontsFromSheet(cssSheet, baseUrl, ctx);

      result.push(...extracted);
    } catch {
      continue;
    }
  }

  return result;
}
