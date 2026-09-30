---
title: Backends
---

# Rendering Backends

Choose a drawing target for an interactive browser chart or a server-generated image. The same data and chart configuration can be used in either environment.

| Environment          | Backend         | Target                                        |
| -------------------- | --------------- | --------------------------------------------- |
| Browser              | `'canvas'`      | DOM container, selector, or compatible canvas |
| Node.js image export | `'skia-canvas'` | `Canvas` from `skia-canvas`                   |

## Browser charts

Pass a container or its selector to create a chart that follows the container's layout. Give the chart a height appropriate for your page.

```html
<div id="chart"></div>
```

```ts
import { Timescope } from 'timescope';

const timescope = new Timescope({
  target: '#chart',
  style: { height: '240px' },
});
```

### Rendering threads

Automatic thread selection suits most browser charts. Set `renderThread` when your application's environment requires a specific rendering thread.

| `renderThread` | Browser rendering                              |
| -------------- | ---------------------------------------------- |
| Omitted        | Worker when supported; otherwise main thread   |
| `'main'`       | Main thread                                    |
| `'worker'`     | Require Worker support and a compatible target |

```ts
const timescope = new Timescope({
  target: '#chart',
  renderThread: 'main',
  style: { height: '240px' },
});
```

`backend` and `renderThread` are constructor-only. [Constructor reference](/api/timescope#options-constructor-only)

## Render a PNG in Node.js

Use the Skia Canvas backend to generate an image for a report or download. Create a canvas at the desired size, then load and draw the view before saving it.

```bash
npm install timescope skia-canvas
```

```ts
import { Canvas } from 'skia-canvas';
import { Timescope } from 'timescope';

const canvas = new Canvas(800, 240);
const timescope = new Timescope({
  target: canvas,
  backend: 'skia-canvas',
  fonts: [],
  fit: { range: [0, 30], padding: 24 },
  sources: {
    values: [
      { time: 0, value: 1 },
      { time: 30, value: 2 },
    ],
  },
  series: { values: { data: { source: 'values' }, chart: 'lines' } },
  tracks: { default: { timeAxis: { relative: true } } },
});

try {
  await timescope.prepareView().fetch();
  await timescope.nextFrame();
  await canvas.toFile('chart.png');
} finally {
  timescope.dispose();
}
```

## External canvases and sizing

Supply an existing canvas when your application needs to own the drawing surface. Resize it through Timescope when the output dimensions change.

| Target            | Size                                                              | On disposal                  |
| ----------------- | ----------------------------------------------------------------- | ---------------------------- |
| Browser container | Automatic; set `style.width` / `style.height`                     | Chart-created canvas removed |
| Supplied canvas   | `await timescope.resize(width, height, dpr)`; DPR defaults to `1` | Supplied canvas retained     |

After resizing an export canvas, [wait for data and drawing](/guide/advanced/views#wait-for-data-and-drawing) before reading pixels.

## Fonts

`fonts` loads custom font data; `font` selects the global text style. Loading a font does not automatically select it. To use an installed system font, set `font: { family: 'MS Gothic' }` without adding a font definition.

Use an object to change the family while retaining the default size and weight at each location. The example below selects a custom font for all ordinary text, with a local size override for time-axis labels.

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

The global style applies to text marks, time-axis and value-axis labels, and tooltips, but not icons. Local object properties override the global object property by property; unspecified values inherit, then fall back to each location's defaults. String styles are complete CSS canvas declarations (for example, `'normal 12px "Chart Labels"'`), not family names or mergeable objects.

Change `font` later with `setOptions()` or `updateOptions()`. `fonts` is constructor-only. In framework components, pass the style through `options.font` and font data through the separate `fonts` prop.

| `fonts`                | Additional fonts loaded in the browser    |
| ---------------------- | ----------------------------------------- |
| Omitted                | Accessible document `@font-face` rules    |
| `[]`                   | None                                      |
| URL / definition array | Specified stylesheets or font definitions |

The bundled `Timescope` font is automatically loaded in browser charts and registered with Skia Canvas in Node.js. The Skia Canvas backend ignores the `fonts` option; register additional fonts with `FontLibrary.use()` before drawing. The bundled font file is also exported as `timescope/Timescope.woff2`.

[Font inputs](/api/timescope#fonts) · [Font styles](/api/timescope-options#font-style) · [Framework components](/guide/advanced/frameworks)
