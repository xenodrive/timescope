<script setup lang="ts">
import { Icon } from '@iconify/vue';
import codeTags from '@iconify-icons/mdi/code-tags';
import contentCopy from '@iconify-icons/mdi/content-copy';
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, ref, watch, type Component } from 'vue';
import { data as examplesCode, type VanillaExample } from './gallery-code.data';

const props = defineProps<{
  name: string;
  title: string;
  caption: string;
  tag: string;
  ready: boolean;
  active: boolean;
}>();
defineEmits(['open', 'close']);
const modules = import.meta.glob<Component>('../../../src/guide/examples/*.vue', { import: 'default' });
const demo = defineAsyncComponent(modules[`../../../src/guide/examples/${props.name}.vue`]);
const instance = ref<{ exportCode?: () => VanillaExample }>();
const code = computed(() => instance.value?.exportCode?.() ?? examplesCode[props.name]);
const file = ref<'javascript' | 'html'>('javascript');
const copied = ref(false);
const wheelEnabled = ref(false);
const displayedCode = computed(() => code.value?.[file.value] ?? '');
const highlightedCode = ref('');
let copyTimer: ReturnType<typeof setTimeout> | undefined;

watch(
  () => (props.active ? { code: displayedCode.value, lang: file.value } : null),
  async (source, _, onCleanup) => {
    let cancelled = false;
    onCleanup(() => {
      cancelled = true;
    });
    highlightedCode.value = '';
    if (!source) return;
    try {
      const { highlight } = await import('./gallery-highlight');
      const html = await highlight(source.code, source.lang);
      if (!cancelled) highlightedCode.value = html;
    } catch (error) {
      console.error('Failed to highlight example code', error);
    }
  },
);
watch(
  () => props.active,
  () => {
    wheelEnabled.value = false;
  },
);
onBeforeUnmount(() => clearTimeout(copyTimer));

function pointerDown(event: PointerEvent) {
  if (event.pointerType === 'mouse' || event.pointerType === 'pen') wheelEnabled.value = true;
}

function wheel(event: WheelEvent) {
  if (!wheelEnabled.value && event.target instanceof HTMLCanvasElement) event.stopPropagation();
}

async function tabKeydown(event: KeyboardEvent) {
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight' && event.key !== 'Home' && event.key !== 'End') return;
  event.preventDefault();
  file.value =
    event.key === 'Home'
      ? 'javascript'
      : event.key === 'End'
        ? 'html'
        : file.value === 'javascript'
          ? 'html'
          : 'javascript';
  await nextTick();
  document.getElementById(`example-${props.name}-${file.value}-tab`)?.focus();
}

async function copy() {
  try {
    await navigator.clipboard.writeText(displayedCode.value);
    copied.value = true;
    clearTimeout(copyTimer);
    copyTimer = setTimeout(() => {
      copied.value = false;
    }, 1500);
  } catch {
    copied.value = false;
  }
}
</script>

<template>
  <article
    :id="name"
    class="example-panel"
    @pointerdown="pointerDown"
    @pointerleave="wheelEnabled = false"
    @wheel.capture="wheel">
    <header class="example-panel-header">
      <div>
        <span class="example-tag">{{ tag }}</span>
        <h2>{{ title }}</h2>
        <p>{{ caption }}</p>
      </div>
      <button class="example-code-button" :aria-label="`View code for ${title}`" @click="$emit('open')">
        <Icon :icon="codeTags" aria-hidden="true" />
        Code
      </button>
    </header>
    <div class="example-stage">
      <component :is="demo" v-if="ready" ref="instance" />
    </div>
    <Teleport to="body">
      <div v-if="active" class="example-code-overlay" @click.self="$emit('close')">
        <section class="example-code-dialog" role="dialog" aria-modal="true" :aria-label="`Code for ${title}`">
          <header class="example-code-header">
            <div>
              <span class="example-tag">{{ tag }}</span>
              <h2>{{ title }} · Code</h2>
            </div>
            <button class="example-code-close" aria-label="Close code" @click="$emit('close')">✕</button>
          </header>
          <div class="example-code-tools">
            <div class="example-code-tabs" role="tablist" aria-label="Source file" @keydown="tabKeydown">
              <button
                :id="`example-${name}-javascript-tab`"
                role="tab"
                :aria-controls="`example-${name}-code`"
                :aria-selected="file === 'javascript'"
                :tabindex="file === 'javascript' ? 0 : -1"
                @click="file = 'javascript'">
                JavaScript
              </button>
              <button
                :id="`example-${name}-html-tab`"
                role="tab"
                :aria-controls="`example-${name}-code`"
                :aria-selected="file === 'html'"
                :tabindex="file === 'html' ? 0 : -1"
                @click="file = 'html'">
                HTML
              </button>
            </div>
            <button @click="copy">
              <Icon :icon="contentCopy" aria-hidden="true" />
              {{ copied ? 'Copied' : 'Copy' }}
            </button>
          </div>
          <div
            :id="`example-${name}-code`"
            class="example-code-content"
            role="tabpanel"
            :aria-labelledby="`example-${name}-${file}-tab`"
            tabindex="0">
            <div v-if="highlightedCode" class="example-highlight" v-html="highlightedCode"></div>
            <pre v-else tabindex="0"><code>{{ displayedCode }}</code></pre>
          </div>
        </section>
      </div>
    </Teleport>
  </article>
</template>

<style>
.example-panel {
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--vp-c-divider);
  border-radius: 14px;
  background: var(--vp-c-bg);
  scroll-margin-top: 96px;
}
.example-panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
  padding: 22px 28px;
}
.example-panel-header h2,
.example-code-header h2 {
  margin: 3px 0 0;
  padding: 0;
  border: 0;
  font-size: 20px;
  font-weight: 650;
}
.example-panel-header p {
  margin: 5px 0 0;
  color: var(--vp-c-text-2);
  font-size: 13px;
}
.example-tag {
  color: var(--vp-c-text-2);
  font-size: 10px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}
.example-code-button,
.example-code-tools > button {
  flex-shrink: 0;
  padding: 7px 14px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  font-size: 13px;
}
.example-code-button,
.example-code-tools > button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.example-stage {
  padding: 8px 28px 28px;
  min-width: 0;
}
.example-code-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px;
  background: #0b132bb3;
  backdrop-filter: blur(10px);
}
.example-code-dialog {
  display: flex;
  flex-direction: column;
  width: min(1080px, 100%);
  height: min(720px, calc(100dvh - 64px));
  overflow: hidden;
  border-radius: 18px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  box-shadow: 0 30px 100px #0005;
}
.example-code-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 20px 28px 12px;
}
.example-code-close {
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  border: 1px solid var(--vp-c-divider);
  border-radius: 50%;
}
.example-code-tools {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 0 28px 16px;
  font-size: 13px;
}
.example-code-tabs {
  display: flex;
  gap: 4px;
  padding: 3px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 9px;
}
.example-code-tabs button {
  padding: 5px 12px;
  border-radius: 6px;
}
.example-code-tabs button[aria-selected='true'] {
  background: var(--vp-c-text-1);
  color: var(--vp-c-bg);
}
.example-code-content {
  display: flex;
  flex: 1;
  min-height: 0;
  padding: 20px 28px 28px;
  background: #e5e7eb;
}
.example-highlight {
  display: flex;
  flex: 1;
  min-width: 0;
  min-height: 0;
}
.example-code-content pre {
  flex: 1;
  min-width: 0;
  min-height: 0;
  margin: 0;
  padding: 20px;
  overflow: auto;
  border-radius: 10px;
  background: #111827;
  color: #d8e5f5;
  font-size: 12px;
  line-height: 1.7;
  tab-size: 2;
}
.example-panel button:hover,
.example-code-dialog button:hover {
  color: var(--vp-c-brand-1);
}
.example-panel button:focus-visible,
.example-code-dialog button:focus-visible,
.example-code-dialog select:focus-visible {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: 3px;
}
@media (max-width: 639px) {
  .example-panel-header {
    padding: 18px 16px;
  }
  .example-stage {
    padding: 0 16px 20px;
  }
  .example-code-overlay {
    padding: 10px;
  }
  .example-code-dialog {
    height: min(720px, calc(100dvh - 20px));
  }
  .example-code-header,
  .example-code-content {
    padding: 16px;
  }
  .example-code-tools {
    padding: 0 16px 12px;
  }
}
</style>
