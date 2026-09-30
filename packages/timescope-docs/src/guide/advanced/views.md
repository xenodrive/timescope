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

Dispose the Timescope when its container is removed, and unsubscribe listeners when their application controls are no longer active:

```ts
const stop = timescope.on('timechanged', ({ value }) => {
  console.log(value?.toString() ?? 'live');
});

stop(); // Remove this subscription.
timescope.dispose(); // Release the instance.
```

[Framework components](/guide/advanced/frameworks#lifecycle) handle disposal automatically. Stop application-owned timers and data producers yourself in either case.
