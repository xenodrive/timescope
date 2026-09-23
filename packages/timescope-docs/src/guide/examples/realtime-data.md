<script setup>
import Example from './realtime-data.vue';
</script>

# Realtime Data

Append generated samples to an aggregate source while following a playback clock.

## Try it

Watch new samples arrive. Drag back to inspect earlier data and distinguish the selected time from the advancing playback clock.

<Example />

## Code

<!-- example-code -->

## How it works

- `createDataSource({ type: 'point-aggregate' })` creates a source supporting `append()`; this method is not available on every source type.
- Sample timestamps and the supplied playback time are relative seconds.
- `time: null` follows the clock supplied by `setPlaybackTime()`. Use `setTime(null)` to return to following after selecting a fixed time.
- The chart draws aggregate minimum/maximum bounds and an average line.

### Cleanup

Register this with your application's teardown lifecycle:

```ts
clearInterval(timer);
timescope.dispose();
```

## Next steps

See [Source options](/api/timescope-options#sources), [Decimation](./decimation), and [Audio Waveform](./audio-waveform) for an external playback clock.
