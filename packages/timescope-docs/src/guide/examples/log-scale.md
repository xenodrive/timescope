<script setup>
import Example from './log-scale.vue';
</script>

# Log Scale

Compare linear and logarithmic views of values spanning several orders of magnitude.

## Try it

Press **Toggle** and compare the vertical spacing of the same five samples.

<Example />

## Code

<!-- example-code -->

## How it works

- `data.domain.scale` controls the value scale; the horizontal axis remains time.
- This example uses positive values from 1 to 10,000 and automatic domain bounds.
- `updateOptions()` changes the scale while retaining omitted configuration.

## Next steps

See [Domains](/api/timescope-options#domains) for scaling options and [Compare on a Shared Scale](./shared-domain) for comparing series.
