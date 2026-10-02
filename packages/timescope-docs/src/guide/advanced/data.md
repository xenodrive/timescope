---
title: Loading and Updating Data
---

# Loading and Updating Data

Extend [Drawing a Chart](/guide/drawing-a-chart) with remote loading and live updates, using the [DataSource and DataLoader model](/guide/concepts#dataloader-and-datasource).

The examples use a target sized with CSS:

```html
<div id="chart" style="height: 240px"></div>
```

Start with a **snapshot** when your application can supply the complete dataset: an array of rows, a URL, or a callback that loads them all. For a large or remote history, use **range loading** so your endpoint can return the requested time range at the requested resolution. Both approaches use the same row format.

Choose exactly one of `data`, `url`, or `loader` in a loading options object, and at most one of `decoder` and `mappings`. Without a transform, inline data and callback results must be row arrays; URL responses are read as JSON. [Numeric and time inputs](/guide/advanced/numbers-and-time#numeric-and-time-inputs) explains how row values and dates are interpreted.

## Snapshot Loading

### Load inline data

Snapshots remain loaded until invalidation. Drawing a Chart passes an array directly; use `createDataSource()` when you need an instance for invalidation or reuse, then register it in `sources`:

```ts
import { createDataSource, Timescope } from 'timescope';

const measurements = createDataSource([
  { time: 0, value: 18 },
  { time: 15, value: 21 },
  { time: 30, value: 19 },
]);

const timescope = new Timescope({
  target: '#chart',
  fit: [0, 30],
  sources: { measurements },
  series: { temperature: { data: { source: 'measurements' }, chart: 'lines' } },
});
```

### Load from a URL

A URL without placeholders loads a complete snapshot. It can return a JSON array in the same row format:

```ts
const measurements = createDataSource({ url: '/samples.json' });
```

### Load with a snapshot loader

Use a `loader` callback for application logic such as authentication or an SDK call. A **snapshot loader** takes no arguments and returns the complete dataset; set `chunked: false`:

```ts {2-3}
const measurements = createDataSource({
  chunked: false,
  loader: async () => {
    const response = await fetch('/samples.json');
    if (!response.ok) throw new Error(`Samples: ${response.status}`);
    return response.json();
  },
});
```

### Convert a response to rows

If an endpoint returns a different structure, use `decoder` to convert its response to rows. For field-path mapping without a callback, use [`mappings`](/api/types#timescopemappings). These transforms also apply to range loading.

The decoder receives the inline payload, a fetched `Response`, or the loader callback's result, and may return a Promise. Mapping keys become row field names; their values are payload paths. Use `record.timestamp` for a nested field or `primary, fallback` for the first non-null candidate. URL responses with mappings are read as JSON before mapping.

```ts
const measurements = createDataSource({
  url: '/api/measurements',
  decoder: async (response: Response) => {
    if (!response.ok) throw new Error(`Measurements: ${response.status}`);
    const payload = await response.json();
    return payload.samples.map((sample: { timestamp: string; temperature: number }) => ({
      time: sample.timestamp,
      value: sample.temperature,
    }));
  },
});
```

## Chunk Loading

The Series' `data.resolution` and the DataSource's resolution hints select the [data resolution](/api/types#timescopedataresolution). By default, the preferred interval is the display resolution from [Core Concepts](/guide/concepts#time-and-zoom).

`chunkSize` and `chunkOrigin` control the preferred query ranges: chunks span **`chunkSize × data resolution`** time units from **`chunkOrigin`**. Loaders must also accept arbitrary requested ranges; do not assume a request matches the visible range exactly.

![Preferred query ranges aligned to chunkOrigin, with each chunk spanning chunkSize times resolution](../assets/chunk-loading.svg)

`chunkSize` defaults to `256`, and `chunkOrigin` to `0`. The following range-loading inputs acquire rows for each requested range.

`chunkSize` must be a positive safe integer. A callback can choose it per resolution, but must return a stable size for that resolution. `immediate: true` permits loading while the view moves. `cacheSize` retains inactive query results and defaults to `1000`; use a nonnegative integer, or `0` to disable retention.

### Select data resolution

Use a positive `data.resolution` value or a resolver callback to choose a preferred interval independently of display resolution. A callback receives `resolution` (display time units per pixel) and `resolutions` (the source's preferred resolutions, or an empty array).

For range loaders, source `resolutions` supplies positive interval hints. `zoomLevels` supplies equivalent hints in zoom units, but `resolutions` takes precedence. Snapshot sources do not expose these hints, and they never restrict direct `query()` calls.

The preferred interval snaps to source hints, or to integer-zoom resolutions if there are no hints. The default `'nearest'` snap chooses the closest on the logarithmic zoom scale. `'floor'` chooses the largest interval at or below the preference, while `'ceil'` chooses the smallest at or above it; both clamp to the candidate endpoints when needed:

```ts
data: {
  source: 'history',
  resolution: {
    resolve: ({ resolution }) => resolution.mul(2),
    snap: 'ceil',
  },
}
```

[Resolution types](/api/types#timescopedataresolution)

### Load from a templated URL

Include range placeholders so the endpoint can return rows for the requested time range and resolution:

```ts
const history = createDataSource({
  url: '/api/history?start={start}&end={end}&resolution={resolution}',
});
```

Timescope substitutes the placeholders as the user pans and zooms. The endpoint should follow the [range response requirements](#return-rows-for-a-range) below.

[URL placeholders](/api/types#url-placeholders)

### Load with a range loader

A **range loader** receives the requested range and data resolution. Function loaders use this mode by default (`chunked: true`):

```ts {4}
import { createDataSource } from 'timescope';

const history = createDataSource({
  loader: async ({ range: [start, end], resolution }) => {
    const query = new URLSearchParams({
      start: start.toString(),
      end: end.toString(),
      resolution: resolution.toString(),
    });
    const response = await fetch(`/api/history?${query}`);
    if (!response.ok) throw new Error(`History: ${response.status}`);
    return response.json(); // Rows at the requested resolution, including link neighbors.
  },
});
```

### Return rows for a range

Templated URLs and range loaders receive a finite range `[start, end)` and a positive `resolution`, expressed as `Decimal` values. The start is included and the end is excluded. Requests can have arbitrary boundaries, so handle the supplied range rather than assuming it aligns with a particular chunk.

Return points whose times fall inside that range. For interval rows, return every row that overlaps the range, preserving its original start and end even when part of the interval lies outside the request.

Aggregate queries return whole buckets anchored to `chunkOrigin`, so their rows may extend beyond the requested range.

Links also need neighboring points to continue smoothly across the request boundary. Where available, include one point on each side for lines and steps, or two for curves. Include these neighbors even when the requested range itself contains no points.

![Return complete rows intersecting the range, plus neighboring rows for links](../assets/query-context.svg)

[Loading options](/api/types#timescopesourceoptions) · [Resolution](/api/types#timescopedataresolution) · [Dynamic Loader example](/examples/gallery#dynamic-loader)

## Aggregate snapshot points

The default `'simple'` source supports both points and intervals. Choose `'point-aggregate'` or `'point-percentile'` to summarize snapshot points at the requested data resolution; these types do not accept interval rows or range-loading inputs.

Aggregate sources expose each value's `#avg`, `#first`, `#last`, `#min`, and `#max` fields; the unsuffixed field is the average. Percentile sources expose `#first`, `#last`, `#min`, `#max`, and the percentiles selected by `percentiles.values` (`0.5`, `0.9`, and `0.95` by default). Use selectors such as `value#p95` to draw a percentile. `percentiles.primary` chooses the unsuffixed value, defaulting to p50; `percentiles` applies only to `'point-percentile'`.

Only `'point-aggregate'` supports appending live points. `createDataSource()` infers row and field types from its input and returns an append-capable instance for this source type; an already supplied DataSource is returned unchanged.

[Source types and output fields](/api/types#timescopesourceoptions)

## Refresh changed data

Call `invalidate()` when previously loaded data has changed. For a snapshot, `measurements.invalidate()` reloads the complete dataset on demand. This is also how you notify Timescope after changing an input array.

For range-loaded history, identify the affected interval so Timescope can refresh it:

```ts
history.invalidate([120, 180]); // Corrected samples in this interval.
history.invalidate([180, undefined]); // New or corrected samples from time 180 onward.
```

Include late-arriving samples in the invalidated range. Passing a range to a snapshot source still reloads the whole snapshot.

When you have a Timescope instance rather than an individual source, use `await timescope.reload()` to invalidate all its sources, or `await timescope.reload(['measurements'])` to select sources by name.

`reload()` returns `false` when unavailable or failed. Built-in sources reacquire invalidated data on demand; omitting the invalidation range affects all data, and an `undefined` endpoint is unbounded.

> [!IMPORTANT]
> Neither `invalidate()` nor `await reload()` waits for replacement data and drawing. Before export, [wait for data and drawing](/guide/advanced/views#wait-for-data-and-drawing).

## Append live points

For an ordered live stream, use `type: 'point-aggregate'` and call `append()` as points arrive. Appending does not move the view; advance the [playback clock](/guide/advanced/views#follow-a-live-or-playback-clock) separately to follow the latest sample.

```ts
import { createDataSource, Timescope } from 'timescope';

const signal = createDataSource({
  type: 'point-aggregate',
  data: [{ time: 0, value: 1 }],
});

const timescope = new Timescope({
  target: '#chart',
  time: null,
  zoom: 5,
  sources: { signal },
  series: { signal: { data: { source: 'signal' }, chart: 'lines' } },
  tracks: { default: { timeAxis: { relative: true } } },
});
timescope.setPlaybackTime(0);

await signal.append([
  { time: 1, value: 2 },
  { time: 2, value: 1.5 },
]);
timescope.setPlaybackTime(2);
```

Supply points in time order, including across successive calls to `append()`. Equal times are allowed, but a new point cannot precede an earlier one. The chart refreshes automatically after an append, so no `reload()` call is needed.

Equal-time points retain insertion order. An invalid batch inserts nothing. Only mappings configured directly on the source apply to appended input; decoders and DataLoader transforms do not.

Awaiting `append()` means the data has been updated; drawing may still be pending. If you later invalidate the source, its snapshot is replaced from the original input. Any appended points absent from that input are lost.

[Appending Points](/api/interfaces#timescopeappendonlydatasource) · [Live Stream example](/examples/gallery#live-stream)

## Reuse a DataSource {#reuse-a-source}

When replacing configuration, keep the same DataSource instance to retain loaded data. This also applies to [framework `options` updates](/guide/advanced/frameworks/overview#configuration-and-state): do not recreate the DataSource for an appearance-only change.

```ts
timescope.setOptions({
  sources: { measurements },
  series: { temperature: { data: { source: 'measurements' }, chart: 'lines:filled' } },
});
```

[DataSource lifecycle](/api/interfaces#timescopedatasource-invalidation) · [Reusable DataLoader](#reuse-a-dataloader)

Charts manage the lifetime of their DataSources, including shared instances. Dispose a standalone source with `source.dispose?.()` when it is no longer needed.

## Reuse a DataLoader

Use `createDataLoader()` to reuse acquisition and conversion settings across DataSources, or to load canonical rows without creating a chart:

```ts
import { createDataLoader, createDataSource } from 'timescope';

const loader = createDataLoader({ url: '/samples.json' });
const rows = await loader.load();

const measurements = createDataSource({ loader, chunked: false });
```

A DataLoader does not cache results: each `load()` performs acquisition again. Sharing a loader shares acquisition settings, not loaded data or invalidation state. Share a [DataSource instance](#reuse-a-source) when you want to retain loaded data. Configure `decoder` or `mappings` on the loader rather than on a DataSource that receives it.

The factory infers snapshot or range mode and preserves a supplied loader's mode. `ranged` is `true` for templated URLs or function loaders without `chunked: false`. Call `load()` for snapshots and `load(request)` for ranges; supplying the wrong form rejects. Snapshot DataLoader inputs require `chunked: false` when used in a source.

[DataLoader reference](/api/classes#timescopedataloader).

## Custom DataSources

Implement `TimescopeDataSource` when your application already has its own query and invalidation system. Its `query()` must return canonical rows following the [range response requirements](#return-rows-for-a-range), at a positive resolution in the rows' time units. Direct queries need not align with chunks.

Extend `TimescopeDataSourceBase` to reuse source options and event handling, and implement its abstract `query()`. The base's `invalidate()` increments `revision` and emits `change` and `invalidate` without acquiring data. A reversed invalidation range throws `RangeError`. Its `dispose()` releases event handlers.

[DataSource interface](/api/interfaces#timescopedatasource) · [Base class](/api/classes#timescopedatasourcebase)
