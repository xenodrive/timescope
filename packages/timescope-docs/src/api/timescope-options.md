---
titleTemplate: Timescope API
---

# Timescope Options

`TimescopeOptions` is accepted by `setOptions()`. `updateOptions()` accepts partial options and supports deleting named entries with `null`. The constructor accepts `TimescopeOptionsInitial`, which includes the same configurable options and the initial-only fields listed in [Timescope](/api/timescope#options-constructor-only). Configurable options have the same effect in the constructor and `setOptions()`.

## Options

| Key            | Type                                                 | Behavior                                                       |
| -------------- | ---------------------------------------------------- | -------------------------------------------------------------- |
| `style`        | `{ width?, height?, background? }`                   | Sets canvas size and background.                               |
| `cursor`       | `boolean \| { color?, borderColor? }`                | Shows and styles the time cursor. Default: `true`.             |
| `showFps`      | `boolean`                                            | Shows the FPS overlay.                                         |
| `renderThread` | `'worker' \| 'main'`                                 | Selects the drawing thread when mounting. Default: `'worker'`. |
| `sources`      | `Record<string, TimescopeSourceInput>`               | Defines data sources.                                          |
| `domains`      | `Record<string, TimescopeDomainOptions>`             | Defines shared value domains.                                  |
| `series`       | `Record<string, TimescopeSeriesInput>`               | Defines series.                                                |
| `tracks`       | `Record<string, { height?, symmetric?, timeAxis? }>` | Defines track layout.                                          |
| `selection`    | `boolean \| { resizable?, color?, invert? }`         | Configures range selection.                                    |

The cursor colors default to `color: 'white'` and `borderColor: 'red'`.

## Rendering Thread

`renderThread`: `'worker'` (default) or `'main'`. Applied on mount; changes require remounting. Sources and loaders always run on the main thread.

## Sources

For the acquisition and query model, see [Sources](/guide/concepts#sources).

### Input Types

| Input                              | Behavior                                                                  |
| ---------------------------------- | ------------------------------------------------------------------------- |
| `readonly TimescopeDataRowInput[]` | Uses inline data. Changes to the original array are not observed.         |
| `{ data }`                         | Uses inline data with source options.                                     |
| `string` or `{ url }`              | Loads a snapshot URL, or loads chunks when the URL contains placeholders. |
| `function` or `{ loader }`         | Loads chunks. Set `chunked: false` to use a snapshot loader.              |
| `{ loader: dataLoader }`           | Uses a reusable [DataLoader](#reusable-dataloader) instance.              |
| `TimescopeDataSource`              | Uses a source created by `createDataSource()` or a custom source.         |

### Source Types

`createDataSource(input)` constructs one of these implementations. Custom DataSource instances pass through unchanged.

| `type`               | Behavior                                                               | Acquisition       | Updates                    |
| -------------------- | ---------------------------------------------------------------------- | ----------------- | -------------------------- |
| `'simple'` (default) | Returns unaggregated point and interval rows.                          | Snapshot or range | Invalidation/reacquisition |
| `'point-aggregate'`  | Returns point min/max/avg. Points must be in nondecreasing time order. | Snapshot          | `append()`                 |
| `'point-percentile'` | Returns point percentiles.                                             | Snapshot          | Invalidation/reacquisition |

Only point-aggregate exposes [append()](#append-only-segment-tree). No built-in Source exposes `replace()`.

### Source Options

| Key           | Type                                                                                         | Behavior                                                                                                                                                                                         |
| ------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `chunkSize`   | `number \| (resolution: Decimal) => number`                                                  | Preferred number of intervals per display-cache chunk at the selected data resolution. Default: `256`. Must return a positive safe integer and remain stable for the same source and resolution. |
| `chunkOrigin` | `TimescopeNumberLike`                                                                        | Preferred chunk origin, also used to anchor point aggregation buckets. Default: `0`.                                                                                                             |
| `immediate`   | `boolean`                                                                                    | Allows loading while the view is moving. Default: `true`.                                                                                                                                        |
| `resolutions` | `TimescopeNumberLike[]`                                                                      | Hints for preferred loader resolutions. Direct queries may request other positive resolutions.                                                                                                   |
| `zoomLevels`  | `number[]`                                                                                   | Alternative way to specify resolution hints, using zoom levels.                                                                                                                                  |
| `decoder`     | `(payload) => readonly TimescopeDataRowInput[] \| Promise<readonly TimescopeDataRowInput[]>` | Converts a loaded payload to rows.                                                                                                                                                               |
| `mappings`    | `TimescopeMappings`                                                                          | Maps payload paths to time and value fields.                                                                                                                                                     |
| `type`        | `'simple' \| 'point-aggregate' \| 'point-percentile'`                                        | Selects a concrete DataSource.                                                                                                                                                                   |
| `cacheSize`   | `number`                                                                                     | Output chunk LRU capacity. Default: `1000`; active and in-flight entries remain retained. `0` disables unreferenced result retention.                                                            |
| `percentiles` | `{ values?: (0.5 \| 0.9 \| 0.95)[], primary?: 0.5 \| 0.9 \| 0.95 }`                          | Selects percentile suffixes and the primary value for point-percentile sources.                                                                                                                  |

`data`, `url`, and `loader` are mutually exclusive. `decoder` and `mappings` are also mutually exclusive.

Built-in Sources retain chunk size and origin. Range-backed Sources publish resolution hints; snapshot Sources do not. Direct queries need not align with these hints.

### Direct Queries

```ts
const rows = await source.query({
  range: [Decimal('1.3'), Decimal('8.7')],
  resolution: Decimal('0.2'),
});
```

`query({ range, resolution })` takes a finite ordered Decimal range and a positive Decimal resolution. It bypasses the display cache; snapshot data remains retained. Range Sources forward the request to their Loader, including the [neighboring-row response contract](#range-loader). Aggregate buckets stay anchored to `chunkOrigin` and are returned whole, with neighboring context.

### Payloads and Decoders

The argument to `decoder(payload)` depends on how the source acquires data:

| Acquisition | Decoder input                                    |
| ----------- | ------------------------------------------------ |
| `data`      | The supplied data.                               |
| `url`       | The fetched `Response`, before reading its body. |
| `loader`    | The loader's resolved return value.              |

Return rows or a Promise of rows. Without a decoder, Responses are read as JSON; payloads must be row arrays or, with `mappings`, record arrays.

### Snapshot Loader

`chunked: false`: `loader()` takes no arguments and returns rows or a transform payload, synchronously or as a Promise. The Source retains the snapshot until invalidated.

### Rows

| Field    | Type                                          | Behavior                                              |
| -------- | --------------------------------------------- | ----------------------------------------------------- |
| `time`   | `TimescopeTimeLike<never>`                    | Sets the row time. Mutually exclusive with `times`.   |
| `times`  | `Record<string, TimescopeTimeLike<never>>`    | Sets named row times such as `start` and `end`.       |
| `value`  | `TimescopeNumberLike \| null`                 | Sets the row value. Mutually exclusive with `values`. |
| `values` | `Record<string, TimescopeNumberLike \| null>` | Sets named row values.                                |
| `data`   | `unknown`                                     | Provides metadata to mark callbacks.                  |

A row must contain at least one time. Its temporal support is a point when all times are equal, otherwise `[min(times), max(times))`, independently of `using`. Simple sources accept both; point-aggregate and point-percentile reject intervals. See [Canonical Rows](/guide/concepts#canonical-rows) for the data model.

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

`loader({ range, resolution })` returns rows or a transform payload, synchronously or as a Promise. Requests contain an arbitrary finite ordered Decimal range and a positive Decimal resolution; they need not align with chunk boundaries or resolution hints. Match row density to the requested resolution. See [Range Loader](/guide/concepts#range-loader) for the response model and [Chunk Loading](/guide/concepts#chunk-loading) for how display requests are chosen.

Return all rows intersecting `[start, end)`:

- Points satisfy `start <= time < end`.
- Intervals satisfy `rowStart < end && start < rowEnd`; return complete, untrimmed rows.

For links, the loader **SHOULD** return extra rows consisting of the nearest neighbors on each side: one for lines, steps, and their areas; two for curves and curve areas, as available, even when the range contains no points.

This recommendation also applies to direct queries and range DataLoader calls. For example, a very narrow range containing no points can return two neighbors on each side for curves, if available — four rows in total.

### Invalidation and Caching

Display queries share cached results per Source. `cacheSize` limits inactive result retention; eviction preserves snapshots. Failed acquisitions are retryable.

```ts
source.invalidate(); // All data
source.invalidate([start, end]); // An affected range
source.invalidate([latestDataTime, undefined]); // The live tail, at every resolution
```

- Endpoints accept `TimescopeTimeLike<undefined>`; omitted endpoints are unbounded. Include late-arriving samples in the affected range.
- Overlapping and boundary chunks reload; stale cache results and invalidated in-flight results are rejected.
- Snapshot invalidation always reacquires the whole snapshot, discarding appends absent from the acquisition input. `append()` retains data and notifies only the changed range.
- `timescope.reload()` invalidates its Sources.

Shared Sources are disposed when their last renderer releases them; standalone Sources require `dispose()`. Renaming within one update preserves the instance.

`updateOptions()` retains omitted entries, recreates explicitly configured Sources, reuses supplied Source instances, and rebuilds updated Series from merged settings. Use `null` for an individual `sources`, `series`, `tracks`, or `domains` entry to remove it (for example, `updateOptions({ series: { old: null } })`). Updates that leave a Series referring to a missing Source, Track, or named Domain are rejected. `setOptions()` replaces all settings, including renderer defaults. Callbacks retain their closures.

### Reusable DataLoader

`createDataLoader(options)` returns a `TimescopeDataLoader`. For its role relative to a Source, see [DataLoader and DataSource](/guide/concepts#dataloader-and-datasource).

| Member                        | Contract                                                                                 |
| ----------------------------- | ---------------------------------------------------------------------------------------- |
| `ranged`                      | Whether `load()` requires a range request.                                               |
| `load()`                      | Snapshot acquisition; returns a Promise of normalized readonly rows.                     |
| `load({ range, resolution })` | Range acquisition; takes an ordered range of Decimals and a positive Decimal resolution. |

Each call acquires data without caching. A request is required for range Loaders and forbidden for snapshot Loaders.

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

Pass via `loader`; configure transforms on the DataLoader only. Its `ranged` flag controls acquisition mode; snapshot instances use `chunked: false`. Row field names and metadata types are not preserved for Source inference.

### Appending Points {#append-only-segment-tree}

`append(row | rows): Promise<void>` — point-aggregate only.

- Initial and appended points must be in nondecreasing time order; equal times retain insertion order. Invalid batches insert nothing.
- Direct Source `mappings` apply to appends; decoders and supplied DataLoader transforms do not.
- Refreshes consumers automatically. The Promise confirms the data update, not frame presentation.

## Series

See [Series](/guide/concepts#series) for how data, drawing, tracks, and domains relate.

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

Return a positive interval in row time units. Default: display resolution. Snapping uses published Source intervals, or integer-zoom intervals when none are published.

| Snap      | Selection                                             |
| --------- | ----------------------------------------------------- |
| `nearest` | Closest on the logarithmic zoom scale.                |
| `floor`   | Largest interval at or below the preferred interval.  |
| `ceil`    | Smallest interval at or above the preferred interval. |

Directional snapping falls back to the nearest endpoint. The result is the query/loader resolution, distinct from chart callbacks' display resolution.

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

See [Using Selectors](/guide/concepts#using-selectors) for the coordinate-selection model.

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

Single-value marks default to `'value@time'`. `line`, `bar`, and `section` marks default to `['min', 'max']`. Single-value links default to `'value@time'`; area links use the value and the Track's shared baseline (`#zero`) by default.

## Chart Presets

| Preset                                                      | Result                                                        |
| ----------------------------------------------------------- | ------------------------------------------------------------- |
| `'lines'`, `'lines:filled'`                                 | Line chart, optionally filled.                                |
| `'curves'`, `'curves:filled'`                               | Monotone cubic chart, optionally filled.                      |
| `'steps-start'`, `'steps'`, `'steps-end'`                   | Step chart. Add `:filled` for a filled chart.                 |
| `'points'`                                                  | Circle marks.                                                 |
| `'linespoints'`, `'curvespoints'`                           | Lines or curves with circle marks. Add `:filled` for fill.    |
| `'stepspoints-start'`, `'stepspoints'`, `'stepspoints-end'` | Steps with circle marks. Add `:filled` for fill.              |
| `'impulses'`, `'impulsespoints'`                            | Lines from the shared baseline, optionally with circle marks. |
| `'bars'`, `'bars:filled'`                                   | Bars from the shared baseline.                                |

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

Mark callbacks receive `{ times, values, data, resolution }`; link callbacks receive `{ resolution }`. Times are `Decimal`, values are `Decimal | null`, and `data` is row metadata. `resolution` is display time units per pixel (`2 ** (-zoom)`), not the loader interval.

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

| Color                | Marks                                                            | Links                        |
| -------------------- | ---------------------------------------------------------------- | ---------------------------- |
| Default              | Series color at 25% alpha, precomposited against the background. | Series color at 25% alpha.   |
| Explicit `fillColor` | Used as-is, including alpha.                                     | Used as-is, including alpha. |

`fillOpacity` multiplies the resulting fill alpha; default `1`, clamped to `0`–`1`. It affects neither strokes nor the default shading strength.

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

Omitting `tracks` creates an implicit `default` track. Explicit `tracks: {}` is invalid, including when reached by deleting the last track with `updateOptions()`.

| Key         | Type                                  | Behavior                                   |
| ----------- | ------------------------------------- | ------------------------------------------ |
| `height`    | `number`                              | Sets a fixed height in pixels.             |
| `symmetric` | `boolean`                             | Mirrors positive and negative chart space. |
| `timeAxis`  | `boolean \| TimescopeTimeAxisOptions` | Shows, hides, or configures the time axis. |

### Time Axis

The time axis is drawn at the Track's [shared baseline](/guide/concepts#shared-baseline). Hiding the axis does not remove the baseline used by `#zero`.

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

`timeZone` accepts `'local'`, `'utc'`, or an IANA name (e.g. `'Asia/Tokyo'`); labelers receive components in that zone.

## Selection

Selection is resizable by default. Shift-drag creates a range.

| Value or key | Type      | Behavior                                   |
| ------------ | --------- | ------------------------------------------ |
| `false`      | `boolean` | Disables selection.                        |
| `true`       | `boolean` | Enables default selection behavior.        |
| `resizable`  | `boolean` | Enables creating and resizing a selection. |
| `color`      | `string`  | Sets overlay color.                        |
| `invert`     | `boolean` | Shades outside the selected range.         |

`selection.range` is accepted **only by the constructor** as the initial selected range. It is consumed during construction and does not appear in `timescope.options`. `setSelectionRange()` and `clearSelectionRange()` update the current `selectionRange` at runtime without changing `options.selection`. Replacing options without `selection` does not clear the current range; explicitly setting `selection: false` disables selection and clears it.

## Domains

| Key           | Type                                                                    | Behavior                                                                            |
| ------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `scale`       | `'linear' \| 'linear-symmetric' \| 'log'`                               | Sets the value scale.                                                               |
| `axis`        | `boolean \| 'left' \| 'right' \| TimescopeYAxisOptions`                 | Shows and configures a value axis.                                                  |
| `animation`   | `boolean`                                                               | Animates range changes. Default: `true`.                                            |
| `range`       | `TimescopeNumberLike \| [min?, max?] \| { expand?, shrink?, default? }` | Sets or configures the value range.                                                 |
| `expand`      | `boolean`                                                               | Allows the range to expand for observed values. Default: `false`.                   |
| `shrink`      | `boolean`                                                               | Allows the range to contract. Default: `true`.                                      |
| `floatingGap` | `number`                                                                | Sets the pixel gap between a floating range and the shared baseline. Default: `20`. |
| `unit`        | `string`                                                                | Sets the tooltip and value-axis unit.                                               |
| `digits`      | `number`                                                                | Sets decimal places in tooltips and value axes.                                     |

An unbounded range follows visible values. A single numeric range value means `[0, value]`.

See [Domains](/guide/concepts#domains) for independent and shared scales, [Auto Scaling](/guide/concepts#auto-scaling) for `expand` and `shrink`, and [Floating Ranges](/guide/concepts#floating-ranges) for the relationship to the Track's shared baseline.

With `shrink: true`, automatic constant data yields `[v, v]` and one tick when the value axis is enabled. Nonzero constants are centered, except under `linear-symmetric`; zero stays on the [shared baseline](/guide/concepts#shared-baseline). `animation: false` disables range transitions. Fixed bounds and `shrink: false` still constrain the range.

## See Also

- [Timescope](/api/timescope)
- [Core Concepts](/guide/concepts)
