import type { ForwardedRef } from 'react';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import {
  Timescope,
  type FieldDefLike,
  type TimescopeNumberLike,
  type TimescopeOptions,
  type TimescopeOptionsInitial,
  type TimescopeOptionsSelection,
  type TimescopeOptionsSeries,
  type TimescopeOptionsSources,
  type TimescopeOptionsTracks,
  type TimescopeSourceInput,
  type TimescopeTimeLike,
} from 'timescope';
import type { Decimal } from '@kikuchan/decimal';

type TimescopeProps<
  Source extends Record<string, TimescopeSourceInput>,
  SourceName extends Record<string, keyof Source>,
  TimeDef extends Record<string, FieldDefLike<TimescopeTimeLike<never>>>,
  ValueDef extends Record<string, FieldDefLike<TimescopeNumberLike | null>>,
  Track extends string,
> = {
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

  sources?: TimescopeOptionsSources<Source>;
  series?: TimescopeOptionsSeries<Source, SourceName, TimeDef, ValueDef, Track>;
  tracks?: TimescopeOptionsTracks<Track>;

  indicator?: boolean;
  selection?: TimescopeOptionsSelection;

  showFps?: boolean;

  fonts?: TimescopeOptionsInitial<Source, SourceName, TimeDef, ValueDef, Track>['fonts'];

  onTimeChanged?: (value: Decimal | null) => void;
  onTimeChanging?: (value: Decimal | null) => void;
  onTimeAnimating?: (value: Decimal | null) => void;
  onZoomChanged?: (value: number) => void;
  onZoomChanging?: (value: number) => void;
  onZoomAnimating?: (value: number) => void;
  onSelectedRangeChanging?: (value: [Decimal, Decimal] | null) => void;
  onSelectedRangeChanged?: (value: [Decimal, Decimal] | null) => void;
  onAnimating?: (value: boolean) => void;
  onEditing?: (value: boolean) => void;
};

export type TimescopeAPI = {
  setTime: Timescope['setTime'];
  setZoom: Timescope['setZoom'];
  fitTo: Timescope['fitTo'];
};

const TimescopeComponent = forwardRef(function TimescopeComponent<
  Source extends Record<string, TimescopeSourceInput>,
  SourceName extends Record<string, keyof Source>,
  TimeDef extends Record<string, FieldDefLike<TimescopeTimeLike<never>>>,
  ValueDef extends Record<string, FieldDefLike<TimescopeNumberLike | null>>,
  Track extends string,
>(props: TimescopeProps<Source, SourceName, TimeDef, ValueDef, Track>, ref: ForwardedRef<TimescopeAPI>) {
  const timescopeRef = useRef<Timescope | null>(null);
  const [containerEl, setContainerEl] = useState<HTMLDivElement | null>(null);
  const initialPropsRef = useRef({
    time: props.time,
    timeRange: props.timeRange,
    zoom: props.zoom,
    zoomRange: props.zoomRange,
    fonts: props.fonts,
  });

  const callbacksRef = useRef({
    onTimeChanged: props.onTimeChanged,
    onTimeChanging: props.onTimeChanging,
    onTimeAnimating: props.onTimeAnimating,
    onZoomChanged: props.onZoomChanged,
    onZoomChanging: props.onZoomChanging,
    onZoomAnimating: props.onZoomAnimating,
    onSelectedRangeChanging: props.onSelectedRangeChanging,
    onSelectedRangeChanged: props.onSelectedRangeChanged,
    onAnimating: props.onAnimating,
    onEditing: props.onEditing,
  });

  useEffect(() => {
    callbacksRef.current = {
      onTimeChanged: props.onTimeChanged,
      onTimeChanging: props.onTimeChanging,
      onTimeAnimating: props.onTimeAnimating,
      onZoomChanged: props.onZoomChanged,
      onZoomChanging: props.onZoomChanging,
      onZoomAnimating: props.onZoomAnimating,
      onSelectedRangeChanging: props.onSelectedRangeChanging,
      onSelectedRangeChanged: props.onSelectedRangeChanged,
      onAnimating: props.onAnimating,
      onEditing: props.onEditing,
    };
  }, [
    props.onTimeChanged,
    props.onTimeChanging,
    props.onTimeAnimating,
    props.onZoomChanged,
    props.onZoomChanging,
    props.onZoomAnimating,
    props.onSelectedRangeChanging,
    props.onSelectedRangeChanged,
    props.onAnimating,
    props.onEditing,
  ]);

  useImperativeHandle(
    ref,
    () => ({
      setTime: (...args) => timescopeRef.current?.setTime(...args) ?? false,
      setZoom: (...args) => timescopeRef.current?.setZoom(...args) ?? false,
      fitTo: (...args) => timescopeRef.current?.fitTo(...args) ?? false,
    }),
    [],
  );

  useEffect(() => {
    const initialProps = initialPropsRef.current;
    const instance = new Timescope({
      time: initialProps.time ?? null,
      timeRange: initialProps.timeRange,
      zoom: initialProps.zoom ?? 0,
      zoomRange: initialProps.zoomRange,
      fonts: initialProps.fonts,
    });

    timescopeRef.current = instance;

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

    instance.on('selectedrangechanging', (e) => callbacksRef.current.onSelectedRangeChanging?.(e.value));
    instance.on('selectedrangechanged', (e) => callbacksRef.current.onSelectedRangeChanged?.(e.value));

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
    timescopeRef.current?.setTime(props.time ?? null);
  }, [props.time]);

  useEffect(() => {
    timescopeRef.current?.setTimeRange(props.timeRange);
  }, [props.timeRange]);

  useEffect(() => {
    timescopeRef.current?.setZoom(props.zoom ?? 0);
  }, [props.zoom]);

  useEffect(() => {
    timescopeRef.current?.setZoomRange(props.zoomRange);
  }, [props.zoomRange]);

  useEffect(() => {
    timescopeRef.current?.updateOptions({
      style: { width: props.width ?? '100%', height: props.height ?? '36px', background: props.background },
    });
  }, [props.width, props.height, props.background]);

  useEffect(() => {
    timescopeRef.current?.updateOptions({ sources: props.sources } as TimescopeOptions);
  }, [props.sources]);

  useEffect(() => {
    timescopeRef.current?.updateOptions({ series: props.series } as TimescopeOptions);
  }, [props.series]);

  useEffect(() => {
    timescopeRef.current?.updateOptions({ tracks: props.tracks } as TimescopeOptions);
  }, [props.tracks]);

  useEffect(() => {
    timescopeRef.current?.updateOptions({ indicator: props.indicator ?? true } as TimescopeOptions);
  }, [props.indicator]);

  useEffect(() => {
    timescopeRef.current?.updateOptions({ selection: props.selection } as TimescopeOptions);
  }, [props.selection]);

  useEffect(() => {
    timescopeRef.current?.updateOptions({ showFps: props.showFps } as TimescopeOptions);
  }, [props.showFps]);

  const containerRef = useCallback((element: HTMLDivElement | null) => {
    setContainerEl(element);
  }, []);

  return <div ref={containerRef} />;
});

export default TimescopeComponent;
export { TimescopeComponent as Timescope };
