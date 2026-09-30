import type { TimescopeBackendHost } from '#src/main/backend';
import { canvasMainBackend } from '#src/main/backends/canvas.main';
import { canvasWorkerBackend } from '#src/main/backends/canvas.worker';
import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => vi.unstubAllGlobals());

function host(): TimescopeBackendHost {
  return {
    fontsChanged: vi.fn(async () => {}),
    sizeChanged: vi.fn(),
    pointer: vi.fn(),
    wheel: vi.fn(),
    pointerStyle: async () => undefined,
    isDisabled: () => false,
  };
}

function fontRule(family: string, source: string) {
  return {
    type: 5,
    style: {
      getPropertyValue: (key: string) =>
        ({
          'font-family': family,
          src: source,
        })[key] ?? '',
    },
  };
}

it.each([canvasMainBackend, canvasWorkerBackend])(
  'resolves CSS imports and URLs before returning fonts without changing caller buffers',
  async (backend) => {
    vi.stubGlobal('document', { baseURI: 'https://example.test/page/' });
    vi.stubGlobal('CSSRule', { FONT_FACE_RULE: 5, IMPORT_RULE: 3 });
    vi.stubGlobal(
      'CSSStyleSheet',
      class {
        cssRules: unknown[] = [];
        async replace(text: string) {
          this.cssRules =
            text === 'root stylesheet'
              ? [{ type: 3, href: 'nested.css' }, fontRule('Labels', 'url(../labels.woff2)')]
              : [{ type: 3, href: 'root.css' }, fontRule('Icons', 'url(icons.woff2)')];
        }
      },
    );
    const fetch = vi.fn(async (url: string) => ({
      ok: true,
      url,
      text: async () => (url.endsWith('root.css') ? 'root stylesheet' : 'nested stylesheet'),
    }));
    vi.stubGlobal('fetch', fetch);
    const source = new Uint8Array([1, 2, 3]);
    const definition = { family: 'Custom', source: 'url(custom.woff2)' };
    const mounted = await backend.mount(
      {
        target: { width: 20, height: 10, getContext: () => null },
        fonts: ['https://example.test/css/root.css', definition, { family: 'Binary', source }],
      },
      host(),
    );
    try {
      expect(mounted.fonts.map((font) => font.family)).toEqual(['Timescope', 'Icons', 'Labels', 'Custom', 'Binary']);
      expect(mounted.fonts[1].source).toBe('url(https://example.test/css/icons.woff2)');
      expect(mounted.fonts[2].source).toBe('url(https://example.test/labels.woff2)');
      expect(mounted.fonts[3].source).toBe('url(https://example.test/page/custom.woff2)');
      expect(definition.source).toBe('url(custom.woff2)');
      expect(mounted.fonts[4].source).toBe(source);
      expect(source.byteLength).toBe(3);
      expect(fetch).toHaveBeenCalledTimes(2);
    } finally {
      mounted.dispose();
    }
  },
);

it('moves document font watching into the backend and stops updates after disposal', async () => {
  const events = new EventTarget();
  const rules = [fontRule('First', 'url(first.woff2)')];
  vi.stubGlobal('CSSRule', { FONT_FACE_RULE: 5, IMPORT_RULE: 3 });
  vi.stubGlobal('document', {
    baseURI: 'https://example.test/',
    fonts: events,
    styleSheets: [{ cssRules: rules }],
  });
  const backendHost = host();
  const mounted = await canvasMainBackend.mount(
    {
      target: { width: 20, height: 10, getContext: () => null },
    },
    backendHost,
  );
  try {
    expect(mounted.fonts.map((font) => font.family)).toEqual(['Timescope', 'First']);
    rules.push(fontRule('Second', 'url(second.woff2)'));
    events.dispatchEvent(new Event('loadingdone'));
    await vi.waitFor(() => expect(backendHost.fontsChanged).toHaveBeenCalledOnce());
    expect(backendHost.fontsChanged).toHaveBeenCalledWith([
      { family: 'First', source: 'url(https://example.test/first.woff2)', desc: {} },
      { family: 'Second', source: 'url(https://example.test/second.woff2)', desc: {} },
    ]);
    events.dispatchEvent(new Event('loadingdone'));
    mounted.dispose();
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(backendHost.fontsChanged).toHaveBeenCalledOnce();
  } finally {
    mounted.dispose();
  }
});
