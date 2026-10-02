# Core Concepts

Timescope is a time-series visualizer with time navigation controls.

- **Infinite by design** — unlimited range and precision with [Decimal](/api/classes#decimal).
- **Shared time** — keeps overlaid Charts and separate Tracks temporally aligned.
- **Independent Marks and Links** — composable shapes and connections.

## Time, Zoom, and Resolution {#time-and-zoom}

**Time** is the selected time, marked by the time cursor at the center of the view. **Display resolution** is the time span per pixel. Together they determine the visible time range.

**Zoom level** is a logarithmic expression of display resolution:

$$
\mathit{resolution} = 2^{-\mathit{zoom}}
$$

At zoom `0`, one pixel spans one time unit. Increasing zoom by one halves the display resolution and the visible time span.

Timescope uses [Decimal](/api/classes#decimal) as a common numeric representation for time, values, and resolutions, preserving precision across widely different scales.

`time = null` follows the clock (the wall clock by default); the property remains `null`, not the current timestamp. `timeRange` bounds navigation, and `zoomRange` bounds the zoom level.

![Time centers the visible range; zoom expresses its resolution, with navigation bounded by timeRange and zoomRange](./assets/time-zoom.svg)

## DataSources {#sources}

A **DataSource** provides rows for a requested time range and **data resolution**. Data resolution is a positive time interval describing the desired data granularity; it need not equal the display resolution.

### Canonical Rows

A **canonical row** contains named `times`, named `values`, and optional `data` metadata. An input such as `{ time: 15, value: 3 }` is normalized to fields named `time` and `value` in those maps.

![Coordinates of one row: a point, multiple values at one time, or a value spanning a time interval](./assets/row-anatomy.svg)

Equal times describe a point; different times describe the half-open interval from earliest to latest. Either can carry one or several values. Metadata does not define coordinates. See the [row types](/api/types#data-rows) for accepted inputs.

Provide exactly one of `time` or `times`, and exactly one of `value` or `values`, with at least one named time. Only simple DataSources support interval rows; aggregate and percentile DataSources accept points.

### DataLoader and DataSource

A **DataLoader** acquires input and normalizes it into canonical rows, either as a complete snapshot or for a requested range. A DataSource uses those rows to answer queries, optionally aggregating them. Acquisition does not change how Charts select row fields.

![A DataLoader acquires canonical rows; a DataSource answers Series requests by range and resolution](./assets/data-pipeline.svg)

For loading callbacks, query requirements, and invalidation, see [Loading and Updating Data](/guide/advanced/data).

## Series

A **Series** brings together data from a DataSource, a value Domain, and shared attributes such as its name and color. **Charts** and **Tooltips**, for example, are consumers of this information. Several Series can share a DataSource while using different Domains or presentation attributes.

![Example Series consumers: Charts use series data and Tooltips use instantaneous values](./assets/series-consumers.svg)

### Instantaneous Value

A Series also provides an **[instantaneous value](/api/types#instantaneous-values)** sampled at the time cursor. By default, it reads `value` from the latest row at or before the cursor, without interpolating drawn connections. Its sampling resolution can differ from the Chart's data resolution, allowing a Tooltip to show detailed values alongside a broader Chart view.

Use `data.instantaneous.using` to choose a value, and `zoom` or `resolution` to choose sampling granularity. Set `data.instantaneous: false` to disable cursor sampling; `tooltip: false` also disables it.

![A Series samples an instantaneous value at the time cursor, which a Tooltip can display alongside a broader Chart view](./assets/instantaneous-value.svg)

## Tracks

A **[Track](/api/types#timescopeoptionstracks)** provides a drawing region for Series consumers such as Charts and Tooltips. Tracks stack vertically, while Charts on the same Track are overlaid. All Tracks share time and display resolution, preserving temporal alignment across separate drawing regions.

Set a Track's `height` for a fixed CSS-pixel height or `symmetric: true` to mirror positive and negative chart space. Hiding its time axis does not remove the `#zero` baseline.

![Charts overlay within a Track; vertically stacked Tracks share time and display resolution](./assets/tracks.svg)

## Charts

A **Chart** visualizes the data of a Series using Marks and Links.

### Marks and Links

**Marks** draw individual rows. **Links** connect consecutive rows. A Chart can combine any number of either independently. [Chart presets](/api/types#timescopecharttype) are combinations of these same primitives, so preset and custom Charts share one model.

![Circle marks, a line link, and an area link compose a chart](./assets/marks-and-links.svg)

### `using` selectors {#using-selectors}

A [`using` selector](/api/types#using) binds a primitive to the row's fields: a time supplies the horizontal coordinate and a value supplies the vertical coordinate. Different primitives can select different fields from the same row, without changing the row's time range.

Primitives take one or two coordinates, each defined by a time and a value. They can also refer to the Track's [shared baseline](#shared-baseline) (`#zero`) or its chart-area edges (`#top`, `#bottom`).

![Selecting coordinates from row fields or Track baseline and chart-area references](./assets/using-selectors.svg)

## Domains

A **[Domain](/api/types#timescopedomainoptions)** determines how values map to vertical positions through a scale and range. A value axis is an optional display of that mapping; a Domain works without one.

Each Series has its own Domain unless it shares one explicitly. Inline Domain settings belong to that Series, so auto-scaled Series can have different ranges even on the same Track. Equal heights need not mean equal values. Sharing a Domain gives Series a common scale and range, independently of their Track.

![Independent Domains can place different values at equal heights; a shared Domain gives Series a common scale, without requiring a visible value axis](./assets/domains.svg)

### Shared Baseline

Each Track has a **shared baseline** — the position where its time axis is drawn when enabled — referenced by `#zero`. Linear Domains that include zero align it there, even with different scales. Bars and areas can use this common reference without sharing a Domain.

![Two independently scaled Domains align zero to the same Track baseline](./assets/shared-baseline.svg)

### Floating Ranges

A range away from zero can **float** above or below the shared baseline, magnifying local differences. A [**`floatingGap`**](/api/types#timescopedomainoptions) separates the range from the baseline; bars and areas extending to the baseline fade through it.

![A zero-inclusive linear range reaches the shared baseline; a floating positive range magnifies local differences and fades toward the baseline across a gap](./assets/domain-floating.svg)

### Auto Scaling

A Domain can follow visible data. Unspecified bounds adjust automatically; [**`expand`** and **`shrink`**](/api/types#timescopedomainoptions) control whether the range can grow beyond specified bounds and contract again.

An `undefined` range endpoint follows visible data. A scalar `range` means `[0, value]`. Use `range: { default, expand, shrink }` to group these settings, or set `expand` and `shrink` at the Domain's top level, where they take precedence. Domain `animation` controls range transitions, and `unit` appears on Tooltips and value-axis labels.

![With a default range of zero to ten, expand allows wider data to enlarge the range, while shrink controls whether it contracts again](./assets/domain-auto-scaling.svg)

## Next steps

Follow [Drawing a Chart](/guide/drawing-a-chart) to turn these concepts into code, then explore more combinations in the [Examples](/examples/gallery).
