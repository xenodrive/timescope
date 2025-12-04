# Timescope Options

Reference for `TimescopeOptions` used by `new Timescope(options?)`, `setOptions()`, and `updateOptions()`.

Constructor-only fields are listed in [Timescope](/api/timescope#options). The following keys are configurable via `TimescopeOptions`, `setOptions()`, and `updateOptions()`:

| Key | Type | Description |
|-----|------|-------------|
| `style` | `{ width?, height?, background? }` | Canvas sizing and background. |
| `padding` | `number[]` | Canvas padding `[top, right, bottom, left]`. |
| `indicator` | `boolean` | Show cursor indicator. (default: true) |
| `showFps` | `boolean` | Show FPS overlay. |
| `sources` | `{ [name: string]: ... }` | Data providers (see [Sources](#sources)). |
| `series` | `{ [name: string]: ... }` | Series configuration (see [Series](#series)). |
| `tracks` | `{ [name: string]: ... }` | Track layout (see [Track configuration](#track-configuration)). |
| `selection` | `boolean \| SelectionOptions` | Selection overlay (see [Selection](#selection)). |

## Sources

| Type | Description |
|------|-------------|
| `Array`, `{ data }` | Inline data array. |
| `string`, `{ url }` | URL to JSON endpoint. |
| `function`, `{ loader }` | Async loader `(chunk, api) => Promise<data>`. |

Options:
- `chunkSize` — Horizontal span in pixels (default: 256).
- `zoomLevels` — Data zoom levels. When specified, data is requested only at these discrete zoom levels.

>[!WARNING]
>When `zoomLevels` is configured, consider setting `zoomRange` to prevent excessive requests.

### URL string

URL strings support the following placeholders:

- `{z}` / `{zoom}` — Zoom level.
- `{r}` / `{resolution}` — Time units per pixel.
- `{s}` / `{start}` — Start time of chunk.
- `{e}` / `{end}` — End time of chunk.

URLs containing placeholders trigger chunk-based loading. URLs without placeholders are fetched once for the entire dataset.

### Loader signature

```TypeScript
(chunk, api) => Promise<data | Response>
```

Arguments:
- `chunk.range` — `[start, end]` time range.
- `chunk.resolution` — Time units per pixel.
- `chunk.zoom` — Zoom level.
- `api.expiresAt(Date)` —  Set cache expiry (absolute).
- `api.expiresIn(ms)` — Set cache expiry (relative).

Return data or Response. `null` for no data.

## Series

```TypeScript
series: {
  humidity: {
    data: {
      source: 'sensor',
      parser?: (rows) => rows,
      time?: string | {...},
      value?: string | {...},
      name?: string,
      unit?: string,
      digits?: number,
      color?: string,
      range?: number | [number, number] | { auto?: boolean; default?: [number, number] },
      instantaneous?: { using?: string | string[]; zoom?: number },
    },
    chart?: 'lines' | 'linespoints:filled' | ... | {
      marks?: [...],
      links?: [...],
    },
    tooltip?: boolean | { label?: string; format?: () => string },
    yAxis?: 'left' | 'right' | { side?: 'left' | 'right'; label?: string },
    track?: string,
  },
}
```

| Key | Type | Description |
|-----|------|-------------|
| `data.source` | `string` | Source name from `options.sources`. |
| `data.parser` | `(rows) => any[]` | Transform raw data. Must return an array. Optional when data structure matches expected format. |
| `data.time` | `string \| { start: string; end?: string }` | Map rows to time fields. Defaults to `'time'`. |
| `data.value` | `string \| { value: string; min?: string; max?: string }` | Map rows to numeric fields. Defaults to `'value'`. |
| `data.name` | `string` | Series display name. |
| `data.unit` | `string` | Unit label for tooltips. |
| `data.digits` | `number` | Decimal places for tooltip values. |
| `data.color` | `string` | Base color for marks/links. |
| `data.range` | `number \| [number, number] \| { auto?: boolean; default?: [number, number] }` | Value range; number sets symmetric ±range. |
| `data.instantaneous` | `{ using?: string \| string[]; zoom?: number }` | Cursor sampling config. |
| `chart` | `'lines' \| ... \| { marks?: any[]; links?: any[] }` | Preset string or custom chart object. |
| `chart.marks` | `Mark[]` | Visual marks per sample (`circle`, `box`, `text`, etc.). |
| `chart.links` | `Link[]` | Connections between samples (`line`, `area`, etc.). |
| `tooltip` | `boolean \| { label?: string; format?: () => string }` | Enable/disable tooltip and override label or formatter. |
| `yAxis` | `'left' \| 'right' \| { side?: 'left' \| 'right'; label?: string }` | <s>Position or label the per-series Y-axis.</s> <span style="color: #f00">Not implemented yet.</span> |
| `track` | `string` | Target track name. |

### Chart Presets

| Preset | Description |
|--------|-------------|
| `'lines'` | Line chart. |
| `'lines:filled'` | Line chart with filled area below. |
| `'steps-start'` | Step chart (step before point). |
| `'steps-start:filled'` | Step chart filled (step before point). |
| `'steps'` | Step chart (step at midpoint). |
| `'steps:filled'` | Step chart filled (step at midpoint). |
| `'steps-end'` | Step chart (step after point). |
| `'steps-end:filled'` | Step chart filled (step after point). |
| `'points'` | Scatter plot (circles only). |
| `'linespoints'` | Line chart with circles. |
| `'linespoints:filled'` | Line chart with circles and filled area. |
| `'stepspoints-start'` | Step chart with circles (step before point). |
| `'stepspoints-start:filled'` | Step chart with circles and fill (step before point). |
| `'stepspoints'` | Step chart with circles (step at midpoint). |
| `'stepspoints:filled'` | Step chart with circles and fill (step at midpoint). |
| `'stepspoints-end'` | Step chart with circles (step after point). |
| `'stepspoints-end:filled'` | Step chart with circles and fill (step after point). |
| `'impulses'` | Vertical lines from baseline to value. |
| `'impulsespoints'` | Vertical lines with circles at endpoints. |

### Links

| `draw` | `using` | Description | Style |
|--------|---------|-------------|-------|
| `'line'` | Single value | Line connecting points | Stroke |
| `'curve'` | Single value | Monotone cubic line | Stroke |
| `'step'` | Single value | Step at midpoint | Stroke |
| `'step-start'` | Single value | Step before point | Stroke |
| `'step-end'` | Single value | Step after point | Stroke |
| `'area'` | Two values `[min, max]` | Filled area between values | Stroke + Fill |
| `'curve-area'` | Two values `[min, max]` | Monotone cubic area | Stroke + Fill |
| `'step-area'` | Two values `[min, max]` | Step area (midpoint) | Stroke + Fill |
| `'step-area-start'` | Two values `[min, max]` | Step area (before point) | Stroke + Fill |
| `'step-area-end'` | Two values `[min, max]` | Step area (after point) | Stroke + Fill |

### Marks

| `draw` | `using` | Description | Style |
|--------|---------|-------------|-------|
| `'circle'` | Single value | Circle at point | Stroke + Fill + Size + Angle + Offset |
| `'triangle'` | Single value | Triangle at point | Stroke + Fill + Size + Angle + Offset |
| `'square'` | Single value | Square at point | Stroke + Fill + Size + Angle + Offset |
| `'cross'` | Single value | Cross mark | Stroke + Size + Angle + Offset |
| `'plus'` | Single value | Plus mark | Stroke + Size + Angle + Offset |
| `'minus'` | Single value | Horizontal line mark | Stroke + Angle + Offset |
| `'line'` | Two values `[start, end]` | Line segment between points | Stroke + Size + Offset |
| `'section'` | Two values `[start, end]` | Thick section between points | Stroke + Size + Offset |
| `'box'` | Two values `[min, max]` | Box spanning value range | Stroke + Fill + Size + Box + Offset |
| `'text'` | Single value | Text label | Text + Size + Angle + Offset |
| `'icon'` | Single value | Icon label | Icon + Size + Angle + Offset |

### Style options

**Stroke**

| Key | Type | Description |
|-----|------|-------------|
| `lineWidth?` | `number` | Line thickness in pixels. |
| `lineColor?` | `string` | Stroke color (CSS string). |
| `lineDashArray?` | `number[]` | Dash pattern (e.g., `[5,3]`). |
| `lineDashOffset?` | `number` | Dash offset in pixels. |

**Fill**

| Key | Type | Description |
|-----|------|-------------|
| `fillColor?` | `string` | Fill color (CSS string). |
| `fillOpacity?` | `number` | Opacity `0..1`. |

**Size**

| Key | Type | Description |
|-----|------|-------------|
| `size?` | `number` | Pixel size (meaning depends on primitive). |

**Angle**

| Key | Type | Description |
|-----|------|-------------|
| `angle?` | `number` | Rotation in radians. |

**Offset**

| Key | Type | Description |
|-----|------|-------------|
| `offset?` | `[number, number]` | Pixel offset `[x, y]`. |

**Box** (for `'box'`)

| Key | Type | Description |
|-----|------|-------------|
| `padding?` | `number \| [number, number?, number?, number?]` | Interior padding. |
| `radius?` | `number` | Corner radius in pixels. |

**Text** (for `'text'`)

| Key | Type | Description |
|-----|------|-------------|
| `text?` | `string` | Text content. |
| `fontFamily?` | `string` | Font family. |
| `fontWeight?` | `string` | Font weight. |
| `textAlign?` | `'start' \| 'center' \| 'end' \| 'left' \| 'right'` | Horizontal alignment. |
| `textBaseline?` | `'top' \| 'middle' \| 'bottom' \| 'hanging' \| 'alphabetic' \| 'ideographic'` | Vertical alignment. |
| `textColor?` | `string` | Text color. |
| `textOpacity?` | `number` | Opacity `0..1`. |
| `textOutline?` | `boolean` | Enable outline. |
| `textOutlineColor?` | `string` | Outline color. |
| `textOutlineWidth?` | `number` | Outline width in pixels. |

**Icon** (for `'icon'`)

| Key | Type | Description |
|-----|------|-------------|
| `icon?` | `string` | Icon glyph. |
| `iconFontFamily?` | `string` | Icon font family. |
| `iconFontWeight?` | `string` | Icon font weight. |
| `iconAlign?` | `'start' \| 'center' \| 'end' \| 'left' \| 'right'` | Horizontal alignment. |
| `iconBaseline?` | `'top' \| 'middle' \| 'bottom' \| 'hanging' \| 'alphabetic' \| 'ideographic'` | Vertical alignment. |
| `iconColor?` | `string` | Icon color. |
| `iconOpacity?` | `number` | Opacity `0..1`. |
| `iconOutline?` | `boolean` | Enable outline. |
| `iconOutlineColor?` | `string` | Outline color. |
| `iconOutlineWidth?` | `number` | Outline width in pixels. |

## Tracks

```TypeScript
tracks: {
  main: {
    height?: number,
    symmetric?: boolean,
    timeAxis?: boolean | {
      labels?: { color?: string; fontSize?: string },
      relative?: boolean,
      timeFormat?: (info) => string,
    },
  },
}
```

- `height` — Fixed height in pixels (leave undefined for auto).
- `symmetric` — Mirror positive/negative space.
- `timeAxis` — Show time axis (`true`, `false`, or config object).

## Selection

Enable range selection overlay:

```TypeScript
selection: true
```

Configure:

```TypeScript
selection: {
  resizable: true,
  color: '#3b82f6',
  invert: false,
  range: [start, end],
}
```

The `setSelection([start, end])` and `clearSelection()` methods control selection at runtime. Selection changes emit `rangechanging` and `rangechanged` events.

## See Also

- [Timescope](/api/timescope)
- [Chunk Loading](/guide/chunk-loading)
