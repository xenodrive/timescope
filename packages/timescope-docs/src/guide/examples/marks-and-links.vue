<template>
  <div id="example-chart-marks-links-view"></div>
</template>

<script setup lang="ts">
import { Timescope, TimescopeChartLink, TimescopeChartMark } from 'timescope';
import { computed, onBeforeUnmount, onMounted, watch } from 'vue';

const props = withDefaults(defineProps<{
  links?: TimescopeChartLink<any>[];
  marks?: TimescopeChartMark<any>[];
}>(), {
  links: () => [
    { draw: 'line' },
  ],
  marks: () => [
    { draw: 'star', style: { size: 20 } },
  ],
});

const samples = [
  { time: -3.5, value: { value: -0.3, min: -0.8, max: -0.1 } },
  { time: -2.5, value: { value: -0.4, min: -0.6, max: -0.3 } },
  { time: -1.5, value: { value: 0.15, min: -0.2, max: 0.35 } },
  { time: -0.5, value: { value: 0.4, min: 0.1, max: 0.7 } },
  { time: 0.5, value: { value: 0.55, min: 0.2, max: 0.85 } },
  { time: 1.5, value: { value: 0.32, min: 0.05, max: 0.6 } },
  { time: 2.5, value: { value: 0.7, min: 0.4, max: 0.95 } },
];

const series = computed(() => ({
  series: {
    telemetry: {
      data: {
        source: 'samples',
        value: {
          value: 'value.value',
          min: 'value.min',
          max: 'value.max',
        },
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

onMounted(() => {
  const timescope = new Timescope<any>({
    ...options.value,
    time: 0,
    zoom: 6,
    target: '#example-chart-marks-links-view',
    fonts: ['https://cdn.jsdelivr.net/npm/@mdi/font@7.4.47/css/materialdesignicons.min.css'],
  });

  watch(options, (opts) => {
    if (timescope) timescope.updateOptions(opts);
    modelValue.value = opts;
  }, { deep: true, immediate: true });

  onBeforeUnmount(() => timescope?.dispose());
});

</script>
