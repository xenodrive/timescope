<script setup lang="ts">
import { Timescope, defineTimescopeOptions } from "@timescope/vue";
import type { Decimal } from "timescope";
import { ref } from "vue";

const options = defineTimescopeOptions({ showFps: false });
const time = ref<Decimal | null>();
const zoom = ref<number>();

type IsAny<T> = 0 extends 1 & T ? true : false;
const componentIsTyped: IsAny<typeof Timescope> = false;
void componentIsTyped;
</script>

<template>
  <Timescope style="height: 80px" v-model:time="time" v-model:zoom="zoom" :options="options" :initial-fit="[0, 30]" render-thread="main" />
</template>
