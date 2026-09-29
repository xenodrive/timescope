---
title: Loading and Updating Data
---

# Loading and Updating Data

Choose how Timescope acquires data based on the size of the dataset and how it changes. The [DataSource concepts](/guide/concepts#sources) explain the common row and query model; this guide shows how to use it in an application.

## Choose an acquisition strategy

| Dataset                            | Start with                                | Updating it                          |
| ---------------------------------- | ----------------------------------------- | ------------------------------------ |
| Small, already in memory           | An inline row array                       | Supply a new source configuration    |
| A complete file or API response    | A snapshot URL or `chunked: false` loader | Invalidate to fetch a fresh snapshot |
| History too large to load at once  | A range loader or URL with placeholders   | Invalidate the affected time range   |
| Ordered, append-only point samples | A `point-aggregate` source                | Call `append()`                      |

Acquisition and aggregation are separate choices. A simple source preserves point and interval rows. `point-aggregate` summarizes points with min/max/average values; `point-percentile` provides percentile values. Both aggregation types acquire snapshots. See [Source Types](/api/timescope-options#source-types) and the [Decimation example](/guide/examples/#decimation).

## Load a snapshot

A URL without placeholders loads a complete dataset. If the response is not already an array of Timescope rows, convert it with `decoder`:

```ts
import { createDataSource, Timescope } from 'timescope';

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

const timescope = new Timescope({
  target: '#chart',
  sources: { measurements },
  series: { temperature: { data: { source: 'measurements' }, chart: 'lines' } },
});
```

For a function that returns the whole dataset, use `{ loader: async () => rows, chunked: false }`. Without `chunked: false`, a function is a range loader.

The decoder receives a `Response` for a URL, the resolved return value for a loader, or the supplied data for an inline source. Use either `decoder` or [mappings](/api/timescope-options#mappings) to adapt your payload.

## Load only the requested range

A range loader receives `{ range: [start, end], resolution }`. Times and resolution are `Decimal` values. Resolution expresses the requested time interval, so the server can return coarser data when the chart is zoomed out.

```ts
const history = createDataSource({
  loader: async ({ range: [start, end], resolution }) => {
    const query = new URLSearchParams({
      start: start.toString(),
      end: end.toString(),
      resolution: resolution.toString(),
    });
    const response = await fetch(`/api/history?${query}`);
    if (!response.ok) throw new Error(`History: ${response.status}`);
    return response.json(); // An array of Timescope rows, including link neighbors.
  },
});
```

The endpoint should return:

- All points in `[start, end)`.
- Complete interval rows that intersect the requested range, without clipping their times.
- Neighboring rows needed to draw connections across the edges: one on each side for lines and steps, two for curves, where available. Include these even when there are no points inside the range.

Accept arbitrary finite ranges and positive resolutions. Do not require requests to match a particular chunk grid: [direct queries](/api/timescope-options#direct-queries) may use other ranges. Return enough detail for the requested resolution rather than downloading all raw history at every zoom level.

For a simple endpoint, `{ url: '/api/history?start={start}&end={end}&resolution={resolution}' }` provides the same range parameters without a custom loader. See [URL Placeholders](/api/timescope-options#url-placeholders).

### Tune loading for the view

Start with the defaults, then adjust these public options as needed:

- **`resolutions` or `zoomLevels`:** advertise preferred data intervals. Configure `series.data.resolution` to control how the chart chooses among them.
- **`chunkSize`:** controls the preferred number of resolution intervals per display request. A larger value covers more time in each chunk.
- **`immediate: false`:** defer loading while the view is moving, useful for expensive requests.
- **`cacheSize`:** limits retained inactive results. `0` disables retention of unreferenced results; it does not unload a retained snapshot.

If tooltips need finer values than the overview chart, set `series.data.instantaneous.resolution` separately. If they are unnecessary, `tooltip: false` disables those cursor-sampling queries.

See the [Dynamic Loader example](/guide/examples/#dynamic-loader) for a visible demonstration of range loading, and [Resolution](/api/timescope-options#resolution) for the exact selection rules.

## Refresh changed data

Invalidate a source when previously acquired data is no longer current:

```ts
measurements.invalidate(); // Reacquire the complete snapshot on demand.
history.invalidate([120, 180]); // Refresh an affected interval.
history.invalidate([180, undefined]); // Refresh the live tail.
```

Include the earliest possibly changed time, including late-arriving samples. Snapshot invalidation always reacquires the whole snapshot; a range limits invalidation for range-based data.

If you do not keep source references, use `await timescope.reload()` for all sources or `await timescope.reload(['measurements'])` for selected names. This requests invalidation; it does not wait for the replacement data to be drawn. For that, [prepare the view and wait for a frame](/guide/advanced/views#wait-for-data-and-drawing).

## Append live points

Use a `point-aggregate` source for ordered point samples that arrive over time:

```ts
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
});

await signal.append([
  { time: 1, value: 2 },
  { time: 2, value: 1.5 },
]);
timescope.setPlaybackTime(2); // Follow the sample clock instead of wall-clock time.
```

Initial and appended points must be in nondecreasing time order. Equal times are allowed; interval rows are not. `append()` automatically refreshes consumers, so no `reload()` is needed. Its Promise confirms the data update, not drawing completion.

Invalidating an appendable snapshot reacquires its original input and discards appended data not present there. Use invalidation for a deliberate replacement, not after every append. For corrected or out-of-order history, consider a range loader instead.

See the [Live Stream example](/guide/examples/#live-stream) for playback controls and [Appending Points](/api/timescope-options#append-only-segment-tree) for the complete contract.

## Reuse a source

Create a DataSource once when it needs to survive presentation changes. Pass that instance in `options.sources`; keep it stable across framework renders. Several series can reference the same source while choosing different charts or domains.

Mutating an original inline array is not observed. Use a new source configuration, invalidate a loader-backed source, or call `append()` on an appendable source according to the update you need.

Timescope releases shared sources when their last renderer releases them. If you create a standalone source only for direct queries, call `source.dispose()` when finished. For acquisition shared outside charts, see [Reusable DataLoader](/api/timescope-options#reusable-dataloader).
