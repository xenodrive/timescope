---
title: System Metrics Monitoring
---

<template>
<!-- #region html -->
<div id="example-system-metrics"></div>
<!-- #endregion html -->
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue';

// #region code
import { Timescope } from 'timescope';

onMounted(() => { // ignore:

const cpuData: { time: number; value: number }[] = [];
const memoryData: { time: number; value: number }[] = [];
const networkData: { time: number; value: number }[] = [];
const diskData: { time: number; value: number }[] = [];

for (let i = 0; i <= 120; i++) {
  const time = i * 5;
  cpuData.push({
    time,
    value: 20 + Math.sin(time / 30) * 15 + Math.random() * 10,
  });
  memoryData.push({
    time,
    value: 45 + Math.sin(time / 50) * 10 + Math.random() * 8,
  });
  networkData.push({
    time,
    value: 30 + Math.cos(time / 40) * 20 + Math.random() * 15,
  });
  diskData.push({
    time,
    value: 15 + Math.sin(time / 60) * 8 + Math.random() * 5,
  });
}

const timescope = // ignore:
new Timescope({
  target: '#example-system-metrics',
  style: { height: '400px' },
  time: 300,
  timeRange: [0, 600],
  zoom: 1.5,
  sources: {
    cpu: cpuData,
    memory: memoryData,
    network: networkData,
    disk: diskData,
  },
  series: {
    cpu: {
      data: { source: 'cpu', name: 'CPU', color: '#ef4444' },
      chart: {
        links: [
          { draw: 'area', using: ['value', 'zero'], style: { fillOpacity: 0.2 } },
          { draw: 'line', using: 'value', style: { lineWidth: 2 } },
        ],
        marks: [
          { draw: 'circle', using: 'value', style: { size: 3 } },
        ],
      },
      track: 'cpu',
    },
    memory: {
      data: { source: 'memory', name: 'Memory', color: '#3b82f6' },
      chart: {
        links: [
          { draw: 'area', using: ['value', 'zero'], style: { fillOpacity: 0.2 } },
          { draw: 'line', using: 'value', style: { lineWidth: 2 } },
        ],
        marks: [
          { draw: 'circle', using: 'value', style: { size: 3 } },
        ],
      },
      track: 'memory',
    },
    network: {
      data: { source: 'network', name: 'Network', color: '#10b981' },
      chart: {
        links: [
          { draw: 'area', using: ['value', 'zero'], style: { fillOpacity: 0.2 } },
          { draw: 'line', using: 'value', style: { lineWidth: 2 } },
        ],
        marks: [
          { draw: 'circle', using: 'value', style: { size: 3 } },
        ],
      },
      track: 'network',
    },
    disk: {
      data: { source: 'disk', name: 'Disk', color: '#f59e0b' },
      chart: {
        links: [
          { draw: 'area', using: ['value', 'zero'], style: { fillOpacity: 0.2 } },
          { draw: 'line', using: 'value', style: { lineWidth: 2 } },
        ],
        marks: [
          { draw: 'circle', using: 'value', style: { size: 3 } },
        ],
      },
      track: 'disk',
    },
  },
  tracks: {
    cpu: {
      timeAxis: false,
    },
    memory: {
      timeAxis: false,
    },
    network: {
      timeAxis: false,
    },
    disk: {
      timeAxis: true,
    },
  },
});
// #endregion code

onBeforeUnmount(() => timescope?.dispose());
});

</script>
