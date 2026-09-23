<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { Timescope } from 'timescope';
import { domainSamples } from './domain-data.js';
import sampleCode from './domain-data.js?raw';
import { expression, vanillaCode } from './vanilla';

const target = ref<HTMLElement>();
const lower = ref<number | ''>('');
const upper = ref<number | ''>('');
const expand = ref(false);
const shrink = ref(true);
const gap = ref(24);
const selected = ref('Auto');
const scene = ref(0);
const scenes = ['Quiet', 'Impact', 'Recovery', 'Floating', 'Negative'];
const presets = ['Fixed', 'Auto', 'Zero anchored', 'Expand & hold', 'Expand & shrink'];
let timescope: Timescope | undefined;
const samples = domainSamples();
const domain = computed(() => ({
  range: {
    default: [
      lower.value === '' ? undefined : Number(lower.value),
      upper.value === '' ? undefined : Number(upper.value),
    ] as [number | undefined, number | undefined],
    expand: expand.value,
    shrink: shrink.value,
  },
  floatingGap: gap.value,
  axis: 'left' as const,
}));
const configuration = computed(
  () =>
    `range: { default: [${lower.value === '' ? 'undefined' : lower.value}, ${upper.value === '' ? 'undefined' : upper.value}], expand: ${expand.value}, shrink: ${shrink.value} }, floatingGap: ${gap.value}`,
);
const options = computed(() => ({
  style: { height: '320px' },
  time: scene.value * 100 + 50,
  zoom: 3,
  sources: { samples },
  domains: { amplitude: domain.value },
  series: {
    signal: { data: { source: 'samples', domain: 'amplitude', color: '#0d9488' }, chart: 'lines:filled' as const },
  },
  tracks: { default: { timeAxis: { relative: true } } },
}));
defineExpose({
  exportCode: () =>
    vanillaCode(
      { ...options.value, sources: { samples: expression('domainSamples()') } },
      sampleCode,
      `timescope.fitTo([${scene.value * 100 + 10}, ${scene.value * 100 + 90}], { animation: false });`,
    ),
});

function jump(index: number) {
  scene.value = index;
  timescope?.fitTo([index * 100 + 10, index * 100 + 90], { animation: false });
}
function create() {
  if (!target.value) return;
  timescope?.dispose();
  timescope = new Timescope({
    ...options.value,
    target: target.value,
  });
  jump(scene.value);
}
function preset(name: string) {
  selected.value = name;
  lower.value = name === 'Auto' ? '' : 0;
  upper.value = ['Auto', 'Zero anchored'].includes(name) ? '' : 10;
  expand.value = name.startsWith('Expand');
  shrink.value = name !== 'Expand & hold';
}
watch(domain, () => timescope?.updateOptions({ domains: { amplitude: domain.value } }));
onMounted(create);
onBeforeUnmount(() => timescope?.dispose());
</script>

<template>
  <div class="demo">
    <div class="demo-controls">
      <button v-for="name in presets" :key="name" :aria-pressed="selected === name" @click="preset(name)">
        {{ name }}
      </button>
    </div>
    <div ref="target"></div>
    <div class="demo-controls">
      <span class="demo-note">Scene</span
      ><button v-for="(name, index) in scenes" :key="name" :aria-pressed="scene === index" @click="jump(index)">
        {{ name }}</button
      ><button @click="create">Reset scale</button>
    </div>
    <div class="demo-controls">
      <label>Min <input v-model="lower" type="number" placeholder="Auto" @input="selected = ''" /></label>
      <label>Max <input v-model="upper" type="number" placeholder="Auto" @input="selected = ''" /></label>
      <label><input v-model="expand" type="checkbox" @change="selected = ''" /> expand</label>
      <label><input v-model="shrink" type="checkbox" @change="selected = ''" /> shrink</label>
      <label>floatingGap <input v-model.number="gap" type="range" min="0" max="80" />{{ gap }}px</label>
    </div>
    <div class="demo-config">{{ configuration }}</div>
    <p class="demo-note">Empty bounds follow visible data. Try Impact → Recovery, or Auto → Floating.</p>
  </div>
</template>

<style src="./demo.css"></style>
