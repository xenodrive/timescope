<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { logScale } from './charts.js';

defineProps({ formatting: Boolean });

const target = ref();
const scale = ref('log');
const round = ref(undefined);
const axisRound = ref(undefined);
const detailedFormats = [
  { label: "{ label: 'e', digits: 3 }", value: { label: 'e', digits: 3 } },
  { label: "{ label: 'pow10', digits: 1 }", value: { label: 'pow10', digits: 1 } },
];
let timescope;
onMounted(() => {
  timescope = logScale(target.value);
});
onBeforeUnmount(() => timescope?.dispose());

// #region value-scale-controls
function updateScale() {
  timescope.updateOptions({
    series: { response: { data: { domain: { scale: scale.value } } } },
  });
}

function updateRound() {
  timescope.updateOptions({
    series: { response: { tooltip: { round: round.value } } },
  });
}
// #endregion value-scale-controls

// #region axis-format-control
function updateAxisRound() {
  timescope.updateOptions({
    series: { response: { data: { domain: { axis: { side: 'left', round: axisRound.value } } } } },
  });
}
// #endregion axis-format-control
</script>

<template>
  <div class="demo">
    <div class="demo-controls">
      <label v-if="!formatting">
        <code>scale</code>
        <select v-model="scale" @change="updateScale">
          <option value="log">log</option>
          <option value="linear">linear</option>
        </select>
      </label>
      <label v-if="formatting">
        <code>axis.round</code>
        <select v-model="axisRound" @change="updateAxisRound">
          <option :value="undefined">undefined</option>
          <option v-for="digits in [0, 1, 2, 3, 4, 5]" :key="digits" :value="digits">{{ digits }}</option>
          <option value="e">'e'</option>
          <option value="pow10">'pow10'</option>
          <option v-for="format in detailedFormats" :key="format.label" :value="format.value">
            {{ format.label }}
          </option>
        </select>
      </label>
      <label>
        <code>tooltip.round</code>
        <select v-model="round" @change="updateRound">
          <option :value="undefined">undefined</option>
          <option v-for="digits in [0, 1, 2, 3, 4, 5]" :key="digits" :value="digits">{{ digits }}</option>
          <option v-if="formatting" value="e">'e'</option>
          <option v-if="formatting" value="pow10">'pow10'</option>
          <option v-for="format in formatting ? detailedFormats : []" :key="format.label" :value="format.value">
            {{ format.label }}
          </option>
        </select>
      </label>
    </div>
    <div ref="target" style="height: 240px"></div>
  </div>
</template>

<style src="../../examples/demo.css"></style>
