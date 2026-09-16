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

Use [`createDataSource()`](#mutable-data-sources) when rows need to be appended or replaced after configuration.

### Mutable Data Sources

`createDataSource(input)` accepts the source inputs above. An array or `{ data }` creates a mutable source with the following methods. Sources created from URLs or loaders are not mutable.

| Method                        | Returns         | Behavior                                                                                                                    |
| ----------------------------- | --------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `append(rows)`                | `Promise<void>` | Adds one row or an array of rows.                                                                                           |
| `replace([start, end], rows)` | `Promise<void>` | Removes existing rows intersecting `[start, end)` and adds one row or an array of rows. Pass `[]` to remove without adding. |

Replacement endpoints accept `TimescopeTimeLike<never>` values; `end` must not precede `start`. Points at `end` are excluded. An overlapping interval row is removed in its entirety, even if it extends outside the replacement range. Every replacement row must intersect the replacement range. See [Rows](#rows) for point and interval definitions.

Updates automatically refresh series using the source; calling `reload()` is unnecessary. Await the returned Promise before an operation that depends on the updated data. It does not indicate that a frame has been drawn.

```ts
import { createDataSource, Timescope } from 'timescope';

const source = createDataSource({
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
await source.replace([0, 1], [{ time: 0, value: 12 }]);
```

Mutation methods accept row inputs. If the source uses `mappings`, pass records in the mapped input format. A `decoder` applies to the initial payload only; pass decoded rows to `append()` and `replace()`.

### Source Options

| Key           | Type                                                                                         | Behavior                                                                    |
| ------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `chunkSize`   | `number`                                                                                     | Sets the number of selected-resolution intervals per chunk. Default: `256`. |
| `chunkOffset` | `TimescopeNumberLike`                                                                        | Aligns chunk boundaries to the given time origin. Default: `0`.             |
| `immediate`   | `boolean`                                                                                    | Allows loading while the view is moving. Default: `true`.                   |
| `resolutions` | `TimescopeNumberLike[]`                                                                      | Limits requests to the listed source resolutions.                           |
| `zoomLevels`  | `number[]`                                                                                   | Limits requests to resolutions represented by the listed zoom levels.       |
| `decoder`     | `(payload) => readonly TimescopeDataRowInput[] \| Promise<readonly TimescopeDataRowInput[]>` | Converts a loaded payload to rows.                                          |
| `mappings`    | `TimescopeMappings`                                                                          | Maps payload paths to time and value fields.                                |
| `reducer`     | `TimescopeReducer`                                                                           | Reduces snapshot rows at requested resolutions.                             |

`data`, `url`, and `loader` are mutually exclusive. `decoder` and `mappings` are also mutually exclusive.

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

Set `chunked: false` to load a complete snapshot. The loader is called without arguments and may return its payload directly or through a Promise. Return rows when no transform is configured, or a payload for `decoder` / `mappings` to convert.

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

A row must contain at least one time. A single time, or several equal named times, represents a point. Otherwise, the row represents the half-open interval from its earliest to its latest named time: `[min(times), max(times))`. This interval determines overlap for chunk loading, replacement, and snapshot reduction, regardless of which time fields a chart selects with `using`.

### Mappings

| Field    | Type                     | Behavior                                     |
| -------- | ------------------------ | -------------------------------------------- |
| `times`  | `Record<string, string>` | Maps canonical time names to payload paths.  |
| `values` | `Record<string, string>` | Maps canonical value names to payload paths. |

### Reducers

| Value                                        | Behavior                                                                                                  |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `'null'`                                     | Returns snapshot rows without reduction. Default.                                                         |
| `'min-max-avg'`                              | Provides `#avg`, `#first`, `#last`, `#min`, and `#max`. The unsuffixed value uses `#avg`.                 |
| `'percentiles'`                              | Provides `#first`, `#last`, `#min`, `#max`, `#p50`, `#p90`, and `#p95`. The unsuffixed value uses `#p50`. |
| `{ type: 'percentiles', values?, primary? }` | Selects percentile suffixes and the percentile used by the unsuffixed value.                              |

Reducers aggregate point rows in snapshot sources; interval rows remain unchanged.

### URL Placeholders

| Placeholder           | Value                       |
| --------------------- | --------------------------- |
| `{z}`, `{zoom}`       | Zoom level.                 |
| `{r}`, `{resolution}` | Selected source resolution. |
| `{s}`, `{start}`      | Chunk start time.           |
| `{e}`, `{end}`        | Chunk end time.             |

### Chunk Loader

The loader signature is `(chunk, api) => Promise<readonly TimescopeDataRowInput[]>` when returning rows directly. With `{ loader, decoder }` or `{ loader, mappings }`, return a Promise of the payload expected by that transform instead. The resulting rows must follow the range and context rules below.

| Field                        | Type                                           | Behavior                                                                                           |
| ---------------------------- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `chunk.range`                | `[Decimal \| undefined, Decimal \| undefined]` | Requested half-open range `[start, end)`. Timescope-generated requests have two defined endpoints. |
| `chunk.resolution`           | `Decimal`                                      | Requested source resolution.                                                                       |
| `chunk.zoom`                 | `number`                                       | Zoom corresponding to the source resolution.                                                       |
| `api.expiresAt(timestampMs)` | `(number) => void`                             | Sets an absolute cache expiry in milliseconds.                                                     |
| `api.expiresIn(ms)`          | `(number) => void`                             | Sets cache lifetime in milliseconds.                                                               |

A chunk spans `chunkSize * chunk.resolution` time units, with boundaries aligned to `chunkOffset`. Return rows at a density appropriate for the requested source resolution.

Return all rows intersecting `[start, end)`:

- Points satisfy `start <= time < end`.
- Interval rows satisfy `rowStart < end && start < rowEnd`. Include a row in every chunk it overlaps, even when its start is outside the requested range. Return the complete row, rather than trimming its times to the chunk boundaries.

For charts with links, also return neighboring rows outside the range: the nearest row on each side for straight lines, steps, and their areas; the two nearest rows on each side for `curve` and `curve-area`. Return as many as exist at the ends of the data. These rows let links continue across chunk boundaries.

Even when no row intersects the requested range, return the neighboring rows if a link crosses that range. For example, points at `0` and `100` are both needed to draw a line through a chunk covering `[40, 60)`. Return `[]` only when there are neither intersecting rows nor neighboring rows needed by the chart.

Responses are cached without a time-based expiry by default. Use `api.expiresIn()` or `api.expiresAt()` when data may change, or call `timescope.reload()` to invalidate cached data.

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

| Field         | Type                 | Meaning                                                                                      |
| ------------- | -------------------- | -------------------------------------------------------------------------------------------- |
| `resolution`  | `Decimal`            | Display time units per pixel: `2 ** (-zoom)`. At zoom `0`, one pixel spans one time unit.    |
| `resolutions` | `readonly Decimal[]` | Source intervals declared by `resolutions` or `zoomLevels`; empty when neither is specified. |

Return a positive preferred source interval in the same time units as the rows. Timescope then snaps it to the source's available intervals. Without `resolve`, the preferred interval is the display resolution. Without a list of source intervals, snapping uses resolutions at integer zoom levels.

`floor` selects the largest interval at or below the preferred interval; `ceil` selects the smallest at or above it. When no interval satisfies that direction, the nearest endpoint of the available range is used. `nearest` selects the closest interval on the zoom (logarithmic) scale.

The selected source interval is passed to the loader as `chunk.resolution`. It can differ from the display resolution passed to chart callbacks.

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

| Form             | Selects                             |
| ---------------- | ----------------------------------- |
| `'value@time'`   | Named value and named time.         |
| `'value'`        | Named value with the default time.  |
| `'@start'`       | Default value at the named time.    |
| `['min', 'max']` | Two coordinates.                    |
| `'#zero'`        | Domain zero.                        |
| `'#top'`         | Top of the chart area.              |
| `'#bottom'`      | Bottom of the chart area.           |
| `'value#avg'`    | An aggregate produced by a reducer. |

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

Marks shade their fill against the configured background before applying
`fillOpacity`. Over an opaque background this hides links behind the marks, as in
`linespoints`. Set mark `fillOpacity` explicitly to allow the underlying chart to
show through. Links use normal alpha compositing so overlapping series remain
visible; their color alpha is multiplied by `fillOpacity`.

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
