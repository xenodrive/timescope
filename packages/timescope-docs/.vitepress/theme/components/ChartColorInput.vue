<script setup lang="ts">
import { computed, nextTick, ref, useId } from 'vue';

const model = defineModel<string>({ required: true });
const props = defineProps<{ label: string; autoColor?: string }>();
const id = useId();
const trigger = ref<HTMLButtonElement>();
const popup = ref<HTMLElement>();
const position = ref({ left: '0px', top: '0px' });
const automatic = computed(() => props.autoColor !== undefined && !model.value);
const displayedColor = computed(() => model.value || props.autoColor || '#0d9488');
const palettes = [
  { name: 'Vivid', colors: ['#ef4444', '#f97316', '#eab308', '#22c55e', '#0d9488', '#3b82f6', '#8b5cf6', '#ec4899'] },
  { name: 'Soft', colors: ['#fca5a5', '#fdba74', '#fde047', '#86efac', '#99f6e4', '#93c5fd', '#c4b5fd', '#f9a8d4'] },
  { name: 'Neutral', colors: ['#ffffff', '#e2e8f0', '#94a3b8', '#64748b', '#475569', '#334155', '#0f172a', '#000000'] },
];

function choose(color: string) {
  model.value = color;
  popup.value?.hidePopover();
}

async function opened(event: Event) {
  if ((event as Event & { newState: string }).newState !== 'open') return;
  await nextTick();
  if (!trigger.value || !popup.value) return;
  const rect = trigger.value.getBoundingClientRect();
  const { width, height } = popup.value.getBoundingClientRect();
  position.value = {
    left: `${Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))}px`,
    top: `${Math.max(8, Math.min(rect.bottom + 8, window.innerHeight - height - 8))}px`,
  };
}
</script>

<template>
  <div class="color-picker-control">
    <button
      ref="trigger"
      type="button"
      class="picker-trigger"
      :popovertarget="id"
      :aria-label="`${label}: ${automatic ? 'automatic' : 'custom color'}`"
      :title="`${label}${automatic ? ' · Auto' : ''}`"
      :style="{ '--picker-color': displayedColor }">
      <span v-if="automatic" class="picker-auto-badge" aria-hidden="true">A</span>
    </button>
    <div :id="id" ref="popup" popover class="color-popup" :style="position" :aria-label="label" @toggle="opened">
      <strong>{{ label }}</strong>
      <div
        v-for="palette in palettes"
        :key="palette.name"
        class="palette-group"
        role="group"
        :aria-label="palette.name">
        <span class="palette-name">{{ palette.name }}</span>
        <div class="palette-colors">
          <button
            v-for="color in palette.colors"
            :key="color"
            type="button"
            class="palette-swatch"
            :style="{ backgroundColor: color }"
            :aria-label="`${palette.name} ${color}`"
            :aria-pressed="!automatic && model === color"
            :title="color"
            @click="choose(color)"></button>
        </div>
      </div>
      <button
        v-if="autoColor !== undefined"
        type="button"
        class="palette-auto"
        :aria-pressed="automatic"
        @click="choose('')">
        <span class="auto-color-preview" :style="{ '--picker-color': autoColor }" aria-hidden="true"></span>
        Auto
        <span v-if="automatic" class="auto-check" aria-hidden="true">✓</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.color-picker-control {
  flex: 0 0 32px;
  width: 32px;
  height: 32px;
}
.color-picker-control .picker-trigger,
.auto-color-preview {
  position: relative;
  width: 32px;
  height: 32px;
  padding: 0;
  overflow: hidden;
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  background: #fff;
}
.picker-trigger::before,
.auto-color-preview::before {
  content: '';
  position: absolute;
  inset: 0;
  background: var(--picker-color);
}
.picker-auto-badge {
  position: absolute;
  right: 1px;
  bottom: 1px;
  padding: 0 3px;
  border-radius: 3px;
  background: rgb(255 255 255 / 90%);
  color: #334155;
  font-size: 9px;
  line-height: 13px;
  font-weight: 700;
}
.color-popup {
  position: fixed;
  inset: auto;
  margin: 0;
  width: min(280px, calc(100vw - 16px));
  max-height: calc(100dvh - 16px);
  overflow: auto;
  padding: 16px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  box-shadow: 0 8px 32px rgb(0 0 0 / 18%);
  font-size: 12px;
  font-weight: 400;
  line-height: 1.5;
}
.palette-group {
  margin-top: 12px;
}
.palette-name {
  display: block;
  margin-bottom: 6px;
  color: var(--vp-c-text-2);
  font-size: 11px;
}
.palette-colors {
  display: grid;
  grid-template-columns: repeat(8, minmax(0, 1fr));
  gap: 6px;
}
.color-popup .palette-swatch {
  width: 100%;
  aspect-ratio: 1;
  padding: 0;
  border: 1px solid rgb(0 0 0 / 12%);
  border-radius: 5px;
  cursor: pointer;
}
.palette-swatch:hover {
  transform: scale(1.12);
}
.palette-swatch[aria-pressed='true'] {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: 2px;
}
.palette-auto {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  margin-top: 16px;
  padding: 8px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 7px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  cursor: pointer;
}
.auto-color-preview {
  width: 22px;
  height: 22px;
}
.palette-auto[aria-pressed='true'] {
  border-color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
}
.auto-check {
  margin-left: auto;
}
.color-picker-control button:focus-visible {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: 2px;
}
</style>
