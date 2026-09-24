---
name: timescope
description: >-
  Implement time selection and interactive time-series visualizations with
  Timescope. Use when asked to build something with Timescope, or when extending
  or debugging an application using timescope or @timescope framework bindings.
  Covers timepicker integration, playback synchronization, data loading, charts,
  tracks, domains, and custom marks and links.
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
- Chart presets are starting points. Compose marks, links, and field selectors
  when the requested appearance needs more than a preset.

## Workflow

1. Inspect the project's framework, package manager, and installed versions of
   `timescope` and any `@timescope/*` binding before choosing APIs.
2. Read the relevant documentation linked below for the requested feature.
   Check the installed package's exports and type declarations when using an API;
   the public documentation may describe a different version. If web access is
   unavailable, use installed types and available examples instead of guessing.
3. Identify the required state and data flow: selected time, external playback or
   controls, displayed data, and which component owns each update. Use the task
   map below to choose APIs and read their contracts.
4. Start with the relevant minimal example. Add the requested data, presentation,
   and interactions using explicit time units.
5. Integrate creation and updates with the application's lifecycle; clean up
   when the instance outlives a module or view.

## Task to implementation map

Read the linked reference before implementing the corresponding feature.

| Requested behavior | Implementation approach | Reference |
| --- | --- | --- |
| Select a time and notify the application | Set initial `time`; subscribe to `timechanged` and read `event.value`. Use `timechanging` for feedback during an active change. | [Events](https://xenodrive.github.io/timescope/api/timescope#events) |
| Change the selected time from another control | Call `setTime(value, animation?)`; use `false` for an immediate change. Keep external state synchronization from echoing updates indefinitely. | [Methods](https://xenodrive.github.io/timescope/api/timescope#methods) |
| Follow playback | Use `setPlaybackTime` to supply the live-clock value and `setTime(null)` to follow it. A fixed selected time and the playback clock are separate state. | [Timescope API](https://xenodrive.github.io/timescope/api/timescope) |
| Display or constrain a time interval | `fitTo` sets the view to an interval; `setTimeRange` limits navigation. Use `setZoom` and `setZoomRange` for zoom control and limits. | [Methods](https://xenodrive.github.io/timescope/api/timescope#methods) |
| Display existing data | Define rows in `sources`, reference the source through `series.*.data.source`, and choose a chart. Use `decoder` or `mappings` to adapt payloads. | [Sources](https://xenodrive.github.io/timescope/api/timescope-options#sources) |
| Fetch data for the visible region | Implement a range loader receiving `{ range, resolution }`; honor the range and neighboring-row contract. | [Range loader](https://xenodrive.github.io/timescope/api/timescope-options#range-loader) |
| Overlay or vertically separate data | Put Series on the same Track for overlays; select different Tracks to stack regions sharing the time axis. | [Tracks](https://xenodrive.github.io/timescope/api/timescope-options#tracks) |
| Compare values on a common scale | Define a shared entry in `domains` and reference it through each Series' `data.domain`. | [Domains](https://xenodrive.github.io/timescope/api/timescope-options#domains) |
| Customize the visual representation | Choose a preset or compose `chart.marks` and `chart.links`. Use `using` to select named time/value fields and baseline or edge references. | [Marks and links](https://xenodrive.github.io/timescope/guide/examples/marks-and-links) |
| Show values at the cursor | Configure `tooltip` and `data.instantaneous`; cursor sampling can use a different resolution from the chart. | [Instantaneous values](https://xenodrive.github.io/timescope/api/timescope-options#instantaneous-values) |
| Update data or configuration | Select the source's supported update/invalidation mechanism. Use `updateOptions` for partial configuration changes and `setOptions` for replacement. | [Source options](https://xenodrive.github.io/timescope/api/timescope-options#sources), [methods](https://xenodrive.github.io/timescope/api/timescope#methods) |

## Minimal examples

Install `timescope` with the project's package manager, for example:

```sh
npm install timescope
```

Provide a mount target in the page:

```html
<div id="timescope"></div>
```

Run either example on the client after the target exists, with a non-zero
container width. These examples are independent. Full-page navigation needs
no explicit cleanup; register `cleanup` for HMR (e.g.
`import.meta.hot?.dispose(cleanup)`) or a lifecycle you manage yourself.
Framework bindings handle their own cleanup.

### Timepicker: select a time and synchronize an external control

```ts
import { Timescope } from 'timescope';

const timescope = new Timescope({
  target: '#timescope',
  style: { height: '100px' },
  time: new Date('2026-01-01T12:00:00Z'),
});

// Store the initial value too: subscribing does not initialize application state.
let selectedTime = timescope.time; // Decimal | null
const unsubscribe = timescope.on('timechanged', (event) => {
  selectedTime = event.value;
  // Publish selectedTime to application state here.
});

// Call from an external date/time control. `false` disables animation.
function selectFromExternalControl(value: Date) {
  timescope.setTime(value, false);
}

function cleanup() {
  unsubscribe();
  timescope.dispose();
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
  style: { height: '240px' },
  time: 1.5,
  zoom: 6,
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

// Register only if the instance needs explicit teardown (e.g. HMR).
function cleanup() {
  timescope.dispose();
}
```

This example uses relative times in seconds. Adapt the rows, source references,
and presentation to the requested data; keep time units consistent throughout.

## Important rules

- Numeric times use seconds by default. Do not pass `Date.now()` as seconds:
  use a `Date`, an ISO date string, or explicitly convert milliseconds to seconds.
- `time: null` and `setTime(null)` follow the live clock. Set an explicit time
  when displaying historical or relative data.
- Times and values use `Decimal` internally. Preserve that precision in loader
  requests and calculations; avoid converting to `number` unless appropriate
  for the application's range and precision.
- Charts on the same Track are overlaid, but their value scales are independent
  unless they explicitly share a Domain. Use a shared Domain to compare values
  on the same scale.
- Inline data arrays are snapshots: mutating the original array does not update
  the visualization. Read the source update API before implementing live data.
  Only point-aggregate sources expose `append()` among the built-in source types.
- Range loaders receive `{ range, resolution }` with Decimal values. Return rows
  intersecting the requested range and available neighboring rows needed for
  connections: one on each side for lines, two for curves, even if the range
  itself contains no points.
- `setOptions` replaces configurable options; `updateOptions` retains omitted
  options. Runtime time and zoom changes use their dedicated setters.
- `on` returns an unsubscribe function. Value events such as `timechanged` expose
  their value as `event.value`. Dispose directly owned instances when explicitly
  tearing down their view or module.

## Framework integration

Bindings are available as `@timescope/vue`, `@timescope/react`,
`@timescope/svelte`, `@timescope/solid`, and `@timescope/luna`.

Use the binding matching the project's framework when appropriate. Inspect its
installed exports and types before using component names, props, events, or refs;
do not assume the bindings all have identical APIs. Bindings handle disposal;
for direct class integration, create the instance after the DOM target exists.
In server-rendered applications, initialize the visualization on the client.

## Additional documentation

Use the task map for feature-specific references and these pages for broader
context or examples. Follow links as needed rather than loading all pages.

| Task | Documentation |
| --- | --- |
| Installation and basic setup | [Getting started](https://xenodrive.github.io/timescope/guide/getting-started) |
| Choosing Sources, Series, Tracks, and Domains | [Core concepts](https://xenodrive.github.io/timescope/guide/concepts) |
| Navigation, events, lifecycle, and runtime updates | [Timescope API](https://xenodrive.github.io/timescope/api/timescope) |
| Data formats, loaders, aggregation, and source updates | [Source options](https://xenodrive.github.io/timescope/api/timescope-options#sources) |
| Built-in chart styles | [Chart presets](https://xenodrive.github.io/timescope/api/timescope-options#chart-presets) |
| Custom marks, links, and field selection | [Marks and links](https://xenodrive.github.io/timescope/guide/examples/marks-and-links) |
| Shared scales and auto-scaling | [Domains](https://xenodrive.github.io/timescope/api/timescope-options#domains) |
| Working examples | [Examples](https://xenodrive.github.io/timescope/guide/examples/) |
