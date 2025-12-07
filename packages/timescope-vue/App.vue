<template>
  <div style="display: flex; flex-direction: column">
    <Timescope v-model:time="time" v-model:zoom="zoom" stack="vertical" width="100%" />
  </div>
  time: {{ time }}, zoom {{ zoom }}
</template>

<script lang="ts" setup>
import { Timescope } from '@timescope/vue';
import { ref } from 'vue';

const time = ref();
const zoom = ref();
</script>
