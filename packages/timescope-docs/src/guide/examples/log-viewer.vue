---
title: Log Viewer
---

<template>
<!-- #region html -->
<div id="example-log-viewer"></div>
<!-- #endregion html -->
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue';

// #region code
import { Timescope } from 'timescope';

onMounted(() => { // ignore:

const errorData: { time: number; value: number }[] = [];
const warningData: { time: number; value: number }[] = [];
const infoData: { time: number; value: number }[] = [];
const debugData: { time: number; value: number }[] = [];
const densityData: { time: number; value: number }[] = [];

let time = 0;
const logCount = 200;
const allLogTimes: number[] = [];

for (let i = 0; i < logCount; i++) {
  time += 0.1 + Math.random() * 1.9;
  allLogTimes.push(time);

  const errorProbability = Math.sin((i / logCount) * Math.PI) * 0.3;
  const rand = Math.random();

  if (rand < errorProbability) {
    errorData.push({ time, value: 4 });
  } else if (rand < errorProbability + 0.15) {
    warningData.push({ time, value: 3 });
  } else if (rand < errorProbability + 0.35) {
    infoData.push({ time, value: 2 });
  } else {
    debugData.push({ time, value: 1 });
  }
}

const windowSize = 10;
let windowStart = 0;
const maxTime = allLogTimes[allLogTimes.length - 1] || 0;

while (windowStart < maxTime) {
  const windowEnd = windowStart + windowSize;
  const count = allLogTimes.filter((t) => t >= windowStart && t < windowEnd).length;

  densityData.push({
    time: windowStart + windowSize / 2,
    value: count,
  });
  windowStart = windowEnd;
}

const timescope = // ignore:
new Timescope({
  target: '#example-log-viewer',
  style: { height: '280px' },
  time: 100,
  zoom: 1,
  sources: {
    errors: errorData,
    warnings: warningData,
    info: infoData,
    debug: debugData,
    density: densityData,
  },
  series: {
    errors: {
      data: { source: 'errors', range: [0, 5], color: '#ef4444' },
      chart: {
        marks: [
          { draw: 'minus', using: 'value', style: { size: 20, angle: 90 } },
        ],
      },
      tooltip: { format: ({ time }) => '+' + time.toFixed(0) + ' s' },
      track: 'logs',
    },
    warnings: {
      data: { source: 'warnings', range: [0, 5], color: '#f59e0b' },
      chart: {
        marks: [
          { draw: 'minus', using: 'value', style: { size: 20, angle: 90 } },
        ],
      },
      tooltip: { format: ({ time }) => '+' + time.toFixed(0) + ' s' },
      track: 'logs',
    },
    info: {
      data: { source: 'info', range: [0, 5], color: '#3b82f6' },
      chart: {
        marks: [
          { draw: 'minus', using: 'value', style: { size: 20, angle: 90 } },
        ],
      },
      tooltip: { format: ({ time }) => '+' + time.toFixed(0) + ' s' },
      track: 'logs',
    },
    debug: {
      data: { source: 'debug', range: [0, 5], color: '#6b7280' },
      chart: {
        marks: [
          { draw: 'minus', using: 'value', style: { size: 20, angle: 90 } },
        ],
      },
      tooltip: { format: ({ time }) => '+' + time.toFixed(0) + ' s' },
      track: 'logs',
    },
    eventDensity: {
      data: { source: 'density' },
      chart: {
        links: [
          { draw: 'step-area', using: ['value', 'zero'], style: { fillColor: '#8b5cf6', fillOpacity: 0.2 } },
          { draw: 'step', using: 'value', style: { lineColor: '#8b5cf6', lineWidth: 1.5 } },
        ],
      },
      track: 'density',
    },
  },
  tracks: {
    logs: {
      timeAxis: false,
    },
    density: {
      timeAxis: true,
    },
  },
});
// #endregion code

onBeforeUnmount(() => timescope?.dispose());
});

</script>
