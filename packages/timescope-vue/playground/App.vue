<template>
  <div style="display: flex; flex-direction: column">
    <Timescope
      ref="timescope-ref"
      v-model:time="time"
      v-model:zoom="zoom"
      v-model:selection-range="selectionRange"
      :initial-fit="[0, 30]"
      :zoom-range="[-13, 8]" />
  </div>
  <pre>
time: {{ time }}, zoom {{ zoom }}
selectionRange: {{ selectionRange?.join(',') }}

ts.time: {{ ts?.time }}
ts.timeChanging: {{ ts?.timeChanging }}
ts.timeAnimating: {{ ts?.timeAnimating }}
ts.animating: {{ ts?.animating }}
ts.selectionRangeChanging: {{ ts?.selectionRangeChanging?.join(',') }}
ts.selectionRange: {{ ts?.selectionRange?.join(',') }}
</pre>
</template>

<script lang="ts" setup>
import { Timescope } from '@timescope/vue';
import { ref, useTemplateRef } from 'vue';

const time = ref();
const zoom = ref();
const selectionRange = ref();

const ts = useTemplateRef('timescope-ref');
</script>
