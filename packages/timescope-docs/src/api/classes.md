---
titleTemplate: Timescope API
outline: [2, 3]
---

# Classes

Public classes exported from `timescope`.

## Timescope

### Constructor {#timescope-constructor}

```ts
new Timescope(options?: TimescopeOptionsInitial)
```

[Constructor options](/api/types#timescopeoptionsinitial) · [Guide](/guide/getting-started)

### Properties {#timescope-properties}

| Property                 | Get                                            | Set                   | Description                                                               |
| ------------------------ | ---------------------------------------------- | --------------------- | ------------------------------------------------------------------------- |
| `time`                   | `Decimal \| null`                              | `TimescopeTimeLike`   | Selected time; `null` follows the clock. Assignments use `setTime()`.     |
| `timeChanging`           | `Decimal \| null`                              | —                     | Time during interaction.                                                  |
| `timeAnimating`          | `Decimal \| null`                              | —                     | Time during animation.                                                    |
| `timeRange`              | `TimescopeRange<Decimal \| null \| undefined>` | —                     | Navigation bounds; `undefined` is unbounded and `null` follows the clock. |
| `zoom`                   | `number`                                       | `TimescopeNumberLike` | Selected zoom level. Assignments use `setZoom()`.                         |
| `zoomChanging`           | `number`                                       | —                     | Zoom level during interaction.                                            |
| `zoomAnimating`          | `number`                                       | —                     | Zoom level during animation.                                              |
| `zoomRange`              | `TimescopeRange<number \| undefined>`          | —                     | Zoom bounds; `undefined` is unbounded.                                    |
| `selectionRange`         | `TimescopeRange<Decimal> \| null`              | —                     | Committed selection; `null` when cleared.                                 |
| `selectionRangeChanging` | `TimescopeRange<Decimal> \| null`              | —                     | Selection range during interaction.                                       |
| `size`                   | `TimescopeSize`                                | —                     | Viewport position, CSS-pixel dimensions, and drawing DPR.                 |
| `disabled`               | `boolean`                                      | `boolean`             | Disables interaction when `true`; initially `false`.                      |
| `animating`              | `boolean`                                      | —                     | Whether a time animation is active.                                       |
| `editing`                | `boolean`                                      | —                     | Whether time is being edited.                                             |
| `options`                | `TimescopeOptions`                             | —                     | Current configuration, excluding creation-only state.                     |
| `canvas`                 | `TimescopeCanvas \| null`                      | —                     | Mounted canvas; `null` while unmounted.                                   |

### Methods {#timescope-methods}

| Signature                                                                               | Returns                 | Description                                                                        | Defaults                                                      | Return details                                                                                |
| --------------------------------------------------------------------------------------- | ----------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `setTime(value: TimescopeTimeLike, animation?: TimescopeAnimationInput)`                | `boolean`               | Sets the selected time; `null` follows the clock.                                  | `animation`: `'out'`, 500 ms.                                 | `false` for invalid input.                                                                    |
| `setZoom(value: TimescopeNumberLike, animation?: TimescopeAnimationInput)`              | `boolean`               | Sets the selected zoom level.                                                      | `animation`: `'linear'`, 200 ms; lazy commit when zooming in. | `false` for invalid input.                                                                    |
| `setTimeRange(range?: TimescopeRange<TimescopeTimeLike \| undefined>)`                  | `void`                  | Sets navigation bounds.                                                            | `range`: `[undefined, null]`.                                 | —                                                                                             |
| `setZoomRange(range?: TimescopeRange<TimescopeNumberLike \| undefined>)`                | `void`                  | Sets zoom bounds.                                                                  | `range`: `[undefined, undefined]`.                            | —                                                                                             |
| `fitTo(range: TimescopeRange<TimescopeTimeLike<never>>, options?: TimescopeFitOptions)` | `boolean`               | Fits a time range, deferred until the canvas has a drawable size.                  | `options.animation`: `true`; `options.padding`: `0` CSS px.   | `false` for invalid range or padding; requires `start < end` and finite, nonnegative padding. |
| `setPlaybackTime(value: TimescopeTimeLike)`                                             | `void`                  | Sets the clock followed while `time` is `null`; `null` restores wall-clock time.   | —                                                             | —                                                                                             |
| `setSelectionRange(range: TimescopeRange<TimescopeTimeLike<never>> \| null)`            | `void`                  | Sets or clears selection; ignored while selection is disabled.                     | —                                                             | —                                                                                             |
| `clearSelectionRange()`                                                                 | `void`                  | Clears the selected range.                                                         | —                                                             | —                                                                                             |
| `setOptions(next: TimescopeOptions)`                                                    | `void`                  | Replaces configuration; preserves time and zoom.                                   | Omitted settings use their defaults.                          | —                                                                                             |
| `updateOptions(patch: TimescopeUpdateOptions)`                                          | `void`                  | Merges configuration; `null` removes named entries.                                | Omitted settings retain their values.                         | —                                                                                             |
| `reload(sources?: string[])`                                                            | `Promise<boolean>`      | Requests source invalidation.                                                      | `sources`: all sources.                                       | `false` if unavailable or failed; does not wait for replacement data or drawing.              |
| `prepareView()`                                                                         | `TimescopePreparedView` | Creates an editable pending view for data acquisition.                             | —                                                             | [Prepared-view API](/api/interfaces#timescopepreparedview).                                   |
| `resize(width: number, height: number, dpr?: number)`                                   | `Promise<boolean>`      | Resizes an externally managed canvas.                                              | `dpr`: `1`.                                                   | `false` for automatically sized targets or failure.                                           |
| `redraw()`                                                                              | `Promise<void>`         | Requests drawing without fetching data.                                            | —                                                             | —                                                                                             |
| `nextFrame()`                                                                           | `Promise<void>`         | Waits for a drawable mount and completed drawing.                                  | —                                                             | Does not fetch data.                                                                          |
| `mount(target?: TimescopeBackendTarget)`                                                | `this`                  | Mounts on a compatible target; built-in backends require one.                      | —                                                             | The current instance.                                                                         |
| `unmount()`                                                                             | `void`                  | Releases the mount, retaining instance listeners and externally supplied canvases. | —                                                             | —                                                                                             |
| `dispose()`                                                                             | `void`                  | Releases the instance and its event listeners.                                     | —                                                             | —                                                                                             |
| `on(event: string, handler: (event: object \| string) => void)`                         | `() => void`            | Subscribes to an event; its name determines the handler payload.                   | —                                                             | Unsubscribe function.                                                                         |
| `un(event: string, handler: (event: object \| string) => void)`                         | `void`                  | Removes a registered event handler.                                                | —                                                             | —                                                                                             |

[View control](/guide/advanced/views) · [Data refresh](/guide/advanced/data#refresh-changed-data) · [Rendering](/guide/advanced/backends) · [Cleanup](/guide/advanced/views#cleanup)

### Events {#timescope-events}

| Event                    | Payload                                                                                       | Description                                                   |
| ------------------------ | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `timechanging`           | `{ type: 'timechanging', value: Decimal \| null, origin?: string }`                           | Time changes during interaction.                              |
| `timechanged`            | `{ type: 'timechanged', value: Decimal \| null, origin?: string }`                            | Selected time is committed.                                   |
| `timeanimating`          | `{ type: 'timeanimating', value: Decimal \| null, origin?: string }`                          | Time animation progresses.                                    |
| `timeanimated`           | `{ type: 'timeanimated', value: Decimal \| null, origin?: string }`                           | Time animation finishes.                                      |
| `zoomchanging`           | `{ type: 'zoomchanging', value: number, origin?: string }`                                    | Zoom changes during interaction.                              |
| `zoomchanged`            | `{ type: 'zoomchanged', value: number, origin?: string }`                                     | Selected zoom is committed.                                   |
| `zoomanimating`          | `{ type: 'zoomanimating', value: number, origin?: string }`                                   | Zoom animation progresses.                                    |
| `zoomanimated`           | `{ type: 'zoomanimated', value: number, origin?: string }`                                    | Zoom animation finishes.                                      |
| `selectionrangechanging` | `{ type: 'selectionrangechanging', value: TimescopeRange<Decimal> \| null, origin?: string }` | Selection changes during interaction.                         |
| `selectionrangechanged`  | `{ type: 'selectionrangechanged', value: TimescopeRange<Decimal> \| null, origin?: string }`  | Selection is committed or cleared.                            |
| `error`                  | `{ type: 'error', value: Error, origin?: string }`                                            | Backend selection or initialization fails.                    |
| `ready`                  | `'ready'`                                                                                     | First drawable mount with a non-zero size; once per instance. |
| `mount`                  | `'mount'`                                                                                     | Each drawable mount with a non-zero size.                     |
| `unmount`                | `'unmount'`                                                                                   | Mounted chart is removed.                                     |
| `resize`                 | `'resize'`                                                                                    | Canvas size or device pixel ratio changes.                    |
| `change`                 | `'change'`                                                                                    | Observable state changes.                                     |

[Guide](/guide/advanced/views#observe-view-changes)

## TimescopeDataLoader

### Constructor {#timescopedataloader-constructor}

```ts
new TimescopeDataLoader(options: TimescopeDataLoaderOptions)
```

[Options](/api/types#timescopedataloaderoptions) · [Factory](/api/utilities#createdataloader) · [Guide](/guide/advanced/data#reuse-a-dataloader)

### Properties {#timescopedataloader-properties}

| Property (readonly) | Type      | Description                                |
| ------------------- | --------- | ------------------------------------------ |
| `ranged`            | `boolean` | Whether `load()` requires a range request. |

### Methods {#timescopedataloader-methods}

| Signature                             | Returns                                | Description                                                                            | Rejects                                                                                                                                                                                                                        |
| ------------------------------------- | -------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `load()`                              | `Promise<readonly TimescopeDataRow[]>` | <span id="timescopedataloader-errors"></span>Acquires and normalizes a fresh snapshot. | `Error`: range loader called without a request.<br>Acquisition or conversion error: input could not be loaded or normalized.                                                                                                   |
| `load(request: TimescopeLoadRequest)` | `Promise<readonly TimescopeDataRow[]>` | Acquires and normalizes rows for a range.                                              | `Error`: snapshot loader called with a request, or unknown alphabetic URL placeholder.<br>`RangeError`: reversed range or nonpositive resolution.<br>Acquisition or conversion error: input could not be loaded or normalized. |

[Request](/api/types#load-and-query-requests) · [Callbacks](/api/types#loader-callbacks)

## TimescopeDataSourceBase

```ts
abstract class TimescopeDataSourceBase implements TimescopeDataSource
```

### Constructor {#timescopedatasourcebase-constructor}

```ts
constructor(options?: TimescopeSourceCommonOptions)
```

[Options](/api/types#timescopesourcecommonoptions) · [Guide](/guide/advanced/data#custom-datasources)

### Properties {#timescopedatasourcebase-properties}

[Inherited properties](/api/interfaces#timescopedatasource-properties)

| Property (readonly) | Type                                           | Initial value | Description                                   |
| ------------------- | ---------------------------------------------- | ------------- | --------------------------------------------- |
| `revision`          | `number`                                       | `0`           | Source revision, incremented on invalidation. |
| `invalidation`      | `TimescopeDataSourceInvalidation \| undefined` | `undefined`   | Latest invalidation range and revision.       |

### Methods {#timescopedatasourcebase-methods}

| Signature                                                                         | Returns                                | Description                                                                                                                                                       | Return details                                                                            | Throws                        |
| --------------------------------------------------------------------------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------- |
| `query(request: TimescopeDataSourceQuery)`                                        | `Promise<readonly TimescopeDataRow[]>` | Abstract query implementation.                                                                                                                                    | Canonical rows following the [query contract](/api/interfaces#timescopedatasource-query). | —                             |
| `invalidate(range?: TimescopeRange<TimescopeTimeLike<undefined>>)`                | `void`                                 | <span id="timescopedatasourcebase-errors"></span>Increments revision and emits `change` and `invalidate`, without acquiring data; omitted range affects all data. | —                                                                                         | `RangeError`: reversed range. |
| `on(event: 'change' \| 'invalidate', handler: (event: object \| string) => void)` | `() => void`                           | Subscribes to source events.                                                                                                                                      | Unsubscribe function.                                                                     | —                             |
| `un(event: 'change' \| 'invalidate', handler: (event: object \| string) => void)` | `void`                                 | Removes a registered handler.                                                                                                                                     | —                                                                                         | —                             |
| `dispose()`                                                                       | `void`                                 | Releases event handlers.                                                                                                                                          | —                                                                                         | —                             |

### Events {#timescopedatasourcebase-events}

| Event        | Payload                                                          | Description                     |
| ------------ | ---------------------------------------------------------------- | ------------------------------- |
| `change`     | `'change'`                                                       | Source revision is incremented. |
| `invalidate` | `{ type: 'invalidate', value: TimescopeDataSourceInvalidation }` | Source data is invalidated.     |

## Decimal

[`@kikuchan/decimal`](https://www.npmjs.com/package/@kikuchan/decimal) · [Guide](/guide/advanced/numbers-and-time#decimal-arithmetic)

### Constructor {#decimal-constructor}

```ts
Decimal(value: DecimalLike): Decimal
Decimal(value: null): null
Decimal(value: undefined): undefined
```

[Numeric inputs](/api/types#number-and-time-inputs)

### Properties {#decimal-properties}

| Property | Type     | Description                                |
| -------- | -------- | ------------------------------------------ |
| `coeff`  | `bigint` | Signed coefficient in `coeff × 10⁻ᵈⁱᵍⁱᵗˢ`. |
| `digits` | `number` | Decimal scale; a safe integer.             |

### Methods {#decimal-methods}

| Signature                                                                                                        | Returns              |
| ---------------------------------------------------------------------------------------------------------------- | -------------------- |
| `add(v: DecimalLike)`                                                                                            | `Decimal`            |
| `sub(v: DecimalLike)`                                                                                            | `Decimal`            |
| `mul(v: DecimalLike, digits?: number \| bigint)`                                                                 | `Decimal`            |
| `div(v: DecimalLike, precision?: number \| bigint, mode?: 'round' \| 'floor' \| 'ceil' \| 'trunc')`              | `Decimal`            |
| `divExact(v: DecimalLike, fallbackPrecision?: number \| bigint, mode?: 'round' \| 'floor' \| 'ceil' \| 'trunc')` | `Decimal`            |
| `divRound(v: DecimalLike, digits?: number \| bigint, mode?: 'round' \| 'floor' \| 'ceil' \| 'trunc')`            | `Decimal`            |
| `divFloor(v: DecimalLike, digits?: number \| bigint)`                                                            | `Decimal`            |
| `divCeil(v: DecimalLike, digits?: number \| bigint)`                                                             | `Decimal`            |
| `divTrunc(v: DecimalLike, digits?: number \| bigint)`                                                            | `Decimal`            |
| `mod(v: DecimalLike)`                                                                                            | `Decimal`            |
| `modPositive(v: DecimalLike)`                                                                                    | `Decimal`            |
| `neg(flag?: boolean)`                                                                                            | `Decimal`            |
| `abs()`                                                                                                          | `Decimal`            |
| `sign()`                                                                                                         | `number`             |
| `eq(v: DecimalLike)`, `neq(v: DecimalLike)`                                                                      | `boolean`            |
| `lt(v: DecimalLike)`, `le(v: DecimalLike)`                                                                       | `boolean`            |
| `gt(v: DecimalLike)`, `ge(v: DecimalLike)`                                                                       | `boolean`            |
| `cmp(v: DecimalLike)`                                                                                            | `number`             |
| `between(min: DecimalLike \| undefined, max: DecimalLike \| undefined)`                                          | `boolean`            |
| `isCloseTo(v: DecimalLike, tolerance: DecimalLike)`                                                              | `boolean`            |
| `isZero()`, `isPositive()`, `isNegative()`                                                                       | `boolean`            |
| `round(digits?: number \| bigint, force?: boolean)`                                                              | `Decimal`            |
| `floor(digits?: number \| bigint, force?: boolean)`                                                              | `Decimal`            |
| `ceil(digits?: number \| bigint, force?: boolean)`                                                               | `Decimal`            |
| `trunc(digits?: number \| bigint, force?: boolean)`                                                              | `Decimal`            |
| `roundBy(step: DecimalLike, mode?: 'round' \| 'floor' \| 'ceil' \| 'trunc')`                                     | `Decimal`            |
| `floorBy(step: DecimalLike)`, `ceilBy(step: DecimalLike)`, `truncBy(step: DecimalLike)`                          | `Decimal`            |
| `rescale(digits?: number \| bigint, mode?: 'round' \| 'floor' \| 'ceil' \| 'trunc')`                             | `Decimal`            |
| `toString()`                                                                                                     | `string`             |
| `toFixed(digits: number \| bigint)`                                                                              | `string`             |
| `number()`                                                                                                       | `number`             |
| `integer()`                                                                                                      | `bigint`             |
| `pow(exponent: DecimalLike, precision?: number \| bigint)`                                                       | `Decimal`            |
| `sqrt(precision?: number \| bigint)`                                                                             | `Decimal`            |
| `root(degree: number \| bigint, precision?: number \| bigint)`                                                   | `Decimal`            |
| `log(base: DecimalLike, precision?: number \| bigint)`                                                           | `Decimal`            |
| `inverse(precision?: number \| bigint)`                                                                          | `Decimal`            |
| `clamp(min: DecimalLike \| undefined, max: DecimalLike \| undefined)`                                            | `Decimal`            |
| `shift10(exponent: number \| bigint)`                                                                            | `Decimal`            |
| `order()`                                                                                                        | `bigint`             |
| `frac()`                                                                                                         | `Decimal`            |
| `split(digits?: number \| bigint, mode?: 'round' \| 'floor' \| 'ceil' \| 'trunc')`                               | `[Decimal, Decimal]` |
| `splitBy(step: DecimalLike, mode?: 'round' \| 'floor' \| 'ceil' \| 'trunc')`                                     | `[Decimal, Decimal]` |
| `clone()`                                                                                                        | `Decimal`            |

### Static Methods {#decimal-static-methods}

| Signature                                                                                  | Returns                              |
| ------------------------------------------------------------------------------------------ | ------------------------------------ |
| `Decimal.isDecimal(value: unknown)`                                                        | `value is Decimal`                   |
| `Decimal.isDecimalLike(value: unknown)`                                                    | `value is DecimalLike`               |
| `Decimal.isDecimalType(value: unknown)`                                                    | `boolean`                            |
| `Decimal.pow10(exponent: number \| bigint)`                                                | `Decimal`                            |
| `Decimal.min(...values: (DecimalLike \| null \| undefined)[])`                             | `Decimal \| null`                    |
| `Decimal.max(...values: (DecimalLike \| null \| undefined)[])`                             | `Decimal \| null`                    |
| `Decimal.minmax(...values: (DecimalLike \| null \| undefined)[])`                          | `[Decimal \| null, Decimal \| null]` |
| `Decimal.equals(a: DecimalLike \| null \| undefined, b: DecimalLike \| null \| undefined)` | `boolean`                            |

## Calendar

[`@kikuchan/calendar`](https://www.npmjs.com/package/@kikuchan/calendar) · [Guide](/guide/advanced/numbers-and-time#calendar-time)

### Constructor {#calendar-constructor}

<ApiMember
  id="calendar-new"
  kind="Constructor"
  :signatures="['new Calendar()', 'new Calendar(epochSeconds)', 'new Calendar(year, month, day, hour?, minutes?, seconds?)']"
  :parameters="[
    { name: 'epochSeconds', type: 'DecimalLike | Date', description: 'Unix epoch seconds or a JavaScript date.' },
    { name: 'year, month, day', type: 'bigint | number', description: 'Calendar components; month and day are one-based.' },
    { name: 'hour?, minutes?', type: 'bigint | number' },
    { name: 'seconds?', type: 'DecimalLike' },
  ]"
  returns="Calendar">

Creates a calendar value in the local display zone.

<template #defaults>

No arguments: current time. `hour`, `minutes`, `seconds`: `0`.

</template>
</ApiMember>

### Static Methods {#calendar-static-methods}

| Signature                                                                                                                                                                      | Returns    | Description                                                                   | Defaults                                                                         |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `Calendar.fromEpoch(epochSeconds: DecimalLike)`                                                                                                                                | `Calendar` |
| `Calendar.fromDate(date: Date)`                                                                                                                                                | `Calendar` |
| `Calendar.fromComponents(input: { year: DecimalLike, month: DecimalLike, day: DecimalLike, hour?: DecimalLike, minutes?: DecimalLike, seconds?: DecimalLike, zone?: string })` | `Calendar` | Creates a calendar value from integer components; seconds may be fractional.  | `input.hour`, `input.minutes`, `input.seconds`: `0`.<br>`input.zone`: `'local'`. |
| `Calendar.parse(value: string, format?: string, inputZone?: string)`                                                                                                           | `Calendar` | Parses a calendar date; explicit offsets take precedence over the input zone. | `format`: ISO 8601; `inputZone`: `'local'`.                                      |

### Methods {#calendar-methods}

| Signature                                                                                                                                                                          | Returns                                                                                                          | Description                                                                      | Defaults     |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------ |
| `year()`                                                                                                                                                                           | `bigint`                                                                                                         |
| `month()`                                                                                                                                                                          | `bigint`                                                                                                         |
| `day()`                                                                                                                                                                            | `bigint`                                                                                                         |
| `hour()`                                                                                                                                                                           | `bigint`                                                                                                         |
| `minutes()`                                                                                                                                                                        | `bigint`                                                                                                         |
| `seconds()`                                                                                                                                                                        | `Decimal`                                                                                                        |
| `weekday()`                                                                                                                                                                        | `number`                                                                                                         |
| `epoch()`                                                                                                                                                                          | `Decimal`                                                                                                        |
| `components()`                                                                                                                                                                     | `{ year: bigint, month: bigint, day: bigint, hour: bigint, minutes: bigint, seconds: Decimal, weekday: number }` |
| `clone()`                                                                                                                                                                          | `Calendar`                                                                                                       |
| `year(value: DecimalLike)`, `month(value: DecimalLike)`, `day(value: DecimalLike)`, `hour(value: DecimalLike)`, `minutes(value: DecimalLike)`, `seconds(value: DecimalLike)`       | `Calendar`                                                                                                       |
| `year$(value: DecimalLike)`, `month$(value: DecimalLike)`, `day$(value: DecimalLike)`, `hour$(value: DecimalLike)`, `minutes$(value: DecimalLike)`, `seconds$(value: DecimalLike)` | `Calendar`                                                                                                       |
| `epoch(value: DecimalLike)`                                                                                                                                                        | `Calendar`                                                                                                       |
| `epoch$(value: DecimalLike)`                                                                                                                                                       | `this`                                                                                                           |
| `zone()`                                                                                                                                                                           | `string`                                                                                                         |
| `zone(value: string)`                                                                                                                                                              | `Calendar`                                                                                                       |
| `utc()`                                                                                                                                                                            | `Calendar`                                                                                                       |
| `local()`                                                                                                                                                                          | `Calendar`                                                                                                       |
| `zone$(value: string)`, `utc$()`, `local$()`                                                                                                                                       | `this`                                                                                                           |
| `alignToDay(step?: number \| bigint \| (number \| bigint)[])`                                                                                                                      | `Calendar`                                                                                                       | Day boundary at or before this date; arrays specify boundaries.                  | `step`: `1`. |
| `nextDay(step?: number \| bigint \| (number \| bigint)[])`                                                                                                                         | `Calendar`                                                                                                       | Next day boundary; arrays specify boundaries.                                    | `step`: `1`. |
| `alignToMonth(step?: number \| bigint \| (number \| bigint)[])`                                                                                                                    | `Calendar`                                                                                                       | Month boundary at or before this date; arrays specify boundaries.                | `step`: `1`. |
| `nextMonth(step?: number \| bigint \| (number \| bigint)[])`                                                                                                                       | `Calendar`                                                                                                       | Next month boundary; arrays specify boundaries.                                  | `step`: `1`. |
| `alignToYear(step?: number \| bigint \| (number \| bigint)[], options?: { era?: boolean })`                                                                                        | `Calendar`                                                                                                       | Year boundary at or before this date; `options.era` enables era-aware alignment. | `step`: `1`. |
| `nextYear(step?: number \| bigint \| (number \| bigint)[], options?: { era?: boolean })`                                                                                           | `Calendar`                                                                                                       | Next year boundary; `options.era` enables era-aware alignment.                   | `step`: `1`. |
| `alignToSecond(step: DecimalLike)`                                                                                                                                                 | `Calendar`                                                                                                       |
| `format(format: string)`                                                                                                                                                           | `string`                                                                                                         |

#### Format Tokens {#calendar-format-tokens}

| Token                       | Parsing                                       | Formatting                                                            |
| --------------------------- | --------------------------------------------- | --------------------------------------------------------------------- |
| `Y` / `y`, repeated n times | Optional sign; one or more digits             | At least n digits; negative sign only                                 |
| `IY`                        | Same as `Y`                                   | Four digits for years 0–9999; otherwise sign and at least six digits  |
| `G`, repeated n times       | Positive era year; `BC` prefix or `AD` suffix | At least n digits; `BC` prefix or `AD` suffix                         |
| `g`, repeated n times       | Positive era year; optional `BC` prefix       | At least n digits; `BC` prefix before AD 1                            |
| `MM` / `M`                  | 1–2 digit month                               | Two digits / no padding                                               |
| `DD`                        | 1–2 digit day                                 | Two digits                                                            |
| `hh` / `h`                  | 1–2 digit 24-hour time                        | Two digits / no padding                                               |
| `mm`                        | 1–2 digit minute                              | Two digits                                                            |
| `ss`                        | 1–2 digit whole second                        | Two digits                                                            |
| `S`, repeated n times       | 1–n fractional digits                         | Exactly n digits; padded or truncated                                 |
| `S*`                        | One or more fractional digits                 | All fractional digits without trailing zeros; `0` for integer seconds |
| `Z`                         | `Z`, `±HH:mm`, or `±HHmm`                     | `Z` for zero offset; otherwise `±HH:mm`                               |
| `[text]`                    | Literal text                                  | Literal text                                                          |
| Backslash + character       | Literal next character                        | Literal next character                                                |

[Parsing and formatting guide](/guide/advanced/numbers-and-time#parse-and-format-dates)
