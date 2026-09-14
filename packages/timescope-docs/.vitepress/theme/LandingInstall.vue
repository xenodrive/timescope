<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';

const command = 'npm install timescope';
const copied = ref(false);
const failed = ref(false);
let timer: ReturnType<typeof setTimeout> | undefined;
const status = computed(() => {
  if (copied.value) return 'Copied to clipboard.';
  if (failed.value) return 'Could not copy. Select the command to copy it manually.';
  return '';
});
async function copy() {
  try {
    await navigator.clipboard.writeText(command);
    copied.value = true;
    failed.value = false;
    clearTimeout(timer);
    timer = setTimeout(() => {
      copied.value = false;
    }, 2000);
  } catch {
    failed.value = true;
  }
}
onBeforeUnmount(() => clearTimeout(timer));
</script>

<template>
  <div class="landing-install">
    <div class="landing-install-command">
      <span class="landing-install-prompt" aria-hidden="true">$</span>
      <code>{{ command }}</code>
      <button type="button" :aria-label="`Copy ${command}`" @click="copy">
        <svg
          v-if="!copied"
          viewBox="0 0 24 24"
          width="17"
          height="17"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          aria-hidden="true">
          <rect x="8" y="8" width="12" height="12" rx="2" />
          <path d="M16 8V4H4v12h4" />
        </svg>
        <span v-else aria-hidden="true">✓</span>
      </button>
    </div>
    <span class="visually-hidden" role="status">{{ status }}</span>
  </div>
</template>
