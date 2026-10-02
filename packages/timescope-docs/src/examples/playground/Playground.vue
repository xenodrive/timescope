<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { Timescope, defaultOptions } from 'timescope';
import { useRoute } from 'vitepress';
import { highlight } from '../../../.vitepress/theme/components/gallery-highlight';
import ChartColorInput from '../../../.vitepress/theme/components/ChartColorInput.vue';
import {
  buildOptions,
  defaultSize,
  defaultUsing,
  initialState,
  newDomain,
  newLayer,
  newSeries,
  newTrack,
  optionsCode,
  remove,
  rename,
} from './options.js';
import { presets } from './presets.js';
import { datasets } from './datasets.js';

const state = reactive(initialState());
const route = useRoute();
const target = ref();
const dialog = ref();
const form = ref();
const editor = ref();
const error = ref('');
const copied = ref(false);
const omitDefaults = ref(true);
const highlighted = ref('');
const sourceFields = computed(() => fieldsFor(editor.value?.draft.source ?? 'measurements'));
const dataFields = computed(() => Object.keys(rowsFor(editor.value?.draft.source ?? 'measurements')[0]?.data ?? {}));
const fields = computed(() => [...sourceFields.value, '#zero', '#top', '#bottom']);
const seriesAutoColor = computed(() => {
  const index = state.series.findIndex((series) => series.id === editor.value?.original);
  const preceding = state.series.slice(0, Math.max(0, index)).filter((series) => !series.color).length;
  const colors = defaultOptions.series.colors;
  return colors[preceding % colors.length];
});
const collections = ['general', 'sources', 'tracks', 'series', 'domains'];
const active = ref('general');
const options = computed(() => buildOptions(state));
const sourceItems = computed(() =>
  [...Object.keys(datasets), ...state.sources].map((id) => ({ id, builtIn: Object.hasOwn(datasets, id) })),
);
const code = computed(() => optionsCode(options.value, omitDefaults.value, state));
const alternatives = computed(() =>
  editor.value
    ? (editor.value.collection === 'sources' ? sourceItems.value : state[editor.value.collection]).filter(
        (item) => item.id !== editor.value.original,
      )
    : [],
);
const references = computed(() => {
  if (!editor.value || editor.value.collection === 'series') return [];
  const key = { tracks: 'track', domains: 'domain', sources: 'source' }[editor.value.collection];
  return state.series.filter((series) => series[key] === editor.value.original);
});
let timescope;
let fontSource;
let copyTimer;

watch(
  code,
  async (value, _, onCleanup) => {
    copied.value = false;
    highlighted.value = '';
    let cancelled = false;
    onCleanup(() => {
      cancelled = true;
    });
    const html = await highlight(value, 'javascript');
    if (!cancelled) highlighted.value = html;
  },
  { immediate: true },
);

onMounted(() => {
  readPresetUrl();
  timescope = new Timescope({ ...options.value, target: target.value });
  fontSource = options.value.fonts?.[0];
  window.addEventListener('popstate', readPresetUrl);
});
watch(() => route.path, readPresetUrl);
watch(options, (value) => {
  try {
    if (timescope && fontSource !== value.fonts?.[0]) {
      timescope.dispose();
      timescope = new Timescope({ ...value, target: target.value });
      fontSource = value.fonts?.[0];
    } else {
      const { time, zoom, fit, fonts, ...configuration } = value;
      timescope?.setOptions({ ...configuration, target: target.value });
    }
    error.value = '';
  } catch (cause) {
    error.value = cause.message;
  }
});
watch(
  [
    () => state.viewMode,
    () => state.range,
    () => state.fitPadding,
    () => state.time,
    () => state.zoom,
    () => state.width,
  ],
  async () => {
    await nextTick();
    applyView();
  },
);
onBeforeUnmount(() => {
  window.removeEventListener('popstate', readPresetUrl);
  timescope?.dispose();
  clearTimeout(copyTimer);
});

function unique(collection, base) {
  let id = base;
  let index = 2;
  const items =
    collection === 'sources' ? Object.keys(datasets).concat(state.sources) : state[collection].map((item) => item.id);
  while (items.includes(id)) id = `${base}${index++}`;
  return id;
}

function add(collection) {
  if (collection === 'sources') {
    const id = unique('sources', 'source');
    state.sources.push(id);
    state.data[id] = [{ time: 0, value: 0 }];
    editSource(id);
    return;
  }
  const id = unique(collection, { tracks: 'track', series: 'series', domains: 'domain' }[collection]);
  const item =
    collection === 'tracks'
      ? newTrack(id)
      : collection === 'domains'
        ? newDomain(id)
        : newSeries(id, state.tracks[0].id);
  if (collection === 'series') item.source = Object.keys(options.value.sources)[0] ?? 'measurements';
  state[collection].push(item);
}

function duplicate(collection, item) {
  if (collection === 'sources') {
    const id = unique('sources', `${item.id}Copy`);
    state.sources.push(id);
    state.data[id] = JSON.parse(JSON.stringify(rowsFor(item.id)));
    return;
  }
  state[collection].push({ ...JSON.parse(JSON.stringify(item)), id: unique(collection, `${item.id}Copy`) });
}

function move(index, direction) {
  const [track] = state.tracks.splice(index, 1);
  state.tracks.splice(index + direction, 0, track);
}

async function edit(collection, item, deleting = false) {
  editor.value = {
    collection,
    original: item.id,
    draft: JSON.parse(JSON.stringify(item)),
    deleting,
    replacement: '',
    error: '',
  };
  await nextTick();
  dialog.value.showModal();
}

function editSource(id, deleting = false) {
  edit('sources', { id }, deleting);
  if (!deleting) editor.value.json = JSON.stringify(rowsFor(id), null, 2);
}

async function loadPreset(event) {
  const preset = presets.find((preset) => preset.id === event.target.value);
  Object.assign(state, preset ? preset.create() : initialState());
  copied.value = false;
  event.target.value = '';
  const url = new URL(location.href);
  if (preset) url.searchParams.set('preset', preset.id);
  else url.searchParams.delete('preset');
  history.replaceState(history.state, '', url);
  await nextTick();
  applyView();
}

async function readPresetUrl() {
  const id = new URL(location.href).searchParams.get('preset');
  const preset = presets.find((preset) => preset.id === id);
  Object.assign(state, preset ? preset.create() : initialState());
  await nextTick();
  applyView();
}

function applyView() {
  if (state.viewMode === 'fit') timescope?.fitTo(state.range, { padding: state.fitPadding, animation: false });
  else {
    timescope?.setTime(state.time, false);
    timescope?.setZoom(state.zoom, false);
  }
}

function changeViewMode(event) {
  if (event.target.value === 'timeZoom') {
    state.time = timescope?.time?.number() ?? state.time;
    state.zoom = timescope?.zoom ?? state.zoom;
  } else if (timescope?.size.width) {
    const span = timescope.size.width * 2 ** -timescope.zoom;
    const center = timescope.time?.number() ?? state.time ?? Date.now() / 1000;
    state.range = [center - span / 2, center + span / 2];
    state.fitPadding = 0;
  }
  state.viewMode = event.target.value;
}

function followClock(event) {
  state.time = event.target.checked ? null : Date.now() / 1000;
}

function changeLayerFont(layer, family) {
  if (family) layer.font = { ...layer.font, family };
  else delete layer.font;
}

function rowsFor(name) {
  return state.data[name] ?? datasets[name]?.data ?? [];
}

function fieldsFor(name) {
  const row = rowsFor(name)[0];
  if (row?.values)
    return Object.keys(row.values).flatMap((field) =>
      row.times ? Object.keys(row.times).map((time) => `${field}@${time}`) : [field],
    );
  return row?.value !== undefined ? ['value'] : (datasets[name]?.fields ?? []);
}

function parseRows(json) {
  const rows = JSON.parse(json);
  if (
    !Array.isArray(rows) ||
    rows.length === 0 ||
    rows.some(
      (row) =>
        !row ||
        typeof row !== 'object' ||
        Array.isArray(row) ||
        !(
          Number.isFinite(row.time) ||
          (row.times &&
            typeof row.times === 'object' &&
            !Array.isArray(row.times) &&
            Object.values(row.times).length > 0 &&
            Object.values(row.times).every(Number.isFinite))
        ) ||
        !(Object.hasOwn(row, 'value') || (row.values && typeof row.values === 'object' && !Array.isArray(row.values))),
    )
  ) {
    throw new Error('Provide a non-empty array of rows with a numeric time (or times) and value (or values).');
  }
  return rows;
}

function resetSource(id) {
  if (editor.value?.collection === 'sources' && editor.value.original === id) {
    editor.value.json = JSON.stringify(datasets[id].data, null, 2);
  }
}

function changeSource() {
  const draft = editor.value.draft;
  draft.field = fieldsFor(draft.source)[0] ?? 'value';
  for (const layer of draft.layers) {
    layer.from = draft.field;
    layer.to = draft.field;
    layer.colorField = '';
    layer.textField = '';
  }
}

function apply() {
  if (!form.value.reportValidity()) return;
  const { collection, original, draft, deleting, replacement } = editor.value;
  if (collection === 'sources') {
    if (deleting) {
      if (Object.hasOwn(datasets, original)) return;
      for (const series of references.value) series.source = replacement;
      state.sources.splice(state.sources.indexOf(original), 1);
      delete state.data[original];
    } else {
      const id = draft.id.trim();
      if (
        !/^[A-Za-z_$][\w$]*$/.test(id) ||
        (id !== original &&
          (Object.hasOwn(datasets, original) || Object.hasOwn(datasets, id) || state.sources.includes(id)))
      ) {
        editor.value.error = 'Choose a unique JavaScript identifier for the source ID.';
        return;
      }
      let rows;
      try {
        rows = parseRows(editor.value.json);
      } catch (cause) {
        editor.value.error = cause.message;
        return;
      }
      if (id !== original) {
        if (Object.hasOwn(datasets, original)) return;
        state.sources[state.sources.indexOf(original)] = id;
        for (const series of references.value) series.source = id;
        delete state.data[original];
      }
      if (Object.hasOwn(datasets, id) && editor.value.json === JSON.stringify(datasets[id].data, null, 2)) {
        delete state.data[id];
      } else {
        state.data[id] = rows;
      }
    }
    dialog.value.close();
    return;
  }
  if (deleting) {
    remove(state, collection, original, replacement);
  } else {
    draft.id = draft.id.trim();
    if (!draft.id || state[collection].some((item) => item.id === draft.id && item.id !== original)) {
      editor.value.error = 'Choose a non-empty, unique ID.';
      return;
    }
    if (collection === 'domains') {
      const { lower, upper, scale } = draft;
      if (
        (lower !== '' && upper !== '' && Number(lower) >= Number(upper)) ||
        (scale === 'log' && ((lower !== '' && lower <= 0) || (upper !== '' && upper <= 0)))
      ) {
        editor.value.error = 'Bounds must be ordered and logarithmic bounds must be positive.';
        return;
      }
    }
    if (collection === 'tracks' && draft.timeAxis && !draft.relative && !['local', 'utc'].includes(draft.timeZone)) {
      try {
        new Intl.DateTimeFormat('en', { timeZone: draft.timeZone });
      } catch {
        editor.value.error = 'Enter a valid IANA time zone, such as Asia/Tokyo.';
        return;
      }
    }
    const index = state[collection].findIndex((item) => item.id === original);
    rename(state, collection, original, draft.id);
    state[collection][index] = JSON.parse(JSON.stringify(draft));
  }
  dialog.value.close();
}

async function copy() {
  try {
    await navigator.clipboard.writeText(code.value);
    copied.value = true;
    clearTimeout(copyTimer);
    copyTimer = setTimeout(() => {
      copied.value = false;
    }, 1500);
  } catch {
    error.value = 'Could not copy. Select and copy the code below.';
  }
}
</script>

<template>
  <div class="timescope-playground">
    <div class="playground-preview">
      <div class="playground-toolbar">
        <strong>Preview</strong>
        <div class="playground-actions">
          <select aria-label="Load preset" value="" @change="loadPreset">
            <option value="" disabled>Load preset</option>
            <option value="defaults">Timescope defaults</option>
            <option v-for="preset in presets" :key="preset.id" :value="preset.id">{{ preset.name }}</option>
          </select>
        </div>
      </div>
      <div ref="target" :style="{ width: state.width, height: state.height, background: state.background }"></div>
    </div>
    <p v-if="error" role="alert">{{ error }}</p>
    <div class="playground-workspace">
      <section class="playground-config" aria-label="Configuration">
        <div class="playground-tabs" aria-label="Configuration section">
          <button
            v-for="collection in collections"
            :key="collection"
            :aria-pressed="active === collection"
            @click="active = collection">
            {{ collection }}
          </button>
        </div>
        <div v-if="active === 'general'" class="playground-general">
          <h2>Canvas &amp; view</h2>
          <div class="playground-fields">
            <label>Target width <input v-model="state.width" placeholder="100%" /></label>
            <label>Target height <input v-model="state.height" placeholder="auto (36px fallback)" /></label>
            <label>Target background <ChartColorInput v-model="state.background" label="Target background" /></label>
            <label><input v-model="state.loadMdiFont" type="checkbox" /> Load MDI font</label>
            <label><input v-model="state.cursorEnabled" type="checkbox" /> Time cursor</label>
            <label v-if="state.cursorEnabled"
              >Cursor color <ChartColorInput v-model="state.cursorColor" label="Cursor color"
            /></label>
            <label v-if="state.cursorEnabled"
              >Cursor border color <ChartColorInput v-model="state.cursorBorderColor" label="Cursor border color"
            /></label>
            <label
              >Initial view
              <select :value="state.viewMode" @change="changeViewMode">
                <option value="fit">Fit range</option>
                <option value="timeZoom">Time &amp; zoom</option>
              </select></label
            >
            <template v-if="state.viewMode === 'fit'">
              <label>Range start <input v-model.number="state.range[0]" type="number" step="any" /></label>
              <label>Range end <input v-model.number="state.range[1]" type="number" step="any" /></label>
              <label
                >Fit padding (px) <input v-model.number="state.fitPadding" type="number" min="0" step="any"
              /></label>
            </template>
            <template v-else>
              <label
                ><input :checked="state.time === null" type="checkbox" @change="followClock" /> Follow live clock</label
              >
              <label v-if="state.time !== null"
                >Time <input v-model.number="state.time" type="number" step="any"
              /></label>
              <label>Zoom <input v-model.number="state.zoom" type="number" step="any" /></label>
            </template>
          </div>
        </div>
        <p v-if="active === 'series'" class="playground-note">
          Tracks share time. Series choose a Track and a Domain; several Series can share either.
        </p>
        <article
          v-for="(item, index) in active === 'general' ? [] : active === 'sources' ? sourceItems : state[active]"
          :key="item.id"
          class="playground-item">
          <div class="playground-toolbar">
            <strong>{{ item.id }}</strong
            ><button
              :aria-label="`Edit ${item.id}`"
              @click="active === 'sources' ? editSource(item.id) : edit(active, item)">
              Settings…
            </button>
          </div>
          <p v-if="active === 'sources'" class="playground-note">
            {{ rowsFor(item.id).length }} rows · {{ item.builtIn ? 'Built-in' : 'Custom' }}
          </p>
          <template v-else-if="active === 'series'">
            <label
              >Track
              <select v-model="item.track">
                <option v-for="track in state.tracks" :key="track.id">{{ track.id }}</option>
              </select></label
            >
            <label
              >Domain
              <select v-model="item.domain">
                <option value="">Auto (independent)</option>
                <option v-for="domain in state.domains" :key="domain.id">{{ domain.id }}</option>
              </select></label
            >
            <p class="playground-note">{{ item.layers.length }} drawing layers · {{ item.name }}</p>
          </template>
          <p v-else-if="active === 'tracks'" class="playground-note">
            {{ item.height === '' ? 'Auto height' : `${item.height}px` }} ·
            {{ item.timeAxis ? (item.relative ? 'Relative time' : item.timeZone) : 'No time axis' }}
          </p>
          <p v-else-if="active === 'domains'" class="playground-note">
            {{ item.scale }} · {{ item.lower === '' ? 'auto' : item.lower }} …
            {{ item.upper === '' ? 'auto' : item.upper }}
          </p>
          <div class="playground-actions">
            <button @click="duplicate(active, item)">Duplicate</button>
            <template v-if="active === 'tracks'">
              <button :disabled="index === 0" :aria-label="`Move ${item.id} up`" @click="move(index, -1)">↑</button>
              <button
                :disabled="index === state.tracks.length - 1"
                :aria-label="`Move ${item.id} down`"
                @click="move(index, 1)">
                ↓
              </button>
            </template>
            <button
              :disabled="
                active === 'sources'
                  ? item.builtIn
                  : (active === 'tracks' && state.tracks.length === 1) ||
                    (active === 'domains' &&
                      state.domains.length === 1 &&
                      state.series.some((series) => series.domain === item.id))
              "
              @click="active === 'sources' ? editSource(item.id, true) : edit(active, item, true)">
              Delete…
            </button>
          </div>
        </article>
        <button v-if="active !== 'general'" class="playground-add" @click="add(active)">
          Add {{ active === 'series' ? 'series' : active.slice(0, -1) }}
        </button>
      </section>
      <section class="playground-output" aria-label="Generated options">
        <div class="playground-toolbar">
          <strong>options</strong>
          <div class="playground-actions">
            <label><input v-model="omitDefaults" type="checkbox" /> Omit defaults</label>
            <button @click="copy">{{ copied ? 'Copied' : 'Copy options' }}</button>
          </div>
        </div>
        <div v-if="highlighted" class="playground-code" v-html="highlighted"></div>
        <pre v-else class="playground-code"><code>{{ code }}</code></pre>
      </section>
    </div>
    <dialog ref="dialog" class="playground-dialog" aria-labelledby="settings-title" @close="editor = undefined">
      <form v-if="editor" ref="form" @submit.prevent="apply">
        <div class="playground-toolbar">
          <h2 id="settings-title">{{ editor.deleting ? 'Delete' : 'Edit' }} {{ editor.original }}</h2>
          <button type="button" aria-label="Close settings" @click="dialog.close()">✕</button>
        </div>
        <p v-if="editor.error" role="alert">{{ editor.error }}</p>
        <template v-if="editor.deleting">
          <p>Delete {{ editor.original }}?</p>
          <template v-if="references.length">
            <p>Used by: {{ references.map((item) => item.id).join(', ') }}. Move these series to:</p>
            <label
              >Replacement
              <select v-model="editor.replacement" required>
                <option disabled value="">Choose a replacement</option>
                <option v-for="item in alternatives" :key="item.id">{{ item.id }}</option>
              </select></label
            >
          </template>
        </template>
        <template v-else>
          <label
            >ID
            <input
              v-model="editor.draft.id"
              :readonly="editor.collection === 'sources' && Object.hasOwn(datasets, editor.original)"
              required
          /></label>
          <div v-if="editor.collection === 'sources'">
            <label class="playground-json-label" for="playground-source-json">JSON data</label>
            <textarea id="playground-source-json" v-model="editor.json" spellcheck="false" rows="14"></textarea>
            <button v-if="Object.hasOwn(datasets, editor.original)" type="button" @click="resetSource(editor.original)">
              Reset data
            </button>
          </div>
          <div v-if="editor.collection === 'tracks'" class="playground-fields">
            <label
              >Height (px)
              <input v-model.number="editor.draft.height" type="number" min="0" max="1200" placeholder="Auto"
            /></label>
            <label><input v-model="editor.draft.timeAxis" type="checkbox" /> Show time axis</label>
            <label
              ><input v-model="editor.draft.relative" type="checkbox" :disabled="!editor.draft.timeAxis" /> Relative
              time</label
            >
            <label v-if="editor.draft.timeAxis && !editor.draft.relative"
              >Time zone <input v-model="editor.draft.timeZone" required list="playground-timezones"
            /></label>
            <datalist id="playground-timezones">
              <option>local</option>
              <option>utc</option>
              <option>Asia/Tokyo</option>
              <option>America/New_York</option>
              <option>Europe/London</option>
            </datalist>
          </div>
          <div v-else-if="editor.collection === 'domains'" class="playground-fields">
            <label
              >Scale
              <select v-model="editor.draft.scale">
                <option>linear</option>
                <option>log</option>
              </select></label
            >
            <label
              >Lower bound <input v-model.number="editor.draft.lower" type="number" step="any" placeholder="Automatic"
            /></label>
            <label
              >Upper bound <input v-model.number="editor.draft.upper" type="number" step="any" placeholder="Automatic"
            /></label>
            <label><input v-model="editor.draft.expand" type="checkbox" /> Expand to data</label>
            <label><input v-model="editor.draft.shrink" type="checkbox" /> Shrink to data</label>
            <label>Floating gap (px) <input v-model.number="editor.draft.gap" type="number" min="0" required /></label>
            <label
              >Axis
              <select v-model="editor.draft.axis">
                <option>left</option>
                <option>right</option>
                <option>none</option>
              </select></label
            >
            <label>Unit <input v-model="editor.draft.unit" /></label>
            <label
              >Axis digits
              <input v-model.number="editor.draft.digits" type="number" min="0" max="10" placeholder="Auto"
            /></label>
          </div>
          <template v-else-if="editor.collection === 'series'">
            <div class="playground-fields">
              <label>Name <input v-model="editor.draft.name" /></label>
              <label
                >DataSource
                <select v-model="editor.draft.source" @change="changeSource">
                  <option v-for="name in [...new Set([...Object.keys(datasets), ...state.sources])]" :key="name">
                    {{ name }}
                  </option>
                </select></label
              >
              <label
                >Color <ChartColorInput v-model="editor.draft.color" label="Series color" :auto-color="seriesAutoColor"
              /></label>
              <label
                >Track
                <select v-model="editor.draft.track">
                  <option v-for="item in state.tracks" :key="item.id">{{ item.id }}</option>
                </select></label
              >
              <label
                >Domain
                <select v-model="editor.draft.domain">
                  <option value="">Auto (independent)</option>
                  <option v-for="item in state.domains" :key="item.id">{{ item.id }}</option>
                </select></label
              >
              <label
                >Tooltip field
                <select v-model="editor.draft.field">
                  <option v-for="field in sourceFields" :key="field">{{ field }}</option>
                </select></label
              >
              <label><input v-model="editor.draft.tooltip" type="checkbox" /> Tooltip</label>
            </div>
            <h3>Drawing layers</h3>
            <fieldset v-for="(layer, index) in editor.draft.layers" :key="index">
              <legend>{{ layer.kind }} {{ index + 1 }}</legend>
              <div class="playground-fields">
                <label
                  >Draw
                  <select v-model="layer.draw">
                    <option
                      v-for="draw in layer.kind === 'mark'
                        ? ['circle', 'square', 'triangle', 'diamond', 'star', 'bar', 'section', 'text', 'icon', 'path']
                        : ['line', 'curve', 'step', 'area', 'curve-area', 'step-area']"
                      :key="draw">
                      {{ draw }}
                    </option>
                  </select></label
                >
                <label
                  >Using
                  <select v-model="layer.from">
                    <option value="">Auto ({{ defaultUsing(layer.kind, layer.draw)[0] }})</option>
                    <option v-for="field in fields" :key="field">{{ field }}</option>
                  </select></label
                >
                <label v-if="layer.draw.includes('area') || ['bar', 'section'].includes(layer.draw)"
                  >To
                  <select v-model="layer.to">
                    <option value="">Auto ({{ defaultUsing(layer.kind, layer.draw)[1] }})</option>
                    <option v-for="field in fields" :key="field">{{ field }}</option>
                  </select></label
                >
                <label>
                  Color
                  <ChartColorInput
                    v-model="layer.color"
                    label="Layer color"
                    :auto-color="editor.draft.color || seriesAutoColor" />
                </label>
                <label v-if="!['text', 'icon'].includes(layer.draw)"
                  >Line width <input v-model.number="layer.width" type="number" min="0" max="20" step="0.5" required
                /></label>
                <label v-if="!['text', 'icon'].includes(layer.draw)"
                  >Stroke
                  <select v-model="layer.stroke">
                    <option>solid</option>
                    <option>dashed</option>
                    <option>dotted</option>
                  </select></label
                >
                <label v-if="layer.kind === 'mark'"
                  >Size
                  <input
                    v-model.number="layer.size"
                    type="number"
                    min="1"
                    max="80"
                    :placeholder="`Auto (${defaultSize(layer.draw)})`"
                /></label>
                <label
                  v-if="
                    layer.draw.includes('area') ||
                    (layer.kind === 'mark' && !['text', 'icon', 'section'].includes(layer.draw))
                  "
                  >Fill opacity <input v-model.number="layer.opacity" type="number" min="0" max="1" step="any" required
                /></label>
                <label
                  >Color from data
                  <select v-model="layer.colorField">
                    <option value="">Series / custom color</option>
                    <option v-if="dataFields.includes('color')" value="color">data.color</option>
                  </select></label
                >
                <label v-if="layer.draw === 'bar'"
                  >Radius <input v-model.number="layer.radius" type="number" min="0" required
                /></label>
                <template v-if="layer.draw === 'text' || layer.draw === 'icon'">
                  <label
                    >Text from data
                    <select v-model="layer.textField">
                      <option value="">Fixed text</option>
                      <option
                        v-for="field in ['name', 'label', 'symbol'].filter((field) => dataFields.includes(field))"
                        :key="field"
                        :value="field">
                        data.{{ field }}
                      </option>
                    </select></label
                  >
                  <label v-if="!layer.textField">Text <input v-model="layer.text" /></label>
                </template>
                <label v-if="layer.draw === 'icon'">
                  Font family
                  <input
                    :value="layer.font?.family ?? ''"
                    placeholder="icons"
                    @input="changeLayerFont(layer, $event.target.value)" />
                </label>
                <template v-if="layer.draw === 'text'">
                  <label>Horizontal offset <input v-model.number="layer.offsetX" type="number" required /></label>
                  <label
                    >Text alignment
                    <select v-model="layer.textAlign">
                      <option>left</option>
                      <option>center</option>
                      <option>right</option>
                    </select></label
                  >
                </template>
                <label v-if="layer.draw === 'path'">SVG path <textarea v-model="layer.path" required></textarea></label>
              </div>
              <button type="button" @click="editor.draft.layers.splice(index, 1)">Remove layer</button>
            </fieldset>
            <div class="playground-actions">
              <button type="button" @click="editor.draft.layers.push(newLayer('mark'))">Add mark</button
              ><button type="button" @click="editor.draft.layers.push(newLayer('link'))">Add link</button>
            </div>
          </template>
        </template>
        <footer class="playground-actions">
          <button type="button" @click="dialog.close()">Cancel</button
          ><button type="submit">{{ editor.deleting ? 'Delete' : 'Apply' }}</button>
        </footer>
      </form>
    </dialog>
  </div>
</template>

<style>
.VPDoc:has(.timescope-playground) .content-container {
  max-width: 1200px;
}
.timescope-playground {
  margin: 24px 0;
}
.playground-preview,
.playground-config,
.playground-output {
  min-width: 0;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  padding: 16px;
}
.playground-preview {
  overflow: auto;
  max-height: 700px;
  margin-bottom: 18px;
}
.playground-workspace {
  display: grid;
  grid-template-columns: minmax(280px, 0.85fr) minmax(0, 1.15fr);
  gap: 18px;
}
.playground-toolbar,
.playground-actions,
.playground-tabs {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.playground-toolbar {
  justify-content: space-between;
  margin-bottom: 12px;
}
.timescope-playground button {
  padding: 5px 10px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  font-size: 13px;
}
.timescope-playground button:hover {
  border-color: var(--vp-c-brand-1);
}
.playground-toolbar select {
  appearance: auto;
  font-size: 13px;
  cursor: pointer;
}
.timescope-playground button:disabled {
  opacity: 0.4;
  cursor: default;
}
.timescope-playground button[aria-pressed='true'],
.playground-dialog button[type='submit'] {
  background: var(--vp-c-brand-1);
  color: white;
}
.timescope-playground :focus-visible {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: 2px;
}
.timescope-playground label {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 10px 0;
  font-size: 13px;
}
.timescope-playground input:not([type='checkbox']),
.timescope-playground select {
  border: 1px solid var(--vp-c-divider);
  border-radius: 5px;
  padding: 4px 8px;
  min-width: 0;
  max-width: 100%;
  background: var(--vp-c-bg);
}
.timescope-playground input[type='number'] {
  width: 100px;
}
.playground-item {
  border-top: 1px solid var(--vp-c-divider);
  padding: 16px 0;
}
.playground-tabs {
  margin-bottom: 16px;
}
.playground-add {
  margin-top: 12px;
}
.playground-note {
  color: var(--vp-c-text-2);
  font-size: 12px;
  line-height: 1.6;
}
.playground-code {
  overflow: auto;
  max-height: 650px;
  background: #24292e;
  border-radius: 8px;
}
.playground-code pre {
  margin: 0;
  padding: 16px;
  font-size: 12px;
  line-height: 1.6;
}
.playground-dialog {
  position: fixed;
  inset: 0;
  margin: auto;
  width: min(680px, calc(100vw - 32px));
  max-height: calc(100dvh - 48px);
  overflow: auto;
  padding: 24px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
}
.playground-dialog::backdrop {
  background: #0008;
}
.playground-dialog h2 {
  margin: 0;
  border: 0;
  padding: 0;
  font-size: 20px;
}
.playground-fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 16px;
}
.playground-dialog fieldset {
  margin: 16px 0;
  padding: 12px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
}
.playground-dialog footer {
  justify-content: flex-end;
  margin-top: 24px;
}
.playground-general {
  padding-top: 4px;
}
.playground-general h2 {
  margin: 0 0 12px;
  border: 0;
  padding: 0;
  font-size: 16px;
}
.playground-dialog textarea {
  display: block;
  width: 100%;
  min-height: 220px;
  padding: 12px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  font: 12px/1.5 monospace;
}
.playground-json-label {
  margin-bottom: 6px;
}
@media (max-width: 760px) {
  .playground-workspace,
  .playground-fields {
    grid-template-columns: 1fr;
  }
}
</style>
