import type { TimescopeChunk } from '#src/core/chunk';
import type { Decimal } from '#src/core/decimal';
import type { TimescopePathCommands } from '#src/core/path';
import type { TimescopeRange } from '#src/core/range';
import type { TimescopeCommittableMessageSync } from '#src/core/TimescopeCommittable';
import type { TimescopeViewportSnapshot } from '#src/core/TimescopeState';
import type { Vector2f } from '#src/core/vector';
import type { TimescopeDataCache } from '#src/renderer/TimescopeDataCache';
import type { TimescopeTrack } from '#src/renderer/TimescopeTrack';
import type { TimescopeViewport } from '#src/renderer/TimescopeViewport';

export type RenderCall<C extends Record<string, (payload: any) => any>> = <K extends keyof C>(
  command: K,
  payload: Parameters<C[K]>[0],
) => Promise<Awaited<ReturnType<C[K]>>>;

export type TimescopeRenderingContext = {
  ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;
  renderingTrack: TimescopeTrack | null;
  options: TimescopeRenderEngineOptions;
  tracks: TimescopeTrack[];
  dataCaches: Record<string, TimescopeDataCache<any>>;
  chart: { ox: number; oy: number; width: number; height: number };
  size: { width: number; height: number };
  symmetric: boolean;
  timeAxis: TimescopeViewport;
  dpr: number;
};

export interface Interaction {
  onPointerEvent(info: InteractionInfoWire, timescope: TimescopeRenderingContext): boolean | void;
  pointerStyle(info: InteractionInfoWire, timescope: TimescopeRenderingContext): string | void;
}

export type TimescopeLayerOptions = { zindex?: number };

export type TextStyleOptions = {
  color?: string;
  fontWeight?: string;
  fontSize?: string;
  fontFamily?: string;
};

export type MaybeFn<R, T> = T extends unknown[] ? ((...args: T) => R) | R : R;
type UsingElement<V extends [string, string]> =
  | `${V[1] | '#zero' | '#top' | '#bottom'}@${V[0]}`
  | (V[1] | '#zero' | '#top' | '#bottom')
  | `@${V[0]}`;
export type Using1<V extends [string, string]> = UsingElement<V> | [UsingElement<V>];
export type Using2<V extends [string, string]> = [UsingElement<V>, UsingElement<V>];
export type Using<V extends [string, string] = [string, string]> = Using1<V> | Using2<V>;

export type StrokeStyle<T = false> = {
  lineWidth?: MaybeFn<number, T>;
  lineColor?: MaybeFn<string, T>;
  lineDashArray?: MaybeFn<number[], T>;
  lineDashOffset?: MaybeFn<number, T>;
};
export type FillStyle<T = false> = {
  fillColor?: MaybeFn<string, T>;
  fillOpacity?: MaybeFn<number, T>;
  fillPost?: boolean;
};
export type SizeStyle<T = false> = { size?: MaybeFn<number, T> };
export type AngleStyle<T = false> = { angle?: MaybeFn<number, T> };
export type PathStyle<T = false> = { path?: MaybeFn<string, T>; origin?: [number, number]; scale?: number };
export type TextStyle<T = false> = {
  fontWeight?: MaybeFn<string, T>;
  fontFamily?: MaybeFn<string, T>;
  textAlign?: MaybeFn<'start' | 'center' | 'end' | 'left' | 'right', T>;
  textBaseline?: MaybeFn<'top' | 'middle' | 'bottom' | 'hanging' | 'alphabetic' | 'ideographic', T>;
  textColor?: MaybeFn<string, T>;
  textOpacity?: MaybeFn<number, T>;
  textOutline?: MaybeFn<boolean, T>;
  textOutlineColor?: MaybeFn<string, T>;
  textOutlineWidth?: MaybeFn<number, T>;
  text?: MaybeFn<string, T>;
};
export type IconStyle<T = false> = {
  iconFontWeight?: MaybeFn<string, T>;
  iconFontFamily?: MaybeFn<string, T>;
  iconAlign?: MaybeFn<'start' | 'center' | 'end' | 'left' | 'right', T>;
  iconBaseline?: MaybeFn<'top' | 'middle' | 'bottom' | 'hanging' | 'alphabetic' | 'ideographic', T>;
  iconColor?: MaybeFn<string, T>;
  iconOpacity?: MaybeFn<number, T>;
  iconOutline?: MaybeFn<boolean, T>;
  iconOutlineColor?: MaybeFn<string, T>;
  iconOutlineWidth?: MaybeFn<number, T>;
  icon?: MaybeFn<string, T>;
};
export type BoxStyle<T = false> = {
  extrude?: MaybeFn<number | [number, number?, number?, number?], T>;
  radius?: MaybeFn<number, T>;
};
export type OffsetStyle<T = false> = { offset?: MaybeFn<[number, number], T> };

export type TimescopeChartStyleEntry<
  D extends string,
  U extends boolean,
  S,
  T extends unknown[] | false,
  V extends [string, string],
> = {
  draw: MaybeFn<D, T>;
  using?: MaybeFn<U extends true ? Using2<V> : Using1<V>, T>;
  style?: MaybeFn<S, T>;
};
export type TimescopeChartMark<T extends unknown[] | false, V extends [string, string] = [string, string]> =
  | TimescopeChartStyleEntry<'circle', false, StrokeStyle<T> & FillStyle<T> & SizeStyle<T> & OffsetStyle<T>, T, V>
  | TimescopeChartStyleEntry<
      'triangle' | 'square' | 'diamond' | 'star',
      false,
      StrokeStyle<T> & FillStyle<T> & SizeStyle<T> & AngleStyle<T> & OffsetStyle<T>,
      T,
      V
    >
  | TimescopeChartStyleEntry<
      'plus' | 'cross' | 'minus',
      false,
      StrokeStyle<T> & SizeStyle<T> & AngleStyle<T> & OffsetStyle<T>,
      T,
      V
    >
  | TimescopeChartStyleEntry<'text', false, SizeStyle<T> & AngleStyle<T> & TextStyle<T> & OffsetStyle<T>, T, V>
  | TimescopeChartStyleEntry<'icon', false, SizeStyle<T> & AngleStyle<T> & IconStyle<T> & OffsetStyle<T>, T, V>
  | TimescopeChartStyleEntry<'path', false, SizeStyle<T> & AngleStyle<T> & PathStyle<T> & OffsetStyle<T>, T, V>
  | TimescopeChartStyleEntry<'line', true, StrokeStyle<T> & SizeStyle<T> & OffsetStyle<T>, T, V>
  | TimescopeChartStyleEntry<'section', true, StrokeStyle<T> & SizeStyle<T> & OffsetStyle<T>, T, V>
  | TimescopeChartStyleEntry<
      'bar',
      true,
      StrokeStyle<T> & FillStyle<T> & SizeStyle<T> & BoxStyle<T> & OffsetStyle<T>,
      T,
      V
    >
  | TimescopeChartStyleEntry<'region', true, StrokeStyle<T> & FillStyle<T> & BoxStyle<T> & OffsetStyle<T>, T, V>;
export type TimescopeChartLink<T extends unknown[] | false, V extends [string, string] = [string, string]> =
  | TimescopeChartStyleEntry<'line' | 'curve' | 'step' | 'step-start' | 'step-end', false, StrokeStyle<T>, T, V>
  | TimescopeChartStyleEntry<
      'area' | 'curve-area' | 'step-area' | 'step-area-start' | 'step-area-end',
      true,
      StrokeStyle<T> & FillStyle<T>,
      T,
      V
    >;
export type TimescopeChartType =
  | 'lines'
  | 'lines:filled'
  | 'curves'
  | 'curves:filled'
  | 'steps-start'
  | 'steps-start:filled'
  | 'steps'
  | 'steps:filled'
  | 'steps-end'
  | 'steps-end:filled'
  | 'points'
  | 'linespoints'
  | 'linespoints:filled'
  | 'curvespoints'
  | 'curvespoints:filled'
  | 'stepspoints-start'
  | 'stepspoints-start:filled'
  | 'stepspoints'
  | 'stepspoints:filled'
  | 'stepspoints-end'
  | 'stepspoints-end:filled'
  | 'impulses'
  | 'impulsespoints'
  | 'bars'
  | 'bars:filled';

export type TimescopeOptionsSelection =
  | boolean
  | {
      resizable?: boolean;
      color?: string;
      invert?: boolean;
      range?: TimescopeRange<Decimal> | null;
    };

// -------------------- Messages --------------------

export type TimescopeSyncMessage = {
  time?: TimescopeCommittableMessageSync<null>;
  zoom?: TimescopeCommittableMessageSync<never>;
};

export type TimescopeEventMessage = {
  uid: string;
  value: unknown;
};

export type TimescopeLoadChunkMessage = {
  key: string;
  chunk: TimescopeChunk;
};

export type TimescopeLoadMetaMessage = {
  key: string;

  zoom: number;
  resolution: Decimal;
};

export type TimescopeLoadMetaOptions = {
  zoom: number;
  resolution: Decimal;
};

export type TimescopeViewportChangedMessage = {
  viewport: TimescopeViewportStateWire;
};

export type TimescopeViewportStateWire = TimescopeViewportSnapshot;

export type TimescopeDataLoadMessage = {
  key: string;
  time: Decimal | null;
  zoom: number;
  range: TimescopeRange<Decimal>;
  xOrigin: Decimal;
  resolution: Decimal;
  fallbackResolution?: Decimal;
  loadMissing?: boolean;
};

export type TimescopeFrameLatchResult = { ok: true } | { ok: false; message: string };

export type TimescopeFrameViewMessage = {
  time: Decimal | null;
  playbackTime: Decimal;
  zoom: number;
  resolution: Decimal;
  range: TimescopeRange<Decimal>;
  currentRange: TimescopeRange<Decimal>;
  viewport: TimescopeViewportStateWire;
};
export type TimescopeFrameViewResult = { ok: true; view: TimescopeFrameViewMessage } | { ok: false; message: string };
export type TimescopeFrameCaptureMessage = {
  time?: Decimal | null;
  zoom?: Decimal;
  playbackTime?: Decimal | null;
};
// -------------------- Wire Types --------------------

/**
 * Wire-safe configuration for worker-side data caches.
 */
export type TimescopeDataCacheOptionsWire = {
  instantWidth?: number;
  instantResolution?: Decimal | undefined;
  immediate?: boolean;
};

// -------------------- RPC Commands --------------------

export type RendererCommands = {
  // Worker -> Main
  readonly sync: (state: TimescopeSyncMessage) => void;

  readonly 'renderer:event': (e: TimescopeEventMessage) => void;
  readonly 'viewport:changed': (e: TimescopeViewportChangedMessage) => void;
  readonly 'viewport:changing': (e: TimescopeViewportChangedMessage) => void;
  readonly 'viewport:prepare': (
    e: TimescopeViewportChangedMessage & { settled?: boolean },
  ) => Promise<TimescopeFrameLatchResult>;

  readonly 'data:load': (mgs: TimescopeDataLoadMessage) => Promise<any>;
};

export type RenderEngineCommands = {
  // Main -> Worker
  readonly init: (opts: RendererInitOptions) => void;
  readonly fonts: (fonts?: TimescopeFont[]) => Promise<void> | void;
  readonly 'options:update': (options: TimescopeRenderEngineOptions) => void;
  readonly resize: (opts: RendererResizeOptions) => Promise<void> | void;

  readonly pointer: (info: InteractionInfoWire) => Promise<boolean | void> | boolean | void;
  readonly cursor: (info: InteractionInfoWire) => Promise<string | void> | string | void;
  readonly sync: (sync: TimescopeSyncMessage) => void;
  readonly 'frame:latch': () => void;
  readonly 'frame:capture': (payload: TimescopeFrameCaptureMessage) => Promise<TimescopeFrameViewResult>;
  readonly 'frame:prepare': (view: TimescopeFrameViewMessage) => Promise<TimescopeFrameLatchResult>;
  readonly 'frame:commit': () => Promise<TimescopeFrameLatchResult>;
  readonly 'frame:abort': () => void;

  readonly reload: () => void;
  readonly redraw: () => void;

  readonly 'data:changed': (key: string) => void;
};

// renderer init/resize payloads and shared wire types
export type TimescopeFont = {
  family: string;
  source: string | BufferSource;
  desc?: FontFaceDescriptors;
};

export type RendererInitOptions = {
  canvas: OffscreenCanvas | HTMLCanvasElement;
};

export type RendererResizeOptions = {
  size: { width: number; height: number };
  context?: { dpr?: number };
};

export type TimescopeRenderEngineOptions = {
  showFps?: boolean;
  padding?: number[];
  indicator?: boolean;
  background?: string;
  selection?: TimescopeOptionsSelection;
  series?: Record<string, { track?: string; tooltip?: false }>;
  tracks?: Record<
    string,
    {
      height?: number;
      symmetric?: boolean;
      timeAxis?:
        | boolean
        | {
            axis?: false | { color?: string };
            ticks?: false | { color?: string };
            labels?: false | TextStyleOptions;
          };
    }
  >;
  dataCacheOptions?: {
    [K in string]: TimescopeDataCacheOptionsWire;
  };
};

// -------------------- Layer serialization --------------------

export type TimescopeTrackWire = {
  height?: number;
  symmetric?: boolean;
  labelHeight?: number;
};

// -------------------- Interaction (shared) --------------------

export type InteractionEventName =
  | 'cursor'
  | 'down'
  | 'click'
  | 'drag:start'
  | 'drag:update'
  | 'drag:end'
  | 'drag:cancel'
  | 'pinch:start'
  | 'pinch:update'
  | 'pinch:end'
  | 'pinch:cancel'
  | 'up';

export type InteractionPointerInfo = {
  pointerId: number;
  latest: Vector2f;
  last: Vector2f;
  delta: Vector2f;
  anchor: Vector2f;
  pressed: boolean;
};

export type InteractionState = 'none' | 'down' | 'drag' | 'pinch';

export type InteractionInfo = {
  type: InteractionEventName;
  state: InteractionState;
  latest: InteractionPointerInfo;
  buttons: InteractionPointerInfo[];
  shiftKey: boolean;
};

export type InteractionPointWire = { x: number; y: number };
export type InteractionPointerInfoWire = Omit<InteractionPointerInfo, 'latest' | 'last' | 'delta' | 'anchor'> & {
  latest: InteractionPointWire;
  last: InteractionPointWire;
  delta: InteractionPointWire;
  anchor: InteractionPointWire;
};
export type InteractionInfoWire = Omit<InteractionInfo, 'latest' | 'buttons'> & {
  latest: InteractionPointerInfoWire;
  buttons: InteractionPointerInfoWire[];
};

export type TimescopeTimeAxisData = {
  data: {
    /** Tick time at the label position. */
    time: { time: Decimal };

    /** Human-readable label text. Omit to render no label. */
    text?: string;
    /** Whether to render a tick mark. */
    tick?: boolean;
    /** Whether this tick is a major tick. */
    major?: boolean;
  }[];
  meta: {
    time: Decimal;
    resolution: Decimal;
  };
};

export type TimescopeSeriesChartData = {
  data: {
    marks: TimescopeProjectedChartMark[][];
    links: TimescopeCompiledChartLink[];
  };

  meta: {
    color: string;
    time: Decimal;
    resolution: Decimal;

    projection: TimescopeYProjectionWire;
    linkProjection: TimescopeYProjectionWire;
  };
};

export type TimescopeProjectedChartMark = Omit<TimescopeChartMark<false>, 'using'> & {
  point: {
    x1: number;
    y1: number | 'zero' | 'top' | 'bottom';
    x2: number;
    y2: number | 'zero' | 'top' | 'bottom';
  };
};

export type TimescopeCompiledChartLink = {
  commands: TimescopePathCommands;
  draw: TimescopeChartLink<false>['draw'];
  style: StrokeStyle<false> & FillStyle<false>;
};

export type TimescopeYProjectionMode =
  | 'zero-inclusive'
  | 'floating-positive'
  | 'floating-negative'
  | 'zero-only'
  | 'constant'
  | 'empty';

export type TimescopeYProjectionWire = {
  domainId: string;
  domainEpoch: number;
  revision: number;
  autoscale: boolean;
  animation: boolean;
  mode: TimescopeYProjectionMode;
  extent: [number, number] | null;
  gap: number;
  floating: number;
  numericZero: number | null;
  toAnchor: { scale: number; offset: number } | null;
};

export type TimescopeYAxisData = {
  data: {
    id: string;
    side: 'left' | 'right';
    label?: string;
    unit?: string;
    color?: string;
    ticks: { value: number; text: string; zero?: boolean }[];
  };
  meta: {
    time: Decimal;
    resolution: Decimal;
    projection: TimescopeYProjectionWire;
  };
};

export type TimescopeSeriesTooltipData = {
  data: {
    t: Decimal[];
    y: Float64Array;
    text: string[];
  };

  meta: {
    time: Decimal;
    resolution: Decimal;
    color: string;
    projection: TimescopeYProjectionWire;
  };
};
