---
title: Audio Waveform Visualization
---

<template>
<!-- #region html -->
<div>
  <div id="example-audio-waveform"></div>
  <audio id="example-audio-player" src="/timescope/audio.wav" controls style="width: 100%" />
</div>
<!-- #endregion html -->
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue';

// #region code
import { Decimal, Timescope } from 'timescope';

onMounted(() => { // ignore:

let waveform = new Uint8Array();
const sampleRate = 22050;
const channels = 1;

const timescope = new Timescope({
  target: '#example-audio-waveform',
  style: { height: '320px' },
  time: 0,
  timeRange: [0, 0],
  zoom: 8,
  sources: {
    waveform: {
      loader: async ({ range, resolution }) => {
        const hdrSize = 0x2c;
        const sidx = range[0].mul(sampleRate).floor().number() + hdrSize;
        const eidx = range[1].mul(sampleRate).ceil().number() + hdrSize;
        const step = resolution.mul(sampleRate).ceil().number();

        const result: any[] = [];
        for (let idx = sidx; idx < eidx; idx += step) {
          let minL = Infinity;
          let maxL = -Infinity;
          let minR = Infinity;
          let maxR = -Infinity;
          let avgL = 0;
          let avgR = 0;

          if (idx > waveform.length / channels) break;
          if (idx < hdrSize) continue;

          for (let i = 0; i < Math.max(step, 1); i++) {
            const vL = (waveform[(idx + i) * channels + (0 % channels)] - 128) / 128;
            const vR = (waveform[(idx + i) * channels + (1 % channels)] - 128) / 128;
            if (isNaN(vL) || isNaN(vR)) continue;

            if (vL < minL) minL = vL;
            if (vL > maxL) maxL = vL;
            if (vR < minR) minR = vR;
            if (vR > maxR) maxR = vR;
          }
          const t = Decimal(idx - hdrSize).div(sampleRate);

          avgL = (minL + maxL) / 2;
          avgR = (minR + maxR) / 2;

          result.push({
            time: t,
            minL,
            avgL,
            maxL,
            minR,
            avgR,
            maxR,
          });
        }

        return result;
      },
    },
  },
  series: {
    waveformL: {
      data: {
        source: 'waveform',
        value: { min: 'minL', value: 'avgL', max: 'maxL' },
        range: [-1, 1],
      },
      chart: {
        links: (chunk) => chunk.resolution.lt(0.00001) ? [] : [
          { draw: 'line', using: 'value' },
          { draw: 'area', using: ['min', 'max'] },
        ],
        marks: (chunk) => chunk.resolution.lt(0.00001) ? [
          { draw: 'line', using: ['value', 'zero'] },
          { draw: 'circle', using: 'value' },
        ] : [],
      },
      track: 'waveformL',
      tooltip: false,
    },
    waveformR: {
      data: {
        source: 'waveform',
        value: { min: 'minR', value: 'avgR', max: 'maxR' },
        range: [-1, 1],
      },
      chart: {
        links: (chunk) => chunk.resolution.lt(0.00001) ? [] : [
          { draw: 'line', using: 'value' },
          { draw: 'area', using: ['min', 'max'] },
        ],
        marks: (chunk) => chunk.resolution.lt(0.00001) ? [
          { draw: 'line', using: ['value', 'zero'] },
          { draw: 'circle', using: 'value' },
        ] : [],
      },
      track: 'waveformR',
      tooltip: false,
    },
  },
  tracks: {
    waveformL: {
      symmetric: true,
      timeAxis: {
        relative: true,
      },
    },
    waveformR: {
      symmetric: true,
      timeAxis: {
        relative: true,
      },
    },
  },
});

const player = document.getElementById('example-audio-player') as HTMLAudioElement;

let playing = false;

function update() {
  if (playing) requestAnimationFrame(update);
  timescope.setPlaybackTime(player.currentTime);
}

player.addEventListener('play', () => {
  playing = true;
  timescope.setPlaybackTime(player.currentTime);
  timescope.setTime(null, false);
  update();
});

player.addEventListener('ended', () => {
  playing = false;
  timescope.setPlaybackTime(player.currentTime);
});

player.addEventListener('seeking', () => {
  if (!playing && !timescope.editing && !timescope.animating) {
    timescope.setTime(player.currentTime, false);
  }
});

timescope.on('timechanging', (e) => {
  if (!playing) {
    player.currentTime = e.value?.number() ?? 0;
  }
});

player.addEventListener('durationchange', () => {
  timescope.setTimeRange([0, player.duration]);
});

async function loadWaveform() {
  waveform = await fetch(player.src).then((r) => r.bytes());
  timescope.reload();
}

loadWaveform();
// #endregion code

onBeforeUnmount(() => timescope?.dispose());

});

</script>
