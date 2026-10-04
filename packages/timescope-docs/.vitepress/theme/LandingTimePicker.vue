<script setup lang="ts">
import { Timescope } from '@timescope/vue';
import type { Decimal } from 'timescope';
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { dawnOf, pickerZoom, timeRange, travelSettings, yearOf, type TravelState } from './time-travel';

const emit = defineEmits<{ travel: [TravelState] }>();
const host = ref<HTMLElement>();
const picker = ref<InstanceType<typeof Timescope>>();
const mounted = ref(false);
const width = ref(1);
const time = ref<Decimal | null>(null);
const previewYear = ref(yearOf(null));
const editing = ref(false);
const animating = ref(false);
let direction: 1 | -1 = 1;
let activity = 0;
let previousTime: Decimal | null = null;
let departureYear = previewYear.value;
let observer: ResizeObserver | undefined;
const zoomRange = computed<[number, number]>(() => [
  pickerZoom(width.value, travelSettings.universeYears),
  pickerZoom(width.value, 1),
]);
const options = { tracks: { default: { timeAxis: { timeZone: 'utc' } } } };
const label = computed(() =>
  time.value === null && !editing.value && !animating.value
    ? 'Present'
    : previewYear.value <= 0
      ? `${(1 - previewYear.value).toLocaleString('en-US')} BCE`
      : `${previewYear.value.toLocaleString('en-US')} CE`,
);

function committed(value: Decimal | null) {
  time.value = value;
  preview(value);
  departureYear = yearOf(value);
}
function preview(value: Decimal | null, interaction = true) {
  if (interaction) activity++;
  const year = yearOf(value);
  if (year !== previewYear.value) direction = year < previewYear.value ? -1 : 1;
  else if (value && !value.eq(previousTime ?? Date.now() / 1000))
    direction = value.lt(previousTime ?? Date.now() / 1000) ? -1 : 1;
  previewYear.value = year;
  previousTime = value;
  emit('travel', {
    activity,
    mode: interaction ? 'travel' : value === null ? 'normal' : 'stopped',
    direction,
    dawn: dawnOf(previewYear.value),
    year: previewYear.value,
    distanceYears: Math.abs(previewYear.value - departureYear),
  });
}
onMounted(() => {
  observer = new ResizeObserver(([entry]) => {
    width.value = entry.contentRect.width;
  });
  observer.observe(host.value!);
  width.value = host.value!.clientWidth;
  mounted.value = true;
});
onBeforeUnmount(() => {
  observer?.disconnect();
});
</script>

<template>
  <section ref="host" class="landing-time-picker" aria-label="Time travel">
    <Timescope
      v-if="mounted"
      ref="picker"
      class="travel-picker"
      :options="options"
      :time-range="timeRange"
      :zoom-range="zoomRange"
      :initial-zoom="pickerZoom(width, 100)"
      @timechanged="committed"
      @timechanging="preview"
      @timeanimating="preview($event, false)"
      @editing="editing = $event"
      @animating="animating = $event" />
    <div class="travel-toolbar">
      <output aria-live="off">{{ label }}</output>
      <button type="button" @click="picker?.setTime(null)">Back to the Present</button>
    </div>
  </section>
</template>
