---
title: Backends
---

# Rendering Backends

The rendering backend determines which drawing surface Timescope uses. The built-in choices cover interactive charts in a browser and image generation in Node.js.

## Available backends

| Backend         | Typical use                                     | Target                                                | Rendering thread                             |
| --------------- | ----------------------------------------------- | ----------------------------------------------------- | -------------------------------------------- |
| `'canvas'`      | Interactive browser charts                      | A DOM container, its selector, or a compatible canvas | Worker when supported; otherwise main thread |
| `'skia-canvas'` | Server-side charts and image exports in Node.js | A `Canvas` from `skia-canvas`                         | Current thread                               |

Both use the same sources, series, tracks, and chart options. Start with automatic selection unless your application needs a specific drawing environment.

## Browser charts

Pass a container or selector. Timescope creates and sizes the canvas for that container:

```ts
import { Timescope } from 'timescope';

const timescope = new Timescope({
  target: '#chart',
  style: { height: '240px' },
});

// When the chart is no longer needed:
// timescope.dispose();
```

Framework applications can use a [binding](/guide/advanced/frameworks) to handle mounting and disposal automatically.

### Rendering threads

In a browser, Timescope automatically uses a Worker when Worker rendering and canvas transfer are available. Otherwise it draws on the main thread. `renderThread` makes the choice explicit:

```ts
const timescope = new Timescope({
  target: '#chart',
  backend: 'canvas',
  renderThread: 'main',
});
```

- Omit `renderThread` to allow automatic selection.
- Use `'main'` when your environment requires rendering on the main thread.
- Use `'worker'` to require Worker rendering on a supported environment and target.

`backend` and `renderThread` are constructor-only options. To change them, create a new Timescope instance.

## Render a PNG in Node.js

Use the Skia Canvas backend to generate images without a DOM. Install `skia-canvas` alongside Timescope:

```bash
npm install timescope skia-canvas
```

Create a canvas with the desired dimensions, load the view's data, and wait for drawing before exporting:

```ts
import { Canvas } from 'skia-canvas';
import { Timescope } from 'timescope';

const canvas = new Canvas(800, 240);
const timescope = new Timescope({
  target: canvas,
  backend: 'skia-canvas',
  fonts: [],
  time: 15,
  zoom: 4,
  sources: {
    values: [
      { time: 0, value: 1 },
      { time: 30, value: 2 },
    ],
  },
  series: { values: { data: { source: 'values' }, chart: 'lines' } },
});

try {
  await timescope.prepareView().fetch();
  await timescope.nextFrame();
  await canvas.toFile('chart.png');
} finally {
  timescope.dispose();
}
```

`prepareView().fetch()` loads and activates the view's data; `nextFrame()` waits for it to be drawn. Wait for both before exporting. See [Controlling Views](/guide/advanced/views#wait-for-data-and-drawing) for cancellation and view changes.

The Skia Canvas backend uses a supplied Skia Canvas on the current thread.

## External canvases and sizing

When you supply a canvas instead of a container, your application owns it. Timescope draws into it and leaves the supplied element in place when unmounted or disposed.

After changing the desired dimensions, request an explicit resize:

```ts
await timescope.resize(1200, 360, 1);
```

The optional third argument is device pixel ratio (default `1`). Use `nextFrame()` after preparing any newly visible data if you need the resized pixels for an export. Container-backed browser charts are sized automatically; give their container a non-zero layout size.

## Fonts

The bundled `Timescope` font loads automatically in browser renderers and is the default for time-axis labels, value axes, text marks, and tooltips. Icon marks keep their own `icons` default. `fonts` configures additional font loading at creation:

- Omit it in the browser to load fonts declared by accessible document `@font-face` rules.
- Pass `[]` to disable document font loading, as in the Node.js example. In browsers the bundled font still loads.
- Pass CSS stylesheet URLs or explicit `{ family, source, desc? }` definitions to choose fonts.

```ts
const timescope = new Timescope({
  target: '#chart',
  fonts: [{ family: 'Chart Labels', source: 'url(/fonts/chart-labels.woff2)' }],
});
```

Loading a font makes it available; select its family in the relevant [text styles](/api/timescope-options#text). Explicit font sources are useful when the document's font rules are not accessible. Custom `font` values are used as provided; add `Timescope` to their family list if you want it as a fallback. The bundled font is not automatically registered with Skia Canvas in Node.js. See the [font option reference](/api/timescope#fonts) for accepted source types.

## Backend selection

With `backend` omitted, browser builds select Canvas; Node.js builds try Skia Canvas before standard Canvas. The target still needs to be compatible with the selected backend.

Set `backend` to `'canvas'`, `'skia-canvas'`, or an ordered array of these choices. Timescope selects the first compatible candidate. For example, a Node.js application that accepts different canvas types can use `backend: ['skia-canvas', 'canvas']`. The Canvas backend also accepts compatible Canvas implementations with an appropriate `environment`.

Subscribe to `timescope.on('error', handler)` to report backend selection or initialization failures; its event carries the `Error` in `event.value`. See [constructor options](/api/timescope#options-constructor-only) for the accepted types.
