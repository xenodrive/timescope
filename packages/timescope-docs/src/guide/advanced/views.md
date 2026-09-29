---
title: Controlling Views
---

# Controlling Views

Applications often need to navigate to a result, change chart settings, or wait for a complete view before taking an image. Use current-state methods for navigation, configuration methods for chart settings, and prepared views when data must be ready before a view is presented.

The snippets below use a mounted `Timescope` instance named `timescope`. For component props and refs, see [Framework Bindings](/guide/advanced/frameworks).

## Navigate and fit a range

```ts
timescope.setTime('2026-01-15T10:00:00Z');
timescope.setZoom(2);

timescope.fitTo(['2026-01-15T10:00:00Z', '2026-01-15T11:00:00Z'], { padding: [24, 48] });
```

`fitTo()` chooses time and zoom so the interval fits inside the view. Padding is in CSS pixels. If the chart has no size yet, fitting is deferred until it does. Use the constructor's `fit` option, or a binding's `initialFit`, for a one-time initial fit.

`setTime()` and `setZoom()` animate by default. Pass `false` as the second argument for an immediate change, or choose easing and duration:

```ts
timescope.setTime(30, false);
timescope.setZoom(4, { animation: 'in-out', duration: 300 });
```

Constrain navigation with `setTimeRange([start, end])` and `setZoomRange([min, max])`. Selection is separate from navigation: `setSelectionRange([start, end])` highlights a range without fitting it, and `clearSelectionRange()` removes the highlight.

See [Animation](/api/timescope#animation) and [Events](/api/timescope#events) for intermediate values and notifications.

## Follow a live or playback clock

`time = null` follows the live clock. Setting a concrete time leaves follow mode:

```ts
timescope.setTime(null, false); // Follow the clock.
timescope.setTime(30, false); // Stay at a selected time.
```

For replay or media synchronization, supply a playback clock in the same time units as your data:

```ts
timescope.setPlaybackTime(12.5);
timescope.setTime(null, false);

// As playback advances:
timescope.setPlaybackTime(12.6);

// Return to the wall clock:
timescope.setPlaybackTime(null);
```

Updating the playback clock affects the followed position only while `time` is `null`. Appending data and advancing the clock are separate operations; see [Append live points](/guide/advanced/data#append-live-points).

## Update chart configuration

Use `updateOptions()` for a partial change:

```ts
timescope.updateOptions({
  series: {
    temperature: { chart: 'lines:filled' },
  },
});
```

Omitted settings remain in place. To remove a named source, series, track, or domain, set that entry to `null`. Remove or update its consumers in the same call so no series refers to a missing entry:

```ts
timescope.updateOptions({
  series: { temperature: null },
  sources: { measurements: null },
});
```

Use `setOptions(next)` when `next` is the complete desired configuration. Settings omitted from it return to their defaults. Framework bindings use this replacement behavior for their `options` prop.

Neither method resets current time or zoom. Current selection is also preserved unless selection is explicitly disabled. Use the corresponding state setters to change the view.

For data updates, prefer the source operations in [Loading and Updating Data](/guide/advanced/data). Explicitly configuring a source again recreates it; passing a stable DataSource instance lets presentation changes reuse it.

## Wait for data and drawing

Different operations provide different guarantees:

| Operation or event            | What it guarantees                                                    |
| ----------------------------- | --------------------------------------------------------------------- |
| `ready` / `mount`             | The chart is drawable and has a non-zero size                         |
| `reload()`                    | Source invalidation has been requested                                |
| `await view.fetch()`          | The prepared view's required data is ready and its state is activated |
| `await timescope.nextFrame()` | A requested frame has finished drawing; it does not fetch data        |

To load and draw the current view completely:

```ts
await timescope.prepareView().fetch();
await timescope.nextFrame();
```

Use this sequence before exporting pixels, as in the [Node.js PNG example](/guide/advanced/backends#render-a-png-in-node-js).

### Prepare a different view

A prepared view is a draft. Set its target time and zoom without immediately moving the current view:

```ts
const view = timescope.prepareView();
view.setTime(120, false);
view.setZoom(3, false);

try {
  await view.fetch();
  await timescope.nextFrame();
  // The prepared view has been activated and drawn.
} catch (error) {
  if (!(error instanceof Error && error.name === 'AbortError')) throw error;
  // Navigation or another change superseded this request.
}
```

Creating and editing the draft does not load data or pause ordinary chart interaction. `fetch()` captures the current viewport with the draft's changes, loads the required data, then activates the data and state together. It schedules drawing; `nextFrame()` supplies the separate drawing guarantee.

### Cancellation

Only one prepared view can be fetching at a time. Call `view.abort()` to discard a draft or cancel its fetch. Navigation, user interaction, option changes, resizing, or unmounting also cancel an active fetch; handle `AbortError` when those are expected. `view.signal` exposes cancellation to your application.

For exports, keep the target size and view stable until both loading and drawing finish. For interactive navigation, allow a newer action to supersede a pending view rather than treating cancellation as a loading failure.

## Release application resources

Core event subscriptions return an unsubscribe function:

```ts
const stop = timescope.on('timechanged', ({ value }) => {
  console.log('Selected time:', value?.toString() ?? 'live');
});

// When this subscriber is removed:
stop();

// When the whole chart is removed:
timescope.dispose();
```

Also stop application-owned timers, playback listeners, and data producers when removing their chart. Framework bindings dispose their Timescope instance automatically.
