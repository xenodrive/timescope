<script setup lang="ts">
import ApiCode from './ApiCode.vue';

defineProps<{ text: string }>();
</script>

<template>
  <div class="api-signature language-ts">
    <button class="copy" title="Copy signature" data-copied="Copied" />
    <span class="lang">ts</span>
    <pre><ApiCode :text="text" /></pre>
  </div>
</template>

<style>
.vp-doc .api-signature pre {
  margin: 0;
  padding: 20px 24px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.vp-doc .api-signature code.api-code {
  display: block;
  padding: 0;
  color: var(--vp-c-text-1);
  background: transparent;
  line-height: 1.7;
  font-size: var(--vp-code-font-size);
}
</style>
