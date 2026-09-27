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
| `target`           | `HTMLElement \| string`                                                      | Mount target.                                                     |
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

## Methods

| Method                       | Purpose                                                                                                   |
| ---------------------------- | --------------------------------------------------------------------------------------------------------- |
| `setTime(value, animation?)` | Update the cursor time. Pass `null` to follow "now". See [Animation](#animation).                         |
| `setTimeRange(range?)`       | Constrain the time domain. Pass `undefined` to restore defaults.                                          |
| `setZoom(value, animation?)` | Set zoom programmatically. See [Animation](#animation).                                                   |
| `setZoomRange(range?)`       | Clamp zoom to `[min, max]`.                                                                               |
| `fitTo(range, options?)`     | Center and zoom to show `[start, end]` fully.                                                             |
| `setPlaybackTime(value)`     | Set the live-clock value used while `time` is `null`.                                                     |
| `latchFrame()`               | Apply time, zoom, and playback changes together. See [Frame synchronization](#frame-synchronization).     |
| `setSelectionRange(range)`   | Highlight `[start, end]` on the canvas. Pass `null` to clear it.                                          |
| `clearSelectionRange()`      | Remove the selection overlay.                                                                             |
| `setOptions(next)`           | Replace style, sources, or series at runtime.                                                             |
| `updateOptions(next)`        | Merge partial option changes (e.g., swap a single chart) without recreating the whole Timescope instance. |
| `reload(sources?)`           | Invalidate all cached chunks for selected sources. Mutable sources normally invalidate themselves.        |
| `redraw()`                   | Request a renderer redraw.                                                                                |
| `mount(target)`              | Append the canvas to a selector or element. Returns `this`.                                               |
| `unmount()`                  | Remove the canvas from its mount target.                                                                  |
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

### Frame synchronization

`time`, `zoom`, and the playback clock are independent state, and setting them one by one can present intermediate frames. `latchFrame()` groups the changes so they appear together: create the latch, call the setters, then call `commit()`. Setters called while the latch is open are queued instead of applied, and `commit()` applies them as one frame.

Latches are available after mounting, and only one can be active at a time. `commit()` returns a Promise that resolves when the grouped change has been presented; `abort()` discards a pending change. Starting an incompatible operation — such as `setOptions()`, `setTimeRange()`, or user interaction — also aborts the latch; use its `signal` or handle an `AbortError` when cancellation matters.

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
| `load`                   | `'load'`                     | The mounted canvas first acquired a non-zero size. |
| `mount`                  | `'mount'`                    | A canvas was mounted.                              |
| `unmount`                | `'unmount'`                  | A mounted canvas was removed.                      |
| `resize`                 | `'resize'`                   | Canvas size or device pixel ratio changed.         |
| `change`                 | `'change'`                   | Observable state changed.                          |

Selection is resizable by default. Shift-drag creates a range; set `selection: false` to disable it. The methods above also update the overlay programmatically.

Value events call the handler with `{ type, value, origin? }`. Lifecycle and `change` events call it with the event-name string. `on()` returns an unsubscribe function.

## See Also

- [Timescope Options](/api/timescope-options)
- [Chunk Loading](/guide/concepts#chunk-loading)
- [Events example](/guide/examples/#events)
