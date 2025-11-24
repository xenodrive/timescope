<template>
  <div class="api-table">
    <table>
      <thead>
        <tr>
          <th>Property</th>
          <th>Type</th>
          <th>Description</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(item, index) in items" :key="index">
          <td><code>{{ item.name }}</code></td>
          <td><code class="type">{{ item.type }}</code></td>
          <td>{{ item.description }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  items: Array<{
    name: string;
    type: string;
    description: string;
  }>;
}>();
</script>

<style scoped>
.api-table {
  margin: 16px 0;
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

th {
  text-align: left;
  padding: 12px;
  background: var(--vp-c-bg-soft);
  border-bottom: 2px solid var(--vp-c-divider);
  font-weight: 600;
}

td {
  padding: 12px;
  border-bottom: 1px solid var(--vp-c-divider);
  vertical-align: top;
}

code {
  font-size: 13px;
  padding: 2px 6px;
  background: var(--vp-c-bg-mute);
  border-radius: 4px;
}

.type {
  color: var(--vp-c-brand-1);
}

tr:hover {
  background: var(--vp-c-bg-soft);
}
</style>
