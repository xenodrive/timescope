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
import { IntervalTree } from './tree.ts';
import { loadWaveFile } from './format.ts';

onMounted(() => { // ignore:

const player = document.getElementById('example-audio-player') as HTMLAudioElement;

let tree: IntervalTree<{ time: Decimal, data: number[] }> | null = null;

async function loadData() {
  const data = await fetch(player.src).then((r) => r.bytes());

  const { samples } = loadWaveFile(data) || {};
  if (!samples) return;

  tree = new IntervalTree();
  tree.bulkInsert(samples, (item) => [item.time, item.time, '[]']);

  timescope.reload();
}

async function query(range: [Decimal | undefined, Decimal | undefined], resolution: Decimal, channel: number) {
  if (!range[0] || !range[1] || !tree) return [];

  const result: { time: Decimal; value: number; min: number; max: number }[] = [];

  for (let t = range[0]; t.lt(range[1]); t = t.add(resolution)) {
    const values = tree.query(t, t.add(resolution)).map((item) => item.data[channel]);

    if (values.length) {
      const value = values.reduce((a, b) => a + b, 0) / values.length;
      const min = Math.min(...values);
      const max = Math.max(...values);

      result.push({ time: t, value, min, max });
    }
  }

  return result;
}

const timescope = new Timescope({
  target: '#example-audio-waveform',
  style: { height: '320px' },
  time: 0,
  timeRange: [0, 0],
  zoom: 8,
  sources: {
    waveformL: {
      loader: async ({ range, resolution }) => {
        return query(range, resolution, 0);
      },
    },
    waveformR: {
      loader: async ({ range, resolution }) => {
        return query(range, resolution, 1);
      },
    },
  },
  series: {
    waveformL: {
      data: {
        source: 'waveformL',
        value: ['min', 'max', 'value'],
        domain: { range: [-1, 1] },
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
        source: 'waveformR',
        value: ['min', 'max', 'value'],
        domain: { range: [-1, 1] },
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

loadData();
// #endregion code

onBeforeUnmount(() => timescope?.dispose());

});

</script>
