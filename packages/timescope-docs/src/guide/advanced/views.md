---
title: Controlling Views
---

# Controlling Views

The snippets use the basic `timescope` instance from [Drawing a Chart](/guide/drawing-a-chart#basic-chart). Basic navigation and fitting are covered in [Getting Started](/guide/getting-started#view-control).

## Update chart configuration

Use a partial update for a local change, or replace the options when your application holds the complete desired configuration:

| Method                 | Configuration                                        |
| ---------------------- | ---------------------------------------------------- |
| `updateOptions(patch)` | Merge changes; retain omitted settings               |
| `setOptions(next)`     | Replace configuration; omitted settings use defaults |

```ts
timescope.updateOptions({
  series: { signal: { chart: 'lines:filled' } },
});
```

To remove a DataSource instead, remove its dependent Series in the same update:

```ts
timescope.updateOptions({
  series: { signal: null },
  sources: { samples: null },
});
```

Time and zoom are preserved by both methods. For data changes rather than configuration changes, see [Loading and Updating Data](/guide/advanced/data).

### Reuse default values

Import `defaultOptions` to inspect or reuse the fallback settings. Spread only the group relevant to your configuration:

```ts
import { defineTimescopeOptions, defaultOptions } from 'timescope';

const options = defineTimescopeOptions({
  domains: {
    amplitude: { ...defaultOptions.domain, axis: 'left' },
  },
});
```

The export is not a complete constructor configuration: it contains no named DataSources, Series, Domains, or Tracks. Do not spread the whole export into `new Timescope()`. Groups and arrays are frozen; copy them when customizing.

Some defaults depend on the chart: unspecified Track heights share the available space, a Series uses the first Track, and primitive colors inherit the Series color. Leave these settings unspecified when you want that behavior rather than assigning a fixed value.

## Follow a live or playback clock

As described in [Core Concepts](/guide/concepts#time-and-zoom), `time = null` follows a clock. Use `setPlaybackTime()` to supply an application-driven clock instead of wall-clock time. Call it on each media or data tick; it does not advance playback by itself.

```ts
timescope.setTime(30, false); // Stay at time 30, without animation.

timescope.setPlaybackTime(12.5); // Use the data's time units.
timescope.setTime(null, false); // Follow playback.
timescope.setPlaybackTime(12.6); // Advance playback.
timescope.setPlaybackTime(null); // Restore the wall clock.
```

## Wait for data and drawing

Use a **prepared view** to load required data before switching to a different time and zoom. For image export, also wait for `nextFrame()` after fetching:

```text
prepareView() → edit draft → await fetch() → await nextFrame() → export pixels
                              data ready       drawing done
```

| Operation or event   | Completion guarantee                           |
| -------------------- | ---------------------------------------------- |
| `ready` / `mount`    | Drawable canvas with a non-zero size           |
| `await reload()`     | Invalidation requested if the result is `true` |
| `await view.fetch()` | Required data ready; prepared view activated   |
| `await nextFrame()`  | Requested frame drawn; no data-fetch guarantee |

To finish loading and drawing the current view:

```ts
await timescope.prepareView().fetch();
await timescope.nextFrame();
```

To prepare a different view before displaying it:

```ts
const view = timescope.prepareView();
view.setTime(15, false);
view.setZoom(4, false);

try {
  await view.fetch();
  await timescope.nextFrame();
} catch (error) {
  if (!(error instanceof Error && error.name === 'AbortError')) throw error;
  // The requested view was cancelled; do not export it.
}
```

Navigation, option changes, resizing, or unmounting cancel an active fetch with `AbortError`. Keep the view, clock, and canvas size stable during export.

[Prepared-view methods and cancellation](/api/timescope#prepared-views) · [Browser PNG export](/guide/advanced/backends#render-a-png-in-the-browser) · [Node.js PNG export](/guide/advanced/backends#render-a-png-in-node-js)

## Cleanup

An instance that lives for the whole page does not need explicit cleanup when changes cause a full-page reload rather than HMR, or when leaving the page or closing the tab. You can omit cleanup code in that case; do not add `unload` or `beforeunload` handlers solely to dispose the chart.

For HMR, SPA route changes, or removing a view while the document remains active, dispose directly owned instances during teardown so the old chart does not remain alive. `dispose()` also removes listeners registered with `timescope.on()`, so there is no need to unsubscribe them individually when disposing the instance:

```ts
timescope.on('timechanged', ({ value }) => {
  console.log(value?.toString() ?? 'live');
});

// When the chart is no longer needed:
timescope.dispose(); // Release the instance and its listeners.
```

Register cleanup with the relevant lifecycle hook; merely defining a cleanup function does not run it. For Vite HMR:

```ts
import.meta.hot?.dispose(() => {
  timescope.dispose();
  // Clean up application-owned resources here, if any.
});
```

Use the returned unsubscribe function only when a subscription should end while the Timescope instance remains active, for example when an application control is removed:

```ts
const stop = timescope.on('timechanged', ({ value }) => {
  console.log(value?.toString() ?? 'live');
});

stop(); // End only this subscription; keep the chart active.
```

Neither unsubscribing nor disposing cancels event callbacks already queued for delivery. `unmount()` is not disposal: it retains instance listeners for a later mount.

[Framework components](/guide/advanced/frameworks#lifecycle) handle instance disposal, including its listeners, automatically; do not duplicate that disposal. When HMR or in-page teardown requires cleanup, clean up application-owned timers, data producers, and listeners registered on external objects (such as `window` or a media element) yourself, whether using a framework component or a directly owned instance.
