<script setup lang="ts">
import type { ApiParameter } from '../../../api-members';
import ApiCode from './ApiCode.vue';

defineProps<{ parameters: ApiParameter[] }>();
</script>

<template>
  <div class="api-parameters">
    <span class="api-member-label">Parameters</span>
    <dl class="api-parameter-list">
      <div v-for="parameter in parameters" :key="parameter.name" class="api-parameter">
        <dt><ApiCode :text="parameter.name" :linked="false" /></dt>
        <dd>
          <ApiCode :text="parameter.type" />
          <p v-if="parameter.description">{{ parameter.description }}</p>
        </dd>
      </div>
    </dl>
  </div>
</template>

<style>
.vp-doc .api-parameter-list {
  margin: 0;
  font-size: 14px;
}

.api-parameter {
  display: grid;
  grid-template-columns: minmax(80px, 25%) minmax(0, 1fr);
  gap: 12px;
  padding: 6px 0;
  line-height: 1.6;
}

.api-parameter dt {
  font-weight: 500;
}

.api-parameter dd {
  min-width: 0;
  margin: 0;
}

.vp-doc .api-parameter dd p {
  margin: 4px 0 0;
  font-size: 13px;
  color: var(--vp-c-text-2);
}

@media (max-width: 639px) {
  .api-parameter {
    grid-template-columns: 1fr;
    gap: 2px;
  }
}
</style>
