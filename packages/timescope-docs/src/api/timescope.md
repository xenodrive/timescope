---
titleTemplate: Timescope API
---

# Timescope

```ts
import { Timescope } from 'timescope';
```

## Constructor

```ts
new Timescope(options?: TimescopeOptionsInitial<Sources, Series, Track>)
```

### Options (constructor only)

Configurable fields: [Timescope Options](/api/timescope-options).

| Key                | Type                                                                                           | Default / contract                                                                                |
| ------------------ | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `time`             | `TimescopeTimeLike`                                                                            | `null`; initial selected time                                                                     |
| `zoom`             | `TimescopeNumberLike`                                                                          | `0`; initial zoom level                                                                           |
| `fit`              | `[start, end] \| { range: [start, end], padding?: number \| [left, right] }`                   | Initial fit after sizing; endpoints `TimescopeTimeLike<never>`; incompatible with `time` / `zoom` |
| `timeRange`        | `[TimescopeTimeLike \| undefined, TimescopeTimeLike \| undefined]`                             | `[undefined, null]`; unbounded past to current clock                                              |
| `zoomRange`        | `[TimescopeNumberLike \| undefined, TimescopeNumberLike \| undefined]`                         | Both ends unbounded                                                                               |
| `target`           | `Element \| string \| TimescopeCanvas`                                                         | Backend mount input; omitted for later `mount()`                                                  |
| `backend`          | `'canvas' \| 'skia-canvas' \| readonly ('canvas' \| 'skia-canvas')[]`                          | First compatible candidate; browser entry provides Canvas; Node.js entry provides Skia Canvas     |
| `renderThread`     | `'worker' \| 'main'`                                                                           | Automatic; browser Worker when supported, otherwise main                                          |
| `environment`      | `TimescopeEnvironment`                                                                         | Optional canvas-environment overrides                                                             |
| `fonts`            | `(string \| { family: string, source: string \| BufferSource, desc?: FontFaceDescriptors })[]` | [Font inputs](#fonts)                                                                             |
| `wheelSensitivity` | `number`                                                                                       | `200`; wheel delta per zoom level                                                                 |
| `selection.range`  | `[TimescopeTimeLike<never>, TimescopeTimeLike<never>] \| null`                                 | `null`; initial selection                                                                         |

| `fit` constraint | Value                                                                                |
| ---------------- | ------------------------------------------------------------------------------------ |
| Range            | `start < end`                                                                        |
| Padding          | Nonnegative finite CSS pixels; default `0`; scalar for both sides or `[left, right]` |

#### Fonts

| Input        | Additional loading                                                            |
| ------------ | ----------------------------------------------------------------------------- |
| Omitted      | Accessible document `@font-face` rules                                        |
| `[]`         | None                                                                          |
| String entry | CSS stylesheet URL                                                            |
| Object entry | `family`, CSS font `source` or `BufferSource`, optional `FontFaceDescriptors` |

Browser-only loading; Skia Canvas ignores `fonts`. The bundled Timescope font is always available.

[Selecting and loading fonts](/guide/advanced/backends#fonts).

### Input types

| Type                           | Accepted values                                                                                     |
| ------------------------------ | --------------------------------------------------------------------------------------------------- |
| `TimescopeNumberLike`          | `number`, numeric `string`, `bigint`, `Decimal`                                                     |
| `TimescopeTimeLike`            | `number`, `bigint`, `Decimal`, date/time `string`, `Date`, `null`; `Date` converts to epoch seconds |
| `TimescopeTimeLike<never>`     | Concrete time; excludes `null` and `undefined`                                                      |
| `TimescopeTimeLike<undefined>` | Concrete time or an unbounded `undefined` endpoint                                                  |
| `TimescopeCanvas`              | `{ width: number, height: number, getContext(type: '2d'): unknown }`                                |
| `TimescopeEnvironment`         | Optional `requestAnimationFrame`, `cancelAnimationFrame`, `Path2D`, `fonts: FontFaceSet`            |

## Properties

| Property                 | Type                                                                   | Access / meaning                                                  |
| ------------------------ | ---------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `time`                   | `Decimal \| null`                                                      | Read/write; selected time; `null` follows the clock               |
| `timeChanging`           | `Decimal \| null`                                                      | Read; time during interaction                                     |
| `timeAnimating`          | `Decimal \| null`                                                      | Read; time during animation                                       |
| `timeRange`              | `[Decimal \| null \| undefined, Decimal \| null \| undefined]`         | Read; navigation bounds                                           |
| `zoom`                   | `number`                                                               | Read/write; selected zoom level                                   |
| `zoomChanging`           | `number`                                                               | Read; zoom during interaction                                     |
| `zoomAnimating`          | `number`                                                               | Read; zoom during animation                                       |
| `zoomRange`              | `[number \| undefined, number \| undefined]`                           | Read; zoom bounds                                                 |
| `selectionRange`         | `[Decimal, Decimal] \| null`                                           | Read; selected range                                              |
| `selectionRangeChanging` | `[Decimal, Decimal] \| null`                                           | Read; selection during interaction                                |
| `size`                   | `{ x: number, y: number, width: number, height: number, dpr: number }` | Read; viewport position, CSS-pixel dimensions, device pixel ratio |
| `disabled`               | `boolean`                                                              | Read/write; `true` disables interaction; default `false`          |
| `animating`              | `boolean`                                                              | Read; time animation active                                       |
| `editing`                | `boolean`                                                              | Read; time being edited                                           |
| `options`                | `TimescopeOptions`                                                     | Read; configurable options, excluding initial state               |
| `canvas`                 | `TimescopeCanvas \| null`                                              | Read; created or supplied canvas; `null` when unmounted           |

## Methods

### Navigation

| Signature                                                                                           | Returns   | Contract                                                              |
| --------------------------------------------------------------------------------------------------- | --------- | --------------------------------------------------------------------- |
| `setTime(value: TimescopeTimeLike, animation?: TimescopeAnimationInput)`                            | `boolean` | Set time; `null` follows the clock; `false` for invalid input         |
| `setZoom(value: TimescopeNumberLike, animation?: TimescopeAnimationInput)`                          | `boolean` | Set zoom; `false` for invalid input                                   |
| `setTimeRange(range?: [TimescopeTimeLike \| undefined, TimescopeTimeLike \| undefined])`            | `void`    | `undefined` restores `[undefined, null]`                              |
| `setZoomRange(range?: [TimescopeNumberLike \| undefined, TimescopeNumberLike \| undefined])`        | `void`    | `undefined` removes limits                                            |
| `fitTo(range: [TimescopeTimeLike<never>, TimescopeTimeLike<never>], options?: TimescopeFitOptions)` | `boolean` | Fit range, deferred until sized; `false` for invalid range or padding |
| `setPlaybackTime(value: TimescopeTimeLike)`                                                         | `void`    | Clock used while `time` is `null`; `null` restores wall clock         |
| `setSelectionRange(range: [TimescopeTimeLike<never>, TimescopeTimeLike<never>] \| null)`            | `void`    | Set or clear selection; ignored with `selection: false`               |
| `clearSelectionRange()`                                                                             | `void`    | Clear selection                                                       |

| `TimescopeFitOptions` field | Type                                      | Default                            |
| --------------------------- | ----------------------------------------- | ---------------------------------- |
| `animation`                 | `boolean`                                 | `true`                             |
| `padding`                   | `number \| [left: number, right: number]` | `0`; nonnegative finite CSS pixels |

### Configuration

| Signature                                      | Returns            | Contract                                                                          |
| ---------------------------------------------- | ------------------ | --------------------------------------------------------------------------------- |
| `setOptions(next: TimescopeOptions)`           | `void`             | Replace configuration; omitted settings use defaults                              |
| `updateOptions(patch: TimescopeUpdateOptions)` | `void`             | Merge settings; `null` removes a named DataSource, Series, Track, or Domain       |
| `reload(sources?: string[])`                   | `Promise<boolean>` | Invalidate named DataSources, or all if omitted; `false` if unavailable or failed |

| Constraint            | Rule                                                                                      |
| --------------------- | ----------------------------------------------------------------------------------------- |
| Current state         | Time and zoom preserved; selection preserved unless explicitly disabled                   |
| Named references      | Every referenced DataSource, Track, and named Domain must exist                           |
| DataSource input      | Explicit DataSource configuration replaces that DataSource; a supplied instance is reused |
| `reload()` completion | Invalidation requested; replacement data and drawing may still be pending                 |

### Rendering and lifecycle

| Signature                                              | Returns                 | Contract                                                                         |
| ------------------------------------------------------ | ----------------------- | -------------------------------------------------------------------------------- |
| `prepareView()`                                        | `TimescopePreparedView` | Editable pending view                                                            |
| `resize(width: number, height: number, dpr?: number)`  | `Promise<boolean>`      | Resize external canvas; DPR default `1`; `false` for automatic sizing or failure |
| `redraw()`                                             | `Promise<void>`         | Request drawing; no data fetch                                                   |
| `nextFrame()`                                          | `Promise<void>`         | Wait for a drawable mount and completed drawing; no data fetch                   |
| `mount(target?: Element \| string \| TimescopeCanvas)` | `this`                  | Mount on a compatible target; built-in backends require a target                 |
| `unmount()`                                            | `void`                  | Release the mount; retain instance listeners and externally supplied canvas       |
| `dispose()`                                            | `void`                  | Release the instance, including its event listeners                              |
| `on(event, handler)`                                   | `() => void`            | Subscribe; returned function unsubscribes                                        |

Listeners registered with `on()` are removed automatically on `dispose()`. Use the returned unsubscribe function to end a subscription before instance disposal; calling it separately during disposal is unnecessary. Neither unsubscribing nor disposing cancels callbacks already queued for delivery, including the final `unmount` event on disposal of a mounted chart. Application-owned timers, data producers, and listeners on external objects remain the application's responsibility.

### Animation

| `TimescopeAnimationInput`                  | Contract                                                                                                                                  |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `false`                                    | Immediate change                                                                                                                          |
| `'in-out'`                                 | Smooth start and end; 500 ms                                                                                                              |
| `'linear'`                                 | Constant rate; 500 ms                                                                                                                     |
| `'out'`                                    | Slowing finish; 500 ms                                                                                                                    |
| `{ animation, duration, lazy?, tangent? }` | `animation`: easing name or `false`; `duration`: milliseconds; `lazy`: commit value after animation; `tangent`: initial slope for `'out'` |
| Omitted for `setTime()`                    | `'out'`, 500 ms                                                                                                                           |
| Omitted for `setZoom()`                    | `'linear'`, 200 ms                                                                                                                        |

### Prepared views

| `TimescopePreparedView` member | Returns / type  | Contract                                                                            |
| ------------------------------ | --------------- | ----------------------------------------------------------------------------------- |
| `signal`                       | `AbortSignal`   | Readonly cancellation signal                                                        |
| `setTime(value, animation?)`   | `boolean`       | Draft time; same arguments as `Timescope.setTime()`                                 |
| `setZoom(value, animation?)`   | `boolean`       | Draft zoom; same arguments as `Timescope.setZoom()`                                 |
| `setPlaybackTime(value)`       | `void`          | Draft clock; same argument as `Timescope.setPlaybackTime()`                         |
| `fetch()`                      | `Promise<void>` | Load required data and activate the view; drawing completion requires `nextFrame()` |
| `abort(reason?: unknown)`      | `void`          | Cancel the draft or fetch; default reason `AbortError`                              |

| Condition                                                               | Result                              |
| ----------------------------------------------------------------------- | ----------------------------------- |
| Edit after `fetch()` or `abort()`                                       | `InvalidStateError`                 |
| Fetch without a mount, or while another view is fetching                | Rejected with `InvalidStateError`   |
| Navigation, interaction, option change, resize, or unmount during fetch | Rejected with `AbortError`          |
| Data acquisition failure                                                | Rejected with the acquisition error |

## Events

Value-event payload: `{ type, value, origin? }`.

| Event                    | `value`                      | Timing                                     |
| ------------------------ | ---------------------------- | ------------------------------------------ |
| `timechanging`           | `Decimal \| null`            | Time changing                              |
| `timechanged`            | `Decimal \| null`            | Selected time committed                    |
| `timeanimating`          | `Decimal \| null`            | Time animation progressing                 |
| `timeanimated`           | `Decimal \| null`            | Time animation finished                    |
| `zoomchanging`           | `number`                     | Zoom changing                              |
| `zoomchanged`            | `number`                     | Selected zoom level committed              |
| `zoomanimating`          | `number`                     | Zoom animation progressing                 |
| `zoomanimated`           | `number`                     | Zoom animation finished                    |
| `selectionrangechanging` | `[Decimal, Decimal] \| null` | Selection changing                         |
| `selectionrangechanged`  | `[Decimal, Decimal] \| null` | Selection committed or cleared             |
| `error`                  | `Error`                      | Backend selection or initialization failed |

Lifecycle-event payload: the event-name string.

| Event     | Timing                                                       |
| --------- | ------------------------------------------------------------ |
| `ready`   | First drawable mount with a non-zero size; once per instance |
| `mount`   | Each drawable mount with a non-zero size                     |
| `unmount` | Mounted chart removed                                        |
| `resize`  | Canvas size or device pixel ratio changed                    |
| `change`  | Observable state changed                                     |
