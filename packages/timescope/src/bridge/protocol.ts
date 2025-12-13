import type { TimescopeDataChunkDesc } from '#src/core/chunk';
import type { Decimal } from '#src/core/decimal';
import type { Range } from '#src/core/range';
import type { TimescopeCommittableMessageSync } from '#src/core/TimescopeCommittable';
import type { TimescopeChartLink, TimescopeChartMark, TimescopeOptions } from '#src/core/types';
import { Vector2f } from '#src/core/vector';

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
  chunk: TimescopeDataChunkDesc;
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
  range: Range<Decimal>;
};

// -------------------- Wire Types --------------------

/**
 * Wire payload for transferring chunk data across boundaries.
 */
export type TimescopeDataChunkWire<T> = TimescopeDataChunkDesc & {
  /** Chunk payload. */
  data?: T & { time: Record<string, Decimal> & { _minTime: Decimal; _maxTime: Decimal } }[];
};

export type TimescopeDataCacheOptionsWire = {
  instantValue?: boolean;
  instantZoomLevel?: number;
  immediate?: boolean;

  chunkSize?: number;
  zoomLevels?: readonly number[];
};

// -------------------- RPC Commands --------------------

export type RendererCommands = {
  readonly sync: (state: TimescopeSyncMessage) => void;

  readonly 'renderer:event': (e: TimescopeEventMessage) => void;
  readonly 'provider:loadChunk': (e: TimescopeLoadChunkMessage) => Promise<TimescopeDataChunkWire<any>>;
  readonly 'provider:loadMeta': (e: TimescopeLoadMetaMessage) => Promise<object>;
  readonly 'view:changed': (e: TimescopeViewChangedMessage) => Promise<void>;
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

export type WorkerCommands = {
  readonly init: (opts: RendererInitOptions) => void;
  readonly fonts: (fonts?: TimescopeFont[]) => void;
  readonly 'options:update': (options: TimescopeOptionsForWorker) => void;
  readonly resize: (opts: RendererResizeOptions) => Promise<void> | void;

  readonly pointer: (info: InteractionInfo) => Promise<boolean | void> | boolean | void;
  readonly cursor: (info: InteractionInfo) => Promise<string | void> | string | void;
  readonly sync: (sync: TimescopeSyncMessage) => void;

  readonly reload: () => void;
  readonly redraw: () => void;
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
  chunk: TimescopeDataChunkDesc;
};

export type TimescopeSeriesProviderData = {
  time: Record<string, Decimal>;
  value: Record<string, Decimal>;
};

export type TimescopeSeriesProviderMeta = {
  pmin: Decimal | null;
  pmax: Decimal | null;
  nmin: Decimal | null;
  nmax: Decimal | null;
  zero: Decimal | null;
  scale?: 'linear' | 'log';
};

export type TimescopeTimeAxisProviderData = {
  /** Tick time at the label position. */
  time: { time: Decimal };

  /** Human-readable label text. Omit to render no label. */
  text?: string;
  /** Whether to render a tick mark. */
  tick?: boolean;
  /** Whether this tick is a major tick. */
  major?: boolean;
};

export type TimescopeSeriesChartProviderData = TimescopeSeriesProviderData & {
  marks: TimescopeChartMark<false>[];
};

export type TimescopeSeriesChartProviderMeta = TimescopeSeriesProviderMeta & {
  links: TimescopeChartLink<false>[];
  color: string;
};

export type TimescopeSeriesInstantaneousValueProviderData = {
  time: { time: Decimal };
  value: { value: Decimal };

  text: string;
};

export type TimescopeSeriesInstantaneousValueProviderMeta = TimescopeSeriesProviderMeta & {
  color: string;
};
