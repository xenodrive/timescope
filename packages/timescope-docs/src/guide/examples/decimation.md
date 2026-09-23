<script setup>
import Example from './decimation.vue';
</script>

# Decimation

Explore a telemetry dataset with an aggregate source that retains the range of values at coarser resolutions.

## Try it

Zoom out to see the minimum/maximum envelope, then zoom in to inspect more detail. Selecting a time range fits the view to that interval.

<Example />

## Code

<!-- example-code -->

## How it works

- The URL points to this site's sample JSON asset. Replace it with your own dataset when copying the example.
- `type: 'point-aggregate'` enables resolution-dependent aggregation.
- `value#min` and `value#max` describe the aggregate envelope, preserving extremes that a single representative value cannot show.
- `selectionrangechanged` calls `fitTo()` to display the selected interval.

## Next steps

See [Source options](/api/timescope-options#sources) for aggregation and [Dynamic Loader](./dynamic-loader) for requesting data by range.
