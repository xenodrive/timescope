import type { TimescopeChunk } from '#src/core/chunk';
import type { Decimal } from '#src/core/decimal';
import type { TimescopePathCommands } from '#src/core/path';
import type { TimescopeRange } from '#src/core/range';
import type { TextStyleOptions } from '#src/core/style';
import type { TimescopeCommittableMessageSync } from '#src/core/TimescopeCommittable';
import type {
  FillStyle,
  StrokeStyle,
  TimescopeChartLink,
  TimescopeChartMark,
  TimescopeOptionsSelection,
} from '#src/core/types';
import type { Vector2f } from '#src/core/vector';

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

export type TimescopeViewportStateWire = {
  current: { center: Decimal; resolution: Decimal };
  candidate: { center: Decimal; resolution: Decimal };
  cursor: { center: Decimal };
  axisSize: readonly [number, number];
  editing: boolean;
  animating: boolean;
};

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

export type WorkerCommands = {
  // Main -> Worker
  readonly init: (opts: RendererInitOptions) => void;
  readonly fonts: (fonts?: TimescopeFont[]) => void;
  readonly 'options:update': (options: TimescopeOptionsForWorker) => void;
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
  canvas: OffscreenCanvas;
};

export type RendererResizeOptions = {
  size: { width: number; height: number };
  context?: { dpr?: number };
};

export type TimescopeOptionsForWorker = {
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
  'zero-inclusive' | 'floating-positive' | 'floating-negative' | 'zero-only' | 'constant' | 'empty';

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
