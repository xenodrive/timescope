<script setup>
import Example from './time-control.vue';
</script>

# Synchronize a Time Control

Connect the selected time to an external numeric input. This example uses relative seconds to keep the state flow visible.

## Try it

Drag the timeline and release it to update the input. Enter a different number, then press Enter or leave the input to move the timeline immediately.

<Example />

## Code

<!-- example-code -->

## How it works

- Read `timescope.time` before subscribing so the external control has an initial value.
- `timechanged` publishes committed changes through `event.value`. Use `timechanging` instead when you need feedback during dragging.
- The input calls `setTime(value, false)` to move without animation. Compare Decimal values before calling the setter to avoid redundant updates.
- Assigning an input's value does not dispatch a DOM change event. With reactive state, retain the equality guard to prevent updates echoing between both sides.

The `cleanup()` function releases the DOM listener, subscription, and instance. Register it on unmount.

## Next steps

See [Events](./events) for event timing, [Audio Waveform](./audio-waveform) for playback synchronization, and [Methods](/api/timescope#methods) for navigation APIs.
