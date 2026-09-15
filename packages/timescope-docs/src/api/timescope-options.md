---
titleTemplate: Timescope API
---

# Timescope Options

`TimescopeOptions` is accepted by `setOptions()` and `updateOptions()`. The constructor accepts `TimescopeOptionsInitial`, which includes these options and the fields listed in [Timescope](/api/timescope#options-constructor-only).

## Options

| Key            | Type                                                 | Behavior                                                               |
| -------------- | ---------------------------------------------------- | ---------------------------------------------------------------------- |
| `style`        | `{ width?, height?, background? }`                   | Sets canvas size and background.                                       |
| `padding`      | `number[]`                                           | Sets canvas padding as `[top, right, bottom, left]`.                   |
| `indicator`    | `boolean`                                            | Shows the cursor indicator. Default: `true`.                           |
| `showFps`      | `boolean`                                            | Shows the FPS overlay.                                                 |
| `renderThread` | `'worker' \| 'main'`                                 | Selects the render engine's thread when mounting. Default: `'worker'`. |
| `sources`      | `Record<string, TimescopeSourceInput>`               | Defines data sources.                                                  |
| `domains`      | `Record<string, TimescopeDomainOptions>`             | Defines shared value domains.                                          |
| `series`       | `Record<string, TimescopeSeriesInput>`               | Defines series.                                                        |
| `tracks`       | `Record<string, { height?, symmetric?, timeAxis? }>` | Defines track layout.                                                  |
| `selection`    | `boolean \| { resizable?, color?, invert?, range? }` | Configures range selection.                                            |

## Rendering Thread

The same render engine and drawing layers can run in a Worker or on the main thread:

```ts
new Timescope({
  target: '#timescope',
  renderThread: 'main',
});
```

`'worker'` uses a Worker and transfers the canvas to it. `'main'` runs the engine directly on the main thread using the canvas's 2D context. Data sources and loaders run on the main thread in both modes.

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

Use `createDataSource()` when rows need to be appended or replaced after configuration.

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

### Rows

| Field    | Type                                          | Behavior                                              |
| -------- | --------------------------------------------- | ----------------------------------------------------- |
| `time`   | `TimescopeTimeLike<never>`                    | Sets the row time. Mutually exclusive with `times`.   |
| `times`  | `Record<string, TimescopeTimeLike<never>>`    | Sets named row times such as `start` and `end`.       |
| `value`  | `TimescopeNumberLike \| null`                 | Sets the row value. Mutually exclusive with `values`. |
| `values` | `Record<string, TimescopeNumberLike \| null>` | Sets named row values.                                |
| `data`   | `unknown`                                     | Provides metadata to mark callbacks.                  |

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

`min-max-avg` averages use Decimal division with 18 decimal places. Reducers aggregate point rows in snapshot sources; interval rows remain unchanged.

### URL Placeholders

| Placeholder           | Value                       |
| --------------------- | --------------------------- |
| `{z}`, `{zoom}`       | Zoom level.                 |
| `{r}`, `{resolution}` | Selected source resolution. |
| `{s}`, `{start}`      | Chunk start time.           |
| `{e}`, `{end}`        | Chunk end time.             |

### Chunk Loader

The loader signature is `(chunk, api) => Promise<readonly TimescopeDataRowInput[]>`.

| Field                        | Type                                           | Behavior                                                                       |
| ---------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------ |
| `chunk.range`                | `[Decimal \| undefined, Decimal \| undefined]` | Requested time range. Timescope-generated requests have two defined endpoints. |
| `chunk.resolution`           | `Decimal`                                      | Requested source resolution.                                                   |
| `chunk.zoom`                 | `number`                                       | Zoom corresponding to the source resolution.                                   |
| `api.expiresAt(timestampMs)` | `(number) => void`                             | Sets an absolute cache expiry in milliseconds.                                 |
| `api.expiresIn(ms)`          | `(number) => void`                             | Sets cache lifetime in milliseconds.                                           |

Return an empty array when the requested chunk has no rows.

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

The resolver receives `{ resolution, resolutions }`.

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

Within a linear or logarithmic scale, transitions into and out of constant data
animate the screen transform. An update during a transition continues from the
current display, and the final display does not depend on earlier ranges.
`animation: false` applies the final display immediately. Fixed bounds and
`shrink: false` continue to constrain the range.

## See Also

- [Timescope](/api/timescope)
- [Core Concepts](/guide/concepts)
