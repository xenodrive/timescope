import type { TimescopeChunk } from '#src/core/chunk';
import type { Decimal } from '#src/core/decimal';
import type { TimescopeRange } from '#src/core/range';
import type { TimescopeCommittableMessageSync } from '#src/core/TimescopeCommittable';
import type { TimescopeChartLink, TimescopeChartMark, TimescopeOptions } from '#src/core/types';
import { Vector2f } from '#src/core/vector';
import type { TimescopeSeriesPoint } from '#src/main/TimescopeDataSeries';

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

export type TimescopeViewChangedMessage = {
  time: Decimal | null;
  zoom: number;
  resolution: Decimal;
  range: TimescopeRange<Decimal>;
};

export type TimescopeProviderLoadDataMessage = {
  key: string;
  time: Decimal | null;
  zoom: number;
  range: TimescopeRange<Decimal>;
  resolution: Decimal;
};
// -------------------- Wire Types --------------------

/**
 * Wire payload for transferring chunk data across boundaries.
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
  readonly 'view:changed': (e: TimescopeViewChangedMessage) => Promise<void>;
  readonly 'view:changing': (e: TimescopeViewChangedMessage) => void;

  readonly 'provider:loadData': (mgs: TimescopeProviderLoadDataMessage) => Promise<any>;
};

export type WorkerCommands = {
  // Main -> Worker
  readonly init: (opts: RendererInitOptions) => void;
  readonly fonts: (fonts?: TimescopeFont[]) => void;
  readonly 'options:update': (options: TimescopeOptionsForWorker) => void;
  readonly resize: (opts: RendererResizeOptions) => Promise<void> | void;

  readonly pointer: (info: InteractionInfo) => Promise<boolean | void> | boolean | void;
  readonly cursor: (info: InteractionInfo) => Promise<string | void> | string | void;
  readonly sync: (sync: TimescopeSyncMessage) => void;

  readonly reload: () => void;
  readonly redraw: () => void;

  readonly 'provider:changed': (key: string) => void;
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

export type TimescopeOptionsForWorker = TimescopeOptions & {
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

export type ProviderLoadChunkMessage = {
  key: string;
  chunk: TimescopeChunk;
};

export type TimescopeSeriesProviderData = {
  data: TimescopeSeriesPoint[];
  meta: {
    time: Decimal;
    resolution: Decimal;
  };
};

export type TimescopeTimeAxisProviderData = {
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

export type TimescopeSeriesChartProviderData = {
  data: {
    marks: TimescopeChartMark<false>[];
    point: {
      x: Record<string, number>;
      y: Record<string, number>;
    };
  }[];

  meta: {
    links: TimescopeChartLink<false>[];
    color: string;
    time: Decimal;
    resolution: Decimal;

    minmax: [number, number];
    floating?: number;

    start_t: number;
    scaleY: number;
    baseY: number;
  };
};

export type TimescopeSeriesInstantaneousValueProviderData = {
  data: {
    time: { time: Decimal };
    value: { value: Decimal | null };

    point: { y: number };

    text: string;
  }[];

  meta: {
    time: Decimal;
    resolution: Decimal;
    color: string;
  };
};
