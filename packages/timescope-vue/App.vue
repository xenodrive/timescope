<template>
  <div style="display: flex; flex-direction: column">
    <Timescope ref="timescope-ref" v-model:time="time" v-model:zoom="zoom" stack="vertical" width="100%" :zoom-range="[-13, 8]" />
  </div>
<pre>
time: {{ time }}, zoom {{ zoom }}

ts.time: {{ ts?.time }}
ts.animating: {{ ts?.animating }}
</pre>
</template>

<script lang="ts" setup>
import { Timescope } from '@timescope/vue';
import { ref, computed, watch, useTemplateRef, reactive } from 'vue';

const time = ref();
const zoom = ref();

const ts = useTemplateRef('timescope-ref');

</script>
