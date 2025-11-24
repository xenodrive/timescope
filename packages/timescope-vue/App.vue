<template>
  <Timescope v-model:time="time" v-model:zoom="zoom" />
  time: {{ time }}, zoom {{ zoom }}
</template>

<script lang="ts" setup>
import { Timescope } from 'timescope-vue';
import { ref } from 'vue';

const time = ref();
const zoom = ref();
</script>
