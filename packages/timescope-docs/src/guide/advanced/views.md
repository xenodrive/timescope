---
title: Controlling Views
---

# Controlling Views

The snippets use the basic `timescope` instance from [Drawing a Chart](/guide/drawing-a-chart#basic-chart). Basic navigation and fitting are covered in [Getting Started](/guide/getting-started#view-control).

## Fit and constrain navigation

Use constructor `fit` for the initial view, or `fitTo()` to fit a range later. Both defer fitting until the canvas has a drawable size. The range must have `start < end`; padding is measured in CSS pixels and must be finite and nonnegative. A scalar applies to both sides:

```ts
timescope.fitTo([0, 30], { padding: [24, 48], animation: false });
```

Do not combine constructor `fit` with `time` or `zoom`. Without `fit`, `time` defaults to `null` and `zoom` to `0`. `fitTo()` returns `false` for an invalid range or padding.

Set `timeRange` and `zoomRange` at creation, or use their setters to change navigation bounds. An `undefined` endpoint is unbounded; `null` in `timeRange` follows the clock. Calling `setTimeRange()` without a range restores `[undefined, null]`, while `setZoomRange()` removes zoom limits.

`wheelSensitivity` controls wheel delta per zoom level and defaults to `200`. Set `timescope.disabled = true` to disable interaction; it defaults to `false`.

## Animate navigation

`setTime()` defaults to an `'out'` animation lasting `500` ms; `setZoom()` defaults to `'linear'` over `200` ms. Assigning `time` or `zoom` directly uses the same setters. Both setters return `false` for invalid input.

Pass `false` as the animation argument for an immediate change. String presets use `500` ms: `'in-out'` starts and ends smoothly, `'linear'` moves at a constant rate, and `'out'` slows toward the end. Use an object to choose a duration:

```ts
timescope.setTime(15, { animation: 'in-out', duration: 300 });
```

The object's `lazy` option commits the selected value after the animation rather than at its start. `tangent` controls the initial slope of an `'out'` animation. Prepared-view setters use the same defaults.

## Observe view changes

Read `time` and `zoom` for committed navigation state, `timeChanging` and `zoomChanging` during interaction, and `timeAnimating` and `zoomAnimating` during animation. Subscribe to the matching `changing`, `changed`, `animating`, and `animated` events to observe those phases. Value events contain `{ type, value, origin? }`.

`animating` indicates a time animation, not a zoom animation; `editing` indicates that time is being edited. `size` describes the viewport's position, CSS-pixel dimensions, and drawing DPR. `options` contains configuration without creation-only state.

Lifecycle events carry their event-name string. `ready` fires once per instance at its first drawable, non-zero-size mount; `mount` fires at each drawable mount. `resize` reports size or DPR changes, `unmount` reports mount removal, and `change` reports observable state changes. The `error` value event reports backend selection or initialization failures.

[Properties and events](/api/classes#timescope-properties)

## Select a time range

Selection is enabled by default. Shift-drag creates a range, and its handles allow resizing. Set `selection.resizable: false` to disable these interactions, or `selection: false` to disable selection and clear its range. `selection: true` restores default selection settings.

Set an initial range with constructor `selection.range`, or change it later:

```ts
timescope.setSelectionRange([10, 20]);
timescope.clearSelectionRange();
```

Passing `null` to `setSelectionRange()` also clears it. The setter is ignored while selection is disabled. Read `selectionRange` for the committed range and `selectionRangeChanging` during interaction; their events are `selectionrangechanged` and `selectionrangechanging`. Use `selection.color` to customize the overlay and `selection.invert: true` to shade outside the range.

## Update chart configuration

Use `updateOptions()` when changing part of the chart. It merges the supplied settings and keeps those you omit. For example, this changes the chart preset while retaining its source, color, and other settings:

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

Use `setOptions()` instead when your application holds the complete desired configuration. It replaces the current options, so omitted settings return to their defaults.

Objects merge in `updateOptions()`; arrays and source inputs replace their previous values. Named entries accept `null` for deletion. Both update methods preserve time and zoom, and clear selection only when it is disabled. For changes to the data itself, see [Loading and Updating Data](/guide/advanced/data).

### Typed configuration

Use `defineTimescopeOptions()` when extracting configuration into a reusable variable. It returns the same object while preserving inferred source names, row fields, metadata, and Track names, and checking their references:

```ts
import { defineTimescopeOptions } from 'timescope';

const options = defineTimescopeOptions({
  sources: { samples: [{ time: 0, value: 1 }] },
  series: { signal: { data: { source: 'samples' }, chart: 'lines' } },
});
```

Referenced DataSources, Tracks, and named Domains must exist. Omitting `tracks` creates an implicit `default` Track; an empty Track object is invalid.

Use `createDefineTimescopeOptions(wrapper)` to integrate an options wrapper, such as a framework's reactive helper. It returns the wrapper's result with the input's inferred type, so the wrapper must preserve the options structure and value types. Without a wrapper it returns the input unchanged.

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

Use a **prepared view** to load the data needed at a particular time and zoom. Calling `fetch()` loads that data and activates the prepared view. Then await `nextFrame()` to finish drawing it before reading or exporting pixels.

The `ready` and `mount` events only tell you that the canvas has a drawable size. Likewise, `reload()` requests a refresh without waiting for replacement data. Neither is a substitute for fetching and drawing before an export.

To finish loading and drawing the current view, use these two calls in order:

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

> [!WARNING]
> Navigation, option changes, resizing, or unmounting cancel an active fetch with `AbortError`. Keep the view, clock, and canvas size stable during export.

Once `fetch()` starts, or after `abort()`, draft setters throw `InvalidStateError`. Fetching requires a mounted instance and no other fetching view. Call `view.abort(reason)` to cancel a draft or fetch; the default reason is `AbortError`, and `view.signal` exposes the cancellation signal. Acquisition failures reject `fetch()` with the original error.

`redraw()` requests drawing without acquiring data. `nextFrame()` waits for a drawable mount and completed drawing, also without acquiring data.

[Prepared-view methods and cancellation](/api/interfaces#timescopepreparedview-methods) · [Browser PNG export](/guide/advanced/backends#render-a-png-in-the-browser) · [Node.js PNG export](/guide/advanced/backends#render-a-png-in-node-js)

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

`unmount()` retains instance listeners for a later mount. Use `dispose()` when the instance is no longer needed.

[Framework components](/guide/advanced/frameworks/overview#lifecycle) handle instance disposal, including its listeners, automatically; do not duplicate that disposal. When HMR or in-page teardown requires cleanup, clean up application-owned timers, data producers, and listeners registered on external objects (such as `window` or a media element) yourself, whether using a framework component or a directly owned instance.
