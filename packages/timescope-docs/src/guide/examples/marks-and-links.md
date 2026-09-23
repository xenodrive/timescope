<script setup>
import Example from '@/guide/examples/marks-and-links.vue';
import ChartColorInput from '../../../.vitepress/theme/components/ChartColorInput.vue';
import { ref, computed } from 'vue';

const links = ref([
  { draw: 'area', color: '#0d9488', fillColor: '', fillOpacity: 1 },
  { draw: 'area', color: '#8b5cf6', fillColor: '', fillOpacity: 1, using: ['min', 'max'] },
  { draw: 'line', color: '#0f766e', fillColor: '', fillOpacity: 1 },
]);
const marks = ref([
  { draw: 'circle', color: '#0d9488', fillColor: '', fillOpacity: 1 },
]);

const path = 'M13,13H11V7H13M13,17H11V15H13M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2 Z';
const MARK_POINT_STYLE = { size: 20, lineWidth: 2 };
const MARK_TEXT_STYLE = { textOutlineColor: 'white', textOutlineWidth: 3, size: 20, text: ({ values }) => values.value?.toString() ?? '' };
const MARK_ICON_STYLE = { iconOutlineColor: 'white', iconOutlineWidth: 3, size: 20, icon: '\u{F034E}', iconFontFamily: 'Material Design Icons' };
const MARK_PATH_STYLE = { size: 20, path, scale: 1 / 24, origin: [12, 12] };

const markStyles = {
  circle: { ...MARK_POINT_STYLE },
  triangle: { ...MARK_POINT_STYLE },
  square: { ...MARK_POINT_STYLE },
  cross: { ...MARK_POINT_STYLE },
  plus: { ...MARK_POINT_STYLE },
  minus: { ...MARK_POINT_STYLE },
  star: { ...MARK_POINT_STYLE },
  diamond: { ...MARK_POINT_STYLE },
  line: { ...MARK_POINT_STYLE },
  bar: { ...MARK_POINT_STYLE },
  section: { ...MARK_POINT_STYLE },
  icon: { ...MARK_ICON_STYLE },
  text: { ...MARK_TEXT_STYLE },
  path: { ...MARK_PATH_STYLE },
};

const controls = computed(() => [
  { name: 'Marks', kind: 'mark', rows: marks.value, selection: marksSelection.value },
  { name: 'Links', kind: 'link', rows: links.value, selection: linksSelection.value },
]);

function hasFill(kind, draw) {
  return kind === 'link' ? draw.includes('area') : ['circle', 'triangle', 'square', 'star', 'diamond', 'bar', 'path'].includes(draw);
}

function hasStroke(kind, draw) {
  return kind === 'link' ? !draw.includes('area') : !['text', 'icon'].includes(draw);
}

function hasSize(kind, draw) {
  return kind === 'mark' && draw !== 'line';
}

function hasAngle(kind, draw) {
  return kind === 'mark' && ['triangle', 'square', 'diamond', 'star', 'text', 'icon', 'path'].includes(draw);
}

function setNumber(row, key, value) {
  row[key] = value === '' ? undefined : Number(value);
}

const dashPresets = [
  { name: 'Solid', value: 'solid', dash: [] },
  { name: 'Dashed', value: 'dashed', dash: [6, 4] },
  { name: 'Dotted', value: 'dotted', dash: [1, 4] },
  { name: 'Dash-dot', value: 'dash-dot', dash: [6, 3, 1, 3] },
  { name: 'Long dash', value: 'long-dash', dash: [12, 6] },
];

function dashArray(row) {
  return dashPresets.find(preset => preset.value === row.lineDash)?.dash ?? [];
}

const usingOptions = ['value', 'min', 'max', '#zero', '#top', '#bottom'];

function usesTwoValues(kind, draw) {
  return kind === 'link' ? draw.includes('area') : ['line', 'bar', 'section'].includes(draw);
}

function usingValues(kind, row) {
  const defaults = kind === 'mark' && usesTwoValues(kind, row.draw) ? ['min', 'max'] : ['value', '#zero'];
  return [row.using?.[0] ?? defaults[0], row.using?.[1] ?? defaults[1]];
}

function resolvedUsing(kind, row) {
  const values = usingValues(kind, row);
  return usesTwoValues(kind, row.draw) ? values : values[0];
}

function setUsing(kind, row, index, value) {
  const values = usingValues(kind, row);
  values[index] = value;
  row.using = values;
}

function autoFillColor(kind, row) {
  return `color-mix(in srgb, ${row.color.trim() || '#0d9488'} 25%, ${kind === 'mark' ? '#fff' : 'transparent'})`;
}

function colorStyle(kind, row) {
  return {
    color: row.color.trim() || '#0d9488',
    ...(hasSize(kind, row.draw) && row.size !== undefined ? { size: Math.max(0, Math.min(32, row.size)) } : {}),
    ...(hasStroke(kind, row.draw) ? {
      ...(row.lineWidth !== undefined ? { lineWidth: Math.max(0, row.lineWidth) } : {}),
      ...(row.lineColor ? { lineColor: row.lineColor } : {}),
      ...(dashArray(row).length ? { lineDashArray: dashArray(row) } : {}),
    } : {}),
    ...(hasAngle(kind, row.draw) && row.angle !== undefined ? { angle: row.angle } : {}),
    ...(hasFill(kind, row.draw) ? {
      ...(row.fillColor.trim() ? { fillColor: row.fillColor.trim() } : {}),
      fillOpacity: row.fillOpacity,
    } : {}),
  };
}

const marksFinal = computed(() => {
  return marks.value.map((mark) => ({
    draw: mark.draw,
    using: resolvedUsing('mark', mark),
    style: {
      ...(markStyles[mark.draw] ?? {}),
      ...colorStyle('mark', mark),
    },
  }));
});

const linksFinal = computed(() => {
  return links.value.map((link) => ({
    draw: link.draw,
    using: resolvedUsing('link', link),
    style: {
      lineWidth: 2,
      ...colorStyle('link', link),
    },
  }));
});

const marksSelection = ref([
  {
    name: 'Point',
    children: [
      { draw: 'circle' },
      { draw: 'triangle' },
      { draw: 'square' },
      { draw: 'cross' },
      { draw: 'plus' },
      { draw: 'minus' },
      { draw: 'star' },
      { draw: 'diamond' },
      { draw: 'icon' },
      { draw: 'text' },
      { draw: 'path' },
    ],
  }, {
    name: 'Range',
    children: [
      { draw: 'line' },
      { draw: 'bar' },
      { draw: 'section' },
    ],
  }
]);

const linksSelection = ref([
  {
    name: 'Line',
    children: [
      { draw: 'line' },
      { draw: 'curve' },
      { draw: 'step-start' },
      { draw: 'step' },
      { draw: 'step-end' },
    ]
  }, {
    name: 'Area',
    children: [
      { draw: 'area' },
      { draw: 'curve-area' },
      { draw: 'step-area-start' },
      { draw: 'step-area' },
      { draw: 'step-area-end' },
    ]
  }
]);

const options = ref();

function randomColor() {
  return '#' + [...Array(3)].map(() => Math.floor(Math.random() * 255).toString(16).padStart(2, '0')).join('');
}

const INDENT_UNIT = '  ';

const highlightedOptions = computed(() =>
  highlightTypeScript(`const options = ${serializeValue(options.value ?? {})};`),
);

function serializeValue(value, indentLevel = 0) {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'string') return `"${escapeString(value)}"`;
  if (typeof value === 'function') return value.toString();

  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    const nextIndent = INDENT_UNIT.repeat(indentLevel + 1);
    const items = value.map((item) => `${nextIndent}${serializeValue(item, indentLevel + 1)}`);
    return `[\n${items.join(',\n')}\n${INDENT_UNIT.repeat(indentLevel)}]`;
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value);
    if (entries.length === 0) return '{}';
    const nextIndent = INDENT_UNIT.repeat(indentLevel + 1);
    const lines = entries.map(([key, val]) => `${nextIndent}${formatKey(key)}: ${serializeValue(val, indentLevel + 1)},`);
    return `{\n${lines.join('\n')}\n${INDENT_UNIT.repeat(indentLevel)}}`;
  }

  return 'null';
}

function escapeString(input) {
  return input.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function formatKey(key) {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key) ? key : JSON.stringify(key);
}

function highlightTypeScript(code) {
  const escaped = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const tokenPattern = /("(?:\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*"(?:\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g;
  return escaped.replace(tokenPattern, (match) => {
    let className = 'number';
    if (/^"/.test(match)) {
      className = match.endsWith(':') ? 'key' : 'string';
    } else if (/true|false/.test(match)) {
      className = 'boolean';
    } else if (/null/.test(match)) {
      className = 'null';
    }
    return `<span class="token ${className}">${match}</span>`;
  });
}
</script>

# Marks & Links

Build a chart from per-row marks and links between rows, then inspect the resulting configuration.

## Try it

Change the line link to a curve, add a mark, and change its shape. For an area link, choose `min` and `max` in **using** to shade the range between those fields. Open **Details** to adjust stroke and fill settings.

<div class="fill-playground">
<div class="chart-preview">
  <Example v-model="options" :links="linksFinal" :marks="marksFinal" />
</div>

<div class="chart-controls">
  <p class="control-hint">Pick a palette color, or choose Auto at the bottom of the fill palette. A marks an automatic fill. Details opens stroke and drawing options below each row.</p>
  <section v-for="group in controls" :key="group.kind" class="layer-list">
    <div class="panel-heading">
      <strong>{{ group.name }} <span class="count-badge">{{ group.rows.length }}</span></strong>
      <button type="button" @click="group.rows.push({ draw: group.kind === 'mark' ? 'star' : 'area', color: randomColor(), fillColor: '', fillOpacity: 1 })">+ Add {{ group.kind }}</button>
    </div>
    <div v-for="(row, idx) in group.rows" :key="idx" class="compact-layer">
      <label class="control-field">draw
          <select v-model="row.draw" :aria-label="`${group.kind} ${idx + 1} draw`">
            <optgroup v-for="selection in group.selection" :key="selection.name" :label="selection.name">
              <option v-for="sel in selection.children" :key="sel.draw" :value="sel.draw">{{ sel.draw }}</option>
            </optgroup>
          </select>
      </label>
      <div class="control-field">color<ChartColorInput v-model="row.color" :label="`${group.kind} ${idx + 1} color`" /></div>
        <div v-if="hasFill(group.kind, row.draw)" class="control-field inline-fill-color">
          <span>fillColor</span>
          <ChartColorInput v-model="row.fillColor" :label="`${group.kind} ${idx + 1} fillColor`" :auto-color="autoFillColor(group.kind, row)" />
        </div>
      <span v-else class="no-fill-settings" aria-label="No fill settings">—</span>
      <label class="control-field">size <output>{{ hasSize(group.kind, row.draw) ? row.size ?? markStyles[row.draw]?.size ?? 20 : '—' }}</output><input class="size-input" type="range" min="0" max="32" step="1" :value="row.size ?? markStyles[row.draw]?.size ?? 20" :disabled="!hasSize(group.kind, row.draw)" :aria-label="`${group.kind} ${idx + 1} size`" @input="setNumber(row, 'size', $event.target.value)" /></label>
      <label class="control-field">lineDashArray<select class="dash-select" :value="row.lineDash ?? 'solid'" :disabled="!hasStroke(group.kind, row.draw)" :aria-label="`${group.kind} ${idx + 1} lineDashArray`" @change="row.lineDash = $event.target.value"><option v-for="preset in dashPresets" :key="preset.value" :value="preset.value">{{ preset.name }}</option></select></label>
      <button type="button" class="details-toggle" title="Details" :aria-label="`Details for ${group.kind} ${idx + 1}`" :aria-controls="`${group.kind}-${idx}-details`" :aria-expanded="!!row.expanded" @click="row.expanded = !row.expanded">⋯</button>
      <button type="button" class="remove-layer" :aria-label="`Remove ${group.kind} ${idx + 1}`" @click="group.rows.splice(idx, 1)">×</button>
      <div class="inline-using">
        <span>using</span>
        <div class="using-selectors">
        <select :value="usingValues(group.kind, row)[0]" :aria-label="`${group.kind} ${idx + 1} using ${usesTwoValues(group.kind, row.draw) ? 'start' : 'value'}`" @change="setUsing(group.kind, row, 0, $event.target.value)">
          <option v-for="value in usingOptions" :key="value" :value="value">{{ value }}</option>
        </select>
        <template v-if="usesTwoValues(group.kind, row.draw)">
          <span aria-hidden="true">→</span>
          <select :value="usingValues(group.kind, row)[1]" :aria-label="`${group.kind} ${idx + 1} using end`" @change="setUsing(group.kind, row, 1, $event.target.value)">
            <option v-for="value in usingOptions" :key="value" :value="value">{{ value }}</option>
          </select>
        </template>
        </div>
      </div>
      <div v-if="row.expanded" :id="`${group.kind}-${idx}-details`" class="layer-details">
        <template v-if="hasStroke(group.kind, row.draw)">
          <div class="control-field">lineColor<ChartColorInput :model-value="row.lineColor ?? ''" :label="`${group.kind} ${idx + 1} lineColor`" :auto-color="row.color" @update:model-value="row.lineColor = $event" /></div>
          <label class="control-field">lineWidth<input class="line-width-input" type="number" min="0" step="0.5" :value="row.lineWidth ?? (group.kind === 'link' ? 2 : markStyles[row.draw]?.lineWidth ?? 1)" :aria-label="`${group.kind} ${idx + 1} lineWidth`" @input="setNumber(row, 'lineWidth', $event.target.value)" /></label>
        </template>
        <label v-if="hasFill(group.kind, row.draw)" class="control-field inline-fill-opacity">fillOpacity <output>{{ row.fillOpacity.toFixed(2) }}</output><input v-model.number="row.fillOpacity" type="range" min="0" max="1" step="0.01" :aria-label="`${group.kind} ${idx + 1} fillOpacity`" /></label>
        <label v-if="hasAngle(group.kind, row.draw)" class="control-field">angle <output>{{ row.angle ?? 0 }}°</output><input class="angle-input" type="range" min="0" max="360" step="1" :value="row.angle ?? 0" :aria-label="`${group.kind} ${idx + 1} angle`" @input="setNumber(row, 'angle', $event.target.value)" /></label>
        <p v-if="!hasStroke(group.kind, row.draw) && !hasAngle(group.kind, row.draw) && !hasFill(group.kind, row.draw)" class="control-hint">No additional settings for this drawing type.</p>
      </div>
    </div>
  </section>
</div>

</div>

## Options

<pre class="code-block"><code class="language-typescript" v-html="highlightedOptions"></code></pre>

## How it works

- Marks draw individual rows; links connect adjacent rows. Each layer chooses its own `draw`, `using`, and `style`.
- `using` selects named value fields. `#zero` is the zero baseline; `#top` and `#bottom` refer to drawing-region edges.
- The Options panel reflects your current choices. It is configuration, not a complete initialization script: pass it to a mounted Timescope instance with a target and dispose the instance on teardown.
- Layers are drawn together within the same chart. Use Tracks for separate drawing regions and Domains to control value scales.

## Next steps

Start with [Chart Presets](./chart-presets) for ready-made combinations. [Gantt Chart](./gantt-chart) uses named time fields, while [Styling](./styling) customizes axes and backgrounds. See [Core Concepts](/guide/concepts) for selectors and drawing layers.

<style scoped>
@import url('https://cdn.jsdelivr.net/npm/@mdi/font@7.4.47/css/materialdesignicons.min.css');
@import './chart-controls.css';

.chart-preview {
  padding: 8px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  background: var(--vp-c-bg);
}

pre {
  width: 100%;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  overflow: auto;
  padding: 8px;
}

:deep(.code-block) {
  background-color: var(--vp-code-block-bg, var(--vp-c-bg-alt));
  color: var(--vp-code-block-color, inherit);
}

:deep(.code-block code) {
  display: block;
  font-family: var(--vp-font-family-mono, SFMono-Regular, Consolas, 'Liberation Mono', Menlo, monospace);
  font-size: 0.875rem;
  line-height: 1.5;
}

:deep(.code-block .token.string) {
  color: var(--vp-c-green-2, #0ba360);
}

:deep(.code-block .token.key) {
  color: var(--vp-c-purple-2, #c792ea);
}

:deep(.code-block .token.number) {
  color: var(--vp-c-yellow-2, #d19a66);
}

:deep(.code-block .token.boolean) {
  color: var(--vp-c-red-2, #f07178);
}

:deep(.code-block .token.null) {
  color: var(--vp-c-gray-2, #94a3b8);
}
</style>
