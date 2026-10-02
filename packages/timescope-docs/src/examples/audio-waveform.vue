---
title: Audio Waveform Visualization
---

<template>
  <!-- #region html -->
  <div class="demo">
    <div class="demo-controls">
      <button id="example-audio-load" type="button">Load audio</button>
      <input id="example-audio-file" type="file" accept="audio/*" hidden />
    </div>
    <div id="example-audio-waveform" style="height: 320px"></div>
    <audio id="example-audio-player" src="/timescope/audio.wav" controls style="width: 100%" />
  </div>
  <!-- #endregion html -->
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue';
import { createAudioWaveformDemo } from './audio-waveform-demo.js';

let cleanup: (() => void) | undefined;
onMounted(() => {
  cleanup = createAudioWaveformDemo('#example-audio-waveform');
});
onBeforeUnmount(() => cleanup?.());
</script>

<style src="./demo.css"></style>
