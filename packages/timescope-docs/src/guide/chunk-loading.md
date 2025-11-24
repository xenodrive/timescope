# Chunk Loading

Timescope loads data chunks based on the visible time range and current zoom level.

## Define a loader

```TypeScript
import { Timescope } from 'timescope';

const timescope = new Timescope({
  sources: {
    metrics: {
      loader: async (chunk, api) => {
        api.expiresIn(30_000);
        const start = chunk.range[0]?.number() ?? 0;
        const end = chunk.range[1]?.number() ?? start + 60;
        return fetch(`/api/metrics?start=${start}&end=${end}`).then((r) => r.json());
      },
    },
  },
  series: {
    cpu: {
      data: {
        source: 'metrics',
        time: { start: 'window.start', end: 'window.end' },
        value: { value: 'usage' },
      },
    },
  },
});
```

## Loader parameters

- `chunk.range` — `[start, end]` time window (as `Decimal` values)
- `chunk.resolution` — Time units per pixel (as `Decimal`). Use this to determine appropriate data density for the current zoom level
- `api.expiresIn(ms)` — Set cache expiry

### Using resolution for sampling

The `resolution` parameter indicates the time units per pixel, which can be used to determine data point density:

```TypeScript
import { Decimal } from 'timescope';

const computeValue = (t: Decimal) => Math.sin(t.number());

loader: async (chunk) => {
  const start = chunk.range[0] ?? Decimal(0);
  const end = chunk.range[1] ?? start.add(Decimal(60));
  const resolution = chunk.resolution;  // Time units per pixel

  const rows = [];

  // Generate one data point per pixel worth of time
  for (let t = start; t.le(end); t = t.add(resolution)) {
    rows.push({
      time: t,
      value: computeValue(t),
    });
  }

  return rows;
}
```

When zoomed out, this generates fewer data points. When zoomed in, it generates more data points to match the pixel density.

## Options

Loader configuration options are defined in the source entry:

```TypeScript
sources: {
  metrics: {
    chunkSize: 256,           // Pixels per fetch (default: 256)
    zoomLevels: [-6, -2, 2],  // Optional: snap requests to specific zoom bands
    loader: async (chunk, api) => {
      api.expiresIn(60_000);  // Cache for 60 seconds on the client
      /* ... */
    },
  },
},
```

`chunkSize` and `zoomLevels` are configured in the source definition, while cache expiry is set in the loader function via `api.expiresIn()`.

## Next steps

- Review the [Dynamic Loader example](/guide/examples/dynamic-loader)
- Learn about [Series selectors](/api/timescope#using-selectors)
- See [Timescope API](/api/timescope) for runtime controls
