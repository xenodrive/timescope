---
titleTemplate: Timescope API
---

# Timescope

The `Timescope` class manages rendering, user interaction, and data processing. Instances are created via the constructor and can be reconfigured using `setOptions` or `updateOptions`.

## Constructor

```TypeScript
new Timescope(options?: TimescopeOptionsInitial<Sources, Series, Track>)
```

Creates a new Timescope instance with the provided options.

### Options (constructor only)

All other option fields are defined in [Timescope Options](/api/timescope-options).

| Key                | Type                                                                         | Description                                                       |
| ------------------ | ---------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `time`             | `TimescopeTimeLike`                                                          | Initial cursor time (use `setTime()` later).                      |
| `fit`              | `[start, end] \| { range: [start, end], padding?: number \| [left, right] }` | Initial visible time range. Specify instead of `time` and `zoom`. |
| `timeRange`        | `[TimescopeTimeLike?, TimescopeTimeLike?]`                                   | Initial timeline bounds (use `setTimeRange()` later).             |
| `zoom`             | `TimescopeNumberLike`                                                        | Initial zoom (use `setZoom()` later).                             |
| `zoomRange`        | `[TimescopeNumberLike?, TimescopeNumberLike?]`                               | Initial zoom limits (use `setZoomRange()` later).                 |
| `target`           | `HTMLElement \| string \| TimescopeCanvas`                                   | Mount target or an external canvas.                               |
| `backend`          | `TimescopeBackendChoice \| TimescopeBackendChoice[]`                         | Ordered backend candidates (Node: Skia then Canvas; browser: Canvas). |
| `renderThread`     | `'worker' \| 'main'`                                                         | Rendering thread (auto-selected when omitted).                    |
| `fonts`            | `(string \| { family, source, desc? })[]`                                    | CSS stylesheets or font definitions to load.                      |
| `wheelSensitivity` | `number`                                                                     | Wheel delta per zoom level (default: `200`).                      |
| `selection.range`  | `[TimescopeTimeLike, TimescopeTimeLike] \| null`                             | Initial selection only; use `setSelectionRange()` later.          |

`fit` is applied once when the canvas first has a size. `padding` is in CSS pixels: a number applies to both sides, or use `[left, right]`.

#### Fonts

When omitted, Timescope loads fonts declared by accessible `@font-face` rules in the document. An empty array disables document font loading. String entries are CSS stylesheet URLs; object entries contain a font family, a CSS font source or `BufferSource`, and optional `FontFaceDescriptors`.

## Properties

| Property                 | Type                                                           | Description                                                                               |
| ------------------------ | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `time`                   | `Decimal \| null`                                              | Current cursor time                                                                       |
| `timeChanging`           | `Decimal \| null`                                              | Cursor time during an active change                                                       |
| `timeAnimating`          | `Decimal \| null`                                              | Cursor time during animation                                                              |
| `timeRange`              | `[Decimal \| null \| undefined, Decimal \| null \| undefined]` | Time bounds                                                                               |
| `zoom`                   | `number`                                                       | Current zoom value                                                                        |
| `zoomChanging`           | `number`                                                       | Zoom during an active change                                                              |
| `zoomAnimating`          | `number`                                                       | Zoom during animation                                                                     |
| `zoomRange`              | `[number \| undefined, number \| undefined]`                   | Zoom limits                                                                               |
| `selectionRange`         | `[Decimal, Decimal] \| null`                                   | Current selection range                                                                   |
| `selectionRangeChanging` | `[Decimal, Decimal] \| null`                                   | Selection range during an active change                                                   |
| `size`                   | `{ x, y, width, height, dpr }`                                 | Canvas position, dimensions, and DPR                                                      |
| `disabled`               | `boolean`                                                      | Interaction enabled/disabled                                                              |
| `animating`              | `boolean`                                                      | Cursor-time animation in progress                                                         |
| `editing`                | `boolean`                                                      | Cursor time is being edited                                                               |
| `options`                | `TimescopeOptions`                                             | Current reconfigurable configuration (excludes constructor-only fields and current state) |
| `target`                 | `Element \| TimescopeCanvas \| null`                           | Backend's actual drawing target; null when unmounted                                      |
| `canvas`                 | `TimescopeCanvas \| null`                                      | Canvas surface, if the backend uses one                                                   |

## Methods

| Method                       | Purpose                                                                                                   |
| ---------------------------- | --------------------------------------------------------------------------------------------------------- |
| `setTime(value, animation?)` | Update the cursor time. Pass `null` to follow "now". See [Animation](#animation).                         |
| `setTimeRange(range?)`       | Constrain the time domain. Pass `undefined` to restore defaults.                                          |
| `setZoom(value, animation?)` | Set zoom programmatically. See [Animation](#animation).                                                   |
| `setZoomRange(range?)`       | Clamp zoom to `[min, max]`.                                                                               |
| `fitTo(range, options?)`     | Center and zoom to show `[start, end]` fully; defer until sized if necessary. Returns a boolean.          |
| `setPlaybackTime(value)`     | Set the live-clock value used while `time` is `null`.                                                     |
| `prepareView()`              | Create a pending view whose data can be fetched before activation. See [Prepared views](#prepared-views). |
| `setSelectionRange(range)`   | Highlight `[start, end]` on the canvas. Pass `null` to clear it.                                          |
| `clearSelectionRange()`      | Remove the selection overlay.                                                                             |
| `setOptions(next)`           | Replace style, sources, or series at runtime.                                                             |
| `updateOptions(next)`        | Merge partial option changes (e.g., swap a single chart) without recreating the whole Timescope instance. |
| `reload(sources?)`           | Wait for the backend, then invalidate selected sources. Returns `Promise<boolean>`.                        |
| `resize(width, height, dpr?)` | Wait for the backend, then resize an external canvas. Returns `Promise<boolean>`.                         |
| `redraw()`                   | Request a renderer redraw.                                                                                |
| `nextFrame()`                | Request a frame and wait for drawing to finish; does not fetch new data.                                  |
| `mount(target)`              | Mount the selected backend on a target. Returns `this`.                                                   |
| `unmount()`                  | Unmount the backend and release its owned resources.                                                      |
| `dispose()`                  | Release resources when Timescope is no longer needed.                                                     |
| `on(event, handler)`         | Subscribe to events. Returns an unsubscribe function.                                                     |

`setOptions()` replaces the current configurable options; it has the same effect as supplying those options to the constructor, except for constructor-only initial state. `updateOptions()` applies partial changes while retaining omitted options. Set individual `sources`, `series`, `tracks`, or `domains` entries to `null` to remove them. Neither method changes the current selection range unless selection is explicitly disabled.

### Animation

| Value                            | Behavior                                 |
| -------------------------------- | ---------------------------------------- |
| `false`                          | Change immediately.                      |
| `'in-out'`                       | Animate with a smooth start and end.     |
| `'linear'`                       | Animate at a constant rate.              |
| `'out'`                          | Animate with a slowing finish.           |
| `{ animation, duration, lazy? }` | Set easing and duration in milliseconds. |

When omitted, `setTime()` uses `'out'` for 500 ms and `setZoom()` uses `'linear'` for 200 ms. Explicit easing strings use 500 ms.

### Prepared views

`prepareView()` creates a draft of the next view. Call `view.setTime()`, `view.setZoom()`, or `view.setPlaybackTime()` to set its target without changing Timescope's current state. Creating or editing a draft does not pause rendering or begin loading; ordinary Timescope setters keep working normally.

`await view.fetch()` begins the transaction: it captures the current viewport with the draft's changes, holds presentation of the target view, and waits for every required data source and cache to prepare that target. On success it activates the target data and state together and schedules drawing. It **does not** wait for the scheduled drawing to finish; use `await timescope.nextFrame()` if you need the pixels. Only one view can be fetching at a time. `view.abort()` discards a draft or cancels a fetch. Ordinary setters, option changes, resizing, user interaction, or unmounting also cancel an active fetch. Use `view.signal` or handle an `AbortError` when cancellation matters.

## Events

| Event                    | `event.value`                | Timing                                             |
| ------------------------ | ---------------------------- | -------------------------------------------------- |
| `timechanging`           | `Decimal \| null`            | Fired while the cursor time is changing.           |
| `timechanged`            | `Decimal \| null`            | Fired when the cursor time changes.                |
| `timeanimating`          | `Decimal \| null`            | Fired for cursor-time values during animation.     |
| `timeanimated`           | `Decimal \| null`            | Fired when cursor-time animation finishes.         |
| `zoomchanging`           | `number`                     | Fired while zoom is changing.                      |
| `zoomchanged`            | `number`                     | Fired when zoom changes.                           |
| `zoomanimating`          | `number`                     | Fired for zoom values during animation.            |
| `zoomanimated`           | `number`                     | Fired when zoom animation finishes.                |
| `selectionrangechanging` | `[Decimal, Decimal] \| null` | Fired while the selection range is changing.       |
| `selectionrangechanged`  | `[Decimal, Decimal] \| null` | Fired when the selection range changes or clears.  |
| `mount`                  | `'mount'`                    | The renderer is initialized and its target has a non-zero size; fires once per mount. |
| `ready`                  | `'ready'`                    | The first mount becomes drawable; fires once per Timescope instance. |
| `unmount`                | `'unmount'`                  | A mounted canvas was removed.                      |
| `error`                  | `Error`                      | Backend selection or initialization failed.         |
| `resize`                 | `'resize'`                   | Canvas size or device pixel ratio changed.         |
| `change`                 | `'change'`                   | Observable state changed.                          |

Selection is resizable by default. Shift-drag creates a range; set `selection: false` to disable it. The methods above also update the overlay programmatically.

Value events call the handler with `{ type, value, origin? }`. Lifecycle and `change` events call it with the event-name string. `on()` returns an unsubscribe function.

## See Also

- [Timescope Options](/api/timescope-options)
- [Chunk Loading](/guide/concepts#chunk-loading)
- [Events example](/guide/examples/#events)
