---
title: Rendering Backends
---

# Rendering Backends

The same chart configuration works in the browser and Node.js. In the browser, the `'canvas'` backend can mount into a DOM container or use a supplied canvas. For Node.js image exports, use the `'skia-canvas'` backend with a `Canvas` from `skia-canvas`.

Omit `backend` for automatic selection, normally Canvas in browsers and Skia Canvas in Node.js. An array of candidates selects the first compatible backend. `environment` can override the canvas environment's scheduler, path constructor, and font collection.

## Browser charts

The examples in [Drawing a Chart](/guide/drawing-a-chart) use automatic sizing and thread selection. Usually you can leave `renderThread` unspecified. If your environment requires main-thread rendering, set it explicitly:

```ts
import { Timescope } from 'timescope';

const timescope = new Timescope({
  target: '#chart',
  renderThread: 'main',
});
```

Use `renderThread: 'worker'` to require Worker rendering; this needs Worker support and a compatible target. Both `backend` and `renderThread` are constructor-only. [Constructor options](/api/types#timescopeoptionsinitial)

## External canvases and sizing

Pass a container or selector as `target` to let the chart follow its layout automatically. Set its dimensions with CSS, including a definite height. Timescope creates the canvas and removes it when disposed.

Omit the constructor's `target` to mount later with `timescope.mount(target)`. Built-in backends require a compatible target. `timescope.canvas` is `null` while unmounted.

Supply an existing canvas when your application needs to manage its dimensions, such as for a fixed-size export. Resize it with `await timescope.resize(width, height, dpr)`; `dpr` defaults to `1`. Timescope retains a supplied canvas when disposed, so your application keeps ownership of it.

`resize()` returns `false` for automatically sized targets or a failed resize.

Read `timescope.canvas` to access the mounted canvas. After resizing an export canvas, [wait for data and drawing](/guide/advanced/views#wait-for-data-and-drawing) before reading pixels. The canvas is transparent; a CSS background on its container is not included in exported pixels.

For inherited label colors, theme changes, and transparent backgrounds, see [Styling](/guide/advanced/styling).

## Render a PNG in the browser

Keep shared chart and initial-view settings in `options` and mount into `#chart`. Browser PNG export works with both Worker and main-thread rendering; no `renderThread: 'main'` override is needed. Follow the [data-and-drawing completion sequence](/guide/advanced/views#wait-for-data-and-drawing) before encoding it:

```html
<div id="chart" style="width: 800px; height: 240px"></div>
```

```ts
import { Timescope } from 'timescope';

const timescope = new Timescope({
  ...options,
  target: '#chart',
  backend: 'canvas',
});

try {
  await timescope.prepareView().fetch();
  await timescope.nextFrame();

  const canvas = timescope.canvas;
  if (!(canvas instanceof HTMLCanvasElement)) throw new Error('Expected a browser canvas');

  const png = canvas.toDataURL('image/png');
  // Use png as an <img> src or a download link's href.
} finally {
  timescope.dispose();
}
```

The result is a PNG data URL, ready for an image or download link. The PNG uses the canvas's pixel dimensions, including DPR; use a [supplied canvas](#external-canvases-and-sizing) for a fixed output size.

## Render a PNG in Node.js

Reuse the same `options` and completion sequence. Supply a `Canvas` from `skia-canvas`, select `backend: 'skia-canvas'`, and save the PNG with `toFile()`.

```bash
npm install timescope skia-canvas
```

```ts {6-7}
import { Canvas } from 'skia-canvas';
import { Timescope } from 'timescope';

const timescope = new Timescope({
  ...options,
  target: new Canvas(800, 240),
  backend: 'skia-canvas',
});

try {
  await timescope.prepareView().fetch();
  await timescope.nextFrame();

  const canvas = timescope.canvas;
  if (!(canvas instanceof Canvas)) throw new Error('Expected a Skia canvas');

  await canvas.toFile('chart.png');
} finally {
  timescope.dispose();
}
```

## Fonts

### Select a font style

`font` selects the global style for text Marks, axis labels, and Tooltips, but not icon Marks. Object properties inherit from local settings, then the global style, then each location's defaults:

```ts
const timescope = new Timescope({
  target: '#chart',
  fonts: [{ family: 'Chart Labels', source: 'url(/fonts/chart-labels.woff2)' }],
  font: { family: 'Chart Labels, sans-serif', weight: 'bold' },
  tracks: {
    default: { timeAxis: { labels: { font: { size: 16, weight: 'normal' } } } },
  },
});
```

Here, time-axis labels use normal 16px Chart Labels; other text uses bold Chart Labels at its default size. For an installed system font, `font: { family: 'MS Gothic' }` is enough without a `fonts` entry.

A string such as `'bold 14px "MS Gothic"'` is a complete font declaration, not a family name. A local string replaces the global font; local objects inherit defaults rather than properties from a global string. Prefer objects for combined global and local settings.

In font objects, numeric `size` is in pixels and numeric `lineHeight` is unitless; strings use CSS font-size and line-height syntax. `family` can list comma-separated fallback families. Icon fonts use local settings only.

For text Marks, size priority is local string font → local object `font.size` → Mark `style.size` → global object `font.size` → default. A global string is used unchanged when neither a local font nor an explicit Mark size is set.

Use `updateOptions({ font: { weight: 'normal' } })` to change only the weight, or `updateOptions({ font: undefined })` to clear the style. `setOptions()` replaces the configuration. [Framework components](/guide/advanced/frameworks/overview) accept the style through `options.font`.

### Load custom font data

`fonts` loads additional font data in the browser; it does not select the drawing font. It is constructor-only, or a separate creation-only prop in framework components.

When `fonts` is omitted, Timescope loads accessible document `@font-face` rules. To choose the font data explicitly, supply stylesheet URLs or font definitions, as in the example above. Pass `fonts: []` to skip loading additional fonts.

Skia Canvas ignores `fonts`. The Timescope font is always available.

[Font inputs](/api/types#timescopeoptionsinitial) · [Font styles](/api/types#timescopefontstyle) · [Framework components](/guide/advanced/frameworks/overview)
