<template>
  <section class="landing-section landing-examples" aria-labelledby="landing-examples-title">
    <h2 id="landing-examples-title" class="visually-hidden">Examples</h2>

    <div class="landing-example-grid">
      <article class="landing-card landing-example-card">
        <header class="landing-card-header">
          <div>
            <h3>
              <a href="./guide/examples/simple-timeline">Simple Timeline</a>
            </h3>
            <p>A precise time picker with map-like pan and zoom.</p>
          </div>
        </header>
        <div class="landing-card-body landing-example-body landing-example-body--timepicker">
          <div class="landing-timepicker-frame">
            <SimpleTimeline />
          </div>
        </div>
      </article>

      <article class="landing-card landing-example-card">
        <header class="landing-card-header">
          <div>
            <h3><a href="./guide/examples/decimation">Decimation</a></h3>
            <p>Explore 100,000 points with smooth pan and zoom.</p>
          </div>
        </header>
        <div class="landing-card-body landing-example-body">
          <Decimation />
        </div>
      </article>

      <article class="landing-card landing-example-card">
        <header class="landing-card-header">
          <div>
            <h3><a href="./guide/examples/gantt-chart">Gantt Chart</a></h3>
            <p>Compose interval bars and labels on a shared time axis.</p>
          </div>
        </header>
        <div class="landing-card-body landing-example-body">
          <GanttChart />
        </div>
      </article>

      <article class="landing-card landing-example-card">
        <header class="landing-card-header">
          <div>
            <h3>
              <a href="./guide/examples/dynamic-loader">Dynamic Loader</a>
            </h3>
            <p>Load and cache only the chunks requested by the viewport.</p>
          </div>
        </header>
        <div class="landing-card-body landing-example-body">
          <DynamicLoader />
        </div>
      </article>
    </div>
  </section>
</template>

<script setup lang="ts">
import Decimation from '@/guide/examples/decimation.vue';
import DynamicLoader from '@/guide/examples/dynamic-loader.vue';
import GanttChart from '@/guide/examples/gantt-chart.vue';
import SimpleTimeline from '@/guide/examples/simple-timeline.vue';
</script>
