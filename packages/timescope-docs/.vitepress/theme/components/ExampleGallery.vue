<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { examples } from '../../../src/examples/catalog';
import ExampleCard from './ExampleCard.vue';

const active = ref('');
const filter = ref('All');
const ready = ref(false);
let previousFocus: HTMLElement | null = null;
let previousOverflow = '';
let previousInert = false;
const filters = ['All', 'Time', 'Data', 'Drawing', 'Applications'];

function syncUrl() {
  const name = decodeURIComponent(location.hash.slice(1));
  if (name && examples.some((example) => example.name === name)) {
    filter.value = 'All';
    void nextTick(() => document.getElementById(name)?.scrollIntoView());
  }
}

function keyboard(event: KeyboardEvent) {
  if (!active.value) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    active.value = '';
    return;
  }
  if (event.key === 'Tab') {
    const controls = [
      ...document.querySelectorAll<HTMLElement>(
        '.example-code-dialog button, .example-code-dialog select, .example-code-dialog a[href], .example-code-dialog [tabindex="0"]',
      ),
    ].filter((element) => element.getClientRects().length && !element.matches(':disabled'));
    const first = controls[0];
    const last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }
}

watch(active, async (name, previous) => {
  const app = document.getElementById('app');
  if (name && !previous) {
    previousFocus = document.activeElement as HTMLElement;
    previousOverflow = document.body.style.overflow;
    previousInert = app?.inert ?? false;
    document.body.style.overflow = 'hidden';
    if (app) app.inert = true;
  } else if (!name) {
    document.body.style.overflow = previousOverflow;
    if (app) app.inert = previousInert;
    previousFocus?.focus();
  }
  if (name) {
    await nextTick();
    document.querySelector<HTMLButtonElement>('.example-code-dialog .example-code-close')?.focus();
  }
});

onMounted(() => {
  ready.value = true;
  syncUrl();
  window.addEventListener('hashchange', syncUrl);
  document.addEventListener('keydown', keyboard);
});
onBeforeUnmount(() => {
  window.removeEventListener('hashchange', syncUrl);
  document.removeEventListener('keydown', keyboard);
  if (active.value) {
    document.body.style.overflow = previousOverflow;
    const app = document.getElementById('app');
    if (app) app.inert = previousInert;
  }
});
</script>

<template>
  <nav class="gallery-filters" aria-label="Filter examples">
    <button v-for="tag in filters" :key="tag" :aria-pressed="filter === tag" @click="filter = tag">{{ tag }}</button>
  </nav>
  <div class="gallery-list">
    <ExampleCard
      v-for="example in examples"
      v-show="filter === 'All' || filter === example.tag"
      :key="example.name"
      v-bind="example"
      :ready="ready"
      :active="active === example.name"
      @open="active = example.name"
      @close="active = ''" />
  </div>
</template>

<style>
.VPDoc:has(.gallery-list) .content-container {
  max-width: 1000px;
}
.gallery-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 24px 0;
}
.gallery-filters button {
  border: 1px solid var(--vp-c-divider);
  border-radius: 24px;
  padding: 6px 16px;
  font-size: 13px;
  transition: background 150ms;
}
.gallery-filters button[aria-pressed='true'] {
  background: var(--vp-c-text-1);
  color: var(--vp-c-bg);
  border-color: transparent;
}
.gallery-list {
  display: flex;
  flex-direction: column;
  gap: 28px;
}
</style>
