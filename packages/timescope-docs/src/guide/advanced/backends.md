---
title: Rendering Backends
---

# Rendering Backends

Choose a drawing target for interactive charts or image exports in the browser and Node.js. The same data and chart configuration can be used in either environment.

| Environment          | Backend         | Target                                        |
| -------------------- | --------------- | --------------------------------------------- |
| Browser              | `'canvas'`      | DOM container, selector, or compatible canvas |
| Node.js image export | `'skia-canvas'` | `Canvas` from `skia-canvas`                   |

## Browser charts

The examples in [Drawing a Chart](/guide/drawing-a-chart) use the browser Canvas backend with automatic sizing and thread selection. Set `renderThread` only when your environment requires a specific rendering thread:

| `renderThread` | Browser rendering                              |
| -------------- | ---------------------------------------------- |
| Omitted        | Worker when supported; otherwise main thread   |
| `'main'`       | Main thread                                    |
| `'worker'`     | Require Worker support and a compatible target |

```ts
import { Timescope } from 'timescope';

const timescope = new Timescope({
  target: '#chart',
  renderThread: 'main',
});
```

`backend` and `renderThread` are constructor-only. [Constructor reference](/api/timescope#options-constructor-only)

## External canvases and sizing

Pass a container or selector as `target` for automatic sizing, or supply an existing canvas when your application manages its size. Read `timescope.canvas` to access the mounted canvas.

Container targets follow layout automatically; supplied canvases require explicit resizing:

| Target            | Size                                                              | On disposal                  |
| ----------------- | ----------------------------------------------------------------- | ---------------------------- |
| Browser container | Automatic; size the target with CSS; fallback height `36px`       | Chart-created canvas removed |
| Supplied canvas   | `await timescope.resize(width, height, dpr)`; DPR defaults to `1` | Supplied canvas retained     |

After resizing an export canvas, [wait for data and drawing](/guide/advanced/views#wait-for-data-and-drawing) before reading pixels.

Set dimensions and background on the target with CSS. Give the target a definite height for a chart; otherwise it uses a `36px` fallback. The canvas is transparent; CSS backgrounds are not included in exported pixels.

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

Here, time-axis labels use normal 16px Chart Labels; Tooltips use bold 12px Chart Labels. Other text retains its default size. For an installed system font, `font: { family: 'MS Gothic' }` is enough without a `fonts` entry.

A string such as `'bold 14px "MS Gothic"'` is a complete font declaration, not a family name. A local string replaces the global font; local objects inherit defaults rather than properties from a global string. Prefer objects for combined global and local settings.

For text Marks, size priority is local string font → local object `font.size` → Mark `style.size` → global object `font.size` → default. A global string is used unchanged when neither a local font nor an explicit Mark size is set.

Use `updateOptions({ font: { weight: 'normal' } })` to change only the weight, or `updateOptions({ font: undefined })` to clear the style. `setOptions()` replaces the configuration. [Framework components](/guide/advanced/frameworks/overview) accept the style through `options.font`.

### Load custom font data

`fonts` loads additional font data in the browser; it does not select the drawing font. It is constructor-only, or a separate creation-only prop in framework components.

| `fonts`                | Additional fonts loaded in the browser    |
| ---------------------- | ----------------------------------------- |
| Omitted                | Accessible document `@font-face` rules    |
| `[]`                   | None                                      |
| URL / definition array | Specified stylesheets or font definitions |

[Font inputs](/api/timescope#fonts) · [Font styles](/api/timescope-options#font-style) · [Framework components](/guide/advanced/frameworks/overview)
