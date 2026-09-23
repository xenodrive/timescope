<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { Timescope, type Decimal, type TimescopeChartMark, type TimescopeChartLink } from 'timescope';
import { vanillaCode } from './vanilla';

const target = ref<HTMLElement>();
const color = ref('#0d9488');
const size = ref(10);
const field = ref<'value' | 'min' | 'max'>('value');
const shapes = [
  { value: 'none', icon: '∅' },
  { value: 'circle', icon: '●' },
  { value: 'square', icon: '■' },
  { value: 'triangle', icon: '▲' },
  { value: 'diamond', icon: '◆' },
  { value: 'star', icon: '★' },
  { value: 'text', icon: 'Aa' },
  { value: 'path', icon: '♥' },
] as const;
const shape = ref<(typeof shapes)[number]['value']>('circle');
const fields = ['value', 'min', 'max', '#zero', '#top', '#bottom'];
const colors = ['#0d9488', '#6366f1', '#e11d48', '#d97706', '#0284c7'];
const recipes = ['Points', 'Ribbon', 'Steps', 'Symbols'];
type Draw = 'none' | 'line' | 'curve' | 'step' | 'area' | 'curve-area' | 'step-area';
const draws: Draw[] = ['none', 'line', 'curve', 'step', 'area', 'curve-area', 'step-area'];
const layers = ref([
  { draw: 'area' as Draw, from: 'min', to: 'max', color: '#6366f1', stroke: 'solid', width: 2, opacity: 0.2 },
  { draw: 'curve' as Draw, from: 'value', to: '#zero', color: '#0d9488', stroke: 'solid', width: 2, opacity: 0.2 },
]);
const dashes: Record<string, number[]> = { solid: [], dashed: [7, 5], dotted: [2, 4] };
const area = (draw: string) => draw.includes('area');
let timescope: Timescope | undefined;

const textFormatters = {
  value: ({ values }: { values: Record<string, Decimal | null> }) => values.value?.toFixed(1) ?? '',
  min: ({ values }: { values: Record<string, Decimal | null> }) => values.min?.toFixed(1) ?? '',
  max: ({ values }: { values: Record<string, Decimal | null> }) => values.max?.toFixed(1) ?? '',
};
const chart = computed(() => {
  const marks: TimescopeChartMark<[{ values: Record<string, Decimal | null> }]>[] = [];
  const common = { using: field.value, style: { size: size.value } };
  if (shape.value === 'text')
    marks.push({
      ...common,
      draw: 'text',
      style: { ...common.style, textColor: color.value, text: textFormatters[field.value] },
    });
  else if (shape.value === 'path')
    marks.push({
      ...common,
      draw: 'path',
      style: { ...common.style, path: 'M12 21L3 12C-3 5 5-2 12 5C19-2 27 5 21 12Z', scale: 1 / 24, origin: [12, 12] },
    });
  else if (shape.value !== 'none')
    marks.push({ ...common, draw: shape.value, style: { ...common.style, lineColor: color.value } });
  const links: TimescopeChartLink<false>[] = [];
  for (const layer of layers.value) {
    if (layer.draw === 'none') continue;
    const style = {
      lineColor: layer.color,
      lineWidth: layer.width,
      lineDashArray: dashes[layer.stroke],
      fillColor: layer.color,
      fillOpacity: layer.opacity,
    };
    if (layer.draw === 'area' || layer.draw === 'curve-area' || layer.draw === 'step-area')
      links.push({ draw: layer.draw, using: [layer.from, layer.to], style });
    else links.push({ draw: layer.draw, using: layer.from, style });
  }
  return { marks, links };
});
const samples = Array.from({ length: 9 }, (_, time) => {
  const value = 3 + Math.sin(time * 0.85) * 2;
  return { time, values: { value, min: value - 0.7 - time * 0.05, max: value + 0.8 } };
});
const options = computed(() => ({
  style: { height: '300px' },
  time: 4,
  zoom: 6,
  sources: { samples },
  series: {
    sample: {
      data: { source: 'samples', color: color.value, domain: { range: [0, 7] as [number, number] } },
      chart: chart.value,
    },
  },
  tracks: { default: { timeAxis: { relative: true } } },
}));
function recipe(name: string) {
  shape.value = name === 'Symbols' ? 'path' : 'circle';
  size.value = name === 'Symbols' ? 24 : 10;
  const hidden = name === 'Points' || name === 'Symbols';
  layers.value[0] = {
    draw: hidden ? 'none' : name === 'Steps' ? 'step-area' : 'curve-area',
    from: name === 'Steps' ? 'value' : 'min',
    to: name === 'Steps' ? '#zero' : 'max',
    color: '#6366f1',
    stroke: 'solid',
    width: 2,
    opacity: 0.2,
  };
  layers.value[1] = {
    draw: hidden ? 'none' : name === 'Steps' ? 'step' : 'curve',
    from: 'value',
    to: '#zero',
    color: '#0d9488',
    stroke: 'solid',
    width: 2,
    opacity: 0.2,
  };
}
onMounted(() => {
  timescope = new Timescope({ ...options.value, target: target.value! });
  timescope.fitTo([-0.5, 8.5], { animation: false });
});
watch(options, () => timescope?.updateOptions({ series: options.value.series }));
onBeforeUnmount(() => timescope?.dispose());
defineExpose({
  exportCode: () => vanillaCode(options.value, '', 'timescope.fitTo([-0.5, 8.5], { animation: false });'),
});
</script>

<template>
  <div class="demo">
    <div class="demo-controls">
      <button v-for="name in recipes" :key="name" @click="recipe(name)">{{ name }}</button>
    </div>
    <div ref="target"></div>
    <div class="demo-controls">
      <span class="demo-note">MARK</span
      ><button
        v-for="item in shapes"
        :key="item.value"
        class="shape"
        :aria-label="item.value"
        :title="item.value"
        :aria-pressed="shape === item.value"
        @click="shape = item.value">
        {{ item.icon }}
      </button>
      <label
        >using
        <select v-model="field">
          <option>value</option>
          <option>min</option>
          <option>max</option>
        </select></label
      >
      <label>Size <input v-model.number="size" type="range" min="4" max="32" /></label>
      <button
        v-for="swatch in colors"
        :key="swatch"
        class="swatch"
        :style="{ background: swatch }"
        :aria-label="`Mark color ${swatch}`"
        :aria-pressed="color === swatch"
        @click="color = swatch"></button>
    </div>
    <div class="link-layers">
      <fieldset v-for="(layer, index) in layers" :key="index" class="link-layer">
        <legend>Link {{ index + 1 }}</legend>
        <label
          >Draw
          <select v-model="layer.draw">
            <option v-for="draw in draws" :key="draw">{{ draw }}</option>
          </select></label
        >
        <label
          >using
          <select v-model="layer.from">
            <option v-for="value in fields" :key="value">{{ value }}</option>
          </select></label
        >
        <label v-if="area(layer.draw)"
          >→
          <select v-model="layer.to" :aria-label="`Link ${index + 1} end field`">
            <option v-for="value in fields" :key="value">{{ value }}</option>
          </select></label
        >
        <label>Color <input v-model="layer.color" type="color" /></label>
        <template v-if="!area(layer.draw)"
          ><label
            >Stroke
            <select v-model="layer.stroke">
              <option>solid</option>
              <option>dashed</option>
              <option>dotted</option>
            </select></label
          ><label>Width <input v-model.number="layer.width" type="range" min="1" max="6" step="0.5" /></label
        ></template>
        <label v-else>Opacity <input v-model.number="layer.opacity" type="range" min="0" max="1" step="0.05" /></label>
      </fieldset>
    </div>
  </div>
</template>

<style src="./demo.css"></style>
<style scoped>
.demo .shape {
  min-width: 36px;
  padding: 5px 8px;
  font-size: 17px;
}
.demo .swatch {
  width: 25px;
  height: 25px;
  padding: 0;
  border-radius: 50%;
  border: 3px solid white;
  box-shadow: 0 0 0 1px #e2e8f0;
}
.demo .swatch[aria-pressed='true'] {
  box-shadow: 0 0 0 2px #334155;
}
.link-layers {
  display: grid;
  gap: 10px;
}
.link-layer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
}
.link-layer legend {
  padding: 0 5px;
  color: #64748b;
  font-size: 11px;
}
.link-layer input[type='color'] {
  width: 30px;
  height: 28px;
  padding: 0;
  border: 0;
  cursor: pointer;
}
</style>
