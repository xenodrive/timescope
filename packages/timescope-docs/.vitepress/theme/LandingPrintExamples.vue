<script setup>
import slider from '../../src/assets/poster/time-slider.png';
import charts from '../../src/assets/poster/time-slider-charts.png';
</script>

<template>
  <section class="landing-print-examples" aria-label="Timescope examples">
    <figure>
      <figcaption>Pick a time</figcaption>
      <img :src="slider" width="760" height="64" alt="A time slider with its cursor at 12:00 UTC" />
    </figure>
    <figure>
      <figcaption>Add your data</figcaption>
      <img
        :src="charts"
        width="760"
        height="280"
        alt="The same time slider with a central time axis, stepped signals, a sine wave, and a filled activity curve" />
    </figure>
  </section>
</template>
