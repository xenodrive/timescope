<script setup lang="ts">
import { Timescope } from '@timescope/vue';
import type { Decimal } from 'timescope';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { dawnOf, normalTravel, pickerZoom, timeRange, travelSettings, yearOf, type TravelState } from './time-travel';

const emit = defineEmits<{ travel: [TravelState] }>();
const host = ref<HTMLElement>();
const picker = ref<InstanceType<typeof Timescope>>();
const mounted = ref(false);
const width = ref(1);
const time = ref<Decimal | null>(null);
const previewYear = ref(yearOf(null));
const editing = ref(false);
const animating = ref(false);
const moving = ref(false);
let inactivity: ReturnType<typeof setTimeout> | undefined;
let direction: 1 | -1 = 1;
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

function activity() {
  moving.value = true;
  clearTimeout(inactivity);
  inactivity = setTimeout(() => {
    moving.value = false;
  }, travelSettings.inactivityMs);
}
function committed(value: Decimal | null) {
  const changed = value === null ? time.value !== null : !time.value?.eq(value);
  if (changed) activity();
  time.value = value;
}
function preview(value: Decimal | null) {
  const year = yearOf(value);
  const changed = value === null ? previousTime !== null : !value.eq(previousTime ?? Date.now() / 1000);
  if (changed) activity();
  if (year !== previewYear.value) direction = year < previewYear.value ? -1 : 1;
  else if (value && !value.eq(previousTime ?? Date.now() / 1000))
    direction = value.lt(previousTime ?? Date.now() / 1000) ? -1 : 1;
  previewYear.value = year;
  previousTime = value;
  publish();
}
function publish() {
  const busy = moving.value || animating.value;
  if (!busy && time.value === null) emit('travel', { ...normalTravel, year: yearOf(null) });
  else
    emit('travel', {
      mode: busy ? 'travel' : 'stopped',
      direction,
      dawn: dawnOf(previewYear.value),
      year: previewYear.value,
      distanceYears: Math.abs(previewYear.value - departureYear),
    });
}
watch(
  [editing, animating, time, moving],
  () => {
    publish();
    if (!moving.value && !editing.value && !animating.value) departureYear = previewYear.value;
  },
  { flush: 'post' },
);
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
  clearTimeout(inactivity);
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
      @timeanimating="preview"
      @editing="editing = $event"
      @animating="animating = $event" />
    <div class="travel-toolbar">
      <output aria-live="off">{{ label }}</output>
      <button type="button" @click="picker?.setTime(null)">Back to the Present</button>
    </div>
  </section>
</template>
