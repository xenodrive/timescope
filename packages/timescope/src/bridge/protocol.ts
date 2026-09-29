import type { Decimal } from '#src/core/decimal';
import type { TimescopeRange } from '#src/core/range';
import type { TimescopeCommittableMessageSync } from '#src/core/TimescopeCommittable';
import type { TimescopeViewportSnapshot } from '#src/core/TimescopeState';
import type { TimescopeFont } from '#src/main/font';
import type { InteractionInfo, InteractionPointerInfo } from '#src/main/interaction';
import type { TimescopeRenderEngineOptions } from '#src/renderer/types';

export type TimescopeSyncMessage = {
  time?: TimescopeCommittableMessageSync<null>;
  zoom?: TimescopeCommittableMessageSync<never>;
};
export type TimescopeEventMessage = { uid: string; value: unknown };
export type TimescopeViewportStateWire = TimescopeViewportSnapshot;
export type TimescopeViewportChangedMessage = { viewport: TimescopeViewportStateWire };
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
export type TimescopeFrameCaptureMessage = { time?: Decimal | null; zoom?: Decimal; playbackTime?: Decimal | null };

/** Engine -> controller requests. Both transports acknowledge handler completion. */
export type RendererCommands = {
  readonly sync: (state: TimescopeSyncMessage) => void;
  readonly 'renderer:event': (e: TimescopeEventMessage) => void;
  readonly 'viewport:changed': (e: TimescopeViewportChangedMessage) => void;
  readonly 'viewport:changing': (e: TimescopeViewportChangedMessage) => void;
  readonly 'viewport:prepare': (
    e: TimescopeViewportChangedMessage & { settled?: boolean },
  ) => Promise<TimescopeFrameLatchResult>;
  readonly 'data:load': (message: TimescopeDataLoadMessage) => Promise<any>;
};

/** Controller -> engine requests. Initialization supplies the canvas out of band locally. */
export type RenderEngineCommands = {
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
  readonly redraw: () => Promise<void>;
  readonly 'data:changed': (key: string) => void;
};
export type RendererInitOptions = { canvas: OffscreenCanvas | HTMLCanvasElement };
export type RendererResizeOptions = { size: { width: number; height: number }; context?: { dpr?: number } };
export type RenderEngineCommandsWire = Omit<RenderEngineCommands, 'init'> & {
  readonly init: (options: { canvas: OffscreenCanvas }) => void;
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
