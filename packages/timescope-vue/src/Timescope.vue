<template>
  <div ref="container-ref"></div>
</template>

<script
  lang="ts"
  setup
  generic="
    Sources extends Record<string, TimescopeSourceInput>,
    Series extends Record<string, TimescopeSeriesInput>,
    Track extends string
  ">
import type { Decimal } from '@kikuchan/decimal';
import type {
  TimescopeOptions,
  TimescopeOptionsInitial,
  TimescopeOptionsSelection,
  TimescopeOptionsSeries,
  TimescopeOptionsSources,
  TimescopeOptionsTracks,
  TimescopeRange,
  TimescopeSeriesInput,
  TimescopeSourceInput,
} from 'timescope';
import { Timescope } from 'timescope';
import { customRef, markRaw, onBeforeUnmount, toRaw, useTemplateRef, watch } from 'vue';

const emit = defineEmits<{
  timechanged: [Decimal | null];
  timechanging: [Decimal | null];
  timeanimating: [Decimal | null];
  zoomchanged: [number];
  zoomchanging: [number];
  zoomanimating: [number];
  selectionrangechanging: [[Decimal, Decimal] | null];
  selectionrangechanged: [[Decimal, Decimal] | null];
  animating: [boolean];
  editing: [boolean];

  'update:time': [Decimal | null];
  'update:zoom': [number];
  'update:timechanging': [Decimal | null];
  'update:zoomchanging': [number];
  'update:timeanimating': [Decimal | null];
  'update:zoomanimating': [number];
  'update:selectionRange': [[Decimal, Decimal] | null];
  'update:selectionRangeChanging': [[Decimal, Decimal] | null];
}>();

const props = withDefaults(
  defineProps<{
    width?: string;
    height?: string;
    background?: string;

    time?: Decimal | number | null | string | Date;
    timeRange?: [
      Decimal | number | null | string | Date | undefined,
      Decimal | number | null | string | Date | undefined,
    ];
    zoom?: number;
    zoomRange?: [number | undefined, number | undefined];
    fit?: Extract<TimescopeOptionsInitial<Sources, Series, Track>, { fit: unknown }>['fit'];

    sources?: TimescopeOptionsSources<Sources>;
    series?: TimescopeOptionsSeries<Sources, Series, Track>;
    tracks?: TimescopeOptionsTracks<Track>;

    cursor?: TimescopeOptions['cursor'];
    selection?: TimescopeOptionsSelection;

    selectionRange?: TimescopeRange<Decimal> | null;

    showFps?: boolean;
    renderThread?: TimescopeOptions['renderThread'];

    fonts?: TimescopeOptionsInitial<Sources, Series, Track>['fonts'];
  }>(),
  {
    width: '100%',
    height: '36px',
    cursor: true,
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
  | ['selectionrangechanging', 'selectionRangeChanging']
  | ['selectionrangechanged', 'selectionRange'];

function createTimescopeRef<T extends Combination>(...args: T) {
  return customRef<(typeof timescope)[T[1]]>((track, trigger) => {
    timescope.on(args[0], () => trigger());
    return {
      get() {
        track();
        return timescope[args[1]] as (typeof timescope)[T[1]];
      },
      set() {},
    };
  });
}

const timescope = markRaw(
  new Timescope({
    renderThread: props.renderThread,
    ...(props.fit !== undefined ? { fit: props.fit } : { time: props.time ?? null, zoom: props.zoom ?? 0 }),
    timeRange: props.timeRange,
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
  selectionRange: createTimescopeRef('selectionrangechanged', 'selectionRange'),
  selectionRangeChanging: createTimescopeRef('selectionrangechanging', 'selectionRangeChanging'),

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
timescope.on('selectionrangechanging', (e) => emit('selectionrangechanging', e.value));
timescope.on('selectionrangechanged', (e) => emit('selectionrangechanged', e.value));

let animating = timescope.animating;
let editing = timescope.editing;
timescope.on('change', () => {
  if (timescope.animating !== animating) {
    animating = timescope.animating;
    emit('animating', animating);
  }
  if (timescope.editing !== editing) {
    editing = timescope.editing;
    emit('editing', editing);
  }
});

timescope.on('timechanged', (e) => emit('update:time', e.value));
timescope.on('zoomchanged', (e) => emit('update:zoom', e.value));
timescope.on('timechanging', (e) => emit('update:timechanging', e.value));
timescope.on('zoomchanging', (e) => emit('update:zoomchanging', e.value));
timescope.on('timeanimating', (e) => emit('update:timeanimating', e.value));
timescope.on('zoomanimating', (e) => emit('update:zoomanimating', e.value));
timescope.on('selectionrangechanging', (e) => emit('update:selectionRangeChanging', e.value));
timescope.on('selectionrangechanged', (e) => emit('update:selectionRange', e.value));

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
if (props.selectionRange === undefined) {
  emit('update:selectionRange', timescope.selectionRange);
  emit('update:selectionRangeChanging', timescope.selectionRangeChanging);
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
  () => [props.width, props.height, props.background],
  () => timescope.updateOptions({ style: { width: props.width, height: props.height, background: props.background } }),
  { immediate: true },
);

watch(
  () => props.sources,
  () => {
    const sources =
      props.sources && Object.fromEntries(Object.entries(props.sources).map(([key, source]) => [key, toRaw(source)]));
    timescope.updateOptions({ sources } as TimescopeOptions);
  },
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
  () => props.cursor,
  () => timescope.updateOptions({ cursor: props.cursor } as TimescopeOptions),
  { immediate: true, deep: true },
);

watch(
  () => props.selection,
  () => timescope.updateOptions({ selection: props.selection } as TimescopeOptions),
  { immediate: true, deep: true },
);
watch(
  () => props.selectionRange,
  () => {
    if (props.selectionRange !== undefined) timescope.setSelectionRange(props.selectionRange);
  },
  { immediate: true, deep: true },
);

watch(
  () => [props.showFps, props.renderThread],
  () => timescope.updateOptions({ showFps: props.showFps, renderThread: props.renderThread } as TimescopeOptions),
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
