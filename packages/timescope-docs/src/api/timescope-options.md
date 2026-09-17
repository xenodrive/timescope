---
titleTemplate: Timescope API
---

# Timescope Options

`TimescopeOptions` is accepted by `setOptions()` and `updateOptions()`. The constructor accepts `TimescopeOptionsInitial`, which includes these options and the fields listed in [Timescope](/api/timescope#options-constructor-only).

## Options

| Key            | Type                                                 | Behavior                                                       |
| -------------- | ---------------------------------------------------- | -------------------------------------------------------------- |
| `style`        | `{ width?, height?, background? }`                   | Sets canvas size and background.                               |
| `padding`      | `number[]`                                           | Sets canvas padding as `[top, right, bottom, left]`.           |
| `indicator`    | `boolean`                                            | Shows the cursor indicator. Default: `true`.                   |
| `showFps`      | `boolean`                                            | Shows the FPS overlay.                                         |
| `renderThread` | `'worker' \| 'main'`                                 | Selects the drawing thread when mounting. Default: `'worker'`. |
| `sources`      | `Record<string, TimescopeSourceInput>`               | Defines data sources.                                          |
| `domains`      | `Record<string, TimescopeDomainOptions>`             | Defines shared value domains.                                  |
| `series`       | `Record<string, TimescopeSeriesInput>`               | Defines series.                                                |
| `tracks`       | `Record<string, { height?, symmetric?, timeAxis? }>` | Defines track layout.                                          |
| `selection`    | `boolean \| { resizable?, color?, invert?, range? }` | Configures range selection.                                    |

## Rendering Thread

Use `renderThread` to choose whether drawing runs in a Worker (the default) or on the main thread:

```ts
new Timescope({
  target: '#timescope',
  renderThread: 'main',
});
```

Data sources and loaders run on the main thread in both modes.

The setting is applied when mounting. Changing it with `setOptions()` or `updateOptions()` takes effect on the next mount.

## Sources

### Input Types

| Input                              | Behavior                                                                  |
| ---------------------------------- | ------------------------------------------------------------------------- |
| `readonly TimescopeDataRowInput[]` | Uses inline data. Changes to the original array are not observed.         |
| `{ data }`                         | Uses inline data with source options.                                     |
| `string` or `{ url }`              | Loads a snapshot URL, or loads chunks when the URL contains placeholders. |
| `function` or `{ loader }`         | Loads chunks. Set `chunked: false` to use a snapshot loader.              |
| `TimescopeDataSource`              | Uses a source created by `createDataSource()` or a custom source.         |

### Source Types

`createDataSource(input)` constructs one of these implementations. Custom DataSource instances pass through unchanged.

| `type`               | Behavior                                                                                                                       | Acquisition       | Updates                    |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ----------------- | -------------------------- |
| `'simple'` (default) | Returns unaggregated point and interval rows. Snapshots use a static point/interval index; range loaders are queried directly. | Snapshot or range | Invalidation/reacquisition |
| `'point-aggregate'`  | Returns point min/max/avg using a Segment Tree. Points must be in nondecreasing time order.                                    | Snapshot          | `append()`                 |
| `'point-percentile'` | Returns point percentiles using a static value index.                                                                          | Snapshot          | Invalidation/reacquisition |

Only point-aggregate sources expose `append()`. No built-in source exposes `replace()`. Appends automatically refresh consumers; await the returned Promise before an operation that depends on the new data. It does not indicate that a frame has been drawn.

```ts
import { createDataSource, Timescope } from 'timescope';

const source = createDataSource({
  type: 'point-aggregate',
  data: [{ time: 0, value: 10 }],
});
const timescope = new Timescope({
  target: '#timescope',
  time: 1,
  zoom: 6,
  sources: { samples: source },
  series: { samples: { data: { source: 'samples' }, chart: 'linespoints' } },
});

await source.append({ time: 1, value: 20 });
```

`append()` accepts one row or an array of rows. If the source uses `mappings`, pass records in the mapped input format. A `decoder` applies to the initial payload only; pass decoded rows to `append()`.

### Source Options

| Key           | Type                                                                                         | Behavior                                                                                                                              |
| ------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `chunkSize`   | `number`                                                                                     | Preferred number of resolution intervals per display-cache chunk. Default: `256`.                                                     |
| `chunkOrigin` | `TimescopeNumberLike`                                                                        | Preferred chunk origin, also used to anchor point aggregation buckets. Default: `0`.                                                  |
| `immediate`   | `boolean`                                                                                    | Allows loading while the view is moving. Default: `true`.                                                                             |
| `resolutions` | `TimescopeNumberLike[]`                                                                      | Hints for preferred loader resolutions. Direct queries may request other positive resolutions.                                        |
| `zoomLevels`  | `number[]`                                                                                   | Alternative way to specify resolution hints, using zoom levels.                                                                       |
| `decoder`     | `(payload) => readonly TimescopeDataRowInput[] \| Promise<readonly TimescopeDataRowInput[]>` | Converts a loaded payload to rows.                                                                                                    |
| `mappings`    | `TimescopeMappings`                                                                          | Maps payload paths to time and value fields.                                                                                          |
| `type`        | `'simple' \| 'point-aggregate' \| 'point-percentile'`                                        | Selects a concrete DataSource.                                                                                                        |
| `cacheSize`   | `number`                                                                                     | Output chunk LRU capacity. Default: `1000`; active and in-flight entries remain retained. `0` disables unreferenced result retention. |
| `percentiles` | `{ values?: (0.5 \| 0.9 \| 0.95)[], primary?: 0.5 \| 0.9 \| 0.95 }`                          | Selects percentile suffixes and the primary value for point-percentile sources.                                                       |

`data`, `url`, and `loader` are mutually exclusive. `decoder` and `mappings` are also mutually exclusive.

Construction options describe acquisition hints. The resulting `source.resolutions`, `source.chunkSize`, and `source.chunkOrigin` guide how views construct requests and may differ from those options. Range-backed Simple sources publish their input hints unchanged; snapshot sources publish no preferred resolution list. Built-in sources preserve chunk size and origin. These hints do not require direct queries to use a listed resolution or align with chunk boundaries.

### Direct Queries

```ts
const rows = await source.query({
  range: [Decimal('1.3'), Decimal('8.7')],
  resolution: Decimal('0.2'),
});
```

`TimescopeDataSourceQuery` contains only a finite, ordered `range: [Decimal, Decimal]` and a positive `resolution: Decimal`. There is no chunk ID, sequence, or zoom. Direct queries do not cache results or share range acquisitions; snapshot sources still retain their acquired data and index.

Simple range sources forward the request to their loader on a best-effort basis. Point aggregation and percentile sources anchor buckets to `chunkOrigin`, returning complete intersecting buckets and neighboring context. Shifting query boundaries does not shift bucket boundaries or change the values of an otherwise identical bucket.

### Payloads and Decoders

The argument to `decoder(payload)` depends on how the source acquires data:

| Acquisition | Decoder input                                    |
| ----------- | ------------------------------------------------ |
| `data`      | The supplied data.                               |
| `url`       | The fetched `Response`, before reading its body. |
| `loader`    | The loader's resolved return value.              |

Return an array of [rows](#rows), or a Promise of that array. For example, a JSON URL with a nested array can use:

```ts
sources: {
  samples: {
    url: '/samples.json',
    decoder: async (response: Response) => {
      const payload = await response.json();
      return payload.samples;
    },
  },
}
```

Without a decoder, a `Response` is read as JSON. The resulting payload must be an array of rows, or an array of records when using `mappings`.

### Snapshot Loader

Set `chunked: false` to load a complete snapshot. The loader takes no arguments and may return its payload directly or through a Promise. Return rows when no transform is configured, or a payload for `decoder` / `mappings` to convert. The Source retains and indexes the snapshot until invalidated.

```ts
sources: {
  samples: {
    chunked: false,
    loader: async () => [{ time: 0, value: 10 }, { time: 1, value: 20 }],
  },
}
```

### Rows

| Field    | Type                                          | Behavior                                              |
| -------- | --------------------------------------------- | ----------------------------------------------------- |
| `time`   | `TimescopeTimeLike<never>`                    | Sets the row time. Mutually exclusive with `times`.   |
| `times`  | `Record<string, TimescopeTimeLike<never>>`    | Sets named row times such as `start` and `end`.       |
| `value`  | `TimescopeNumberLike \| null`                 | Sets the row value. Mutually exclusive with `values`. |
| `values` | `Record<string, TimescopeNumberLike \| null>` | Sets named row values.                                |
| `data`   | `unknown`                                     | Provides metadata to mark callbacks.                  |

A row must contain at least one time. A single time, or several equal named times, represents a point. Otherwise, the row represents the half-open interval from its earliest to its latest named time: `[min(times), max(times))`. This interval determines overlap for queries, regardless of which time fields a chart selects with `using`. Simple sources support both points and intervals; point-aggregate and point-percentile reject intervals.

### Mappings

| Field    | Type                     | Behavior                                     |
| -------- | ------------------------ | -------------------------------------------- |
| `times`  | `Record<string, string>` | Maps canonical time names to payload paths.  |
| `values` | `Record<string, string>` | Maps canonical value names to payload paths. |

### Aggregated Output

Point-aggregate sources provide `#avg`, `#first`, `#last`, `#min`, and `#max`; the unsuffixed value is the average. Point-percentile sources provide `#first`, `#last`, `#min`, `#max`, `#p50`, `#p90`, and `#p95`; the primary value defaults to p50. Configure `percentiles: { values, primary }` to select percentile outputs.

Singleton buckets retain the original point time. Buckets containing multiple points use the bucket midpoint. Set `series.data.instantaneous.resolution` independently when the tooltip should use finer data than the chart.

### URL Placeholders

| Placeholder           | Value                       |
| --------------------- | --------------------------- |
| `{z}`, `{zoom}`       | Zoom level.                 |
| `{r}`, `{resolution}` | Selected source resolution. |
| `{s}`, `{start}`      | Requested range start time. |
| `{e}`, `{end}`        | Requested range end time.   |

### Range Loader

The loader signature is `(request: TimescopeLoadRequest) => rows | Promise<rows>`. With a decoder or mappings, return the expected payload instead. A request contains only `range: [Decimal, Decimal]` and `resolution: Decimal`: no chunk identity, sequence, or expiry context.

Loaders accept arbitrary ranges and resolutions on a best-effort basis. Simple sources forward their query conditions. Views normally construct ranges spanning `chunkSize * resolution`, aligned to `chunkOrigin`, but direct callers need not do so. Return rows at a density appropriate for the requested resolution.

Return all rows intersecting `[start, end)`:

- Points satisfy `start <= time < end`.
- Interval rows satisfy `rowStart < end && start < rowEnd`. Include a row in every chunk it overlaps, even when its start is outside the requested range. Return the complete row, rather than trimming its times to the chunk boundaries.

For charts with links, also return neighboring rows outside the range: the nearest row on each side for straight lines, steps, and their areas; the two nearest rows on each side for `curve` and `curve-area`. Return as many as exist at the ends of the data. These rows let links continue across chunk boundaries.

Even when no row intersects the requested range, return the neighboring rows if a link crosses that range. For example, points at `0` and `100` are both needed to draw a line through a chunk covering `[40, 60)`. Return `[]` only when there are neither intersecting rows nor neighboring rows needed by the chart.

### Invalidation and Caching

A display-side ChunkStore is shared by views of the same Source. On a cache miss it calls `source.query({ range, resolution })`, without forwarding the chunk identity. Concurrent chunk loads share acquisition; inactive results can remain in the LRU after leaving the viewport. Snapshot indexes survive output-cache eviction. Failed acquisitions are retryable. Calling `source.query()` directly bypasses this cache entirely.

```ts
source.invalidate(); // All data
source.invalidate([start, end]); // An affected range
source.invalidate([latestDataTime, undefined]); // The live tail, at every resolution
```

Endpoints accept `TimescopeTimeLike<undefined>`. An omitted endpoint is unbounded. The Source emits an invalidation notification; subscribed ChunkStores invalidate overlapping chunks, including the chunk containing the boundary. Sources do not look up or directly invalidate stores. Stores also check the Source revision before serving results, so a read immediately after invalidation cannot return a stale cached result. Active views reload what they need, and invalidated in-flight chunk loads are rejected. Use a data-time boundary that includes late-arriving samples, not necessarily the wall-clock time of the last request.

All snapshot-backed sources discard their snapshot/index on explicit invalidation and reacquire the whole snapshot on the next query. This also discards appended points that are not present in the acquisition input. Even range-specific invalidation notifies consumers of a full reset for snapshot sources. `append()` itself retains the updated index and only notifies consumers of the changed range. `timescope.reload()` invalidates its sources.

Renderers reference-count shared Source instances. Each renderer holds one reference per distinct Source, including Sources supplied by the caller. Removing the Source or disposing the renderer releases that reference; the final release disposes the Source. Moving a Source between names in one update preserves its lifetime. A JavaScript variable alone does not retain a usage reference. For standalone Sources used without a renderer, call `source.dispose()` when finished.

`updateOptions()` preserves omitted Source and Series entries. Explicit Source settings create a new Source; passing the same Source instance reuses it. Explicit Series updates rebuild that Series from the merged settings. Settings are not serialized or deeply compared, and callbacks retain their original identity and closures. `setOptions()` replaces the complete configuration.

### Reusable DataLoader

`createDataLoader()` performs acquisition, decoding and normalization independently of the source's query algorithm. It has no cache, timers, invalidation API, or resolution/chunk constraints. Every `load()` performs acquisition. DataSources retain snapshot/index state and notify consumers of updates; display-side ChunkStores cache query results.

```ts
import { createDataLoader, createDataSource } from 'timescope';

const loader = createDataLoader({
  url: '/samples.json',
  decoder: async (response: Response) => (await response.json()).samples,
});

const rows = await loader.load(); // Normalized readonly rows.
const source = createDataSource({ loader, chunked: false });
source.invalidate(); // Reacquire on the next query.
```

A range loader uses `load({ range, resolution })`. `loader.ranged` distinguishes range acquisition from whole-snapshot acquisition. The same Loader can be used by multiple sources; their state and invalidation are independent. Configure decoding/mappings on the Loader itself when supplying a Loader instance.

### Append-only Segment Tree

```ts
import { createDataSource } from 'timescope';

const source = createDataSource({
  data: [{ time: 0, value: 10 }],
  type: 'point-aggregate',
});
await source.append({ time: 1 / 60, value: 12 });
// source.replace(...) is not available.
```

This source accepts only point rows in nondecreasing time order, including the initial data and each appended batch. Equal times retain insertion order. Invalid batches are rejected before any rows are inserted. Use Simple for unaggregated points/intervals, or point-percentile for percentiles.

Each point is a leaf in a segment tree. Append updates its ancestors; queries combine range aggregates without scanning every point in a bucket. Capacity grows geometrically, so occasional appends rebuild the tree. This trades additional index memory for efficient aggregation of dense ranges.

## Series

| Key                  | Type                                       | Behavior                                                   |
| -------------------- | ------------------------------------------ | ---------------------------------------------------------- |
| `data.source`        | `string`                                   | Selects a source from `options.sources`.                   |
| `data.name`          | `string`                                   | Sets the display name.                                     |
| `data.color`         | `string`                                   | Sets the default chart color.                              |
| `data.domain`        | `string \| TimescopeDomainOptions`         | Selects a shared domain or defines an inline domain.       |
| `data.resolution`    | `TimescopeDataResolution`                  | Resolves and snaps view resolution to source resolution.   |
| `data.instantaneous` | `false \| { using?, zoom?, resolution? }`  | Configures values sampled at the cursor.                   |
| `chart`              | `TimescopeChartType \| { marks?, links? }` | Selects a preset or defines marks and links.               |
| `tooltip`            | `boolean \| { label?, format? }`           | Enables the tooltip and configures its label or formatter. |
| `track`              | `string`                                   | Selects a track.                                           |

### Resolution

`TimescopeDataResolution` accepts a snap mode, a resolution value, a resolver, or `{ resolve?, snap? }`.

| Field     | Type                                                        | Behavior                                                       |
| --------- | ----------------------------------------------------------- | -------------------------------------------------------------- |
| `resolve` | `TimescopeNumberLike \| ((context) => TimescopeNumberLike)` | Chooses a preferred source resolution.                         |
| `snap`    | `'nearest' \| 'floor' \| 'ceil'`                            | Snaps to an available source resolution. Default: `'nearest'`. |

The resolver receives `{ resolution, resolutions }`:

| Field         | Type                 | Meaning                                                                                   |
| ------------- | -------------------- | ----------------------------------------------------------------------------------------- |
| `resolution`  | `Decimal`            | Display time units per pixel: `2 ** (-zoom)`. At zoom `0`, one pixel spans one time unit. |
| `resolutions` | `readonly Decimal[]` | Output intervals published by `source.resolutions`; empty when unrestricted.              |

Return a positive preferred source interval in the same time units as the rows. Timescope then snaps it to the source's available intervals. Without `resolve`, the preferred interval is the display resolution. Without a list of source intervals, snapping uses resolutions at integer zoom levels.

`floor` selects the largest interval at or below the preferred interval; `ceil` selects the smallest at or above it. When no interval satisfies that direction, the nearest endpoint of the available range is used. `nearest` selects the closest interval on the zoom (logarithmic) scale.

The selected output interval is passed to `source.query()`. Range-backed Simple sources pass it to their loader as `request.resolution`; snapshot sources use it for local queries. It can differ from the display resolution passed to chart callbacks.

### Instantaneous Values

| Field        | Type                       | Behavior                                 |
| ------------ | -------------------------- | ---------------------------------------- |
| `using`      | `Using1<[string, string]>` | Selects the value sampled at the cursor. |
| `zoom`       | `number`                   | Selects sampling resolution by zoom.     |
| `resolution` | `TimescopeNumberLike`      | Selects sampling resolution directly.    |

Setting either `tooltip: false` or `data.instantaneous: false` disables cursor sampling for the series.

### Tooltip

| Field    | Type                                              | Behavior                                               |
| -------- | ------------------------------------------------- | ------------------------------------------------------ |
| `label`  | `string`                                          | Overrides the tooltip label.                           |
| `format` | `({ time, value, name, unit, digits }) => string` | Formats a tooltip value. `value` is `Decimal \| null`. |

## Using Selectors

| Form             | Selects                                            |
| ---------------- | -------------------------------------------------- |
| `'value@time'`   | Named value and named time.                        |
| `'value'`        | Named value with the default time.                 |
| `'@start'`       | Default value at the named time.                   |
| `['min', 'max']` | Two coordinates.                                   |
| `'#zero'`        | Domain zero.                                       |
| `'#top'`         | Top of the chart area.                             |
| `'#bottom'`      | Bottom of the chart area.                          |
| `'value#avg'`    | An aggregate produced by a point-aggregate source. |

Single-value marks default to `'value@time'`. `line`, `bar`, and `section` marks default to `['min', 'max']`. Single-value links default to `'value@time'`; area links use the value and domain zero by default.

## Chart Presets

| Preset                                                      | Result                                                     |
| ----------------------------------------------------------- | ---------------------------------------------------------- |
| `'lines'`, `'lines:filled'`                                 | Line chart, optionally filled.                             |
| `'curves'`, `'curves:filled'`                               | Monotone cubic chart, optionally filled.                   |
| `'steps-start'`, `'steps'`, `'steps-end'`                   | Step chart. Add `:filled` for a filled chart.              |
| `'points'`                                                  | Circle marks.                                              |
| `'linespoints'`, `'curvespoints'`                           | Lines or curves with circle marks. Add `:filled` for fill. |
| `'stepspoints-start'`, `'stepspoints'`, `'stepspoints-end'` | Steps with circle marks. Add `:filled` for fill.           |
| `'impulses'`, `'impulsespoints'`                            | Lines from domain zero, optionally with circle marks.      |
| `'bars'`, `'bars:filled'`                                   | Bars from domain zero.                                     |

## Links

| `draw`                                                | Coordinates | Style        |
| ----------------------------------------------------- | ----------- | ------------ |
| `'line'`, `'curve'`                                   | One         | Stroke       |
| `'step-start'`, `'step'`, `'step-end'`                | One         | Stroke       |
| `'area'`, `'curve-area'`                              | Two         | Stroke, Fill |
| `'step-area-start'`, `'step-area'`, `'step-area-end'` | Two         | Stroke, Fill |

## Marks

| `draw`                                          | Coordinates | Style                             |
| ----------------------------------------------- | ----------- | --------------------------------- |
| `'circle'`                                      | One         | Stroke, Fill, Size, Offset        |
| `'triangle'`, `'square'`, `'diamond'`, `'star'` | One         | Stroke, Fill, Size, Angle, Offset |
| `'cross'`, `'plus'`, `'minus'`                  | One         | Stroke, Size, Angle, Offset       |
| `'line'`, `'section'`                           | Two         | Stroke, Size, Offset              |
| `'bar'`                                         | Two         | Stroke, Fill, Size, Box, Offset   |
| `'region'`                                      | Two         | Stroke, Fill, Box, Offset         |
| `'text'`                                        | One         | Text, Size, Angle, Offset         |
| `'icon'`                                        | One         | Icon, Size, Angle, Offset         |
| `'path'`                                        | One         | Path, Size, Angle, Offset         |

## Style

Mark style values may be callbacks receiving `{ times, values, data, resolution }`. Link callbacks receive `{ resolution }`. `values` entries are `Decimal | null`.

In these callbacks, `resolution` is a `Decimal` giving display time units per pixel (`2 ** (-zoom)`), not the source interval requested by the loader. Use it to convert a time duration into a pixel width or to change appearance with zoom. `times` entries are `Decimal` values, and `data` is the row's metadata.

### Stroke

| Key              | Type       |
| ---------------- | ---------- |
| `lineWidth`      | `number`   |
| `lineColor`      | `string`   |
| `lineDashArray`  | `number[]` |
| `lineDashOffset` | `number`   |

### Fill

| Key           | Type      |
| ------------- | --------- |
| `fillColor`   | `string`  |
| `fillOpacity` | `number`  |
| `fillPost`    | `boolean` |

When `fillColor` is omitted, a default fill is derived from the series `color`:
marks composite that color at 25% of its alpha against the configured background,
while links use that color at 25% of its alpha directly. Over an opaque background,
the derived mark fill is opaque and hides underlying links, as in `linespoints`.
Link fills use normal alpha compositing so overlapping series remain visible.

An explicit `fillColor` replaces the derived fill and is used as-is, including its
alpha, for both marks and links. It is never precomposited against the background.

`fillOpacity` defaults to `1` and multiplies the alpha of the resolved fill for
both marks and links. Values are clamped to the range `0`–`1`. It controls the
transparency of the fill, not the strength of the default shading, and does not
affect strokes.

| Fill settings                                  | Marks                                                   | Links                  |
| ---------------------------------------------- | ------------------------------------------------------- | ---------------------- |
| Omitted                                        | Color at 25% alpha precomposited against the background | Color at 25% alpha     |
| `fillOpacity: 0.5`                             | Derived fill at half its alpha                          | Color at 12.5% alpha   |
| `fillColor: F`                                 | F, including its alpha                                  | F, including its alpha |
| `fillColor: F, fillOpacity: 0.5`               | F at half its alpha                                     | F at half its alpha    |
| `fillOpacity: 0` or `fillColor: 'transparent'` | Fully transparent fill                                  | Fully transparent fill |

For a translucent fill in the original series color, set `fillColor` to that color
and use `fillOpacity` to control its transparency. With no `fillColor`, setting
`fillOpacity: 1` preserves the default shading rather than restoring the original
color.

### Geometry

| Key       | Type                                            | Behavior                                                 |
| --------- | ----------------------------------------------- | -------------------------------------------------------- |
| `size`    | `number`                                        | Sets pixel size. Meaning depends on the primitive.       |
| `angle`   | `number`                                        | Sets rotation in degrees.                                |
| `offset`  | `[number, number]`                              | Sets pixel offset `[x, y]`.                              |
| `extrude` | `number \| [number, number?, number?, number?]` | Expands a bar or region as `[top, right, bottom, left]`. |
| `radius`  | `number`                                        | Sets bar or region corner radius in pixels.              |

### Path

| Key      | Type               |
| -------- | ------------------ |
| `path`   | `string`           |
| `origin` | `[number, number]` |
| `scale`  | `number`           |

### Text

| Key                        | Type                                                                          |
| -------------------------- | ----------------------------------------------------------------------------- |
| `text`                     | `string`                                                                      |
| `fontFamily`, `fontWeight` | `string`                                                                      |
| `textAlign`                | `'start' \| 'center' \| 'end' \| 'left' \| 'right'`                           |
| `textBaseline`             | `'top' \| 'middle' \| 'bottom' \| 'hanging' \| 'alphabetic' \| 'ideographic'` |
| `textColor`                | `string`                                                                      |
| `textOpacity`              | `number`                                                                      |
| `textOutline`              | `boolean`                                                                     |
| `textOutlineColor`         | `string`                                                                      |
| `textOutlineWidth`         | `number`                                                                      |

### Icon

| Key                                | Type                                                                          |
| ---------------------------------- | ----------------------------------------------------------------------------- |
| `icon`                             | `string`                                                                      |
| `iconFontFamily`, `iconFontWeight` | `string`                                                                      |
| `iconAlign`                        | `'start' \| 'center' \| 'end' \| 'left' \| 'right'`                           |
| `iconBaseline`                     | `'top' \| 'middle' \| 'bottom' \| 'hanging' \| 'alphabetic' \| 'ideographic'` |
| `iconColor`                        | `string`                                                                      |
| `iconOpacity`                      | `number`                                                                      |
| `iconOutline`                      | `boolean`                                                                     |
| `iconOutlineColor`                 | `string`                                                                      |
| `iconOutlineWidth`                 | `number`                                                                      |

`origin` and `scale` are fixed values. Other style values accept callbacks where supported by the selected primitive.

## Tracks

| Key         | Type                                  | Behavior                                   |
| ----------- | ------------------------------------- | ------------------------------------------ |
| `height`    | `number`                              | Sets a fixed height in pixels.             |
| `symmetric` | `boolean`                             | Mirrors positive and negative chart space. |
| `timeAxis`  | `boolean \| TimescopeTimeAxisOptions` | Shows, hides, or configures the time axis. |

### Time Axis

| Key          | Type                                                       | Behavior                                                                             |
| ------------ | ---------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `axis`       | `false \| { color? }`                                      | Hides or styles the axis line.                                                       |
| `ticks`      | `false \| { color? }`                                      | Hides or styles tick lines.                                                          |
| `labels`     | `false \| { color?, fontWeight?, fontSize?, fontFamily? }` | Hides or styles labels.                                                              |
| `relative`   | `boolean`                                                  | Formats time relative to zero.                                                       |
| `timeFormat` | `TimeFormatFunc \| TimeFormatLabeler`                      | Formats time-axis labels.                                                            |
| `timeUnit`   | `'s' \| 'ms' \| 'us' \| 'ns'`                              | Sets the numeric time unit used for labels. Default: `'s'`.                          |
| `timeZone`   | `string`                                                   | Sets the time zone for absolute-time labels and tick boundaries. Default: `'local'`. |

`TimeFormatFunc` receives `{ time, unit, level, digits, stride? }` and returns `string | undefined`. `TimeFormatLabeler` provides optional formatters for year, month, quarter, date, minutes, and seconds.

Use `'local'`, `'utc'`, or an IANA time zone name for `timeZone`. `TimeFormatLabeler` receives date and time components in that time zone.

```ts
tracks: {
  main: {
    timeAxis: { timeZone: 'Asia/Tokyo' },
  },
}
```

## Selection

Selection is resizable by default. Shift-drag creates a range.

| Value or key | Type                         | Behavior                                   |
| ------------ | ---------------------------- | ------------------------------------------ |
| `false`      | `boolean`                    | Disables selection.                        |
| `true`       | `boolean`                    | Enables default selection behavior.        |
| `resizable`  | `boolean`                    | Enables creating and resizing a selection. |
| `color`      | `string`                     | Sets overlay color.                        |
| `invert`     | `boolean`                    | Shades outside the selected range.         |
| `range`      | `[Decimal, Decimal] \| null` | Sets or clears the selected range.         |

`setSelectionRange()` and `clearSelectionRange()` update the range at runtime.

## Domains

| Key           | Type                                                                    | Behavior                                                            |
| ------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `scale`       | `'linear' \| 'linear-symmetric' \| 'log'`                               | Sets the value scale.                                               |
| `axis`        | `boolean \| 'left' \| 'right' \| TimescopeYAxisOptions`                 | Shows and configures a value axis.                                  |
| `animation`   | `boolean`                                                               | Animates range changes. Default: `true`.                            |
| `range`       | `TimescopeNumberLike \| [min?, max?] \| { expand?, shrink?, default? }` | Sets or configures the value range.                                 |
| `expand`      | `boolean`                                                               | Allows the range to expand for observed values. Default: `false`.   |
| `shrink`      | `boolean`                                                               | Allows the range to contract. Default: `true`.                      |
| `floatingGap` | `number`                                                                | Sets the pixel gap below a same-sign floating range. Default: `20`. |
| `unit`        | `string`                                                                | Sets the tooltip and value-axis unit.                               |
| `digits`      | `number`                                                                | Sets decimal places in tooltips and value axes.                     |

An unbounded range follows visible values. A single numeric range value means `[0, value]`.

With `shrink: true`, an automatic range follows constant data to `[v, v]` as well.
Nonzero constants are centered in the domain's available drawing region, while
zero lies on the shared zero axis. `linear-symmetric` retains its zero-based
scaling for nonzero constants. Constant ranges have a single value tick.

Within a linear or logarithmic scale, the display changes smoothly when entering
or leaving constant data. An update during a transition continues from the
current display.
`animation: false` applies the final display immediately. Fixed bounds and
`shrink: false` continue to constrain the range.

## See Also

- [Timescope](/api/timescope)
- [Core Concepts](/guide/concepts)
