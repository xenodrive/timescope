---
title: Loading and Updating Data
---

# Loading and Updating Data

After [Drawing a Chart](/guide/drawing-a-chart), connect the same Sources and Series to data from your application or a remote service. A [DataLoader](/guide/concepts#dataloader-and-datasource) acquires rows; a DataSource answers requests for ranges and resolutions.

- **Snapshot loading** acquires the complete dataset and retains it until invalidation.
- **Chunk loading** divides display requests into time chunks at a chosen resolution. A Source can answer those requests from a loaded snapshot or acquire the requested rows remotely.

For remote chunk loading, the acquisition interface is called a **range loader** in the API. It accepts arbitrary ranges: callers are not required to align requests to chunk boundaries.

## Snapshot Loading

### Load inline data

For data already available in your application, pass a row array as a source. Each series selects its source by name.

```ts
import { createDataSource, Timescope } from 'timescope';

const measurements = createDataSource([
  { time: 0, value: 18 },
  { time: 15, value: 21 },
  { time: 30, value: 19 },
]);

const timescope = new Timescope({
  target: '#chart',
  style: { height: '240px' },
  fit: [0, 30],
  sources: { measurements },
  series: { temperature: { data: { source: 'measurements' }, chart: 'lines' } },
});
```

### Load from a URL

A URL without placeholders loads a complete snapshot. The response can be a JSON array of rows in the same format as the inline data above.

```ts
const measurements = createDataSource({ url: '/samples.json' });
```

### Load with a snapshot callback

Use a `loader` callback when acquisition needs application logic, such as authentication or an SDK call. Set `chunked: false` for a callback that returns the complete dataset; it takes no range arguments:

```ts
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

If an endpoint returns a different structure, use `decoder` to convert its response to rows. For field-path mapping without a callback, use [`mappings`](/api/timescope-options#mappings). Both transforms also work with chunk loading; the expected rows have the same format.

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

For a Series, the display resolution and the DataSource's resolution hints guide the requested [data resolution](/api/timescope-options#resolution), which may differ from the display resolution.

At that resolution, the timeline is divided into chunks of width **`chunkSize × resolution`**, anchored to **`chunkOrigin`**. The visible range selects the chunks to request. Each selected chunk is queried from the DataSource using its full time range and the chosen resolution. These display requests share cached results for the same DataSource, even across several Series.

![Chunks aligned to chunkOrigin; the visible range selects full chunks to query at the chosen resolution](../assets/chunk-loading.svg)

`chunkSize` defaults to `256`, and `chunkOrigin` defaults to `0`. A loaded snapshot can answer these queries locally. To acquire only the requested history from a remote service, use a templated URL or a range-loader callback instead.

### Load from a templated URL

Include range placeholders so the endpoint can return rows for the requested time range and resolution:

```ts
const history = createDataSource({
  url: '/api/history?start={start}&end={end}&resolution={resolution}',
});
```

Timescope substitutes the placeholders as the user pans and zooms. The endpoint should follow the [range response requirements](#return-rows-for-a-range) below.

[URL placeholders](/api/timescope-options#url-placeholders)

### Load with a range-loader callback

A range-loader callback receives the requested time range and resolution. Function loaders use this mode by default (`chunked: true`):

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
    return response.json(); // Rows at the requested resolution, including link neighbors.
  },
});
```

### Return rows for a range

Both a templated URL and a range-loader callback must return complete rows intersecting the request. Include neighboring points where available so lines and curves can continue across the view's edges.

![Return complete rows intersecting the range, plus neighboring rows for links](../assets/query-context.svg)

| Endpoint contract               | Value                                                                    |
| ------------------------------- | ------------------------------------------------------------------------ |
| Request                         | Arbitrary finite `[start, end)` and positive `resolution`, all `Decimal` |
| Chunk boundaries                | No alignment requirement; the same loader can serve direct range queries |
| Points                          | `start <= time < end`                                                    |
| Intervals                       | All intersecting rows, without trimming their times                      |
| Link neighbors, where available | One on each side for lines/steps; two for curves, including empty ranges |

[Loading options](/api/timescope-options#source-options) · [Resolution](/api/timescope-options#resolution) · [Dynamic Loader example](/guide/examples/#dynamic-loader)

## Refresh changed data

Invalidate a source when previously loaded data has changed. Use a range to identify corrected history or newly available samples at the live tail.

| Change              | Call                                       |
| ------------------- | ------------------------------------------ |
| Complete snapshot   | `measurements.invalidate()`                |
| Historical interval | `history.invalidate([120, 180])`           |
| Live tail           | `history.invalidate([180, undefined])`     |
| All chart sources   | `await timescope.reload()`                 |
| Named chart sources | `await timescope.reload(['measurements'])` |

Include late-arriving samples in the invalidated range. Snapshot invalidation always replaces the whole snapshot.

For completed pixels after a refresh: [Wait for data and drawing](/guide/advanced/views#wait-for-data-and-drawing).

## Append live points

To add live samples, create a data source with `type: 'point-aggregate'` and call `append()` as points arrive in time order. Advance the playback clock separately when the chart should follow the latest sample.

```ts
import { createDataSource, Timescope } from 'timescope';

const signal = createDataSource({
  type: 'point-aggregate',
  data: [{ time: 0, value: 1 }],
});

const timescope = new Timescope({
  target: '#chart',
  style: { height: '240px' },
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

| Requirement          | Rule                                                           |
| -------------------- | -------------------------------------------------------------- |
| Input                | Points in nondecreasing time order; equal times allowed        |
| Chart refresh        | Automatic after `append()`                                     |
| Promise completion   | Data updated; drawing may still be pending                     |
| Snapshot replacement | `invalidate()` discards appends absent from the original input |

[Appending Points](/api/timescope-options#appending-points) · [Live Stream example](/guide/examples/#live-stream)

## Reuse a source

Keep the same DataSource instance when changing chart appearance so the chart can reuse its loaded data. In a framework component, create the source outside the options updates that change presentation settings.

```ts
timescope.setOptions({
  style: { height: '320px' },
  sources: { measurements },
  series: { temperature: { data: { source: 'measurements' }, chart: 'lines:filled' } },
});
```

[Source lifecycle](/api/timescope-options#invalidation-and-caching) · [Reusable DataLoader](/api/timescope-options#reusable-dataloader)
