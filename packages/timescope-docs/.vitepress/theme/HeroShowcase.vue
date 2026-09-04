<template>
  <section
    class="landing-section landing-primary-example"
    aria-labelledby="financial-chart-title"
  >
    <article class="landing-card landing-card--primary">
      <header class="landing-card-header">
        <div>
          <h2 id="financial-chart-title">
            <a href="./guide/examples/financial-chart">Financial Chart</a>
          </h2>
          <p>
            BTC / USDT <span aria-hidden="true">·</span>
            <a
              href="https://data.binance.vision/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Data source: Binance
            </a>
          </p>
        </div>
      </header>
      <div class="landing-card-body hero-showcase-body">
        <FinancialChart class="hero-showcase-canvas" />
      </div>
    </article>
  </section>
</template>

<script setup lang="ts">
import FinancialChart from "@/guide/examples/financial-chart.vue";
</script>
