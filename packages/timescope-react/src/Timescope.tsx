import type { Decimal } from '@kikuchan/decimal';
import type { ForwardedRef } from 'react';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import {
  Timescope,
  type TimescopeOptions,
  type TimescopeOptionsInitial,
  type TimescopeRange,
  type TimescopeSeriesInput,
  type TimescopeSourceInput,
} from 'timescope';

type TimescopeProps<
  Sources extends Record<string, TimescopeSourceInput>,
  Series extends Record<string, TimescopeSeriesInput>,
  Track extends string,
> = {
  options?: TimescopeOptions<Sources, Series, Track>;
  time?: Decimal | number | null | string | Date;
  timeRange?: [
    Decimal | number | null | string | Date | undefined,
    Decimal | number | null | string | Date | undefined,
  ];
  zoom?: number;
  zoomRange?: [number | undefined, number | undefined];
  initialTime?: Decimal | number | null | string | Date;
  initialZoom?: number;
  initialFit?: Extract<TimescopeOptionsInitial<Sources, Series, Track>, { fit: unknown }>['fit'];
  selectionRange?: TimescopeRange<Decimal> | null;

  renderThread?: TimescopeOptionsInitial<Sources, Series, Track>['renderThread'];

  fonts?: TimescopeOptionsInitial<Sources, Series, Track>['fonts'];

  onReady?: () => void;
  onMount?: () => void;
  onTimeChanged?: (value: Decimal | null) => void;
  onTimeChanging?: (value: Decimal | null) => void;
  onTimeAnimating?: (value: Decimal | null) => void;
  onZoomChanged?: (value: number) => void;
  onZoomChanging?: (value: number) => void;
  onZoomAnimating?: (value: number) => void;
  onSelectionRangeChanging?: (value: [Decimal, Decimal] | null) => void;
  onSelectionRangeChanged?: (value: [Decimal, Decimal] | null) => void;
  onAnimating?: (value: boolean) => void;
  onEditing?: (value: boolean) => void;
};

export type TimescopeAPI = {
  setTime: Timescope['setTime'];
  setZoom: Timescope['setZoom'];
  fitTo: Timescope['fitTo'];
  prepareView: Timescope['prepareView'];
  nextFrame: Timescope['nextFrame'];
};

const TimescopeComponent = forwardRef(function TimescopeComponent<
  Sources extends Record<string, TimescopeSourceInput>,
  Series extends Record<string, TimescopeSeriesInput>,
  Track extends string,
>(props: TimescopeProps<Sources, Series, Track>, ref: ForwardedRef<TimescopeAPI>) {
  const timescopeRef = useRef<Timescope<Sources, Series, Track> | null>(null);
  const [containerEl, setContainerEl] = useState<HTMLDivElement | null>(null);
  const initialPropsRef = useRef({
    renderThread: props.renderThread,
    time: props.time,
    initialTime: props.initialTime,
    timeRange: props.timeRange,
    zoom: props.zoom,
    initialZoom: props.initialZoom,
    zoomRange: props.zoomRange,
    fonts: props.fonts,
    initialFit: props.initialFit,
    options: props.options,
    selectionRange: props.selectionRange,
  });

  const callbacksRef = useRef({
    onReady: props.onReady,
    onMount: props.onMount,
    onTimeChanged: props.onTimeChanged,
    onTimeChanging: props.onTimeChanging,
    onTimeAnimating: props.onTimeAnimating,
    onZoomChanged: props.onZoomChanged,
    onZoomChanging: props.onZoomChanging,
    onZoomAnimating: props.onZoomAnimating,
    onSelectionRangeChanging: props.onSelectionRangeChanging,
    onSelectionRangeChanged: props.onSelectionRangeChanged,
    onAnimating: props.onAnimating,
    onEditing: props.onEditing,
  });

  useEffect(() => {
    callbacksRef.current = {
      onReady: props.onReady,
      onMount: props.onMount,
      onTimeChanged: props.onTimeChanged,
      onTimeChanging: props.onTimeChanging,
      onTimeAnimating: props.onTimeAnimating,
      onZoomChanged: props.onZoomChanged,
      onZoomChanging: props.onZoomChanging,
      onZoomAnimating: props.onZoomAnimating,
      onSelectionRangeChanging: props.onSelectionRangeChanging,
      onSelectionRangeChanged: props.onSelectionRangeChanged,
      onAnimating: props.onAnimating,
      onEditing: props.onEditing,
    };
  }, [
    props.onReady,
    props.onMount,
    props.onTimeChanged,
    props.onTimeChanging,
    props.onTimeAnimating,
    props.onZoomChanged,
    props.onZoomChanging,
    props.onZoomAnimating,
    props.onSelectionRangeChanging,
    props.onSelectionRangeChanged,
    props.onAnimating,
    props.onEditing,
  ]);

  useImperativeHandle(
    ref,
    () => ({
      setTime: (...args) => timescopeRef.current?.setTime(...args) ?? false,
      setZoom: (...args) => timescopeRef.current?.setZoom(...args) ?? false,
      fitTo: (...args) => timescopeRef.current?.fitTo(...args) ?? false,
      prepareView: () => {
        if (!timescopeRef.current) throw new DOMException('Timescope is not mounted', 'InvalidStateError');
        return timescopeRef.current.prepareView();
      },
      nextFrame: () =>
        timescopeRef.current?.nextFrame() ??
        Promise.reject(new DOMException('Timescope is not mounted', 'InvalidStateError')),
    }),
    [],
  );

  useEffect(() => {
    const initialProps = initialPropsRef.current;
    if (
      initialProps.initialFit !== undefined &&
      (initialProps.initialTime !== undefined || initialProps.initialZoom !== undefined)
    ) {
      throw new TypeError('initialFit cannot be combined with initialTime or initialZoom');
    }
    const useFit =
      initialProps.initialFit !== undefined && initialProps.time === undefined && initialProps.zoom === undefined;
    const instance = new Timescope<Sources, Series, Track>({
      ...initialProps.options,
      renderThread: initialProps.renderThread,
      ...(useFit
        ? { fit: initialProps.initialFit }
        : {
            time: initialProps.time !== undefined ? initialProps.time : (initialProps.initialTime ?? null),
            zoom: initialProps.zoom ?? initialProps.initialZoom ?? 0,
          }),
      timeRange: initialProps.timeRange,
      zoomRange: initialProps.zoomRange,
      fonts: initialProps.fonts,
      selection:
        initialProps.selectionRange === undefined || initialProps.options?.selection === false
          ? initialProps.options?.selection
          : {
              ...(typeof initialProps.options?.selection === 'object' ? initialProps.options.selection : {}),
              range: initialProps.selectionRange,
            },
    });

    timescopeRef.current = instance;

    instance.on('ready', () => callbacksRef.current.onReady?.());
    instance.on('mount', () => callbacksRef.current.onMount?.());
    instance.on('timechanging', (e) => {
      callbacksRef.current.onTimeChanging?.(e.value);
    });
    instance.on('timechanged', (e) => {
      callbacksRef.current.onTimeChanged?.(e.value);
    });
    instance.on('timeanimating', (e) => {
      callbacksRef.current.onTimeAnimating?.(e.value);
    });
    instance.on('zoomchanging', (e) => {
      callbacksRef.current.onZoomChanging?.(e.value);
    });
    instance.on('zoomchanged', (e) => {
      callbacksRef.current.onZoomChanged?.(e.value);
    });
    instance.on('zoomanimating', (e) => {
      callbacksRef.current.onZoomAnimating?.(e.value);
    });

    instance.on('selectionrangechanging', (e) => callbacksRef.current.onSelectionRangeChanging?.(e.value));
    instance.on('selectionrangechanged', (e) => callbacksRef.current.onSelectionRangeChanged?.(e.value));

    let animating = instance.animating;
    let editing = instance.editing;
    instance.on('change', () => {
      if (instance.animating !== animating) {
        animating = instance.animating;
        callbacksRef.current.onAnimating?.(animating);
      }
      if (instance.editing !== editing) {
        editing = instance.editing;
        callbacksRef.current.onEditing?.(editing);
      }
    });

    if (!useFit) {
      if (initialProps.time === undefined) callbacksRef.current.onTimeChanged?.(instance.time);
      if (initialProps.zoom === undefined) callbacksRef.current.onZoomChanged?.(instance.zoom);
    }

    return () => {
      instance.dispose();
      timescopeRef.current = null;
    };
  }, []);

  useEffect(() => {
    const instance = timescopeRef.current;
    if (!instance || !containerEl) return;
    instance.mount(containerEl);
    return () => instance.unmount();
  }, [containerEl]);

  useEffect(() => {
    if (props.time !== undefined) timescopeRef.current?.setTime(props.time);
  }, [props.time]);

  useEffect(() => {
    timescopeRef.current?.setTimeRange(props.timeRange);
  }, [props.timeRange]);

  useEffect(() => {
    if (props.zoom !== undefined) timescopeRef.current?.setZoom(props.zoom);
  }, [props.zoom]);

  useEffect(() => {
    timescopeRef.current?.setZoomRange(props.zoomRange);
  }, [props.zoomRange]);

  const optionsInitialized = useRef(false);
  useEffect(() => {
    if (!optionsInitialized.current) {
      optionsInitialized.current = true;
      return;
    }
    timescopeRef.current?.setOptions(props.options ?? {});
  }, [props.options]);

  useEffect(() => {
    if (props.selectionRange !== undefined) timescopeRef.current?.setSelectionRange(props.selectionRange);
  }, [props.selectionRange]);

  const containerRef = useCallback((element: HTMLDivElement | null) => {
    setContainerEl(element);
  }, []);

  return <div ref={containerRef} />;
});

export default TimescopeComponent;
export { TimescopeComponent as Timescope };
