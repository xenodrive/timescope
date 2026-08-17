<script setup>
import Example from '@/guide/examples/marks-and-links.vue';
import { ref, computed } from 'vue';

const links = ref([
  { draw: 'line', color: 'green' },
]);
const marks = ref([
  { draw: 'section', color: 'green' },
  { draw: 'star', color: 'green' },
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

function markColorStyle(draw, color) {
  if (!color || draw === 'path') return {};
  if (draw === 'text') return { textColor: color };
  if (draw === 'icon') return { iconColor: color };
  if (['cross', 'plus', 'minus', 'line', 'section'].includes(draw)) return { lineColor: color };
  return { lineColor: color, fillColor: color };
}

const marksFinal = computed(() => {
  return marks.value.map(({ color, ...mark }) => ({
    ...mark,
    style: {
      ...(markStyles[mark.draw] ?? {}),
      ...markColorStyle(mark.draw, color),
    },
  }));
});

const linksFinal = computed(() => {
  return links.value.map(({ color, ...link }) => ({
    ...link,
    style: {
      lineWidth: 2,
      lineColor: color,
      ...(link.draw.includes('area') ? { fillColor: color } : {}),
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

## Example

<table>
  <caption style="text-align: left">marks:</caption>
  <thead>
    <tr>
      <th>#</th>
      <th>draw</th>
      <th>color</th>
      <th></th>
    </tr>
  </thead>
  <tbody>
    <tr v-for="(mark, idx) in marks">
      <td>
        {{ idx }}
      </td>
      <td>
        <select v-model="mark.draw">
          <optgroup v-for="group in marksSelection" :label="group.name">
            <option v-for="sel in group.children" :key="sel.draw" :value="sel.draw">{{ sel.draw }}</option>
          </optgroup>
        </select>
      </td>
      <td>
        <input type="text" v-model="mark.color" :disabled="mark.draw === 'path'" />
      </td>
      <td>
        <button @click="marks.splice(idx, 1)">-</button>
      </td>
    </tr>
    <tr>
      <td><button @click="marks.push({ draw: 'star', color: randomColor() })">+</button></td>
      <td></td>
      <td></td>
      <td></td>
    </tr>
  </tbody>
</table>
<table>
  <caption style="text-align: left">links:</caption>
  <thead>
    <tr>
      <th>#</th>
      <th>draw</th>
      <th>color</th>
      <th></th>
    </tr>
  </thead>
  <tbody>
    <tr v-for="(link, idx) in links">
      <td>
        {{ idx }}
      </td>
      <td>
        <select v-model="link.draw">
          <optgroup v-for="group in linksSelection" :label="group.name">
            <option v-for="sel in group.children" :key="sel.draw" :value="sel.draw">{{ sel.draw }}</option>
          </optgroup>
        </select>
      </td>
      <td>
        <input type="text" v-model="link.color" />
      </td>
      <td>
        <button @click="links.splice(idx, 1)">-</button>
      </td>
    </tr>
    <tr>
      <td><button @click="links.push({ draw: 'line', color: randomColor() })">+</button></td>
      <td></td>
      <td></td>
      <td></td>
    </tr>
  </tbody>
</table>

<Example v-model="options" :links="linksFinal" :marks="marksFinal" />

## Options

<pre class="code-block"><code class="language-typescript" v-html="highlightedOptions"></code></pre>

<style scoped>
@import url('https://cdn.jsdelivr.net/npm/@mdi/font@7.4.47/css/materialdesignicons.min.css');

select {
  background: transparent;
  position: relative;
  border: 1px solid #ccc;
  padding: 0 0.5rem;
}
input {
  border: 1px solid #ccc;
  padding: 0 0.5rem;
}
button {
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 4px;
  background: #ccc;
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
