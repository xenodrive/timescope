---
titleTemplate: Timescope API
---

# Timescope Options

| Type / helper                     | Accepted by / result                                                                 |
| --------------------------------- | ------------------------------------------------------------------------------------ |
| `TimescopeOptions`                | `setOptions()` and framework `options` props                                         |
| `TimescopeOptionsInitial`         | Constructor; adds [constructor-only fields](/api/timescope#options-constructor-only) |
| `TimescopeUpdateOptions`          | `updateOptions()`; partial settings, `null` to delete named entries                  |
| `defineTimescopeOptions(options)` | Typed options with inferred DataSource, Series, and Track names                      |
| `defaultOptions`                  | Read-only effective defaults, grouped by option; [using defaults](#default-values)   |

## Options

| Key         | Type                                                  | Default / contract                          |
| ----------- | ----------------------------------------------------- | ------------------------------------------- |
| `cursor`    | `boolean \| { color?: string, borderColor?: string }` | `true`; colors `transparent` / `red`        |
| `showFps`   | `boolean`                                             | `false`                                     |
| `font`      | `TimescopeFontStyle`                                  | Global text font; [font style](#font-style) |
| `sources`   | `Record<string, TimescopeSourceInput>`                | [DataSources](#sources)                     |
| `domains`   | `Record<string, TimescopeDomainOptions>`              | [Shared Domains](#domains)                  |
| `series`    | `Record<string, TimescopeSeriesInput>`                | [Series](#series)                           |
| `tracks`    | `Record<string, { height?, symmetric?, timeAxis? }>`  | [Track layout](#tracks)                     |
| `selection` | `boolean \| { resizable?, color?, invert? }`          | `true`; [selection options](#selection)     |

### Default Values

Import `defaultOptions` to inspect or reuse the fallback values used by Timescope itself.

```ts
import { defineTimescopeOptions, defaultOptions } from 'timescope';

const options = defineTimescopeOptions({
  domains: {
    amplitude: { ...defaultOptions.domain, axis: 'left' },
  },
});
```

| Group                                     | Contents                                                                                       |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `time`, `zoom`, `wheelSensitivity`, `fit` | Initial navigation values and fit padding                                                      |
| `options`                                 | Top-level fallback flags and unset named collections                                           |
| `cursor`                                  | Cursor colors                                                                                  |
| `domain`, `domainRange`                   | Value scale, labels, axis, automatic bounds, and range behavior                                |
| `track`, `timeAxis`                       | Automatic Track height, time-axis visibility, calendar/relative mode, time zone, and time unit |
| `series`                                  | Tooltip and instantaneous-value defaults, automatic color palette, and inherited-fill alpha    |
| `chartStyle`, `chartSize`, `chartUsing`   | Primitive style defaults, per-kind sizes, and field selectors                                  |
| `source`                                  | Chunk size/origin, immediate loading, and inactive query-cache size                            |

The export is **not a complete constructor configuration**: its groups describe effective defaults, not named DataSources, Series, Domains, or Tracks. Reuse individual values or spread an appropriate group as above; do not spread the entire export into `new Timescope()`.

Every group and array is frozen. Omitted settings can also be contextual: Track heights share the available canvas, a Series uses the first Track, and unspecified primitive colors inherit the Series color. An inherited fill uses `series.fillAlpha`; an explicit `fillColor` does not apply that extra alpha. These rules are not equivalent to filling every optional field with a static value.

## DataSources {#sources}

**Snapshot loading** acquires a complete dataset. **Chunk loading** queries a DataSource in time chunks at a selected data resolution; a DataSource can answer from a snapshot or acquire the requested rows with a **range loader**. The API's `TimescopeRangeLoader` name describes that acquisition interface, not a requirement that requests align to chunk boundaries. See [Loading and Updating Data](/guide/advanced/data) for both workflows.

### Input Types

| `TimescopeSourceInput`                 | Acquisition                                                                              |
| -------------------------------------- | ---------------------------------------------------------------------------------------- |
| `readonly TimescopeDataRowInput[]`     | Inline snapshot; original-array mutations are not observed                               |
| `{ data, ...options }`                 | Inline snapshot with DataSource options                                                  |
| `string` or `{ url, ...options }`      | Snapshot URL; range requests when the URL contains [placeholders](#url-placeholders)     |
| `function` or `{ loader, ...options }` | Range loader; `chunked: false` for a snapshot function                                   |
| `{ loader: dataLoader, ...options }`   | Reusable [DataLoader](#reusable-dataloader); snapshot instances require `chunked: false` |
| `TimescopeDataSource`                  | Existing DataSource instance                                                             |

### DataSource Types {#source-types}

| `type`               | Rows / output                      | Acquisition       | `append()` |
| -------------------- | ---------------------------------- | ----------------- | ---------- |
| `'simple'` (default) | Points and intervals, unaggregated | Snapshot or range | —          |
| `'point-aggregate'`  | Ordered points; min/max/average    | Snapshot          | Supported  |
| `'point-percentile'` | Points; percentiles                | Snapshot          | —          |

### DataSource Options {#source-options}

| Key           | Type                                                                                              | Default / contract                                                                   |
| ------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `data`        | `unknown`                                                                                         | Inline payload; row array without a transform                                        |
| `url`         | `string`                                                                                          | Snapshot or templated range URL                                                      |
| `loader`      | `TimescopeRangeLoader \| TimescopeSnapshotLoader \| TimescopeDataLoader`                          | Acquisition function or reusable loader                                              |
| `chunked`     | `boolean`                                                                                         | Function loader: `true`; `false` for a whole-dataset function                        |
| `type`        | `'simple' \| 'point-aggregate' \| 'point-percentile'`                                             | `'simple'`                                                                           |
| `chunkSize`   | `number \| ((resolution: Decimal) => number)`                                                     | `256`; positive safe integer, stable for a given resolution                          |
| `chunkOrigin` | `TimescopeNumberLike`                                                                             | `0`; chunk and aggregation-bucket origin                                             |
| `immediate`   | `boolean`                                                                                         | `true`; permit loading while the view moves                                          |
| `resolutions` | `readonly TimescopeNumberLike[]`                                                                  | Preferred positive data resolutions for range loading                                |
| `zoomLevels`  | `readonly number[]`                                                                               | Resolution hints as zoom levels; `resolutions` takes precedence                      |
| `decoder`     | `(payload: any) => readonly TimescopeDataRowInput[] \| Promise<readonly TimescopeDataRowInput[]>` | Payload conversion                                                                   |
| `mappings`    | `TimescopeMappings`                                                                               | Payload-field mapping                                                                |
| `cacheSize`   | `number`                                                                                          | `1000`; nonnegative integer; retained inactive query results; `0` disables retention |
| `percentiles` | `{ values?: readonly (0.5 \| 0.9 \| 0.95)[], primary?: 0.5 \| 0.9 \| 0.95 }`                      | Point-percentile only; all three outputs, primary `0.5`                              |

| Constraint           | Rule                                     |
| -------------------- | ---------------------------------------- |
| Acquisition          | Exactly one of `data`, `url`, `loader`   |
| Transform            | At most one of `decoder`, `mappings`     |
| Supplied DataLoader  | Transforms configured on the DataLoader  |
| Snapshot DataSources | Resolution hints do not restrict queries |

### DataSource API

| Signature                                                                                 | Returns / type                                                                                                    |
| ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `createDataSource(input: TimescopeSourceInput)`                                           | `TimescopeDataSource`; `TimescopeAppendOnlyDataSource` for point-aggregate input; existing instances pass through |
| `source.query(request: TimescopeDataSourceQuery)`                                         | `Promise<readonly TimescopeDataRow[]>`                                                                            |
| `source.invalidate(range?: [TimescopeTimeLike<undefined>, TimescopeTimeLike<undefined>])` | `void`                                                                                                            |
| `source.on('invalidate', handler)`                                                        | Unsubscribe function; payload `{ type: 'invalidate', value: { range?, revision } }`                               |
| `source.dispose?.()`                                                                      | `void`; release a standalone DataSource                                                                           |
| `source.chunkSize`, `source.chunkOrigin`, `source.immediate`, `source.cacheSize`          | Readonly DataSource settings                                                                                      |
| `source.resolutions`                                                                      | `readonly Decimal[] \| undefined`; preferred data resolutions                                                     |

### Direct Queries

```ts
type TimescopeDataSourceQuery = {
  range: [Decimal, Decimal];
  resolution: Decimal;
};
```

| Field / output          | Contract                                                              |
| ----------------------- | --------------------------------------------------------------------- |
| `range`                 | Finite, ordered; `start <= end`; independent of chunk boundaries      |
| `resolution`            | Data resolution; positive interval in row time units                  |
| Simple range DataSource | Same request and response contract as a [range loader](#range-loader) |
| Aggregated output       | Whole buckets anchored to `chunkOrigin`, with neighboring context     |

### Payloads and Decoders

| Acquisition | `decoder(payload)` input     |
| ----------- | ---------------------------- |
| `data`      | Supplied data                |
| `url`       | Fetched `Response`           |
| `loader`    | Resolved loader return value |

| Transform  | Required output / input                                 |
| ---------- | ------------------------------------------------------- |
| `decoder`  | Return a row array or Promise of one                    |
| `mappings` | Input is a record array; `Response` bodies read as JSON |
| Neither    | Input is a row array; `Response` bodies read as JSON    |

### Snapshot Loader

```ts
type TimescopeSnapshotLoader<T = unknown> = () => T | Promise<T>;
```

| Setting           | Contract                               |
| ----------------- | -------------------------------------- |
| `chunked: false`  | Required for snapshot function loaders |
| Snapshot lifetime | Retained until invalidation            |

### Rows

| `TimescopeDataRowInput` field | Type                                          | Contract                                       |
| ----------------------------- | --------------------------------------------- | ---------------------------------------------- |
| `time`                        | `TimescopeTimeLike<never>`                    | Single time; mutually exclusive with `times`   |
| `times`                       | `Record<string, TimescopeTimeLike<never>>`    | Named times; at least one                      |
| `value`                       | `TimescopeNumberLike \| null`                 | Single value; mutually exclusive with `values` |
| `values`                      | `Record<string, TimescopeNumberLike \| null>` | Named values                                   |
| `data`                        | `unknown`                                     | Optional row metadata                          |

| Row extent | Definition                                          |
| ---------- | --------------------------------------------------- |
| Point      | All row times equal                                 |
| Interval   | `[min(times), max(times))`; simple DataSources only |

| Canonical row / callback field | Type                              |
| ------------------------------ | --------------------------------- |
| `times`                        | `Record<string, Decimal>`         |
| `values`                       | `Record<string, Decimal \| null>` |
| `data`                         | `unknown`                         |

### Mappings

| Field    | Type                     | Contract                  |
| -------- | ------------------------ | ------------------------- |
| `times`  | `Record<string, string>` | Time name → payload path  |
| `values` | `Record<string, string>` | Value name → payload path |

Path syntax: `record.timestamp` for nested fields; `primary, fallback` for the first non-null value.

### Aggregated Output

| DataSource       | Value suffixes                                                     | Unsuffixed value                   |
| ---------------- | ------------------------------------------------------------------ | ---------------------------------- |
| Point-aggregate  | `#avg`, `#first`, `#last`, `#min`, `#max`                          | Average                            |
| Point-percentile | `#first`, `#last`, `#min`, `#max`, selected `#p50`, `#p90`, `#p95` | `percentiles.primary`; default p50 |

| Bucket          | Output time     |
| --------------- | --------------- |
| One point       | Original time   |
| Multiple points | Bucket midpoint |

### URL Placeholders

| Placeholder           | Value                                      |
| --------------------- | ------------------------------------------ |
| `{z}`, `{zoom}`       | Zoom corresponding to requested resolution |
| `{r}`, `{resolution}` | Requested resolution                       |
| `{s}`, `{start}`      | Requested range start                      |
| `{e}`, `{end}`        | Requested range end                        |

### Range Loader

```ts
type TimescopeLoadRequest = { range: [Decimal, Decimal]; resolution: Decimal };
type TimescopeRangeLoader<T = unknown> = (request: TimescopeLoadRequest) => T | Promise<T>;
```

| Request / response            | Contract                                                                            |
| ----------------------------- | ----------------------------------------------------------------------------------- |
| Request                       | Arbitrary finite ordered range; positive resolution; no chunk-alignment requirement |
| Point rows                    | All points with `start <= time < end`                                               |
| Interval rows                 | All rows with `rowStart < end && start < rowEnd`; complete and untrimmed            |
| Lines / steps and their areas | Recommended nearest neighbor on each side, where available                          |
| Curves and curve areas        | Recommended two nearest neighbors on each side, where available                     |
| Range with no points          | Same neighboring-row recommendation                                                 |
| Density                       | Appropriate to the requested resolution                                             |

### Invalidation and Caching

| Operation / setting            | Contract                                                               |
| ------------------------------ | ---------------------------------------------------------------------- |
| `invalidate()`                 | Reacquire all data on demand                                           |
| `invalidate([start, end])`     | Invalidate the affected range; `undefined` endpoint is unbounded       |
| Snapshot invalidation          | Reacquire the whole snapshot; discard appends absent from its input    |
| `cacheSize: 0`                 | No inactive query-result retention; snapshots remain until invalidated |
| Shared DataSource lifetime     | Automatically disposed after the last chart releases it                |
| Standalone DataSource lifetime | Caller invokes `source.dispose?.()`                                    |

### Reusable DataLoader

| Signature / member                                      | Returns / type                         | Contract                                                              |
| ------------------------------------------------------- | -------------------------------------- | --------------------------------------------------------------------- |
| `createDataLoader(options: TimescopeDataLoaderOptions)` | `TimescopeDataLoader`                  | Acquisition and transforms from [DataSource Options](#source-options) |
| `new TimescopeDataLoader(options)`                      | `TimescopeDataLoader`                  | Same acquisition options                                              |
| `loader.ranged`                                         | `boolean`                              | Readonly; whether `load()` requires a request                         |
| `loader.load()`                                         | `Promise<readonly TimescopeDataRow[]>` | Snapshot only; fresh acquisition per call                             |
| `loader.load(request: TimescopeLoadRequest)`            | `Promise<readonly TimescopeDataRow[]>` | Range only; fresh acquisition per call                                |

`TimescopeDataLoaderOptions`: `data` / `url` / `loader`, `chunked`, `decoder` / `mappings`.

### Appending Points

| Method              | Returns         |
| ------------------- | --------------- |
| `append(rowOrRows)` | `Promise<void>` |

| Constraint    | Contract                                                                                |
| ------------- | --------------------------------------------------------------------------------------- |
| DataSource    | `point-aggregate` only                                                                  |
| Input         | One point row or readonly row array                                                     |
| Order         | Nondecreasing time across initial and appended rows; equal times retain insertion order |
| Invalid batch | No rows inserted                                                                        |
| Transforms    | Direct DataSource `mappings` apply; decoders and DataLoader transforms do not           |
| Refresh       | Automatic; no `reload()` required                                                       |
| Promise       | Data update complete; drawing may still be pending                                      |

## Series

| Key                  | Type                                                      | Contract                                           |
| -------------------- | --------------------------------------------------------- | -------------------------------------------------- |
| `data.source`        | `string`                                                  | Required; name in `options.sources`                |
| `data.name`          | `string`                                                  | Display name                                       |
| `data.color`         | `string`                                                  | Default Chart color                                |
| `data.domain`        | `string \| TimescopeDomainOptions`                        | Shared Domain name or inline Domain                |
| `data.resolution`    | `TimescopeDataResolution`                                 | [Data-resolution selection](#resolution)           |
| `data.instantaneous` | `false \| { using?, zoom?, resolution? }`                 | [Cursor sampling](#instantaneous-values)           |
| `chart`              | `TimescopeChartType \| { marks?, links? }`                | Preset or custom primitives                        |
| `tooltip`            | `boolean \| { label?: string, digits?: number, format? }` | Tooltip settings; `false` disables cursor sampling |
| `track`              | `string`                                                  | Track name                                         |

### Resolution

| `TimescopeDataResolution` form                                              | Meaning                            |
| --------------------------------------------------------------------------- | ---------------------------------- |
| `'nearest' \| 'floor' \| 'ceil'`                                            | Snap mode                          |
| `TimescopeNumberLike`                                                       | Preferred positive data resolution |
| `(context: TimescopeResolutionContext) => TimescopeNumberLike`              | Data-resolution resolver           |
| `{ resolve?: TimescopeResolutionResolver, snap?: TimescopeResolutionSnap }` | Resolver and snap mode             |

| Context / default                 | Value                                                                                |
| --------------------------------- | ------------------------------------------------------------------------------------ |
| `context.resolution`              | `Decimal`; display resolution in time units per pixel, `2 ** (-zoom)`                |
| `context.resolutions`             | `readonly Decimal[]`; DataSource's preferred data resolutions, empty if unrestricted |
| Default preferred data resolution | Display resolution                                                                   |
| Default snap                      | `'nearest'`                                                                          |
| Snap candidates                   | DataSource resolutions; integer-zoom resolutions if none supplied                    |

| Snap      | Selection                                                     |
| --------- | ------------------------------------------------------------- |
| `nearest` | Closest on the logarithmic zoom scale                         |
| `floor`   | Largest data resolution at or below the preferred resolution  |
| `ceil`    | Smallest data resolution at or above the preferred resolution |

Directional snapping falls back to the nearest endpoint.

### Instantaneous Values

| Field                       | Type                       | Contract                    |
| --------------------------- | -------------------------- | --------------------------- |
| `using`                     | `Using1<[string, string]>` | Value sampled at the cursor |
| `zoom`                      | `number`                   | Sampling zoom               |
| `resolution`                | `TimescopeNumberLike`      | Sampling resolution         |
| `data.instantaneous: false` | —                          | Disable cursor sampling     |

### Tooltip

| Field    | Type                  | Contract                                                                         |
| -------- | --------------------- | -------------------------------------------------------------------------------- |
| `label`  | `string`              | Tooltip label override                                                           |
| `digits` | `number`              | Decimal places; overrides domain `digits`; falls back to `2` when neither is set |
| `format` | `(context) => string` | Value formatter                                                                  |

| Formatter context field | Type                                                                  |
| ----------------------- | --------------------------------------------------------------------- |
| `time`                  | `Decimal`                                                             |
| `value`                 | `Decimal \| null`                                                     |
| `name`                  | `string \| undefined`                                                 |
| `unit`                  | `string`                                                              |
| `digits`                | `number`; resolved tooltip/domain decimal places, falling back to `2` |

## `using` Selectors {#using-selectors}

| Form                  | Selection                 |
| --------------------- | ------------------------- |
| `'value@time'`        | Named value and time      |
| `'value'`             | Named value, default time |
| `'@start'`            | Default value, named time |
| `['min', 'max']`      | Two coordinates           |
| `'#zero'`             | Track's shared baseline   |
| `'#top'`, `'#bottom'` | Chart-area edges          |
| `'value#avg'`         | Named aggregate value     |

| Primitive                      | Default `using`                     |
| ------------------------------ | ----------------------------------- |
| Single-coordinate Mark / Link  | `'value@time'`                      |
| `line`, `bar`, `section` Marks | `['min', 'max']`                    |
| Area Links                     | Value and shared baseline (`#zero`) |

## Chart Presets

| Preset                                                      | Result                                                  |
| ----------------------------------------------------------- | ------------------------------------------------------- |
| `'lines'`, `'lines:filled'`                                 | Line Chart, optionally filled                           |
| `'curves'`, `'curves:filled'`                               | Monotone cubic Chart, optionally filled                 |
| `'steps-start'`, `'steps'`, `'steps-end'`                   | Steps; optional `:filled`                               |
| `'points'`                                                  | Circle Marks                                            |
| `'linespoints'`, `'curvespoints'`                           | Lines / curves with circles; optional `:filled`         |
| `'stepspoints-start'`, `'stepspoints'`, `'stepspoints-end'` | Steps with circles; optional `:filled`                  |
| `'impulses'`, `'impulsespoints'`                            | Lines from the shared baseline, optionally with circles |
| `'bars'`, `'bars:filled'`                                   | Bars from the shared baseline                           |

## Links

`chart.links`: array of `{ draw, using?, style? }`, or `(context) => array`.

| `draw`                                                | Coordinates | Style        |
| ----------------------------------------------------- | ----------- | ------------ |
| `'line'`, `'curve'`                                   | One         | Stroke       |
| `'step-start'`, `'step'`, `'step-end'`                | One         | Stroke       |
| `'area'`, `'curve-area'`                              | Two         | Stroke, Fill |
| `'step-area-start'`, `'step-area'`, `'step-area-end'` | Two         | Stroke, Fill |

## Marks

`chart.marks`: array of `{ draw, using?, style? }`, or `(context) => array`.

| `draw`                                          | Coordinates | Style                             |
| ----------------------------------------------- | ----------- | --------------------------------- |
| `'circle'`                                      | One         | Stroke, Fill, Size, Offset        |
| `'triangle'`, `'square'`, `'diamond'`, `'star'` | One         | Stroke, Fill, Size, Angle, Offset |
| `'cross'`, `'plus'`, `'minus'`                  | One         | Stroke, Size, Angle, Offset       |
| `'line'`, `'section'`                           | Two         | Stroke, Size, Offset              |
| `'bar'`                                         | Two         | Stroke, Fill, Size, Box, Offset   |
| `'region'`                                      | Two         | Stroke, Fill, Box                 |
| `'text'`                                        | One         | Text, Size, Angle, Offset         |
| `'icon'`                                        | One         | Icon, Size, Angle, Offset         |
| `'path'`                                        | One         | Path, Size, Angle, Offset         |

## Style

| Callback | Context                                                                                                           |
| -------- | ----------------------------------------------------------------------------------------------------------------- |
| Mark     | `{ times: Record<string, Decimal>, values: Record<string, Decimal \| null>, data: unknown, resolution: Decimal }` |
| Link     | `{ resolution: Decimal }`                                                                                         |

| Callback support         | Contract                                                                  |
| ------------------------ | ------------------------------------------------------------------------- |
| `draw`, `using`, `style` | Value or `(context) => value`                                             |
| Style fields             | Value or `(context) => value`, except fixed `origin`, `scale`, `fillPost` |
| `resolution`             | Display resolution in time units per pixel, `2 ** (-zoom)`                |

### Stroke

| Key              | Type             |
| ---------------- | ---------------- |
| `lineWidth`      | `number`; pixels |
| `lineColor`      | `string`         |
| `lineDashArray`  | `number[]`       |
| `lineDashOffset` | `number`         |

### Fill

| Key           | Type      | Contract                                                                               |
| ------------- | --------- | -------------------------------------------------------------------------------------- |
| `fillColor`   | `string`  | Explicit color, including alpha                                                        |
| `fillOpacity` | `number`  | Multiplies fill alpha, including explicit `fillColor`; default `1`, clamped to `0`–`1` |
| `fillPost`    | `boolean` | Fill after the stroke                                                                  |

| Default fill | Color                                                            |
| ------------ | ---------------------------------------------------------------- |
| Marks        | Series color at 25% alpha; path interiors cleared before filling |
| Links        | Series color at 25% alpha                                        |

Filled path Marks erase previously drawn pixels inside their paths, then paint their fill color. This also applies to explicit `fillColor`: a transparent fill or `fillOpacity: 0` leaves a transparent hole rather than revealing Links. Pixels outside the paths are retained. With `fillPost: true`, erasure and filling occur after the stroke, removing its interior portion. Text and icon Marks do not erase their backgrounds.

### Geometry

| Key       | Type                                            | Contract                                   |
| --------- | ----------------------------------------------- | ------------------------------------------ |
| `size`    | `number`                                        | Pixel size; primitive-specific             |
| `angle`   | `number`                                        | Rotation in degrees                        |
| `offset`  | `[number, number]`                              | Pixel offset `[x, y]`                      |
| `extrude` | `number \| [number, number?, number?, number?]` | Box expansion `[top, right, bottom, left]` |
| `radius`  | `number`                                        | Box corner radius in pixels                |

### Path

| Key      | Type                      |
| -------- | ------------------------- |
| `path`   | `string`; SVG path data   |
| `origin` | `[number, number]`; fixed |
| `scale`  | `number`; fixed           |

### Text

| Key                | Type                                                                          |
| ------------------ | ----------------------------------------------------------------------------- |
| `text`             | `string`                                                                      |
| `font`             | `TimescopeFontStyle`                                                          |
| `textAlign`        | `'start' \| 'center' \| 'end' \| 'left' \| 'right'`                           |
| `textBaseline`     | `'top' \| 'middle' \| 'bottom' \| 'hanging' \| 'alphabetic' \| 'ideographic'` |
| `textColor`        | `string`                                                                      |
| `textOpacity`      | `number`                                                                      |
| `textOutline`      | `boolean`                                                                     |
| `textOutlineColor` | `string`                                                                      |
| `textOutlineWidth` | `number`                                                                      |

### Icon

| Key                | Type                                                                          |
| ------------------ | ----------------------------------------------------------------------------- |
| `icon`             | `string`                                                                      |
| `font`             | `TimescopeFontStyle`                                                          |
| `iconAlign`        | `'start' \| 'center' \| 'end' \| 'left' \| 'right'`                           |
| `iconBaseline`     | `'top' \| 'middle' \| 'bottom' \| 'hanging' \| 'alphabetic' \| 'ideographic'` |
| `iconColor`        | `string`                                                                      |
| `iconOpacity`      | `number`                                                                      |
| `iconOutline`      | `boolean`                                                                     |
| `iconOutlineColor` | `string`                                                                      |
| `iconOutlineWidth` | `number`                                                                      |

### Font Style

`TimescopeFontStyle`: CSS canvas font string or the following object.

| Field                                   | Type                                          |
| --------------------------------------- | --------------------------------------------- |
| `style`, `variant`, `weight`, `stretch` | `string`                                      |
| `size`                                  | `number` in pixels or CSS size `string`       |
| `lineHeight`                            | Unitless `number` or CSS line-height `string` |
| `family`                                | `string`; comma-separated fallback families   |

| Usage             | Default font                        |
| ----------------- | ----------------------------------- |
| Text Marks        | `normal 14px Timescope, sans-serif` |
| Icon Marks        | `normal 16px icons`                 |
| Time-axis labels  | `normal 12px Timescope, sans-serif` |
| Value-axis labels | `normal 11px Timescope, sans-serif` |
| Tooltips          | `normal 12px Timescope, sans-serif` |

`options.font` sets the font for text Marks, time-axis and value-axis labels, and Tooltips, but not icon Marks. It selects the font style; the constructor's `fonts` option loads font data.

Object font properties inherit in this order: local `font` → `options.font` → per-location defaults. Unspecified or `undefined` properties do not override inherited values. For example, `font: { family: 'MS Gothic' }` preserves each location's default size and weight.

Strings are complete CSS canvas font declarations, such as `'bold 14px "MS Gothic"'`, not family names alone. A local string overrides the global font entirely. A global string is used unchanged when there is no local font or explicit Mark size; local object properties cannot inherit from a CSS string and instead use per-location defaults.

Text Mark font-size precedence: local string `font` as supplied → local object `font.size` → Mark `style.size` → global object `font.size` → default. Icon Marks keep their existing local font and size defaults.

```ts
const timescope = new Timescope({
  target: '#chart',
  font: { family: 'MS Gothic', weight: 'bold' },
  tracks: {
    default: { timeAxis: { labels: { font: { size: 16, weight: 'normal' } } } },
  },
});
```

Here, time-axis labels use `normal 16px "MS Gothic"`; Tooltips use `bold 12px "MS Gothic"`. Other text keeps its per-location size while inheriting the global family and weight.

`updateOptions({ font: { weight: 'normal' } })` changes the weight while retaining the other global properties. `updateOptions({ font: undefined })` clears the global style. `setOptions()` replaces the configuration: omitted `font` properties do not retain the previous global style. Framework components accept the global style through their `options.font`, while `fonts` remains a separate creation-only prop.

## Tracks

| Key         | Type                                  | Contract                                 |
| ----------- | ------------------------------------- | ---------------------------------------- |
| `height`    | `number`                              | Fixed CSS-pixel height                   |
| `symmetric` | `boolean`                             | Mirror positive and negative chart space |
| `timeAxis`  | `boolean \| TimescopeTimeAxisOptions` | Show, hide, or configure the time axis   |

| `tracks` input | Result                               |
| -------------- | ------------------------------------ |
| Omitted        | Implicit `default` Track             |
| `{}`           | Invalid; at least one Track required |

### Time Axis

| Key          | Type                                                     | Contract                                                                                  |
| ------------ | -------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `axis`       | `false \| { color?: string }`                            | Axis-line visibility / color                                                              |
| `ticks`      | `false \| { color?: string }`                            | Tick visibility / color                                                                   |
| `labels`     | `false \| { color?: string, font?: TimescopeFontStyle }` | Label visibility / style; default color: target CSS `color` in browsers, black in Node.js |
| `relative`   | `boolean`                                                | Time relative to zero                                                                     |
| `timeFormat` | `TimeFormatFunc \| TimeFormatLabeler`                    | Custom labels                                                                             |
| `timeUnit`   | `'s' \| 'ms' \| 'us' \| 'ns'`                            | Numeric time unit; default `'s'`                                                          |
| `timeZone`   | `string`                                                 | `'local'` (default), `'utc'`, or IANA name; absolute labels and tick boundaries           |

| Formatter                  | Signature / fields                                                                                                                   |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `TimeFormatFunc`           | `(context: TimeFormatFuncOptions) => string \| undefined`; `undefined` uses default formatting                                       |
| `TimeFormatFuncOptions`    | `{ time: Decimal, unit: 's' \| 'ms' \| 'us' \| 'ns', level: CalendarLevel, digits: number, stride?: bigint }`                        |
| `CalendarLevel`            | `'subsecond' \| 'second' \| 'minute' \| 'hour' \| 'day' \| 'month' \| 'year' \| 'relative'`                                          |
| `TimeFormatLabeler`        | Optional `year`, `month`, `quarter`, `date`, `minutes`, `seconds`: `(context: TimeFormatLabelerOptions) => string`                   |
| `TimeFormatLabelerOptions` | `year`, `second`: `bigint`; `quarter`, `month`, `day`, `hour`, `minute`, `week`, `digits`: `number`; `time`, `subseconds`: `Decimal` |

Labeler components use `timeZone`; `week` is weekday (`0` = Sunday). Hiding the axis preserves the `#zero` baseline.

## Selection

| Value / key | Type      | Default / contract                              |
| ----------- | --------- | ----------------------------------------------- |
| `false`     | `boolean` | Disable selection and clear the current range   |
| `true`      | `boolean` | Enable default selection                        |
| `resizable` | `boolean` | `true`; shift-drag creation and handle resizing |
| `color`     | `string`  | Overlay color                                   |
| `invert`    | `boolean` | Shade outside the range                         |

Current range: [`setSelectionRange()`](/api/timescope#navigation) or component `selectionRange`. Initial range: constructor-only `selection.range`.

## Domains

| Key           | Type                                                                    | Default / contract                                                                                              |
| ------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `scale`       | `'linear' \| 'linear-symmetric' \| 'log'`                               | `'linear'`                                                                                                      |
| `axis`        | `boolean \| 'left' \| 'right' \| TimescopeYAxisOptions`                 | Optional value axis                                                                                             |
| `animation`   | `boolean`                                                               | `true`; range transitions                                                                                       |
| `range`       | `TimescopeNumberLike \| [min?, max?] \| { expand?, shrink?, default? }` | Bounds are `TimescopeNumberLike`; unbounded ends follow visible data; scalar means `[0, value]`                 |
| `expand`      | `boolean`                                                               | `false`; allow expansion beyond specified bounds                                                                |
| `shrink`      | `boolean`                                                               | `true`; allow the range to contract                                                                             |
| `floatingGap` | `number`                                                                | `20`; pixels between a floating range and the shared baseline                                                   |
| `unit`        | `string`                                                                | Tooltip and value-axis unit                                                                                     |
| `digits`      | `number`                                                                | Unspecified by default; fallback decimal places for tooltip and value axis; individual settings take precedence |

| Object `range` field | Type / contract                                                       |
| -------------------- | --------------------------------------------------------------------- |
| `default`            | `TimescopeNumberLike \| [TimescopeNumberLike?, TimescopeNumberLike?]` |
| `expand`, `shrink`   | `boolean`; top-level settings take precedence                         |

| `TimescopeYAxisOptions` field | Type                                                                                                     |
| ----------------------------- | -------------------------------------------------------------------------------------------------------- |
| `side`                        | `'left' \| 'right'`                                                                                      |
| `label`                       | `string`                                                                                                 |
| `digits`                      | `number`; overrides domain `digits`; otherwise automatically determined from ticks, shared by all labels |
| `color`                       | `string`; overrides axis and label color; default label color: target CSS `color` / Node.js black        |
| `font`                        | `TimescopeFontStyle`                                                                                     |
