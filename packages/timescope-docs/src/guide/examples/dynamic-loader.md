<script setup>
import Example from './dynamic-loader.vue';
</script>

# Dynamic Loader

Supply data on demand for the requested time range and resolution. This demo generates a waveform after an artificial delay to simulate a request.

## Try it

Pan to a new region and zoom in. Observe the data arriving after a short delay and the level of detail changing.

<Example />

## Code

<!-- example-code -->

## How it works

- The loader receives `{ range, resolution }` with Decimal values. Preserve that precision in request boundaries and time calculations.
- Return rows intersecting the requested range, plus available neighboring rows for connections: one on each side for lines, two for curves, even when the range itself has no points.
- `using: ['min', 'max']` draws a band; `using: 'value'` draws the central line.
- `instantaneous.zoom` requests cursor values at a separate resolution from the chart.

## Next steps

Read the [range-loader contract](/api/timescope-options#range-loader) before connecting a server. [Financial Chart](./financial-chart) applies range loading to price data; [Realtime Data](./realtime-data) demonstrates append-based updates.
