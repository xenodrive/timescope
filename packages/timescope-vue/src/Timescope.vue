<template>
  <div ref="container-ref"></div>
</template>

<script
  lang="ts"
  setup
  generic="
    Source extends Record<string, TimescopeSourceInput>,
    SourceName extends Record<string, keyof Source>,
    TimeDef extends Record<string, FieldDefLike<TimescopeTimeLike<never>>>,
    ValueDef extends Record<string, FieldDefLike<TimescopeNumberLike | null>>,
    Track extends string
  ">
import type {
  FieldDefLike,
  TimescopeNumberLike,
  TimescopeOptions,
  TimescopeOptionsInitial,
  TimescopeOptionsSelection,
  TimescopeOptionsSeries,
  TimescopeOptionsSources,
  TimescopeOptionsTracks,
  TimescopeSourceInput,
  TimescopeTimeLike,
} from 'timescope';
import { Decimal, Timescope } from 'timescope';
import { markRaw, onBeforeUnmount, provide, useTemplateRef, watch } from 'vue';

const emit = defineEmits<{
  timechanged: [Decimal | null];
  timechanging: [Decimal | null];
  zoomchanged: [number];
  zoomchanging: [number];
  rangechanging: [[Decimal, Decimal]];
  rangechanged: [[Decimal, Decimal] | null];

  'update:time': [Decimal | null];
  'update:zoom': [number];
}>();

const props = withDefaults(
  defineProps<{
    width?: string;
    height?: string;

    time?: Decimal | number | null | string | Date;
    timeRange?: [
      Decimal | number | null | string | Date | undefined,
      Decimal | number | null | string | Date | undefined,
    ];
    zoom?: number;
    zoomRange?: [number | undefined, number | undefined];

    sources?: TimescopeOptionsSources<Source>;
    series?: TimescopeOptionsSeries<Source, SourceName, TimeDef, ValueDef, Track>;
    tracks?: TimescopeOptionsTracks<Track>;

    indicator?: boolean;
    selection?: TimescopeOptionsSelection;

    showFps?: boolean;

    fonts?: TimescopeOptionsInitial<any, any, any, any, any>['fonts'];
  }>(),
  {
    width: '100%',
    height: '36px',
    indicator: true,
  },
);

const timescope = markRaw(
  new Timescope({
    time: props.time ?? null,
    timeRange: props.timeRange,
    zoom: props.zoom ?? 0,
    zoomRange: props.zoomRange,

    fonts: props.fonts,
  }),
);

timescope.on('timechanging', (e) => emit('timechanging', e.value));
timescope.on('timechanged', (e) => emit('timechanged', e.value));
timescope.on('zoomchanging', (e) => emit('zoomchanging', e.value));
timescope.on('zoomchanged', (e) => emit('zoomchanged', e.value));
timescope.on('rangechanging', (e) => emit('rangechanging', e.value));
timescope.on('rangechanged', (e) => emit('rangechanged', e.value));

timescope.on('timechanged', (e) => emit('update:time', e.value));
timescope.on('zoomchanged', (e) => emit('update:zoom', e.value));

if (props.time === undefined) emit('update:time', timescope.time);
if (props.zoom === undefined) emit('update:zoom', timescope.zoom);

watch(
  () => props.time,
  () => timescope?.setTime(props.time ?? null),
);
watch(
  () => props.timeRange,
  () => timescope?.setTimeRange(props.timeRange),
);
watch(
  () => props.zoom,
  () => timescope?.setZoom(props.zoom ?? 0),
);
watch(
  () => props.zoomRange,
  () => timescope?.setZoomRange(props.zoomRange),
);

watch(
  () => [props.width, props.height],
  () => timescope.updateOptions({ style: { width: props.width, height: props.height } }),
  { immediate: true },
);

watch(
  () => props.sources,
  () => timescope.updateOptions({ sources: props.sources } as TimescopeOptions),
  { immediate: true, deep: true },
);

watch(
  () => props.series,
  () => timescope.updateOptions({ series: props.series } as TimescopeOptions),
  { immediate: true, deep: true },
);

watch(
  () => props.tracks,
  () => timescope.updateOptions({ tracks: props.tracks } as TimescopeOptions),
  { immediate: true, deep: true },
);

watch(
  () => props.indicator,
  () => timescope.updateOptions({ indicator: props.indicator } as TimescopeOptions),
  { immediate: true, deep: true },
);

watch(
  () => props.selection,
  () => timescope.updateOptions({ selection: props.selection } as TimescopeOptions),
  { immediate: true, deep: true },
);

watch(
  () => props.showFps,
  () => timescope.updateOptions({ showFps: props.showFps } as TimescopeOptions),
  { immediate: true },
);

const el = useTemplateRef('container-ref');

watch(el, () => {
  timescope?.unmount();
  if (el.value) timescope?.mount(el.value);
});

onBeforeUnmount(() => {
  timescope?.dispose();
});

const api = timescope;

provide('timescope-api', api);
defineExpose({ api });
</script>
