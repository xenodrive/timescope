<script setup lang="ts">
import { Timescope } from "@timescope/vue";

type IsAny<T> = 0 extends 1 & T ? true : false;
const componentIsTyped: IsAny<typeof Timescope> = false;
void componentIsTyped;
</script>

<template>
  <Timescope :zoom="0" />
</template>
