# Core Concepts

Timescope is a time-series visualizer with time navigation controls.

- **Infinite by design** — unlimited range and precision with [Decimal](/api/decimal).
- **Chunk loading** — loads data efficiently.
- **Independent marks and links** — composable shapes and connections.

## Time, Zoom, and Resolution {#time-and-zoom}

**Time** is the selected time, marked by the time cursor at the center of the view. **Resolution** is the time span per pixel. Together they determine the visible time window.

**Zoom level** is a convenient logarithmic expression of resolution:

$$
\mathit{resolution} = 2^{-\mathit{zoom}}
$$

At zoom `0`, one pixel spans one time unit. Increasing zoom by one halves the resolution and the visible time span.

Timescope uses [Decimal](/api/decimal) as a common numeric representation for time, values, and resolutions, preserving precision across widely different scales.

`time = null` means the current time, so the view follows the live clock. `timeRange` bounds the navigable time, and `zoomRange` bounds the zoom level.

![Time centers the visible range; zoom expresses its resolution, with navigation bounded by timeRange and zoomRange](./assets/time-zoom.svg)

## DataSources {#sources}

A **DataSource** provides rows for an arbitrary time range and positive resolution.

### DataLoader and DataSource

A **DataLoader** acquires input and converts it into a common row format. It can load a complete snapshot or acquire requested ranges. A DataSource can use a DataLoader for acquisition while controlling how it produces the requested rows.

![A DataLoader acquires canonical rows; a DataSource answers Series requests by range and resolution](./assets/data-pipeline.svg)

#### Range Loader

A [range-based loader](/api/timescope-options#range-loader) accepts an arbitrary time range and positive resolution. It returns complete rows intersecting the range.

The loader **SHOULD** return **extra rows** needed for connections — one on each side for a straight line, two for a curve, as available — even when the range contains no points. For example, a very narrow request can return only the surrounding rows.

![A loader returns rows intersecting the requested range together with extra rows needed for connections](./assets/query-context.svg)

### Canonical Rows

A **canonical row** is a record in this common format: named times, named values, and optional metadata. DataSources and their consumers work with these records regardless of the original input format.

![Coordinates of one row: a point, multiple values at one time, or a value spanning a time interval](./assets/row-anatomy.svg)

In an input row, equal times describe a point; different times describe the interval from earliest to latest. Either can carry one or several values. Metadata accompanies the row without defining its coordinates.

## Series

A **Series** brings together data from a DataSource, a value Domain, and shared attributes such as its name and color. **Charts** and **Tooltips**, for example, are consumers of this information. Several Series can share a DataSource while using different Domains or presentation attributes.

![Example Series consumers: Charts use series data and Tooltips use instantaneous values](./assets/series-consumers.svg)

### Chunk Loading

For a Series, the display resolution and the DataSource's resolution hints guide the requested [data resolution](/api/timescope-options#resolution), which may differ from the display resolution.

At that resolution, the timeline is divided into chunks of width **`chunkSize × resolution`**, anchored to **`chunkOrigin`**. The visible range selects the chunks to request. Each selected chunk is queried from the DataSource using its full time range and the chosen resolution. These display requests share cached results for the same DataSource.

![Chunks aligned to chunkOrigin; the visible range selects full chunks to query at the chosen resolution](./assets/chunk-loading.svg)

### Instantaneous Value

A Series also provides an **[instantaneous value](/api/timescope-options#instantaneous-values)** — a value sampled at the time cursor. It can use its own sampling resolution, allowing detailed values to be read alongside a broader view of the series. A Tooltip consumes this value to display information at the cursor.

![A Series samples an instantaneous value at the time cursor, which a Tooltip can display alongside a broader Chart view](./assets/instantaneous-value.svg)

## Charts

A **Chart** visualizes the data of a Series using marks and links.

### Marks and Links

**Marks** draw individual rows. **Links** connect consecutive rows. A Chart can combine any number of either independently. [Chart presets](/api/timescope-options#chart-presets) are combinations of these same primitives, so preset and custom Charts share one model.

![Circle marks, a line link, and an area link compose a chart](./assets/marks-and-links.svg)

### `using` specifier {#using-selectors}

The [`using` specifier](/api/timescope-options#using-selectors) binds a primitive to the row's fields: a time supplies the horizontal coordinate and a value supplies the vertical coordinate. Different primitives can select different fields from the same row; this selects drawing coordinates without changing the row's time range.

Primitives take one or two positions, each defined by a time and a value. They can also refer to the Track's shared baseline (`#zero`) or the edges of its chart area (`#top`, `#bottom`).

![Selecting coordinates from row fields or Track baseline and chart-area references](./assets/using-selectors.svg)

## Tracks

A **[Track](/api/timescope-options#tracks)** provides a drawing region for Series consumers such as Charts and Tooltips. Tracks stack vertically, while Charts on the same Track are overlaid. All Tracks share time and display resolution, preserving temporal alignment across separate drawing regions.

![Charts overlay within a Track; vertically stacked Tracks share time and display resolution](./assets/tracks.svg)

## Domains

A **[Domain](/api/timescope-options#domains)** determines how values map to vertical positions through a scale and range. A value axis is an optional display of that mapping; a Domain works without one.

Each Series has its own Domain unless it shares one explicitly. Inline Domain settings belong to that Series, so auto-scaled Series can have different ranges even on the same Track. Equal heights need not mean equal values. Sharing a Domain gives Series a common scale and range, independently of their Track.

![Independent Domains can place different values at equal heights; a shared Domain gives Series a common scale, without requiring a visible value axis](./assets/domains.svg)

### Shared Baseline

Each Track has a **shared baseline** — the position where its time axis is drawn when enabled — referenced by `#zero`. Linear Domains that include zero align it there, even with different scales. Bars and areas can use this common reference without sharing a Domain.

![Two independently scaled Domains align zero to the same Track baseline](./assets/shared-baseline.svg)

### Floating Ranges

A range away from zero can **float** above or below the shared baseline, magnifying local differences. A [**`floatingGap`**](/api/timescope-options#domains) separates the range from the baseline; bars and areas extending to the baseline fade through it.

![A zero-inclusive linear range reaches the shared baseline; a floating positive range magnifies local differences and fades toward the baseline across a gap](./assets/domain-floating.svg)

### Auto Scaling

A Domain can follow visible data. Unspecified bounds adjust automatically; [**`expand`** and **`shrink`**](/api/timescope-options#domains) control whether the range can grow beyond specified bounds and contract again.

![With a default range of zero to ten, expand allows wider data to enlarge the range, while shrink controls whether it contracts again](./assets/domain-auto-scaling.svg)

## Next steps

See these concepts in action in the [Examples](/guide/examples/).
