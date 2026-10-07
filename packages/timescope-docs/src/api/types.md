---
titleTemplate: Timescope API
outline: [2, 3]
---

# Types

Public types exported from `timescope`.

## Inputs and Navigation

### Number and time inputs {#number-and-time-inputs}

```ts
type TimescopeNumberLike = number | string | bigint | Decimal;
type DecimalLike = TimescopeNumberLike | { coeff: bigint; digits: number | bigint };
type TimescopeTimeLike<N extends null | undefined = null> = TimescopeNumberLike | Date | N;
```

Numeric strings are decimal values, including scientific notation. JavaScript numbers have already been rounded to their native precision; use strings or `Decimal` to preserve exact digits.

Time strings are calendar dates parsed by `Calendar`, not numeric strings. Numbers, `bigint`, and `Decimal` use the data's time units, seconds by default; `Date` converts to Unix epoch seconds. Navigation `null` follows the clock, and an `undefined` range endpoint is unbounded. `TimescopeTimeLike<never>` excludes both nullish values; `TimescopeTimeLike<undefined>` permits `undefined` instead of `null`.

[Decimal](/api/classes#decimal) · [Calendar](/api/classes#calendar)

### Ranges and sizes {#ranges-and-sizes}

```ts
type TimescopeRange<T> = [start: T, end: T];
```

| `TimescopeSize` field | Type     | Unit   | Description                          |
| --------------------- | -------- | ------ | ------------------------------------ |
| `x`, `y`              | `number` | CSS px | Canvas position within the viewport. |
| `width`, `height`     | `number` | CSS px | Canvas dimensions.                   |
| `dpr`                 | `number` | Ratio  | Device pixel ratio used for drawing. |

### TimescopeFitOptions

| Field        | Type                                      | Default | Unit   | Description                                                                            |
| ------------ | ----------------------------------------- | ------- | ------ | -------------------------------------------------------------------------------------- |
| `animation?` | `boolean`                                 | `true`  | —      | Animates the fitted view.                                                              |
| `padding?`   | `number \| [left: number, right: number]` | `0`     | CSS px | Space around the fitted range; finite and nonnegative. A scalar applies to both sides. |

[Guide](/guide/getting-started#view-control)

### TimescopeAnimationInput

```ts
type TimescopeAnimationInput =
  | false
  | 'in-out'
  | 'linear'
  | 'out'
  | {
      animation: false | 'in-out' | 'linear' | 'out';
      duration: number;
      lazy?: boolean;
      tangent?: number;
    };
```

`false` changes the value immediately. String presets use 500 ms: `'in-out'` starts and ends smoothly, `'linear'` has constant speed, and `'out'` slows toward the end. Object `lazy` commits the selected value after the animation; `tangent` controls the initial slope of an `'out'` animation.

[Method defaults](/api/classes#timescope-methods)

## Data

### TimescopeSourceInput

```ts
type TimescopeSourceInput =
  | string
  | readonly TimescopeDataRowInput[]
  | TimescopeRangeLoader<readonly TimescopeDataRowInput[]>
  | TimescopeSourceOptions
  | TimescopeDataSource;
```

[Snapshot guide](/guide/drawing-a-chart#snapshot-data) · [Chunk Loading](/guide/advanced/chunk-loading)

### TimescopeSourceOptions

| Field          | Type                                                  | Default    | Description                                             |
| -------------- | ----------------------------------------------------- | ---------- | ------------------------------------------------------- |
| `type?`        | `'simple' \| 'point-aggregate' \| 'point-percentile'` | `'simple'` | Source query and aggregation strategy.                  |
| `percentiles?` | `TimescopePercentileOptions`                          | —          | Percentile selection for a `'point-percentile'` source. |

[TimescopeDataLoaderOptions](#timescopedataloaderoptions) · [TimescopeSourceCommonOptions](#timescopesourcecommonoptions)

| Source type          | Acquisition      | Rows               | Output value suffixes                                     | Unsuffixed value      |
| -------------------- | ---------------- | ------------------ | --------------------------------------------------------- | --------------------- |
| `'simple'`           | Snapshot / range | Points / intervals | —                                                         | Original              |
| `'point-aggregate'`  | Snapshot         | Points             | `#avg`, `#first`, `#last`, `#min`, `#max`                 | `#avg`                |
| `'point-percentile'` | Snapshot         | Points             | `#first`, `#last`, `#min`, `#max`, `#p50`, `#p90`, `#p95` | `percentiles.primary` |

[Decimation guide](/guide/drawing-a-chart#decimation)

#### Common source options {#timescopesourcecommonoptions}

| `TimescopeSourceCommonOptions` field | Type                                          | Default | Description                                                                   |
| ------------------------------------ | --------------------------------------------- | ------- | ----------------------------------------------------------------------------- |
| `chunkSize?`                         | `number \| ((resolution: Decimal) => number)` | `256`   | Preferred query size; a positive safe integer, stable per resolution.         |
| `chunkOrigin?`                       | `TimescopeNumberLike`                         | `0`     | Origin for chunks and aggregation buckets.                                    |
| `immediate?`                         | `boolean`                                     | `true`  | Permits loading while the view moves.                                         |
| `resolutions?`                       | `readonly TimescopeNumberLike[]`              | —       | Positive resolution hints for range loaders; overrides `zoomLevels`.          |
| `zoomLevels?`                        | `readonly number[]`                           | —       | Range-loader resolution hints expressed as zoom levels.                       |
| `cacheSize?`                         | `number`                                      | `1000`  | Inactive query results retained; nonnegative integer, `0` disables retention. |

[Guide](/guide/advanced/chunk-loading#chunk-size)

#### Percentiles {#percentiles}

| `TimescopePercentileOptions` field | Type                              | Default            | Description                                      |
| ---------------------------------- | --------------------------------- | ------------------ | ------------------------------------------------ |
| `values?`                          | `readonly (0.5 \| 0.9 \| 0.95)[]` | `[0.5, 0.9, 0.95]` | Percentiles exposed as suffixed output values.   |
| `primary?`                         | `0.5 \| 0.9 \| 0.95`              | `0.5`              | Percentile used for the unsuffixed output value. |

### TimescopeDataLoaderOptions

| Field       | Type                                                                     | Description                                             | Constraint                                                                              |
| ----------- | ------------------------------------------------------------------------ | ------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `data?`     | `unknown`                                                                | Inline payload; row array without a transform.          | Exactly one of `data`, `url`, and `loader`.                                             |
| `url?`      | `string`                                                                 | Snapshot URL or range URL with placeholders.            | Exactly one of `data`, `url`, and `loader`.                                             |
| `loader?`   | `TimescopeRangeLoader \| TimescopeSnapshotLoader \| TimescopeDataLoader` | Acquisition callback or reusable loader.                | Exactly one of `data`, `url`, and `loader`; transforms belong on a supplied DataLoader. |
| `chunked?`  | `boolean`                                                                | Range-loading mode; function loaders default to `true`. | Snapshot callbacks and snapshot DataLoader inputs require `false`.                      |
| `decoder?`  | `TimescopeDataDecoder`                                                   | Converts a payload or fetched response to rows.         | Mutually exclusive with `mappings`.                                                     |
| `mappings?` | `TimescopeMappings`                                                      | Maps record-array fields to row coordinates.            | Mutually exclusive with `decoder`.                                                      |

Without a transform, inline data and callback results must be row arrays; URL responses are read as JSON. `decoder` receives the inline payload, fetched `Response`, or loader result. URL responses with `mappings` are read as JSON before mapping. Snapshot sources retain data until invalidation.

[Snapshot guide](/guide/drawing-a-chart#snapshot-data) · [Range loader guide](/guide/advanced/chunk-loading#use-an-application-loader)

#### URL Placeholders

| Placeholder           | Value               |
| --------------------- | ------------------- |
| `{z}`, `{zoom}`       | `-log2(resolution)` |
| `{r}`, `{resolution}` | `resolution`        |
| `{s}`, `{start}`      | `range[0]`          |
| `{e}`, `{end}`        | `range[1]`          |

### Load and query requests {#load-and-query-requests}

| `TimescopeLoadRequest` / `TimescopeDataSourceQuery` field | Type                      | Constraint             |
| --------------------------------------------------------- | ------------------------- | ---------------------- |
| `range`                                                   | `TimescopeRange<Decimal>` | Finite; `start <= end` |
| `resolution`                                              | `Decimal`                 | `> 0`                  |

[Response requirements](/guide/advanced/chunk-loading#return-rows-for-a-range)

### Loader callbacks {#loader-callbacks}

```ts
type TimescopeRangeLoader<T = unknown> = (request: TimescopeLoadRequest) => T | Promise<T>;
type TimescopeSnapshotLoader<T = unknown> = () => T | Promise<T>;
type TimescopeDataDecoder = (
  payload: any,
) => readonly TimescopeDataRowInput[] | Promise<readonly TimescopeDataRowInput[]>;
```

[Acquisition and transforms](#timescopedataloaderoptions)

### Data rows {#data-rows}

```ts
type TimescopeDataRowInput = (
  | { time: TimescopeTimeLike<never>; times?: never }
  | { time?: never; times: Record<string, TimescopeTimeLike<never>> }
) &
  (
    | { value: TimescopeNumberLike | null; values?: never }
    | { value?: never; values: Record<string, TimescopeNumberLike | null> }
  ) & { data?: unknown };
```

[Guide](/guide/concepts#canonical-rows)

#### Normalized rows {#normalized-rows}

| `TimescopeDataRow` field | Type                              | Description                        |
| ------------------------ | --------------------------------- | ---------------------------------- |
| `times`                  | `Record<string, Decimal>`         | Normalized named time coordinates. |
| `values`                 | `Record<string, Decimal \| null>` | Normalized named values.           |
| `data`                   | `unknown`                         | Original row metadata.             |

#### Field mappings {#timescopemappings}

| `TimescopeMappings` field | Type                     | Description                          |
| ------------------------- | ------------------------ | ------------------------------------ |
| `times`                   | `Record<string, string>` | Time names mapped to payload paths.  |
| `values`                  | `Record<string, string>` | Value names mapped to payload paths. |

[Acquisition and transforms](#timescopedataloaderoptions)

## Configuration

### TimescopeOptions

| Field        | Type                                                  | Default                  | Description                                                                                                                              |
| ------------ | ----------------------------------------------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `cursor?`    | `boolean \| { color?: string, borderColor?: string }` | `true`                   | Time cursor visibility; `color` sets the center line (default: `'red'`), `borderColor` sets the side borders (default: `'transparent'`). |
| `showFps?`   | `boolean`                                             | `false`                  | Frame-rate display.                                                                                                                      |
| `font?`      | `TimescopeFontStyle`                                  | —                        | Global text font.                                                                                                                        |
| `sources?`   | `TimescopeOptionsSources`                             | —                        | Named DataSource inputs.                                                                                                                 |
| `domains?`   | `TimescopeOptionsDomains`                             | —                        | Named value Domains.                                                                                                                     |
| `series?`    | `TimescopeOptionsSeries`                              | —                        | Named Series configurations.                                                                                                             |
| `tracks?`    | `TimescopeOptionsTracks`                              | Implicit `default` Track | Named drawing regions; an empty object is invalid.                                                                                       |
| `selection?` | `TimescopeOptionsSelection`                           | `true`                   | Selection interaction and overlay settings.                                                                                              |

Referenced DataSources, Tracks, and named Domains must exist. Omitting `tracks` creates an implicit `default` Track; an empty Track object is invalid.

[Guide](/guide/drawing-a-chart#basic-chart) · [Typed configuration](/api/utilities#definetimescopeoptions)

### TimescopeOptionsInitial

[TimescopeOptions](#timescopeoptions) · [Constructor](/api/classes#timescope-constructor)

| Field               | Type                                                                                                                                    | Default                  | Description                                                          | Constraint                                                                                |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `time?`             | `TimescopeTimeLike`                                                                                                                     | `null`                   | Initial selected time; `null` follows the clock.                     | Mutually exclusive with `fit`.                                                            |
| `zoom?`             | `TimescopeNumberLike`                                                                                                                   | `0`                      | Initial zoom level.                                                  | Mutually exclusive with `fit`.                                                            |
| `fit?`              | `TimescopeRange<TimescopeTimeLike<never>> \| { range: TimescopeRange<TimescopeTimeLike<never>>, padding?: number \| [number, number] }` | —                        | Initial fitted range and CSS-pixel padding; padding defaults to `0`. | Mutually exclusive with `time` and `zoom`; `start < end`; padding finite and nonnegative. |
| `timeRange?`        | `TimescopeRange<TimescopeTimeLike \| undefined>`                                                                                        | `[undefined, null]`      | Navigation bounds.                                                   | —                                                                                         |
| `zoomRange?`        | `TimescopeRange<TimescopeNumberLike \| undefined>`                                                                                      | `[undefined, undefined]` | Zoom bounds.                                                         | —                                                                                         |
| `target?`           | `TimescopeBackendTarget`                                                                                                                | —                        | Mount target; omit to mount later.                                   | —                                                                                         |
| `backend?`          | `TimescopeBackendChoice \| readonly TimescopeBackendChoice[]`                                                                           | Auto                     | Backend or ordered candidates.                                       | —                                                                                         |
| `renderThread?`     | `'worker' \| 'main'`                                                                                                                    | Auto                     | Rendering thread.                                                    | —                                                                                         |
| `environment?`      | `TimescopeEnvironment`                                                                                                                  | —                        | Canvas environment overrides.                                        | —                                                                                         |
| `fonts?`            | `(string \| { family: string, source: string \| BufferSource, desc?: FontFaceDescriptors })[]`                                          | Document fonts           | Additional browser font data; ignored by Skia Canvas.                | —                                                                                         |
| `wheelSensitivity?` | `number`                                                                                                                                | `200`                    | Wheel delta per zoom level.                                          | —                                                                                         |
| `selection.range?`  | `TimescopeRange<TimescopeTimeLike<never>> \| null`                                                                                      | `null`                   | Initial selected range.                                              | —                                                                                         |

`backend`, `renderThread`, and `fonts` are creation-only. Automatic backend selection normally uses Canvas in browsers and Skia Canvas in Node.js; an array selects the first compatible backend. Automatic thread selection can be overridden with `'main'` or `'worker'`; requiring a Worker needs Worker support and a compatible target. `fonts: []` disables additional font loading; omitted `fonts` loads accessible document `@font-face` rules.

[View control](/guide/getting-started#view-control) · [Fonts](/guide/advanced/styling#fonts) · [Node.js](/guide/advanced/running-on-node)

### TimescopeUpdateOptions

| Field        | Type                                                                                                               |
| ------------ | ------------------------------------------------------------------------------------------------------------------ |
| `cursor?`    | `TimescopeOptions['cursor']`                                                                                       |
| `showFps?`   | `boolean`                                                                                                          |
| `font?`      | `TimescopeFontStyle`                                                                                               |
| `sources?`   | `Record<string, TimescopeSourceInput \| null>`                                                                     |
| `domains?`   | `Record<string, TimescopeDomainOptions \| null>`                                                                   |
| `series?`    | `Record<string, TimescopeSeriesInput \| null>`                                                                     |
| `tracks?`    | `Record<string, { height?: number, symmetric?: boolean, timeAxis?: boolean \| TimescopeTimeAxisOptions } \| null>` |
| `selection?` | `TimescopeOptionsSelection`                                                                                        |

`updateOptions()` merges objects; arrays and source inputs replace their previous values. Named entries accept `null` for deletion. Remove dependent Series in the same update when deleting a source. `setOptions()` replaces the entire configuration, restoring defaults for omitted settings. Both preserve time and zoom, and clear selection only when it is disabled.

[Update methods](/api/classes#timescope-methods)

### TimescopeSeriesInput

| Field                 | Type                                                                                                                                                                 |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `data.source`         | `string`                                                                                                                                                             |
| `data.name?`          | `string`                                                                                                                                                             |
| `data.color?`         | `string`                                                                                                                                                             |
| `data.domain?`        | `string \| TimescopeDomainOptions`                                                                                                                                   |
| `data.resolution?`    | `TimescopeDataResolution`                                                                                                                                            |
| `data.instantaneous?` | `false \| { using?: Using1, zoom?: number, resolution?: TimescopeNumberLike }`                                                                                       |
| `chart?`              | `TimescopeChartType \| { marks?: TimescopeChartMark[] \| ((context) => TimescopeChartMark[]), links?: TimescopeChartLink[] \| ((context) => TimescopeChartLink[]) }` |
| `tooltip?`            | `boolean \| { label?: string, side?: 'left' \| 'right', round?: TimescopeRound, format?: (context) => string }`                                                      |
| `track?`              | `string`                                                                                                                                                             |

[Chart callbacks](#chart-entries) · [Guide](/guide/concepts#series)

#### Instantaneous Values

| Field         | Type                  | Default   | Description                  |
| ------------- | --------------------- | --------- | ---------------------------- |
| `using?`      | `Using1`              | `'value'` | Value sampled at the cursor. |
| `zoom?`       | `number`              | —         | Sampling zoom level.         |
| `resolution?` | `TimescopeNumberLike` | —         | Sampling resolution.         |

[Guide](/guide/concepts#instantaneous-value)

The default sample is the latest row at or before the cursor, without interpolation. `zoom` or `resolution` chooses sampling granularity independently of the Chart. Set `data.instantaneous: false` or `tooltip: false` to disable cursor sampling.

#### Tooltip

| Field     | Type                                                                                                      | Default   | Description                                                        |
| --------- | --------------------------------------------------------------------------------------------------------- | --------- | ------------------------------------------------------------------ |
| `label?`  | `string`                                                                                                  | —         | Tooltip label override.                                            |
| `side?`   | `'left' \| 'right'`                                                                                       | `'right'` | Preferred label side relative to the sample.                       |
| `round?`  | `TimescopeRound`                                                                                          | —         | Number rounding and label format; omitted values remain unrounded. |
| `format?` | `(context: { time: Decimal, value: Decimal \| null, name: string \| undefined, unit: string }) => string` | —         | Complete tooltip formatter, overriding name, unit, and rounding.   |

[Guide](/guide/advanced/styling#tooltip-placement)

## Resolution

### TimescopeDataResolution

```ts
type TimescopeResolutionSnap = 'nearest' | 'floor' | 'ceil';
type TimescopeResolutionResolver = TimescopeNumberLike | ((context: TimescopeResolutionContext) => TimescopeNumberLike);
type TimescopeDataResolution =
  | TimescopeResolutionSnap
  | TimescopeResolutionResolver
  | { resolve?: TimescopeResolutionResolver; snap?: TimescopeResolutionSnap };
```

| Field      | Type                          | Default            | Description                                                 |
| ---------- | ----------------------------- | ------------------ | ----------------------------------------------------------- |
| `resolve?` | `TimescopeResolutionResolver` | Display resolution | Preferred data interval; resolved values must be positive.  |
| `snap?`    | `TimescopeResolutionSnap`     | `'nearest'`        | Snapping mode for source hints or integer-zoom resolutions. |

`'nearest'` snaps on the logarithmic zoom scale. `'floor'` chooses the largest interval at or below the preference; `'ceil'` chooses the smallest at or above it. Both clamp to the available endpoints. Source hints apply to range loaders, not snapshots, and do not restrict direct `query()` calls.

[Guide](/guide/advanced/chunk-loading#select-data-resolution)

#### Resolver context {#resolution-context}

| `TimescopeResolutionContext` field | Type                 | Description                                          |
| ---------------------------------- | -------------------- | ---------------------------------------------------- |
| `resolution`                       | `Decimal`            | Display time units per pixel, `2 ** (-zoom)`.        |
| `resolutions`                      | `readonly Decimal[]` | Preferred source resolutions; empty if unrestricted. |

## Formatting

### TimescopeRound

```ts
type TimescopeRoundMode = 'decimal' | 'pow10';
type TimescopeRoundLabel = 'decimal' | 'e' | 'pow10';
type TimescopeRound =
  | number
  | TimescopeRoundLabel
  | {
      mode?: TimescopeRoundMode;
      digits?: number;
      label?: TimescopeRoundLabel | ((context: TimescopeRoundContext) => string);
    };
```

| Shortcut       | Equivalent options                                 |
| -------------- | -------------------------------------------------- |
| `n` (`number`) | `{ mode: 'decimal', digits: n, label: 'decimal' }` |
| `'decimal'`    | `{ mode: 'decimal', digits: 2, label: 'decimal' }` |
| `'e'`          | `{ mode: 'pow10', digits: 2, label: 'e' }`         |
| `'pow10'`      | `{ mode: 'pow10', digits: 2, label: 'pow10' }`     |

[Guide](/guide/advanced/styling#number-formatting)

Object `mode` is inferred from a string `label`, otherwise it defaults to `'decimal'`; an omitted `label` uses the mode. `digits` must be a safe integer and cannot be negative in `'pow10'` mode. Incompatible mode/label pairs are rejected.

#### Formatter context {#round-context}

| `TimescopeRoundContext` field | Type                 | Description                                     |
| ----------------------------- | -------------------- | ----------------------------------------------- |
| `mode`                        | `TimescopeRoundMode` | Resolved rounding mode.                         |
| `value`                       | `Decimal`            | Original tooltip value or finalized axis value. |
| `roundedValue`                | `Decimal`            | Displayed value; equal to `value` on axes.      |
| `mantissa`                    | `string`             | Signed, formatted mantissa.                     |
| `base`                        | `10`                 | Exponent base.                                  |
| `exponent`                    | `bigint`             | Decimal exponent; `0n` in decimal mode.         |

## Charts and Styles

### Using

```ts
type UsingElement<V extends [string, string]> =
  | `${V[1] | '#zero' | '#top' | '#bottom'}@${V[0]}`
  | (V[1] | '#zero' | '#top' | '#bottom')
  | `@${V[0]}`;
type Using1<V extends [string, string]> = UsingElement<V> | [UsingElement<V>];
type Using2<V extends [string, string]> = [UsingElement<V>, UsingElement<V>];
type Using<V extends [string, string] = [string, string]> = Using1<V> | Using2<V>;
```

| Form                  | Value            | Time    |
| --------------------- | ---------------- | ------- |
| `'value@time'`        | `value`          | `time`  |
| `'value'`             | `value`          | Default |
| `'@start'`            | Default          | `start` |
| `['min', 'max']`      | `min`, `max`     | Default |
| `'#zero'`             | Shared baseline  | Default |
| `'#top'`, `'#bottom'` | Chart-area edges | Default |
| `'value#avg'`         | `value#avg`      | Default |

| Primitive                      | Default `using`      |
| ------------------------------ | -------------------- |
| Single-coordinate Mark / Link  | `'value@time'`       |
| `line`, `bar`, `section` Marks | `['min', 'max']`     |
| Area Links                     | `['value', '#zero']` |

[Guide](/guide/concepts#using-selectors)

### TimescopeChartType

| Preset                | Marks                       | Links        | `:filled` variant |
| --------------------- | --------------------------- | ------------ | ----------------- |
| `'lines'`             | —                           | `line`       | `area`            |
| `'curves'`            | —                           | `curve`      | `curve-area`      |
| `'steps-start'`       | —                           | `step-start` | `step-area-start` |
| `'steps'`             | —                           | `step`       | `step-area`       |
| `'steps-end'`         | —                           | `step-end`   | `step-area-end`   |
| `'points'`            | `circle`                    | —            | —                 |
| `'linespoints'`       | `circle`                    | `line`       | `area`            |
| `'curvespoints'`      | `circle`                    | `curve`      | `curve-area`      |
| `'stepspoints-start'` | `circle`                    | `step-start` | `step-area-start` |
| `'stepspoints'`       | `circle`                    | `step`       | `step-area`       |
| `'stepspoints-end'`   | `circle`                    | `step-end`   | `step-area-end`   |
| `'impulses'`          | `line` to `#zero`           | —            | —                 |
| `'impulsespoints'`    | `line` to `#zero`, `circle` | —            | —                 |
| `'bars'`              | `bar` to `#zero`            | —            | Bar fill          |

[Preset guide](/guide/drawing-a-chart#chart-presets) · [Custom Charts](/guide/advanced/styling#marks-and-links)

### TimescopeChartLink

| `draw`                                                | `using`  | Style                            |
| ----------------------------------------------------- | -------- | -------------------------------- |
| `'line'`, `'curve'`                                   | `Using1` | [Stroke](#stroke-and-fill)       |
| `'step-start'`, `'step'`, `'step-end'`                | `Using1` | [Stroke](#stroke-and-fill)       |
| `'area'`, `'curve-area'`                              | `Using2` | [Stroke, Fill](#stroke-and-fill) |
| `'step-area-start'`, `'step-area'`, `'step-area-end'` | `Using2` | [Stroke, Fill](#stroke-and-fill) |

[Entry fields and callback context](#chart-entries)

### TimescopeChartMark

| `draw`                                          | `using`  | Style                                                                   |
| ----------------------------------------------- | -------- | ----------------------------------------------------------------------- |
| `'circle'`                                      | `Using1` | [Stroke, Fill](#stroke-and-fill), [Size, Offset](#mark-geometry)        |
| `'triangle'`, `'square'`, `'diamond'`, `'star'` | `Using1` | [Stroke, Fill](#stroke-and-fill), [Size, Angle, Offset](#mark-geometry) |
| `'cross'`, `'plus'`, `'minus'`                  | `Using1` | [Stroke](#stroke-and-fill), [Size, Angle, Offset](#mark-geometry)       |
| `'line'`, `'section'`                           | `Using2` | [Stroke](#stroke-and-fill), [Size, Offset](#mark-geometry)              |
| `'bar'`                                         | `Using2` | [Stroke, Fill](#stroke-and-fill), [Size, Box, Offset](#mark-geometry)   |
| `'region'`                                      | `Using2` | [Stroke, Fill](#stroke-and-fill), [Box](#mark-geometry)                 |
| `'text'`                                        | `Using1` | [Text](#text-and-icons), [Size, Angle, Offset](#mark-geometry)          |
| `'icon'`                                        | `Using1` | [Icon](#text-and-icons), [Size, Angle, Offset](#mark-geometry)          |
| `'path'`                                        | `Using1` | [Path, Size, Angle, Offset](#mark-geometry)                             |

[Entry fields and callback context](#chart-entries)

### Chart entries {#chart-entries}

| `TimescopeChartStyleEntry` field | Type                         | Description                                                                                      | Callback form        |
| -------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------ | -------------------- |
| `draw`                           | `string`                     | Primitive name; determines supported coordinates and styles.                                     | `(context) => value` |
| `using?`                         | `Using1 \| Using2`           | Coordinate selectors for the primitive.                                                          | `(context) => value` |
| `style?`                         | [Chart style](#chart-styles) | Drawing style; individual fields also accept callbacks except `origin`, `scale`, and `fillPost`. | `(context) => value` |

| Callback | Context                                                                                                           |
| -------- | ----------------------------------------------------------------------------------------------------------------- |
| Mark     | `{ times: Record<string, Decimal>, values: Record<string, Decimal \| null>, data: unknown, resolution: Decimal }` |
| Link     | `{ resolution: Decimal }`                                                                                         |

[Guide](/guide/advanced/styling#data-driven-styles)

### Chart styles {#chart-styles}

#### Stroke and fill {#stroke-and-fill}

| `StrokeStyle` / `FillStyle` field | Type       | Default |
| --------------------------------- | ---------- | ------- |
| `lineWidth?`                      | `number`   | `1`     |
| `lineColor?`                      | `string`   | —       |
| `lineDashArray?`                  | `number[]` | —       |
| `lineDashOffset?`                 | `number`   | —       |
| `fillColor?`                      | `string`   | —       |
| `fillOpacity?`                    | `number`   | `1`     |
| `fillPost?`                       | `boolean`  | `false` |

[Guide](/guide/advanced/styling#drawing-colors)

`fillOpacity` is clamped to `0`–`1`.

#### Geometry {#mark-geometry}

| Field      | Type                                                                      | Unit |
| ---------- | ------------------------------------------------------------------------- | ---- |
| `size?`    | `number`                                                                  | px   |
| `angle?`   | `number`                                                                  | deg  |
| `offset?`  | `[x: number, y: number]`                                                  | px   |
| `extrude?` | `number \| [top: number, right?: number, bottom?: number, left?: number]` | px   |
| `radius?`  | `number`                                                                  | px   |
| `path?`    | `string`                                                                  | SVG  |
| `origin?`  | `[number, number]`                                                        | —    |
| `scale?`   | `number`                                                                  | —    |

#### Text and icons {#text-and-icons}

| `TextStyle` field   | `IconStyle` field   | Type                                                                          |
| ------------------- | ------------------- | ----------------------------------------------------------------------------- |
| `text?`             | `icon?`             | `string`                                                                      |
| `font?`             | `font?`             | `TimescopeFontStyle`                                                          |
| `textAlign?`        | `iconAlign?`        | `'start' \| 'center' \| 'end' \| 'left' \| 'right'`                           |
| `textBaseline?`     | `iconBaseline?`     | `'top' \| 'middle' \| 'bottom' \| 'hanging' \| 'alphabetic' \| 'ideographic'` |
| `textColor?`        | `iconColor?`        | `string`                                                                      |
| `textOpacity?`      | `iconOpacity?`      | `number`                                                                      |
| `textOutline?`      | `iconOutline?`      | `boolean`                                                                     |
| `textOutlineColor?` | `iconOutlineColor?` | `string`                                                                      |
| `textOutlineWidth?` | `iconOutlineWidth?` | `number`                                                                      |

### TimescopeFontStyle

```ts
type TimescopeFontStyle =
  | string
  | {
      style?: string;
      variant?: string;
      weight?: string;
      stretch?: string;
      size?: number | string;
      lineHeight?: number | string;
      family?: string;
    };
```

Object properties inherit from local settings, then global settings, then location defaults. A local string replaces the global font; local objects inherit defaults rather than properties from a global string. Icon fonts use local settings only. Numeric `size` is in pixels; numeric `lineHeight` is unitless. String sizes and line heights use CSS syntax.

Text Mark size priority: local string font → local object `font.size` → Mark `style.size` → global object `font.size` → default. A global string is used unchanged when neither a local font nor an explicit Mark size is set.

[Guide](/guide/advanced/styling#fonts)

## Layout and Axes

### TimescopeOptionsTracks

```ts
type TimescopeOptionsTracks<Track extends string> = {
  [K in Track]: {
    height?: number;
    symmetric?: boolean;
    timeAxis?: boolean | TimescopeTimeAxisOptions;
  };
};
```

[Guide](/guide/concepts#tracks)

### TimescopeTimeAxisOptions

| Field         | Type                                                     | Default   |
| ------------- | -------------------------------------------------------- | --------- |
| `axis?`       | `false \| { color?: string }`                            | —         |
| `ticks?`      | `false \| { color?: string }`                            | —         |
| `labels?`     | `false \| { color?: string, font?: TimescopeFontStyle }` | —         |
| `relative?`   | `boolean`                                                | `false`   |
| `timeFormat?` | `TimeFormatFunc \| TimeFormatLabeler`                    | —         |
| `timeUnit?`   | `'s' \| 'ms' \| 'us' \| 'ns'`                            | `'s'`     |
| `timeZone?`   | `string`                                                 | `'local'` |

[Guide](/guide/advanced/styling#time-axis-labels)

#### Time formatting {#time-formatting}

```ts
type CalendarLevel = 'subsecond' | 'second' | 'minute' | 'hour' | 'day' | 'month' | 'year' | 'relative';
type TimeFormatFunc = (context: TimeFormatFuncOptions) => string | undefined;
```

| `TimeFormatFuncOptions` field | Type                          |
| ----------------------------- | ----------------------------- |
| `time`                        | `Decimal`                     |
| `unit`                        | `'s' \| 'ms' \| 'us' \| 'ns'` |
| `level`                       | `CalendarLevel`               |
| `digits`                      | `number`                      |
| `stride?`                     | `bigint`                      |

| `TimeFormatLabeler` field                                      | Type                                            |
| -------------------------------------------------------------- | ----------------------------------------------- |
| `year?`, `month?`, `quarter?`, `date?`, `minutes?`, `seconds?` | `(context: TimeFormatLabelerOptions) => string` |

| `TimeFormatLabelerOptions` field                      | Type      |
| ----------------------------------------------------- | --------- |
| `year`, `second`                                      | `bigint`  |
| `quarter`, `month`, `day`, `hour`, `minute`, `digits` | `number`  |
| `week`                                                | `number`  |
| `time`, `subseconds`                                  | `Decimal` |

[Guide](/guide/advanced/styling#time-axis-labels)

### TimescopeOptionsSelection

```ts
type TimescopeOptionsSelection =
  | boolean
  | {
      resizable?: boolean;
      color?: string;
      invert?: boolean;
    };
```

| Field        | Type      | Default | Description                                      |
| ------------ | --------- | ------- | ------------------------------------------------ |
| `resizable?` | `boolean` | `true`  | Enables Shift-drag creation and handle resizing. |
| `color?`     | `string`  | —       | Selected-range overlay color.                    |
| `invert?`    | `boolean` | —       | Shades outside the selected range.               |

Selection is enabled by default. `false` disables selection and clears its range; `true` restores default settings. `resizable: false` disables Shift-drag creation and handle resizing without clearing an existing selection. Set the initial range with constructor `selection.range`, or use the range methods after creation.

[Range methods](/api/classes#timescope-methods) · [Component range](/api/frameworks#props)

### TimescopeDomainOptions

| Field          | Type                                                                                                                                                                                                   | Default    |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| `scale?`       | `'linear' \| 'linear-symmetric' \| 'log'`                                                                                                                                                              | `'linear'` |
| `axis?`        | `boolean \| 'left' \| 'right' \| TimescopeYAxisOptions`                                                                                                                                                | `false`    |
| `animation?`   | `boolean`                                                                                                                                                                                              | `true`     |
| `range?`       | `TimescopeNumberLike \| TimescopeRange<TimescopeNumberLike \| undefined> \| { expand?: boolean, shrink?: boolean, default?: TimescopeNumberLike \| TimescopeRange<TimescopeNumberLike \| undefined> }` | —          |
| `expand?`      | `boolean`                                                                                                                                                                                              | `false`    |
| `shrink?`      | `boolean`                                                                                                                                                                                              | `true`     |
| `floatingGap?` | `number`                                                                                                                                                                                               | `20` px    |
| `unit?`        | `string`                                                                                                                                                                                               | `''`       |

[Guide](/guide/concepts#auto-scaling)

An `undefined` range endpoint follows visible data; a scalar range means `[0, value]`. Top-level `expand` and `shrink` override the corresponding fields inside `range`. Logarithmic Domains draw positive values only and require positive specified bounds. `unit` appears in Tooltips and value-axis labels.

### TimescopeYAxisOptions

| Field    | Type                 |
| -------- | -------------------- |
| `side?`  | `'left' \| 'right'`  |
| `label?` | `string`             |
| `round?` | `TimescopeRound`     |
| `color?` | `string`             |
| `font?`  | `TimescopeFontStyle` |

[Guide](/guide/advanced/styling#number-formatting)

## Rendering

### Rendering targets {#rendering-targets}

```ts
type TimescopeBackendChoice = 'canvas' | 'skia-canvas';
type TimescopeBackendTarget = Element | string | TimescopeCanvas;
```

| `TimescopeCanvas` member | Type                      |
| ------------------------ | ------------------------- |
| `width`, `height`        | `number`                  |
| `getContext`             | `(type: '2d') => unknown` |

Container and selector targets are sized automatically; Timescope creates and owns their canvas. Supplied canvases retain application ownership and use explicit `resize(width, height, dpr)`. Omit constructor `target` to mount later. The mounted `canvas` property is `null` while unmounted.

[Node.js guide](/guide/advanced/running-on-node)

### TimescopeEnvironment

| Field                    | Type                                       |
| ------------------------ | ------------------------------------------ |
| `requestAnimationFrame?` | `(callback: () => void) => number \| void` |
| `cancelAnimationFrame?`  | `(handle: number) => void`                 |
| `Path2D?`                | `new (path?: string) => Path2D`            |
| `fonts?`                 | `FontFaceSet`                              |
