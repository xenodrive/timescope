<script setup>
import Example from './audio-waveform.vue';
</script>

# Audio Waveform

Decode an audio file into sample rows and synchronize two waveform tracks with an audio player. This demo uses the site's `/timescope/audio.wav` asset; supply your own audio URL when adapting it.

## Try it

Press Play to follow the player. Pause and drag the timeline to seek, or seek with the audio controls. Zoom in to reveal individual samples.

<Example />

## Playback synchronization

The playback clock and selected time are separate state. When playback starts, supply the player's clock and switch the selection into following mode:

```ts
timescope.setPlaybackTime(player.currentTime);
timescope.setTime(null, false);
```

Continue supplying `player.currentTime` during playback. When paused, a fixed selection can be synchronized with the player's seek position. Both use seconds.

## Code

<!-- example-code -->

## How it works

- The decoder maps each sample index to `index / sampleRate`, retaining both channel values in one source.
- A point-aggregate source supplies minimum, maximum, and average values. Chart callbacks switch from an envelope to individual marks at fine resolutions.
- Each channel has its own Track and a fixed amplitude range of −1 to 1.
- A frame latch coordinates data preparation with playback rendering. Interaction may supersede a pending playback frame.

### Cleanup

On teardown, stop the update loop, abort the pending latch, cancel the animation frame, remove the player's listeners, close the AudioContext, and dispose the instance:

```ts
playing = false;
frameLatch?.abort();
if (animationFrame != null) cancelAnimationFrame(animationFrame);
player.removeEventListener('play', onPlay);
player.removeEventListener('pause', onPause);
player.removeEventListener('seeking', onSeeking);
player.removeEventListener('durationchange', onDurationChange);
void audioContext.close();
timescope.dispose();
```

## Next steps

See [Synchronize a Time Control](./time-control) for basic state flow, [Decimation](./decimation) for aggregation, and the [Timescope API](/api/timescope) for playback and frame latches.
