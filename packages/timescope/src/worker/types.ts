import type { InteractionInfoWire, TimescopeOptionsForWorker } from '#src/bridge/protocol';
import { TimescopeViewport } from '#src/worker/TimescopeViewport';
import { TimescopeTrack } from '#src/worker/TimescopeTrack';
import type { TimescopeDataCache } from './TimescopeDataCache';

export type TimescopeRenderingContext = {
  ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;
  renderingTrack: TimescopeTrack | null;

  options: TimescopeOptionsForWorker;

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

export type TimescopeRendererOptions = {
  zindex?: number;
};
