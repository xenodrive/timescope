<script setup>
import slider from '../../src/assets/poster/time-slider.png';
import charts from '../../src/assets/poster/time-slider-charts.png';
import audio from '../../src/assets/poster/audio-waveform.png';
import stock from '../../src/assets/poster/stock-chart.png';
</script>

<template>
  <section class="landing-print-examples" aria-label="Timescope examples">
    <figure>
      <figcaption>
        <strong>Time Picker</strong>
        <span>Pick a moment on an infinite time axis.</span>
      </figcaption>
      <img :src="slider" width="640" height="112" alt="A time slider with its cursor at 12:00 UTC" />
    </figure>
    <figure>
      <figcaption>
        <strong>Time Series</strong>
        <span>Explore your data on the same time axis.</span>
      </figcaption>
      <img
        :src="charts"
        width="640"
        height="112"
        alt="The same time slider with a central time axis, stepped signals, a sine wave, and a filled activity curve" />
    </figure>
    <figure>
      <figcaption>
        <strong>Audio Waveform</strong>
        <span>Explore audio with sample-level detail.</span>
      </figcaption>
      <img :src="audio" width="640" height="112" alt="An audio waveform on a relative time axis in seconds" />
    </figure>
    <figure>
      <figcaption>
        <strong>Stock Chart</strong>
        <span>Prices, moving averages, and volume.</span>
      </figcaption>
      <img
        :src="stock"
        width="640"
        height="112"
        alt="Binance BTC/USDT monthly candlesticks with 5- and 20-month moving averages and a separate volume track" />
    </figure>
  </section>
</template>
