---
titleTemplate: Timescope API
outline: [2, 3]
---

# Interfaces

Public interfaces exported from `timescope`.

## TimescopePreparedView

[`Timescope.prepareView()`](/api/classes#timescope-methods) · [Guide](/guide/advanced/views#wait-for-data-and-drawing)

### Properties {#timescopepreparedview-properties}

| Property (readonly) | Type          | Description                                       |
| ------------------- | ------------- | ------------------------------------------------- |
| `signal`            | `AbortSignal` | Cancellation signal for this draft and its fetch. |

### Methods {#timescopepreparedview-methods}

| Signature                                                                  | Returns         | Description                                                                                         | Defaults                                                       | Return details                                                                   | Throws                                                      | Rejects                                                                                                                                                                                            |
| -------------------------------------------------------------------------- | --------------- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `setTime(value: TimescopeTimeLike, animation?: TimescopeAnimationInput)`   | `boolean`       | Sets the draft's selected time.                                                                     | Same as [Timescope.setTime()](/api/classes#timescope-settime). | `false` for invalid input.                                                       | `InvalidStateError`: `fetch()` started or `abort()` called. | —                                                                                                                                                                                                  |
| `setZoom(value: TimescopeNumberLike, animation?: TimescopeAnimationInput)` | `boolean`       | Sets the draft's zoom level.                                                                        | Same as [Timescope.setZoom()](/api/classes#timescope-setzoom). | `false` for invalid input.                                                       | `InvalidStateError`: `fetch()` started or `abort()` called. | —                                                                                                                                                                                                  |
| `setPlaybackTime(value: TimescopeTimeLike)`                                | `void`          | Sets the draft's playback clock; `null` restores wall-clock time.                                   | —                                                              | —                                                                                | `InvalidStateError`: `fetch()` started or `abort()` called. | —                                                                                                                                                                                                  |
| `fetch()`                                                                  | `Promise<void>` | <span id="timescopepreparedview-errors"></span>Loads required data and activates the prepared view. | —                                                              | Drawing may still be pending; await `Timescope.nextFrame()` to finish rendering. | —                                                           | `InvalidStateError`: unmounted, or another view fetching.<br>`AbortError`: navigation, interaction, option change, resize, or unmount during fetch.<br>Acquisition error: data acquisition failed. |
| `abort(reason?: unknown)`                                                  | `void`          | Cancels the draft or its active fetch.                                                              | `reason`: `AbortError`.                                        | —                                                                                | —                                                           | —                                                                                                                                                                                                  |

## TimescopeDataSource

[`createDataSource()`](/api/utilities#createdatasource) · [`TimescopeDataSourceBase`](/api/classes#timescopedatasourcebase) · [Guide](/guide/advanced/data)

### Properties {#timescopedatasource-properties}

| Property (readonly) | Type                                          | Description                                                        |
| ------------------- | --------------------------------------------- | ------------------------------------------------------------------ |
| `chunkSize`         | `number \| ((resolution: Decimal) => number)` | Preferred number of resolution intervals per query chunk.          |
| `chunkOrigin`       | `Decimal`                                     | Origin for chunks and aggregation buckets.                         |
| `resolutions?`      | `readonly Decimal[]`                          | Preferred loader resolutions; direct queries remain unrestricted.  |
| `immediate`         | `boolean`                                     | Whether loading is permitted while the view moves.                 |
| `cacheSize?`        | `number`                                      | Number of inactive query results retained; `0` disables retention. |
| `revision`          | `number`                                      | Current source revision.                                           |
| `invalidation?`     | `TimescopeDataSourceInvalidation`             | Latest invalidation range and revision.                            |

### Methods {#timescopedatasource-methods}

| Signature                                                                                                    | Returns                                | Description                                                                                                                        | Defaults           | Return details                                                                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------ | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `query(request: TimescopeDataSourceQuery)`                                                                   | `Promise<readonly TimescopeDataRow[]>` | <span id="timescopedatasource-query-contract"></span>Queries a finite range at a positive resolution; no chunk alignment required. | —                  | Points: `start <= time && time < end`.<br>Intervals: `rowStart < end && start < rowEnd`, without trimming.<br>Aggregates return whole buckets; [response requirements](/guide/advanced/data#return-rows-for-a-range). |
| `invalidate(range?: TimescopeRange<TimescopeTimeLike<undefined>>)`                                           | `void`                                 | Notifies consumers of changed data; `undefined` endpoints are unbounded.                                                           | `range`: all data. | Does not wait for replacement data or drawing.                                                                                                                                                                        |
| `on('invalidate', handler: (event: { type: 'invalidate', value: TimescopeDataSourceInvalidation }) => void)` | `() => void`                           | Subscribes to source invalidation.                                                                                                 | —                  | Unsubscribe function.                                                                                                                                                                                                 |
| `dispose?()`                                                                                                 | `void`                                 | Releases source resources.                                                                                                         | —                  | —                                                                                                                                                                                                                     |

#### Invalidation {#timescopedatasource-invalidation}

| `TimescopeDataSourceInvalidation` field | Type                                   | Description                                                                      |
| --------------------------------------- | -------------------------------------- | -------------------------------------------------------------------------------- |
| `range?`                                | `TimescopeRange<Decimal \| undefined>` | Affected range; omitted means all data, and `undefined` endpoints are unbounded. |
| `revision`                              | `number`                               | Source revision after the change.                                                |

[Refreshing data](/guide/advanced/data#refresh-changed-data) · [Source lifetime](/guide/advanced/data#reuse-a-source)

### Events {#timescopedatasource-events}

| Event        | Payload                                                          | Description                            |
| ------------ | ---------------------------------------------------------------- | -------------------------------------- |
| `invalidate` | `{ type: 'invalidate', value: TimescopeDataSourceInvalidation }` | Source data is invalidated or changed. |

## TimescopeAppendOnlyDataSource

```ts
interface TimescopeAppendOnlyDataSource extends TimescopeDataSource
```

[Guide](/guide/advanced/data#append-live-points)

### Methods {#timescopeappendonlydatasource-methods}

| Signature                                                                 | Returns         | Description                                                                                             | Return details                                                                                                             |
| ------------------------------------------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `append(rows: TimescopeDataRowInput \| readonly TimescopeDataRowInput[])` | `Promise<void>` | Appends point rows in nondecreasing time order and refreshes consumers; invalid batches insert nothing. | Resolves after the data update, before drawing necessarily completes. Only direct source mappings apply to appended input. |
