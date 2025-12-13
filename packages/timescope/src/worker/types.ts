import type { InteractionInfo, TimescopeOptionsForWorker } from '#src/bridge/protocol';
import { TimescopeTimeAxis } from '#src/worker/TimescopeTimeAxis';
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
  timeAxis: TimescopeTimeAxis;
  dpr: number;
};

export interface Interaction {
  onPointerEvent(info: InteractionInfo, timescope: TimescopeRenderingContext): boolean | void;
  pointerStyle(info: InteractionInfo, timescope: TimescopeRenderingContext): string | void;
}

export type TimescopeRendererOptions = {
  /** Rendering order. Larger value draws on top. */
  zindex?: number;
};
