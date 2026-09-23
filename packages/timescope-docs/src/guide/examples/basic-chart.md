<script setup>
import Example from './basic-chart.vue';
</script>

# Basic Chart

Draw four samples with the smallest useful source-to-chart configuration.

## Try it

Drag the chart to move the samples past the center cursor, then zoom in to inspect individual points.

<Example />

## Code

<!-- example-code -->

## How it works

- `sources.samples` supplies rows; `series.temperature.data.source` selects those rows.
- `chart: 'linespoints'` draws both connections and point markers.
- Times are relative seconds. `time: 1.5` centers the data, while `timeAxis.relative` formats the axis as relative time.
- Inline arrays are snapshots: changing the original array does not update the chart.

## Next steps

[Compare on a shared scale](./shared-domain), [choose a chart preset](./chart-presets), or [append live data](./realtime-data). See [Sources](/api/timescope-options#sources) for data formats.
