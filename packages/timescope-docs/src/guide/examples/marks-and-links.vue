<template>
  <div id="example-chart-marks-links-view"></div>
</template>

<script setup lang="ts">
import { Timescope, TimescopeChartLink, TimescopeChartMark } from 'timescope';
import { computed, onBeforeUnmount, onMounted, watch } from 'vue';

const props = withDefaults(
  defineProps<{
    links?: TimescopeChartLink<any>[];
    marks?: TimescopeChartMark<any>[];
  }>(),
  {
    links: () => [{ draw: 'line' }],
    marks: () => [{ draw: 'star', style: { size: 20 } }],
  },
);

const samples = [
  { time: -3.5, values: { value: -0.3, min: -0.8, max: -0.1 } },
  { time: -2.5, values: { value: -0.4, min: -0.6, max: -0.3 } },
  { time: -1.5, values: { value: 0.15, min: -0.2, max: 0.35 } },
  { time: -0.5, values: { value: 0.4, min: 0.1, max: 0.7 } },
  { time: 0.5, values: { value: 0.55, min: 0.2, max: 0.85 } },
  { time: 1.5, values: { value: 0.32, min: 0.05, max: 0.6 } },
  { time: 2.5, values: { value: 0.7, min: 0.4, max: 0.95 } },
];

const series = computed(() => ({
  series: {
    telemetry: {
      data: {
        source: 'samples',
      },
      chart: {
        links: props.links,
        marks: props.marks,
      },
      tooltip: false,
      track: 'main',
    },
  },
}));

const options = computed(() => ({
  style: {
    height: '240px',
  },
  sources: { samples },
  ...series.value,
  tracks: {
    main: {
      timeAxis: {
        relative: true,
      },
      symmetric: true,
    },
  },
  indicator: false,
}));

const modelValue = defineModel<typeof options.value>();

watch(
  options,
  (opts) => {
    modelValue.value = opts;
  },
  { immediate: true },
);

onMounted(() => {
  const timescope = new Timescope<any>({
    ...options.value,
    time: 0,
    zoom: 6,
    target: '#example-chart-marks-links-view',
  });

  watch(
    series,
    (opts) => {
      timescope.updateOptions(opts);
    },
    { deep: true },
  );

  onBeforeUnmount(() => timescope?.dispose());
});
</script>
