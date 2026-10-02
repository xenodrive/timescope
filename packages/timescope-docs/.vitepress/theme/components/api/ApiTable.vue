<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{ columns: string[] }>();

const labels: Record<string, string> = {
  Key: 'Field',
  Contract: 'Description',
  Meaning: 'Description',
  'Default / contract': 'Description',
  'Default / constraint': 'Description',
  'Access / contract': 'Description',
  'Default / description': 'Description',
  'Type / contract': 'Type / description',
  value: 'Value',
};
const columns = computed(() => props.columns.map((column) => labels[column] ?? column));
const layout = computed(() => {
  if (props.columns[0].startsWith('Error')) return 'errors';
  return 'fields';
});
</script>

<template>
  <div class="api-table" :class="[`api-table--${layout}`, `api-table--${columns.length}-columns`]">
    <table>
      <thead>
        <tr>
          <th v-for="(column, index) in columns" :key="index" scope="col">{{ column }}</th>
        </tr>
      </thead>
      <tbody>
        <slot />
      </tbody>
    </table>
  </div>
</template>

<style>
.vp-doc .api-table {
  margin: 20px 0;
  border: 1px solid var(--vp-c-divider);
  border-radius: var(--api-table-radius, 8px);
  overflow: hidden;
}

.vp-doc .api-table table {
  display: table;
  width: 100%;
  margin: 0;
  table-layout: fixed;
  border-collapse: collapse;
}

.vp-doc .api-table th,
.vp-doc .api-table td {
  padding: 10px 12px;
  vertical-align: top;
  text-align: left;
  overflow-wrap: anywhere;
  line-height: 1.6;
  border: 0;
  border-bottom: 1px solid var(--vp-c-divider);
}

.vp-doc .api-table th {
  background: var(--api-table-header-background, var(--vp-c-bg-soft));
  color: var(--vp-c-text-2);
  font-size: 12px;
  font-weight: 600;
}

.vp-doc .api-table tr {
  background: transparent;
  border: 0;
}

.vp-doc .api-table tbody tr:last-child td {
  border-bottom: 0;
}

.vp-doc .api-table code.api-code {
  padding: 0;
  background: transparent;
}

.api-table--2-columns th:first-child {
  width: 36%;
}

.api-table--3-columns th:first-child {
  width: 23%;
}

.api-table--3-columns th:nth-child(2) {
  width: 36%;
}

.api-table--errors.api-table--3-columns th:first-child {
  width: 29%;
}

.api-table--errors.api-table--3-columns th:nth-child(2) {
  width: 22%;
}

@media (max-width: 639px) {
  .vp-doc .api-table th,
  .vp-doc .api-table td {
    padding: 8px;
    font-size: 13px;
  }
}
</style>
