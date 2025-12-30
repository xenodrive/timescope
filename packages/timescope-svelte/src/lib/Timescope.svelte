<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import type {
    Decimal,
    TimescopeOptions,
    TimescopeOptionsInitial,
    TimescopeOptionsSelection,
    TimescopeRange,
  } from 'timescope';
  import { Timescope } from 'timescope';

  export type TimescopeProps = {
    width?: string;
    height?: string;

    time?: Decimal | number | null | string | Date;
    timeRange?: [
      Decimal | number | null | string | Date | undefined,
      Decimal | number | null | string | Date | undefined,
    ];
    zoom?: number;
    zoomRange?: [number | undefined, number | undefined];

    sources?: TimescopeOptions['sources'];
    series?: TimescopeOptions['series'];
    tracks?: TimescopeOptions['tracks'];

    indicator?: boolean;
    selection?: TimescopeOptionsSelection;

    selectedRange?: TimescopeRange<Decimal> | null;

    showFps?: boolean;

    fonts?: TimescopeOptionsInitial<unknown, unknown, unknown, unknown, unknown>['fonts'];
  };

  type TimescopeEvents = {
    timechanged: Decimal | null;
    timechanging: Decimal | null;
    timeanimating: Decimal | null;
    zoomchanged: number;
    zoomchanging: number;
    zoomanimating: number;
    selectedrangechanging: [Decimal, Decimal] | null;
    selectedrangechanged: [Decimal, Decimal] | null;
  };

  let {
    width = '100%',
    height = '36px',
    time = $bindable<Decimal | number | null | string | Date | undefined>(undefined),
    timeRange,
    zoom = $bindable<number | undefined>(undefined),
    zoomRange,
    sources,
    series,
    tracks,
    indicator = true,
    selection,
    selectedRange = $bindable<TimescopeRange<Decimal> | null | undefined>(undefined),
    showFps,
    fonts,
  } = $props<TimescopeProps>();

  const dispatch = createEventDispatcher<TimescopeEvents>();

  let container: HTMLDivElement | null = null;
  let timescope: Timescope | null = null;

  onMount(() => {
    timescope = new Timescope({
      time: time ?? null,
      timeRange,
      zoom: zoom ?? 0,
      zoomRange,
      fonts,
    });

    timescope.on('timechanging', (e) => dispatch('timechanging', e.value));
    timescope.on('timechanged', (e) => {
      time = e.value;
      dispatch('timechanged', e.value);
    });
    timescope.on('timeanimating', (e) => dispatch('timeanimating', e.value));
    timescope.on('zoomchanging', (e) => dispatch('zoomchanging', e.value));
    timescope.on('zoomchanged', (e) => {
      zoom = e.value;
      dispatch('zoomchanged', e.value);
    });
    timescope.on('zoomanimating', (e) => dispatch('zoomanimating', e.value));
    timescope.on('selectedrangechanging', (e) => dispatch('selectedrangechanging', e.value));
    timescope.on('selectedrangechanged', (e) => {
      selectedRange = e.value;
      dispatch('selectedrangechanged', e.value);
    });

    return () => {
      timescope?.dispose();
      timescope = null;
    };
  });

  $effect(() => {
    if (!timescope || !container) return;
    timescope.mount(container);
    return () => timescope?.unmount();
  });

  $effect(() => {
    if (!timescope) return;
    if (time !== undefined) timescope.setTime(time ?? null);
  });

  $effect(() => {
    if (!timescope) return;
    timescope.setTimeRange(timeRange);
  });

  $effect(() => {
    if (!timescope) return;
    if (zoom !== undefined) timescope.setZoom(zoom ?? 0);
  });

  $effect(() => {
    if (!timescope) return;
    timescope.setZoomRange(zoomRange);
  });

  $effect(() => {
    if (!timescope) return;
    if (selectedRange !== undefined) timescope.setSelectedRange(selectedRange ?? null);
  });

  $effect(() => {
    if (!timescope) return;
    timescope.updateOptions({ style: { width, height } });
  });

  $effect(() => {
    if (!timescope) return;
    timescope.updateOptions({ sources } as TimescopeOptions);
  });

  $effect(() => {
    if (!timescope) return;
    timescope.updateOptions({ series } as TimescopeOptions);
  });

  $effect(() => {
    if (!timescope) return;
    timescope.updateOptions({ tracks } as TimescopeOptions);
  });

  $effect(() => {
    if (!timescope) return;
    timescope.updateOptions({ indicator } as TimescopeOptions);
  });

  $effect(() => {
    if (!timescope) return;
    timescope.updateOptions({ selection } as TimescopeOptions);
  });

  $effect(() => {
    if (!timescope) return;
    timescope.updateOptions({ showFps } as TimescopeOptions);
  });

  export function setTime(...args: Parameters<Timescope['setTime']>) {
    return timescope?.setTime(...args) ?? false;
  }

  export function setZoom(...args: Parameters<Timescope['setZoom']>) {
    return timescope?.setZoom(...args) ?? false;
  }

  export function fitTo(...args: Parameters<Timescope['fitTo']>) {
    return timescope?.fitTo(...args) ?? false;
  }
</script>

<div bind:this={container}></div>
