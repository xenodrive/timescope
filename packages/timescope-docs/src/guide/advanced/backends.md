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

Keep shared chart and initial-view settings in `options` and mount into `#chart`. Use main-thread rendering and follow the [data-and-drawing completion sequence](/guide/advanced/views#wait-for-data-and-drawing) before encoding it:

```html
<div id="chart" style="width: 800px; height: 240px"></div>
```

```ts
import { Timescope } from 'timescope';

const timescope = new Timescope({
  ...options,
  target: '#chart',
  backend: 'canvas',
  renderThread: 'main',
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

```ts
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

`font` selects the global font style for text Marks, axis labels, and Tooltips, but not icon Marks. Use an object to retain each location's default size and weight. Here, a local override changes only the time-axis label size:

```ts
const timescope = new Timescope({
  target: '#chart',
  fonts: [{ family: 'Chart Labels', source: 'url(/fonts/chart-labels.woff2)' }],
  font: { family: 'Chart Labels, sans-serif' },
  tracks: {
    default: { timeAxis: { labels: { font: { size: 16 } } } },
  },
});
```

For an installed system font, `font: { family: 'MS Gothic' }` is enough. String styles must be complete CSS canvas font declarations, not family names. See [Font Style](/api/timescope-options#font-style) for inheritance and size precedence.

Change `font` later with `setOptions()` or `updateOptions()`. [Framework components](/guide/advanced/frameworks) accept it through `options.font`.

### Load custom font data

`fonts` loads additional font data in the browser; it does not select the drawing font. It is constructor-only, or a separate creation-only prop in framework components.

| `fonts`                | Additional fonts loaded in the browser    |
| ---------------------- | ----------------------------------------- |
| Omitted                | Accessible document `@font-face` rules    |
| `[]`                   | None                                      |
| URL / definition array | Specified stylesheets or font definitions |

[Font inputs](/api/timescope#fonts) · [Font styles](/api/timescope-options#font-style) · [Framework components](/guide/advanced/frameworks)
