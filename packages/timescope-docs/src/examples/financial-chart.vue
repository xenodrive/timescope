---
title: Financial Chart
---

<template>
  <div class="demo">
    <!-- #region html -->
    <div id="example-financial-chart" style="height: 280px"></div>
    <!-- #endregion html -->
    <p class="financial-source">
      Data:
      <a href="https://www.binance.com/en/trade/BTC_USDT" target="_blank" rel="noopener noreferrer">Binance · BTC/USDT</a>
    </p>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue';
import { createFinancialChartDemo } from './financial-chart-demo.js';

let cleanup: (() => void) | undefined;
onMounted(() => {
  cleanup = createFinancialChartDemo('#example-financial-chart');
});
onBeforeUnmount(() => cleanup?.());
</script>

<style src="./demo.css"></style>

<style scoped>
.financial-source {
  margin: 8px 0 0;
  text-align: right;
  color: var(--vp-c-text-2);
  font-size: 11px;
}
.financial-source a {
  color: inherit;
  font-weight: normal;
}
</style>
