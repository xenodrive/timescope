<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { createTerrainDemo } from './dynamic-terrain.js';
import sourceCode from './dynamic-terrain.js?raw';

const target = ref<HTMLElement>();
const latency = ref(450);
const progress = ref({ pending: 0, total: 0 });
const selectedView = ref({ time: 512, zoom: -1 });
let demo: ReturnType<typeof createTerrainDemo> | undefined;
function jump(time: number, zoom: number) {
  selectedView.value = { time, zoom };
  demo?.timescope.setTime(time, false);
  demo?.timescope.setZoom(zoom, false);
}
onMounted(() => {
  demo = createTerrainDemo(target.value!, {
    latency: latency.value,
    onProgress: (value) => {
      progress.value = value;
    },
  });
});
watch(latency, (value) => demo?.setLatency(value));
onBeforeUnmount(() => demo?.cleanup());
defineExpose({
  exportCode: () => ({
    html: '<div id="timescope"></div>',
    javascript: `${sourceCode.replace(/^export /gm, '')}\n\nconst demo = createTerrainDemo('#timescope', ${JSON.stringify({ latency: latency.value, ...selectedView.value }, null, 2)});\n\n// Call when removing the visualization.\nfunction cleanup() { demo.cleanup(); }\n`,
  }),
});
</script>

<template>
  <div class="demo">
    <div class="demo-controls">
      <button @click="jump(512, -1)">Landscape</button><button @click="jump(512, 4)">Explore detail</button
      ><button @click="jump(8192, 0)">Somewhere else</button>
      <label>Latency <input v-model.number="latency" type="range" min="0" max="1500" step="50" />{{ latency }}ms</label
      ><button @click="demo?.reload()">Reload</button>
    </div>
    <div ref="target"></div>
    <div class="chunk-legend">
      <span><i class="ready"></i>Boxes = ranges returned by the chunk loader</span>
      <span>{{ progress.pending }} loading · {{ progress.total }} requests across both loaders</span>
    </div>
  </div>
</template>

<style src="./demo.css"></style>
<style scoped>
.chunk-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  padding-top: 12px;
  color: #64748b;
  font-size: 11px;
}
.chunk-legend span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.chunk-legend i {
  width: 10px;
  height: 10px;
  border-radius: 2px;
}
.ready {
  background: #5eead4;
}
</style>
