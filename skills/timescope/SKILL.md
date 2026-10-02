---
name: timescope
description: >-
  Implement time selection and interactive time-series visualizations with
  Timescope. Use when asked to build something with Timescope, or when extending
  or debugging an application using timescope or @timescope framework bindings.
  Covers timepicker integration, initial views, playback synchronization, data
   loading, charts, tracks, domains, fonts, and custom marks and links.
---

# Timescope

Translate the requested behavior into Timescope configuration and API calls.
Assume Timescope has already been chosen; focus on implementing the requested UI.

## Implementation model

- The UI is a horizontal timeline with the selected time at the center cursor.
  It can select time without displaying any data series.
- The horizontal coordinate is always time. Selected time and resolution determine
  the visible window; resolution is time units per pixel: `2 ** (-zoom)`.
  Increasing zoom narrows the visible window.
- Data visualization shares that interactive time axis. Sources supply rows;
  Series associate data with a value Domain and presentation; Charts draw marks
  and links; Tracks provide vertically stacked drawing regions.
- A `chart` preset is a named combination of marks and links, such as
  `'linespoints'`. Compose `chart.marks` and `chart.links` for custom rendering.

## Workflow

1. Inspect the project's framework, package manager, and installed versions of
   `timescope` and any `@timescope/*` binding before choosing APIs.
2. Identify the required state and data flow: selected time, external playback or
   controls, displayed data, and which component owns each update. Use the task
   map below to choose APIs.
3. Check the installed package's exports and type declarations, and read the
   relevant API reference for contracts such as loader ranges and source updates.
   Public documentation may describe a different version; resolve differences
   against the installed package.
4. Implement the requested data flow and presentation using explicit time units,
   source references, and shared domains where needed. The examples below
   illustrate direct class usage; adapt them to the application's structure.
5. Match cleanup to the application's lifecycle. Omit cleanup code when the
   instance lives for the whole page and changes cause a full-page reload.
   For HMR or view/module teardown within the same document, dispose directly
   owned instances and clean up application-owned resources. Instance disposal
   also removes its event listeners.

## Task to implementation map

Use these API references for the requested feature.

| Requested behavior | Implementation approach | Reference |
| --- | --- | --- |
| Select a time and notify the application | Set initial `time`; subscribe to `timechanged` and read `event.value`. Use `timechanging` for feedback during an active change. | [Events](https://xenodrive.github.io/timescope/api/timescope#events) |
| Change the selected time from another control | Call `setTime(value, animation?)`; use `false` for an immediate change. Keep external state synchronization from echoing updates indefinitely. | [Methods](https://xenodrive.github.io/timescope/api/timescope#methods) |
| Follow playback | Use `setPlaybackTime` to supply the live-clock value and `setTime(null)` to follow it. A fixed selected time and the playback clock are separate state. | [Timescope API](https://xenodrive.github.io/timescope/api/timescope) |
| Run setup when the view is available | Subscribe to `ready` before the first mount, or `mount` for each mount. For framework components, use the binding's lifecycle callbacks or events. | [Events](https://xenodrive.github.io/timescope/api/timescope#events), [Framework bindings](https://xenodrive.github.io/timescope/guide/advanced/frameworks/overview) |
| Load the next view before showing it | Create `const view = timescope.prepareView()`, set its time, zoom, or playback time, then `await view.fetch()`. Call `view.abort()` when that view is obsolete. | [Prepared views](https://xenodrive.github.io/timescope/api/timescope#prepared-views) |
| Wait for the drawn frame | Call `await timescope.nextFrame()` after `view.fetch()`. | [Methods](https://xenodrive.github.io/timescope/api/timescope#methods) |
| Set the initial visible interval | Pass `fit: [start, end]` to the constructor, or `fit: { range: [start, end], padding: [left, right] }` for pixel padding. Specify `fit` instead of initial `time` and `zoom`. | [Constructor](https://xenodrive.github.io/timescope/api/timescope#options-constructor-only) |
| Change or constrain the visible interval | `fitTo([start, end], { padding?, animation? })` changes the current view; `setTimeRange` limits navigation. Use `setZoom` and `setZoomRange` for zoom control and limits. | [Methods](https://xenodrive.github.io/timescope/api/timescope#methods) |
| Select a time range | Set `selection.range` only in the constructor for the initial range. Later, use `setSelectionRange(range)` or `clearSelectionRange()`; read the current `selectionRange`. | [Selection](https://xenodrive.github.io/timescope/api/timescope-options#selection) |
| Show or style the time cursor | Set `cursor: false` to hide it, or use `cursor: { color, borderColor }` to configure its fill and outline. | [Options](https://xenodrive.github.io/timescope/api/timescope-options#options) |
| Select or load a font | Set `options.font` for the global text style; prefer `{ family }` to retain per-location sizes. Use constructor-only `fonts` to load font data, and local `font` objects for overrides. | [Font styles](https://xenodrive.github.io/timescope/api/timescope-options#font-style), [font inputs](https://xenodrive.github.io/timescope/api/timescope#fonts) |
| Display existing data | Define rows in `sources`, reference the source through `series.*.data.source`, and choose a chart. Use `decoder` or `mappings` to adapt payloads. | [Sources](https://xenodrive.github.io/timescope/api/timescope-options#sources) |
| Fetch data for the visible region | Implement a range loader receiving `{ range, resolution }`; honor the range and neighboring-row contract. | [Range loader](https://xenodrive.github.io/timescope/api/timescope-options#range-loader) |
| Overlay or vertically separate data | Put Series on the same Track for overlays; select different Tracks to stack regions sharing the time axis. | [Tracks](https://xenodrive.github.io/timescope/api/timescope-options#tracks) |
| Compare values on a common scale | Define a shared entry in `domains` and reference it through each Series' `data.domain`. | [Domains](https://xenodrive.github.io/timescope/api/timescope-options#domains) |
| Customize the visual representation | Use a named `chart` preset or compose `chart.marks` and `chart.links`. Select named time/value fields, baselines, and track edges with `using`. | [Chart presets](https://xenodrive.github.io/timescope/api/timescope-options#chart-presets), [marks](https://xenodrive.github.io/timescope/api/timescope-options#marks), [links](https://xenodrive.github.io/timescope/api/timescope-options#links), [selectors](https://xenodrive.github.io/timescope/api/timescope-options#using-selectors) |
| Show values at the cursor | Configure `tooltip` and `data.instantaneous`; cursor sampling can use a different resolution from the chart. | [Instantaneous values](https://xenodrive.github.io/timescope/api/timescope-options#instantaneous-values) |
| Update data or configuration | Select the source's supported update/invalidation mechanism. Use `updateOptions` for partial configuration changes and `setOptions` for replacement. | [Source options](https://xenodrive.github.io/timescope/api/timescope-options#sources), [methods](https://xenodrive.github.io/timescope/api/timescope#methods) |

## Minimal examples

Install `timescope` with the project's package manager, for example:

```sh
npm install timescope
```

Provide a mount target in the page:

```html
<div id="timescope" style="height: 240px"></div>
```

Run either example on the client after the target exists, with a non-zero
container width. These examples are independent and omit cleanup for a
page-lifetime instance without HMR. Add the teardown registration described in
[Cleanup only when needed](#cleanup-only-when-needed) for HMR or a shorter-lived
view or module. Framework bindings handle instance disposal automatically.

### Timepicker: select a time and synchronize an external control

```ts
import { Timescope } from 'timescope';

const timescope = new Timescope({
  target: '#timescope',
  time: new Date('2026-01-01T12:00:00Z'),
});

// Store the initial value too: subscribing does not initialize application state.
let selectedTime = timescope.time; // Decimal | null
timescope.on('timechanged', (event) => {
  selectedTime = event.value;
  // Publish selectedTime to application state here.
});

// Call from an external date/time control. `false` disables animation.
function selectFromExternalControl(value: Date) {
  timescope.setTime(value, false);
}
```

Choose event timing deliberately: `timechanged` for committed changes,
`timechanging` for changes during interaction, and `timeanimating` for values
during animation. Do not assume events originate only from user gestures. When
connecting reactive state in both directions, compare values or otherwise guard
against feeding the same update back into the setter.

### Time-series visualization: connect data to a chart

```ts
import { Timescope } from 'timescope';

const timescope = new Timescope({
  target: '#timescope',
  fit: [0, 3],
  sources: {
    samples: [
      { time: 0, value: 0.2 },
      { time: 1, value: 0.45 },
      { time: 2, value: 0.6 },
      { time: 3, value: 0.4 },
    ],
  },
  series: {
    temperature: {
      data: { source: 'samples' },
      chart: 'linespoints',
    },
  },
  tracks: { default: { timeAxis: { relative: true } } },
});
```

This example uses relative times in seconds. Adapt the rows, source references,
and presentation to the requested data; keep time units consistent throughout.

### Cleanup only when needed

- **Page lifetime, no HMR:** When the instance stays active until a full-page
  reload, navigation, or tab close, omit cleanup functions and registrations.
  The browser releases the page's resources; do not add `unload` or
  `beforeunload` handlers solely to call `dispose()`.
- **HMR or teardown within the same document:** Register cleanup when a module
  is replaced by HMR, a SPA route leaves, or a manually owned view is removed.
  Dispose the old instance and stop application-owned timers, data producers,
  and listeners on external objects so they do not survive the replacement.
  For Vite HMR, add this to either example:

  ```ts
  function cleanup() {
    timescope.dispose(); // Also removes listeners registered with timescope.on().
    // Clean up application-owned resources here, if any.
  }

  import.meta.hot?.dispose(cleanup);
  ```

  For view teardown, register the same cleanup with the application's lifecycle
  hook. Defining a cleanup function without registering it is not sufficient.
- **Framework components:** The binding disposes its instance automatically;
  do not duplicate that disposal. Clean up application-owned resources when
  the component is unmounted.

### Fonts: global style and local overrides

`font` selects the text style; `fonts` loads font data at creation. They are
independent: a system font needs no entry in `fonts`, and loading a font does
not select it for drawing.

```ts
const timescope = new Timescope({
  target: '#timescope',
  fonts: [{ family: 'Chart Labels', source: 'url(/fonts/chart-labels.woff2)' }],
  font: { family: 'Chart Labels, sans-serif', weight: 'bold' },
  tracks: {
    default: { timeAxis: { labels: { font: { size: 16, weight: 'normal' } } } },
  },
});
```

Global `font` applies to text marks, time-axis and value-axis labels, and tooltips,
not icon marks. Object properties resolve independently: local `font` → global
`font` → per-location defaults. Missing or `undefined` properties inherit; a
family-only object preserves each location's default size and weight. In this
example, time-axis labels inherit the family but use normal weight and 16px.
Text-mark size precedence is local `font.size` → mark `style.size` → global
`font.size` → 14px. Other default sizes are 12px for time-axis labels and
tooltips, and 11px for value-axis labels.

Strings are complete CSS canvas font declarations, such as
`'bold 14px "MS Gothic"'`; `'MS Gothic'` alone is not valid. A local string
overrides the global font entirely. A global string is used unchanged only
when no local font or explicit mark size is supplied. Local object properties
cannot inherit from a CSS string; use object notation for property-wise merging.

Change the global style with `updateOptions({ font: { weight: 'normal' } })`;
other global properties are retained. Use `updateOptions({ font: undefined })`
to clear it. `setOptions` replaces the configuration, so an omitted `font`
returns to the defaults.

## Important rules

- Numeric times use seconds by default. Do not pass `Date.now()` as seconds:
  use a `Date`, an ISO date string, or explicitly convert milliseconds to seconds.
- `time: null` and `setTime(null)` follow the live clock. For historical or
  relative data, initialize with an explicit `time` or `fit` range.
  `setPlaybackTime()` supplies a clock value, not an advancing timer; update it
  on each media/data tick and use `setTime(null)` to follow it.
- An initial `fit` accepts `[start, end]` or `{ range: [start, end], padding }`;
  `padding` is a number for both sides or `[left, right]` in CSS pixels. Do not
  combine initial `fit` with `time` or `zoom`. It is applied once when the canvas
  has a non-zero size. Resizing does not reapply it.
- Use `Decimal` to preserve precision in time and value calculations and loader
  requests. Convert to `number` when the application's range and precision allow it.
- Charts on the same Track are overlaid, but their value scales are independent
  unless they explicitly share a Domain. Use a shared Domain to compare values
  on the same scale.
- Prefer the implicit `default` Track for a single drawing region. When no Track
  customization is needed, omit `tracks` rather than adding an empty named Track
  such as `tracks: { main: {} }` or `tracks: { default: {} }`. Series can omit
  `track`, or explicitly use `track: 'default'` without defining `tracks`.
  Define `tracks.default` only for overrides such as time-axis settings; use
  additional named Tracks when separate drawing regions are needed.
  If `tracks` is defined, Series without `track` use its first entry; an explicit
  `track: 'default'` then requires a `default` entry. Keep even empty entries when
  they define multiple regions, because their number and order determine layout.
  `tracks: {}` is invalid. Omitting `tracks` restores the implicit Track in a
  constructor or `setOptions()`; omission in `updateOptions()` retains the
  existing layout.
- Inline data arrays are snapshots: mutating the original array does not update
  the visualization until invalidation. Keep a `createDataSource()` instance to
  invalidate or reuse it; retain that instance across appearance-only options
  updates to preserve loaded data.
  Only point-aggregate sources expose `append()` among the built-in source types.
- Function loaders default to range loading; set `chunked: false` for a no-argument
  loader returning a complete snapshot. A URL without placeholders loads a snapshot.
- Range loaders receive `{ range, resolution }` with Decimal values and a
  half-open `[start, end)` range. Return complete intersecting interval rows,
  not clipped intervals, plus available neighboring points for connections:
  one on each side for lines/steps, two for curves, even in empty ranges.
- `append()` requires nondecreasing times across initial and appended points;
  equal times are allowed. `await append()` means data updated, not drawing
  complete; advance the playback clock separately. `invalidate()` discards
  appends absent from the original input.
- `setOptions` replaces configurable options; `updateOptions` retains omitted
  options. To remove an individual Source, Series, Track, or Domain, pass `null`
  for its named entry in `updateOptions`. Updates that leave a Series referring
  to a missing Source, Track, or named Domain are rejected. Constructor-only
  inputs such as `fit` and `selection.range` do not remain in `options`; change
  current time, zoom, and selection range with their dedicated setters.
- `defaultOptions` is not a complete constructor configuration. Copy only the
  relevant group; its groups and arrays are frozen. Leave context-dependent
  defaults unspecified rather than spreading the whole export.
- Value events such as `timechanged` expose their value as `event.value`.
- Omit cleanup for page-lifetime instances without HMR. Dispose directly owned
  instances on HMR replacement or view/module teardown within the same document.
  `dispose()` also removes listeners registered with `timescope.on()`; do not
  add redundant unsubscribe calls when disposing the instance. Use the returned
  unsubscribe function when a subscription should end while the instance stays
  active. `unmount()` retains instance listeners for a later mount. Neither
  unsubscribing nor disposing cancels event callbacks already queued for delivery,
  including the final `unmount` event on disposal of a mounted chart.
- Clean up application-owned timers, data producers, and listeners on external
  objects (such as `window` or media elements) separately when HMR or in-page
  teardown requires cleanup. Instance disposal does not manage these resources.

## Drawing and export pitfalls

- A Series without `chart` draws no Chart. Give the host a definite CSS height;
  the `36px` fallback is for a time axis, not a full chart.
- Logarithmic Domains draw only positive values and require positive explicit
  bounds.
- An area defaults to `value` against `#zero`; use `using: ['min', 'max']` for
  a ribbon. Links draw in array order, then Marks; put areas before lines.
  Curved Links do not change the Series' instantaneous-value sampling.
- `ready` / `mount` mean drawable, not data-loaded; `invalidate()` / `reload()`
  do not wait for replacement data. Before reading pixels, use
  `await timescope.prepareView().fetch()` then `await timescope.nextFrame()`.
- Navigation, option changes, resizing, or unmounting abort an active prepared
  fetch with `AbortError`. Keep the view, clock, and size stable during export;
  do not export a cancelled view or edit a draft after `fetch()` / `abort()`.
- Prefer automatic thread selection; explicit `renderThread: 'worker'` requires
  compatible Worker support. Browser PNG export also works with Worker rendering;
  do not force `'main'` for export. `backend` and `renderThread` are constructor-only;
  Node.js PNG export needs `skia-canvas`.
- Resize supplied canvases with `await timescope.resize(width, height, dpr)`;
  CSS layout does not resize them. DPR defaults to `1`; wait for data and drawing.
  CSS backgrounds are not in exported pixels; composite a background if needed.
- Leave axis label colors unset to inherit the host's CSS `color` and follow
  theme changes. Resolve CSS variables on the host; canvas options need concrete
  colors, not `inherit` or `var(...)`. Node.js defaults to black label colors.
- Inherited fills use the Series color at 25% alpha; explicit `fillColor` uses
  its own alpha. `fillOpacity` applies to either; set a fill color for solid points.
- `round` changes labels, not data. Coarse axis precision can remove ticks;
  keep precision automatic if ticks disappear. Tooltip `format` replaces the
  whole text, including name and unit, not just the number.

## Framework integration

Bindings are available as `@timescope/vue`, `@timescope/react`,
`@timescope/svelte`, `@timescope/solid`, and `@timescope/luna`.

Use the binding matching the project's framework. Consult the
  [framework guide](https://xenodrive.github.io/timescope/guide/advanced/frameworks/overview) for
lifecycle callbacks, events, and exposed methods. For direct class integration,
create the instance after the DOM target exists. In server-rendered applications,
initialize the visualization on the client.

Framework components dispose their Timescope instance and its event listeners
automatically. Only unsubscribe manually when a subscription should end sooner;
still clean up application-owned resources on component unmount.

In framework components, pass configurable `TimescopeOptions` as a single
`options` prop; it replaces the previous options when changed. Keep current
`time`, `zoom`, and `selectionRange` outside `options` and synchronize them
with framework bindings or callbacks. Use `initialTime` / `initialZoom` for
one-time values or `initialFit` for a range (without other initial values).
`renderThread` and `fonts` are constructor-only component props.
Pass the configurable text style through `options.font`, not a standalone
`font` prop; keep `fonts` as the separate creation-only font-loading prop.

- Omitting `time` lets the chart manage it; `time={null}` follows the clock.
  `initialFit` also requires both controlled `time` and `zoom` to be omitted.
- Use each binding's update model: Vue's reactive `defineTimescopeOptions`
  comes from `@timescope/vue`; React/Solid/Luna need new complete options objects
  (memoize derived options in React), and Svelte uses `$state.raw` plus reassignment.
  Solid props read signals (`time()`); Luna reactive props receive accessors (`time`).
- Core value events use `event.value`; Vue/React/Solid/Luna handlers receive
  values directly, while Svelte events use `event.detail`. Do not copy the core
  event handler shape into a component callback.

## Additional documentation

Use the task map for feature-specific references and these pages for setup and
the overall data model. Read only what is relevant to the task.

| Task | Documentation |
| --- | --- |
| Installation and basic setup | [Getting started](https://xenodrive.github.io/timescope/guide/getting-started) |
| Choosing Sources, Series, Tracks, and Domains | [Core concepts](https://xenodrive.github.io/timescope/guide/concepts) |
