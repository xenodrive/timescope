<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { createLiveSignal } from './live-signal.js';
import sourceCode from './live-signal.js?raw';

const target = ref<HTMLElement>();
const running = ref(false);
const speed = ref(1);
const following = ref(false);
const progress = ref({ samples: 600, time: 5.99 });
let demo: ReturnType<typeof createLiveSignal> | undefined;
let unsubscribe: (() => void) | undefined;
onMounted(() => {
  demo = createLiveSignal(target.value!, {
    running: running.value,
    speed: speed.value,
    onProgress: (value) => {
      progress.value = value;
    },
  });
  unsubscribe = demo.timescope.on('timechanged', ({ value }) => {
    following.value = value === null;
  });
});
watch(running, (value) => demo?.setRunning(value));
watch(speed, (value) => demo?.setSpeed(value));
onBeforeUnmount(() => {
  unsubscribe?.();
  demo?.cleanup();
});
defineExpose({
  exportCode: () => ({
    html: '<div id="timescope"></div>',
    javascript: `${sourceCode.replace(/^export /gm, '')}\n\nconst demo = createLiveSignal('#timescope', ${JSON.stringify({ running: running.value, speed: speed.value }, null, 2)});\n\n// Call when removing the visualization.\nfunction cleanup() { demo.cleanup(); }\n`,
  }),
});
</script>

<template>
  <div class="demo">
    <div class="demo-controls">
      <button :aria-pressed="running" @click="running = !running">{{ running ? 'Pause' : 'Start' }}</button>
      <button :aria-pressed="following" @click="demo?.follow()">Follow live</button>
      <label
        >Speed
        <select v-model.number="speed">
          <option :value="1">1×</option>
          <option :value="2">2×</option>
          <option :value="4">4×</option>
        </select></label
      >
      <span class="demo-note">{{ progress.time.toFixed(2) }} s · {{ progress.samples.toLocaleString() }} samples</span>
    </div>
    <div ref="target"></div>
    <p class="demo-note">
      Drag back to inspect the signal while samples keep arriving. Follow live returns to the playback clock.
    </p>
  </div>
</template>

<style src="./demo.css"></style>
