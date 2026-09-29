import type { InteractionInfoWire } from '#src/bridge/protocol';
import type { Decimal } from '#src/core/decimal';
import type { TimescopePathCommands } from '#src/core/path';
import type {
  FillStyle,
  StrokeStyle,
  TextStyleOptions,
  TimescopeChartLink,
  TimescopeChartMark,
  TimescopeOptionsSelection,
} from '#src/main/chart';
import type { TimescopeFontStyle } from '#src/main/fontStyle';
import type { TimescopeDataCache } from '#src/renderer/TimescopeDataCache';
import type { TimescopeTrack } from '#src/renderer/TimescopeTrack';
import type { TimescopeViewport } from '#src/renderer/TimescopeViewport';

export type TimescopePath2DConstructor = new (path?: string) => Path2D;

export type TimescopeRenderingContext = {
  ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;
  Path2D: TimescopePath2DConstructor;
  renderingTrack: TimescopeTrack | null;
  options: TimescopeRenderEngineOptions;
  tracks: TimescopeTrack[];
  dataCaches: Record<string, TimescopeDataCache<any>>;
  size: { width: number; height: number };
  symmetric: boolean;
  timeAxis: TimescopeViewport;
  dpr: number;
};

export interface Interaction {
  onPointerEvent(info: InteractionInfoWire, timescope: TimescopeRenderingContext): boolean | void;
  pointerStyle(info: InteractionInfoWire, timescope: TimescopeRenderingContext): string | void;
}

export type TimescopeDataCacheOptionsWire = {
  instantWidth?: number;
  instantResolution?: Decimal | undefined;
  immediate?: boolean;
};

export type TimescopeRenderEngineOptions = {
  font?: TimescopeFontStyle;
  showFps?: boolean;
  cursor?: boolean | { color?: string; borderColor?: string };
  background?: string;
  selection?: TimescopeOptionsSelection;
  selectionReset?: boolean;
  selectionRange?: [Decimal, Decimal] | null;
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
  dataCacheOptions?: Record<string, TimescopeDataCacheOptionsWire>;
};

export type TimescopeTimeAxisData = {
  data: {
    /** Tick time at the label position. */
    time: { time: Decimal };
    /** Human-readable label text. Omit to render no label. */
    text?: string;
    /** Stable ordinal used to thin overlapping labels without shifting on scroll. */
    labelIndex?: bigint;
    /** Whether to render a tick mark. */
    tick?: boolean;
    /** Whether this tick is a major tick. */
    major?: boolean;
  }[];
  meta: { time: Decimal; resolution: Decimal };
};

export type TimescopeSeriesChartData = {
  data: { marks: TimescopeProjectedChartMark[][]; links: TimescopeCompiledChartLink[] };
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
  /** Stable across transfers while the geometry and its coordinate system are unchanged. */
  geometryUid?: string;
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
    font?: TimescopeFontStyle;
    ticks: { value: number; text: string; zero?: boolean }[];
  };
  meta: { time: Decimal; resolution: Decimal; projection: TimescopeYProjectionWire };
};

export type TimescopeSeriesTooltipData = {
  data: { t: Decimal[]; y: Float64Array; text: string[] };
  meta: { time: Decimal; resolution: Decimal; color: string; projection: TimescopeYProjectionWire };
};
