<script setup>
import Example from './shared-domain.vue';
</script>

# Compare on a Shared Scale

Overlay indoor and outdoor temperatures so the same vertical position always means the same temperature.

## Try it

Move the samples past the cursor. The orange indoor series and blue outdoor series use the same 0–30 °C scale, so their vertical separation is directly comparable.

<Example />

## Code

<!-- example-code -->

## How it works

- `domains.temperature` defines a named value scale with a fixed range and unit.
- Both series reference `data.domain: 'temperature'` to share that scale.
- Both use the default Track and are therefore overlaid. Sharing a Track alone would not share their scales.
- Numeric times are relative seconds; the value unit is independently specified as °C.

## Next steps

[Multiple Tracks](./multiple-tracks) handles separate regions and different units. See [Domains](/api/timescope-options#domains) for shared scales and automatic bounds.
