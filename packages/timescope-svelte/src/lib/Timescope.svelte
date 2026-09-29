<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import type {
    Decimal,
    TimescopeOptions,
    TimescopeOptionsInitial,
    TimescopeRange,
    TimescopeSeriesInput,
    TimescopeSourceInput,
  } from 'timescope';
  import { Timescope } from 'timescope';

  export type TimescopeProps = {
    options?: TimescopeOptions;
    time?: Decimal | number | null | string | Date;
    timeRange?: [
      Decimal | number | null | string | Date | undefined,
      Decimal | number | null | string | Date | undefined,
    ];
    zoom?: number;
    zoomRange?: [number | undefined, number | undefined];
    initialTime?: Decimal | number | null | string | Date;
    initialZoom?: number;
    initialFit?: Extract<
      TimescopeOptionsInitial<Record<string, TimescopeSourceInput>, Record<string, TimescopeSeriesInput>, string>,
      { fit: unknown }
    >['fit'];

    selectionRange?: TimescopeRange<Decimal> | null;

    renderThread?: TimescopeOptionsInitial<
      Record<string, TimescopeSourceInput>,
      Record<string, TimescopeSeriesInput>,
      string
    >['renderThread'];

    fonts?: TimescopeOptionsInitial<
      Record<string, TimescopeSourceInput>,
      Record<string, TimescopeSeriesInput>,
      string
    >['fonts'];
  };

  type TimescopeEvents = {
    ready: void;
    mount: void;
    timechanged: Decimal | null;
    timechanging: Decimal | null;
    timeanimating: Decimal | null;
    zoomchanged: number;
    zoomchanging: number;
    zoomanimating: number;
    selectionrangechanging: [Decimal, Decimal] | null;
    selectionrangechanged: [Decimal, Decimal] | null;
    animating: boolean;
    editing: boolean;
  };

  let {
    options,
    time = $bindable<Decimal | number | null | string | Date | undefined>(undefined),
    timeRange,
    zoom = $bindable<number | undefined>(undefined),
    zoomRange,
    initialTime,
    initialZoom,
    initialFit,
    selectionRange = $bindable<TimescopeRange<Decimal> | null | undefined>(undefined),
    renderThread,
    fonts,
  }: TimescopeProps = $props();

  const dispatch = createEventDispatcher<TimescopeEvents>();

  let container: HTMLDivElement | null = null;
  let timescope: Timescope | null = null;

  onMount(() => {
    if (initialFit !== undefined && (initialTime !== undefined || initialZoom !== undefined)) {
      throw new TypeError('initialFit cannot be combined with initialTime or initialZoom');
    }
    const useFit = initialFit !== undefined && time === undefined && zoom === undefined;
    timescope = new Timescope({
      ...options,
      renderThread,
      ...(useFit
        ? { fit: initialFit }
        : { time: time !== undefined ? time : (initialTime ?? null), zoom: zoom ?? initialZoom ?? 0 }),
      timeRange,
      zoomRange,
      fonts,
      selection:
        selectionRange === undefined || options?.selection === false
          ? options?.selection
          : { ...(typeof options?.selection === 'object' ? options.selection : {}), range: selectionRange },
    });

    timescope.on('ready', () => dispatch('ready'));
    timescope.on('mount', () => dispatch('mount'));
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
    timescope.on('selectionrangechanging', (e) => dispatch('selectionrangechanging', e.value));
    timescope.on('selectionrangechanged', (e) => {
      selectionRange = e.value;
      dispatch('selectionrangechanged', e.value);
    });

    if (!useFit) {
      if (time === undefined) time = timescope.time;
      if (zoom === undefined) zoom = timescope.zoom;
    }

    let animating = timescope.animating;
    let editing = timescope.editing;
    timescope.on('change', () => {
      if (timescope?.animating !== animating) {
        animating = timescope?.animating ?? false;
        dispatch('animating', animating);
      }
      if (timescope?.editing !== editing) {
        editing = timescope?.editing ?? false;
        dispatch('editing', editing);
      }
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
    if (selectionRange !== undefined) timescope.setSelectionRange(selectionRange ?? null);
  });

  let optionsInitialized = false;
  $effect(() => {
    if (!timescope) return;
    const nextOptions = options;
    if (!optionsInitialized) {
      optionsInitialized = true;
      return;
    }
    timescope.setOptions(nextOptions ?? {});
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

  export function prepareView() {
    if (!timescope) throw new DOMException('Timescope is not mounted', 'InvalidStateError');
    return timescope.prepareView();
  }

  export function nextFrame() {
    if (!timescope) return Promise.reject(new DOMException('Timescope is not mounted', 'InvalidStateError'));
    return timescope.nextFrame();
  }
</script>

<div bind:this={container}></div>
