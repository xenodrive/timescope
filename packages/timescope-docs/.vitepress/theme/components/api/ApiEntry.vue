<script setup lang="ts">
defineProps<{ kind: string }>();
</script>

<template>
  <section class="api-entry">
    <header class="api-entry-header">
      <div class="api-entry-name"><slot name="name" /></div>
      <span class="api-entry-kind">{{ kind }}</span>
    </header>
    <div v-if="$slots.description" class="api-entry-description"><slot name="description" /></div>
    <dl class="api-details"><slot /></dl>
  </section>
</template>

<style>
.vp-doc .api-entry {
  margin: 12px 0;
  padding: 14px 16px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  background: var(--vp-c-bg);
}

.api-entry-header {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 12px;
}

.vp-doc .api-entry-name {
  min-width: 0;
  font-size: 14px;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.vp-doc .api-entry-name code.api-code {
  color: var(--vp-c-text-1);
  font-size: inherit;
}

.api-entry-kind {
  display: inline-block;
  flex-shrink: 0;
  padding: 1px 7px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 4px;
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-2);
  font-size: 11px;
  font-weight: 500;
  line-height: 1.6;
}

.vp-doc .api-entry-description {
  margin-top: 6px;
  font-size: 13px;
  line-height: 1.6;
  color: var(--vp-c-text-2);
}

.vp-doc .api-details {
  margin: 10px 0 0;
  font-size: 13px;
}

.api-detail {
  display: grid;
  grid-template-columns: 88px minmax(0, 1fr);
  gap: 12px;
  margin-top: 6px;
  line-height: 1.6;
}

.api-detail > dt {
  color: var(--vp-c-text-2);
  font-size: 12px;
  font-weight: 500;
}

.api-detail > dd {
  min-width: 0;
  margin: 0;
  overflow-wrap: anywhere;
}

.vp-doc .api-entry code.api-code,
.vp-doc .api-member code.api-code {
  padding: 2px 5px;
  border-radius: 4px;
  background: var(--vp-code-bg);
  box-decoration-break: clone;
  -webkit-box-decoration-break: clone;
}

.vp-doc .api-entry-name code.api-code,
.vp-doc .api-member-heading code.api-code {
  padding: 0;
  background: transparent;
}

@media (max-width: 639px) {
  .vp-doc .api-entry {
    padding: 12px;
  }

  .api-detail {
    grid-template-columns: 72px minmax(0, 1fr);
    gap: 8px;
  }
}
</style>
