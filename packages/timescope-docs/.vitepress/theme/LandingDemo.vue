<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { Timescope } from 'timescope';
import { exampleOptions, exampleRange, type LandingExampleKind } from './landing-data';

const props = defineProps<{ kind: LandingExampleKind; label: string }>();
const host = ref<HTMLElement>();
const error = ref(false);
let live: Timescope | undefined;

function reset() {
  live?.fitTo(exampleRange(props.kind), { animation: false, padding: 24 });
  live?.setSelectionRange(null);
}

onMounted(() => {
  try {
    live = new Timescope(exampleOptions(props.kind));
    live.on('load', reset);
    live.mount(host.value!);
  } catch (cause) {
    error.value = true;
    console.error('Unable to mount landing example', cause);
  }
});
onBeforeUnmount(() => live?.dispose());
</script>

<template>
  <div class="landing-demo" :class="`landing-demo--${kind}`">
    <div ref="host" class="landing-demo-live" role="img" :aria-label="label" />
    <p v-if="error" class="landing-demo-error">
      This interactive example requires a browser with OffscreenCanvas support.
    </p>
  </div>
</template>
