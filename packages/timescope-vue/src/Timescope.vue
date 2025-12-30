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
  TimescopeRange,
  TimescopeSourceInput,
  TimescopeTimeLike,
} from 'timescope';
import { Timescope } from 'timescope';
import type { Decimal } from 'timescope';
import { customRef, markRaw, onBeforeUnmount, useTemplateRef, watch } from 'vue';

const emit = defineEmits<{
  timechanged: [Decimal | null];
  timechanging: [Decimal | null];
  timeanimating: [Decimal | null];
  zoomchanged: [number];
  zoomchanging: [number];
  zoomanimating: [number];
  selectedrangechanging: [[Decimal, Decimal] | null];
  selectedrangechanged: [[Decimal, Decimal] | null];

  'update:time': [Decimal | null];
  'update:zoom': [number];
  'update:timechanging': [Decimal | null];
  'update:zoomchanging': [number];
  'update:timeanimating': [Decimal | null];
  'update:zoomanimating': [number];
  'update:selectedrange': [[Decimal, Decimal] | null];
  'update:selectedrangechanging': [[Decimal, Decimal] | null];
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

    selectedRange?: TimescopeRange<Decimal> | null;

    showFps?: boolean;

    fonts?: TimescopeOptionsInitial<any, any, any, any, any>['fonts'];
  }>(),
  {
    width: '100%',
    height: '36px',
    indicator: true,
    selection: undefined,
  },
);

type Combination =
  | ['timechanged', 'time']
  | ['timechanging', 'timeChanging']
  | ['timeanimating', 'timeAnimating']
  | ['zoomchanged', 'zoom']
  | ['zoomchanging', 'zoomChanging']
  | ['zoomanimating', 'zoomAnimating']
  | ['change', 'animating']
  | ['change', 'editing']
  | ['selectedrangechanging', 'selectedRangeChanging']
  | ['selectedrangechanged', 'selectedRange'];

function createTimescopeRef<T extends Combination>(...args: T) {
  return customRef<typeof timescope[T[1]]>((track, trigger) => {
    timescope.on(args[0], () => trigger());
    return {
      get() {
        track();
        return timescope[args[1]] as typeof timescope[T[1]];
      },
      set() {
      },
    }
  });
}

const timescope = markRaw(
  new Timescope({
    time: props.time ?? null,
    timeRange: props.timeRange,
    zoom: props.zoom ?? 0,
    zoomRange: props.zoomRange,

    fonts: props.fonts,
  }),
);

defineExpose({
  time: createTimescopeRef('timechanged', 'time'),
  timeChanging: createTimescopeRef('timechanging', 'timeChanging'),
  timeAnimating: createTimescopeRef('timeanimating', 'timeAnimating'),
  zoom: createTimescopeRef('zoomchanged', 'zoom'),
  zoomChanging: createTimescopeRef('zoomchanging', 'zoomChanging'),
  zoomAnimating: createTimescopeRef('zoomanimating', 'zoomAnimating'),
  selectedRange: createTimescopeRef('selectedrangechanged', 'selectedRange'),
  selectedRangeChanging: createTimescopeRef('selectedrangechanging', 'selectedRangeChanging'),

  animating: createTimescopeRef('change', 'animating'),
  editing: createTimescopeRef('change', 'editing'),

  setTime: timescope.setTime.bind(timescope),
  setZoom: timescope.setZoom.bind(timescope),
  fitTo: timescope.fitTo.bind(timescope),
});

timescope.on('timechanging', (e) => emit('timechanging', e.value));
timescope.on('timechanged', (e) => emit('timechanged', e.value));
timescope.on('timeanimating', (e) => emit('timeanimating', e.value));
timescope.on('zoomchanging', (e) => emit('zoomchanging', e.value));
timescope.on('zoomchanged', (e) => emit('zoomchanged', e.value));
timescope.on('zoomanimating', (e) => emit('zoomanimating', e.value));
timescope.on('selectedrangechanging', (e) => emit('selectedrangechanging', e.value));
timescope.on('selectedrangechanged', (e) => emit('selectedrangechanged', e.value));

timescope.on('timechanged', (e) => emit('update:time', e.value));
timescope.on('zoomchanged', (e) => emit('update:zoom', e.value));
timescope.on('timechanging', (e) => emit('update:timechanging', e.value));
timescope.on('zoomchanging', (e) => emit('update:zoomchanging', e.value));
timescope.on('timeanimating', (e) => emit('update:timeanimating', e.value));
timescope.on('zoomanimating', (e) => emit('update:zoomanimating', e.value));
timescope.on('selectedrangechanging', (e) => emit('update:selectedrangechanging', e.value));
timescope.on('selectedrangechanged', (e) => emit('update:selectedrange', e.value));

if (props.time === undefined) {
  emit('update:time', timescope.time);
  emit('update:timechanging', timescope.time);
  emit('update:timeanimating', timescope.time);
}
if (props.zoom === undefined) {
  emit('update:zoom', timescope.zoom);
  emit('update:zoomchanging', timescope.zoom);
  emit('update:zoomanimating', timescope.zoom);
}

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

</script>
