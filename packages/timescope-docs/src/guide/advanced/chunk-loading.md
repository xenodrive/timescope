---
title: Chunk Loading
---

<script setup>
import ExampleDynamicLoader from '../../examples/dynamic-loader.vue';
</script>

# Chunk Loading

Explore a large or remote history without fetching all of it first. Timescope requests time ranges at the data resolution needed by the view, so your endpoint can serve a detailed close-up or a summarized overview. See [Core Concepts](/guide/concepts#chunk-loading) for the model, or try the [Dynamic Loader example](/examples/gallery#dynamic-loader).

<ClientOnly><ExampleDynamicLoader /></ClientOnly>

Pan to reveal new terrain, then zoom in to request finer detail. This example generates data locally with a simulated 450ms delay. The lower Track shows the ranges returned by a companion loader, making chunk boundaries visible.

This is the terrain source used by the demo. `terrain()` generates a height at the given time and resolution, and `delayed()` supplies the simulated latency:

<<< ../../examples/dynamic-terrain.js#terrain-loader{js}

## Connect a range endpoint

For your own remote history, replace local generation with an endpoint. Include range and resolution placeholders in a source URL. Timescope substitutes them as the user pans and zooms:

```html
<div id="chart" style="height: 240px"></div>
```

```ts
import { Timescope } from 'timescope';

const timescope = new Timescope({
  target: '#chart',
  fit: [0, 3600],
  sources: {
    history: {
      url: '/api/history?start={start}&end={end}&resolution={resolution}',
    },
  },
  series: {
    signal: { data: { source: 'history' }, chart: 'lines' },
  },
  tracks: { default: { timeAxis: { relative: true } } },
});
```

Return a JSON array of rows such as `{ time: 15, value: 3 }`, using the same [row format](/api/types#data-rows) as snapshot data. The endpoint chooses or computes data at the requested resolution; Timescope does not automatically summarize a range response for it.

A URL without placeholders loads a complete [snapshot](/guide/drawing-a-chart#snapshot-data) instead.

## Use an application loader

Use a callback when requests need authentication, an SDK, or application-specific processing. Replace the URL source with a `loader`:

```ts
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
    return response.json();
  },
});
```

Register this instance as `sources: { history }`. Function loaders use range mode by default; the request supplies `Decimal` values, so serializing with `toString()` retains their precision.

For a differently shaped payload, return row objects from the callback or use [`decoder` / `mappings`](/api/types#timescopedataloaderoptions). A URL decoder receives the fetched `Response`, while a callback decoder receives the callback's result.

## Return rows for a range

Requests contain a finite range `[start, end)` and a positive `resolution` in the data's time units. The start is included and the end is excluded. Handle the requested boundaries even when they do not match a preferred chunk or the visible range exactly.

- **Points:** return points whose times fall inside the range.
- **Intervals:** return every overlapping interval, keeping its original start and end rather than trimming it to the request.
- **Connections:** include neighboring points on both sides where available: one for lines and steps, or two for curves. Include them even when the range itself has no points.

![Return complete rows intersecting the range, plus neighboring rows for links](../assets/query-context.svg)

The neighboring points let Links continue across request boundaries. For bucketed data, keep bucket alignment consistent across requests and return whole buckets rather than clipping their rows. Built-in aggregate sources anchor buckets to `chunkOrigin`.

[Request types](/api/types#load-and-query-requests) · [URL placeholders](/api/types#url-placeholders)

## Match your endpoint's resolutions {#select-data-resolution}

If the service stores only certain sampling intervals, advertise them with source `resolutions`. For example, a service with one-second, one-minute, and one-hour data can use:

```ts
sources: {
  history: {
    url: '/api/history?start={start}&end={end}&resolution={resolution}',
    resolutions: [1, 60, 3600],
  },
}
```

By default, a Series prefers the display resolution and snaps to the nearest available interval on the logarithmic zoom scale. Without source hints, it snaps to integer-zoom resolutions.

Use Series `data.resolution` to request a different density. For example, prefer two pixels per interval and round up to the next available interval:

```ts
data: {
  source: 'history',
  resolution: {
    resolve: ({ resolution }) => resolution.mul(2),
    snap: 'ceil',
  },
}
```

This changes data acquisition, not the visible time range. [Resolution options](/api/types#timescopedataresolution) describe fixed intervals, resolver callbacks, and snapping modes.

## Tune request sizes {#chunk-size}

Preferred chunks span **`chunkSize × data resolution`** time units, aligned from **`chunkOrigin`**. The defaults are `256` and `0` respectively.

![Preferred query ranges aligned to chunkOrigin, with each chunk spanning chunkSize times resolution](../assets/chunk-loading.svg)

Use a larger `chunkSize` when your service benefits from larger batches, or a smaller one to reduce the amount acquired per chunk. A resolution-dependent size callback must return a stable size for each resolution. Loaders must still accept arbitrary requested boundaries.

`cacheSize` controls retention of inactive query results, and `immediate` controls loading while the view moves. See [source options](/api/types#timescopesourcecommonoptions) for their defaults and constraints.

For a history that also changes over time, see [refreshing changed ranges](/guide/advanced/live-streaming#refresh-changed-data).
