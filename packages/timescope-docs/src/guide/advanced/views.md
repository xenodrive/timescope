---
title: Controlling Views
---

# Controlling Views

The snippets use a mounted `Timescope` instance named `timescope`. For basic navigation and fitting, see [Getting Started](/guide/getting-started#view-control).

## Follow a live or playback clock

Set time to `null` to keep the chart following a clock. The default is wall-clock time; supply playback time to synchronize with media or a recorded signal.

```ts
timescope.setTime(null, false); // Follow the clock.
timescope.setTime(30, false); // Stay at time 30.

timescope.setPlaybackTime(12.5); // Playback time, in the data's time units.
timescope.setTime(null, false); // Follow playback.
timescope.setPlaybackTime(12.6); // Advance playback.
timescope.setPlaybackTime(null); // Return to the wall clock.
```

## Update chart configuration

Change configuration when users switch chart styles, choose series, or adjust the layout. Use a partial update for a local change, or replace the options when your application holds the complete desired configuration.

| Method                 | Configuration                                        |
| ---------------------- | ---------------------------------------------------- |
| `updateOptions(patch)` | Merge changes; retain omitted settings               |
| `setOptions(next)`     | Replace configuration; omitted settings use defaults |

```ts
timescope.updateOptions({
  series: { temperature: { chart: 'lines:filled' } },
});

// Remove a source and its dependent series together.
timescope.updateOptions({
  series: { temperature: null },
  sources: { measurements: null },
});
```

Current time and zoom are preserved. For incoming samples: [Loading and Updating Data](/guide/advanced/data).

## Wait for data and drawing

Before exporting an image, wait for both the view's data and its drawing to finish. A prepared view also lets you choose a different time and zoom before presenting that view.

```text
prepareView() → edit draft → await fetch() → await nextFrame() → export pixels
                              data ready       drawing done
```

| Operation or event   | Completion guarantee                           |
| -------------------- | ---------------------------------------------- |
| `ready` / `mount`    | Drawable chart with a non-zero size            |
| `await reload()`     | Source invalidation requested                  |
| `await view.fetch()` | Required data ready; prepared view activated   |
| `await nextFrame()`  | Requested frame drawn; no data-fetch guarantee |

Current view:

```ts
await timescope.prepareView().fetch();
await timescope.nextFrame();
```

Different view:

```ts
const view = timescope.prepareView();
view.setTime(120, false);
view.setZoom(3, false);

try {
  await view.fetch();
  await timescope.nextFrame();
} catch (error) {
  if (!(error instanceof Error && error.name === 'AbortError')) throw error;
}
```

Navigation or view changes cancel an active fetch. Keep the view and size stable during export.

[Prepared-view methods and cancellation](/api/timescope#prepared-views) · [Node.js PNG export](/guide/advanced/backends#render-a-png-in-node-js)

## Cleanup

Release the chart when its container is removed, and unsubscribe listeners when their application controls are no longer active. Framework components handle chart disposal through their own lifecycle.

```ts
const stop = timescope.on('timechanged', ({ value }) => {
  console.log(value?.toString() ?? 'live');
});

stop(); // Remove this subscription.
timescope.dispose(); // Release the chart.
```

Stop application-owned timers and data producers when removing the component.
