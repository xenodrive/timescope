<template>
  <div style="display: flex; flex-direction: column">
    <Timescope ref="timescope-ref" v-model:time="time" v-model:zoom="zoom" v-model:selectedrange="selectedrange" width="100%" :zoom-range="[-13, 8]" />
  </div>
<pre>
time: {{ time }}, zoom {{ zoom }}
selectedrange: {{ selectedrange?.join(',') }}

ts.time: {{ ts?.time }}
ts.timeChanging: {{ ts?.timeChanging }}
ts.timeAnimating: {{ ts?.timeAnimating }}
ts.animating: {{ ts?.animating }}
ts.selectedRangeChanging: {{ ts?.selectedRangeChanging?.join(',') }}
ts.selectedRange: {{ ts?.selectedRange?.join(',') }}
</pre>
</template>

<script lang="ts" setup>
import { Timescope } from '@timescope/vue';
import { ref, computed, watch, useTemplateRef, reactive } from 'vue';

const time = ref();
const zoom = ref();
const selectedrange = ref();

const ts = useTemplateRef('timescope-ref');
</script>
