import { Decimal } from '#src/core/decimal';
import { PathCommand, type TimescopePathCommands } from '#src/core/path';
import { TimescopeLayer } from '#src/renderer/layers/TimescopeLayer';
import { clipToTrack } from '#src/renderer/rendering';
import type {
  AngleStyle,
  BoxStyle,
  FillStyle,
  IconStyle,
  PathStyle,
  SizeStyle,
  StrokeStyle,
  TextStyle,
  TimescopeProjectedChartMark,
  TimescopeRenderEngineOptions,
  TimescopeRenderingContext,
  TimescopeSeriesChartData,
} from '#src/renderer/types';
import type { TimescopeDataCache } from '../TimescopeDataCache';
import { createYProjectionRebase } from '../yProjection';

type ParsedPoint = { x1: number; y1: number; x2: number; y2: number };
type RenderedChartMark = Omit<TimescopeProjectedChartMark, 'point'> & { point: ParsedPoint };

export function renderScaleX(dataResolution: Decimal, renderResolution: Decimal) {
  return dataResolution.div(renderResolution).number();
}

export function createLinkProjectionRebase(
  from: TimescopeSeriesChartData['meta']['linkProjection'],
  to: TimescopeSeriesChartData['meta']['projection'],
) {
  if (from.domainId !== to.domainId || from.domainEpoch !== to.domainEpoch) return null;
  if (from.revision === to.revision) return { scale: 1, offset: 0 };
  const rebase = createYProjectionRebase(from, to);
  if (rebase) return rebase;
  if (to.mode === 'zero-only') return { scale: 0, offset: 0 };
  if (to.mode === 'constant') return { scale: 0, offset: to.floating < 0 ? -0.5 : 0.5 };
  return null;
}

export type CompiledLinkPath = {
  commands: TimescopePathCommands;
  scaleX: number;
  scaleY: number;
  offsetY: number;
  zero: number;
  top: number;
  bottom: number;
  path: Path2D;
};

function projectedLinkY(value: number, scale: number, offset: number, zero: number, top: number, bottom: number) {
  if (scale === 0) {
    if (value !== value) return zero;
    if (value === Infinity) return top;
    if (value === -Infinity) return bottom;
    return offset;
  }

  const projected = value * scale + offset;
  if (projected !== projected) return zero;
  if (projected === -Infinity) return top;
  if (projected === Infinity) return bottom;
  return projected;
}

export function createCompiledLinkPath(
  commands: TimescopePathCommands,
  scaleX: number,
  scaleY: number,
  offsetY: number,
  zero: number,
  top: number,
  bottom: number,
  previous?: CompiledLinkPath,
): CompiledLinkPath {
  if (
    !Number.isFinite(scaleX) ||
    !Number.isFinite(scaleY) ||
    !Number.isFinite(offsetY) ||
    !Number.isFinite(zero) ||
    !Number.isFinite(top) ||
    !Number.isFinite(bottom)
  ) {
    throw new RangeError('Link path transform must be finite');
  }
  if (scaleY > 0) throw new RangeError('Link path Y scale must not be positive');
  if (
    previous?.commands === commands &&
    Object.is(previous.scaleX, scaleX) &&
    Object.is(previous.scaleY, scaleY) &&
    Object.is(previous.offsetY, offsetY) &&
    Object.is(previous.zero, zero) &&
    Object.is(previous.top, top) &&
    Object.is(previous.bottom, bottom)
  ) {
    return previous;
  }

  const values = commands.values;
  const end = commands.length;
  if (!Number.isSafeInteger(end) || end < 0 || end > values.length) {
    throw new RangeError('Invalid link path command length');
  }
  const path = new Path2D();
  let index = 0;
  while (index < end) {
    const command = values[index++];
    const size =
      command === PathCommand.moveTo || command === PathCommand.lineTo
        ? 2
        : command === PathCommand.bezierCurveTo
          ? 6
          : command === PathCommand.closePath
            ? 0
            : -1;
    if (size < 0) throw new RangeError(`Unknown link path command: ${command}`);
    if (index + size > end) throw new RangeError('Truncated link path command');
    if (command === PathCommand.moveTo) {
      const x = values[index++] * scaleX;
      const y = projectedLinkY(values[index++], scaleY, offsetY, zero, top, bottom);
      path.moveTo(x, y);
    } else if (command === PathCommand.lineTo) {
      const x = values[index++] * scaleX;
      const y = projectedLinkY(values[index++], scaleY, offsetY, zero, top, bottom);
      path.lineTo(x, y);
    } else if (command === PathCommand.bezierCurveTo) {
      const c1x = values[index++] * scaleX;
      const c1y = projectedLinkY(values[index++], scaleY, offsetY, zero, top, bottom);
      const c2x = values[index++] * scaleX;
      const c2y = projectedLinkY(values[index++], scaleY, offsetY, zero, top, bottom);
      const x = values[index++] * scaleX;
      const y = projectedLinkY(values[index++], scaleY, offsetY, zero, top, bottom);
      path.bezierCurveTo(c1x, c1y, c2x, c2y, x, y);
    } else if (command === PathCommand.closePath) {
      path.closePath();
    }
  }

  if (previous) {
    previous.commands = commands;
    previous.scaleX = scaleX;
    previous.scaleY = scaleY;
    previous.offsetY = offsetY;
    previous.zero = zero;
    previous.top = top;
    previous.bottom = bottom;
    previous.path = path;
    return previous;
  }
  return { commands, scaleX, scaleY, offsetY, zero, top, bottom, path };
}

type OffsetStyle = { offset?: [number, number] };
type DefaultColorStyle = { color: string };
type FlagsStyle = { stroke?: boolean; fill?: boolean };

type MarkOp = {
  draw:
    | 'circle'
    | 'triangle'
    | 'square'
    | 'diamond'
    | 'star'
    | 'plus'
    | 'cross'
    | 'minus'
    | 'line'
    | 'bar'
    | 'section'
    | 'region'
    | 'text'
    | 'icon'
    | 'path';
  strokePath?: Path2D;
  fillPath?: Path2D;
  path?: { x: number; y: number }[];
  style: StrokeStyle &
    FillStyle &
    SizeStyle &
    AngleStyle &
    TextStyle &
    PathStyle &
    IconStyle &
    BoxStyle &
    OffsetStyle &
    DefaultColorStyle &
    FlagsStyle & { fillStyle?: string; strokeStyle?: string; postFillStyle?: string; floating?: number };
};

type LinkOp = {
  draw:
    | 'line'
    | 'curve'
    | 'curve-area'
    | 'area'
    | 'step'
    | 'step-start'
    | 'step-end'
    | 'step-area'
    | 'step-area-start'
    | 'step-area-end';
  strokePath?: Path2D;
  fillPath?: Path2D;
  pathCache: CompiledLinkPath;
  path?: undefined;
  style: StrokeStyle &
    FillStyle &
    DefaultColorStyle &
    FlagsStyle & { fillStyle?: string; strokeStyle?: string; floating?: number; baseline?: number };
};

function createStrokeStyle(style: StrokeStyle & DefaultColorStyle) {
  const strokeStyle = style.lineColor ?? style.color ?? 'black';
  return strokeStyle;
}

export function createFillStyle(style: FillStyle & DefaultColorStyle) {
  const color = style.fillColor ?? style.color ?? 'black';
  const rgba = parseColorToRgba(color);
  if (!rgba) return color;
  const a = Math.max(0, Math.min(1, rgba.a * (style.fillOpacity ?? 0.25)));
  return `rgba(${rgba.r}, ${rgba.g}, ${rgba.b}, ${a})`;
}

const flattenedColorCache = new Map<string, { r: number; g: number; b: number; a: number }>();
let colorContext: OffscreenCanvasRenderingContext2D | null | undefined;

export function createMarkFillStyle(style: FillStyle & DefaultColorStyle, background: string) {
  const color = style.fillColor ?? style.color ?? 'black';
  const colorOpacity = style.fillColor === undefined ? 0.25 : 1;
  const cacheKey = `${color}\0${colorOpacity}\0${background}`;
  let rgba = flattenedColorCache.get(cacheKey);
  if (!rgba) {
    rgba = flattenColor(color, background, colorOpacity) ?? undefined;
    if (rgba) flattenedColorCache.set(cacheKey, rgba);
  }
  if (!rgba) return opacity(color, style.fillOpacity ?? 1);

  const a = Math.max(0, Math.min(1, rgba.a * (style.fillOpacity ?? 1)));
  return `rgba(${rgba.r}, ${rgba.g}, ${rgba.b}, ${a})`;
}

function flattenColor(color: string, background: string, colorOpacity: number) {
  const foreground = parseColorToRgba(color);
  const backdrop = parseColorToRgba(background);
  if (foreground && backdrop) {
    return compositeColors({ ...foreground, a: foreground.a * colorOpacity }, backdrop);
  }

  if (colorContext === undefined) {
    colorContext = typeof OffscreenCanvas === 'undefined' ? null : new OffscreenCanvas(1, 1).getContext('2d');
  }
  if (!colorContext) return null;

  colorContext.clearRect(0, 0, 1, 1);
  colorContext.globalAlpha = 1;
  colorContext.fillStyle = background;
  colorContext.fillRect(0, 0, 1, 1);
  colorContext.globalAlpha = colorOpacity;
  colorContext.fillStyle = color;
  colorContext.fillRect(0, 0, 1, 1);
  colorContext.globalAlpha = 1;
  const [r, g, b, a] = colorContext.getImageData(0, 0, 1, 1).data;
  return { r, g, b, a: a / 255 };
}

function compositeColors(
  foreground: { r: number; g: number; b: number; a: number },
  background: { r: number; g: number; b: number; a: number },
) {
  const a = foreground.a + background.a * (1 - foreground.a);
  if (a === 0) return { r: 0, g: 0, b: 0, a: 0 };
  const backgroundWeight = background.a * (1 - foreground.a);
  return {
    r: Math.round((foreground.r * foreground.a + background.r * backgroundWeight) / a),
    g: Math.round((foreground.g * foreground.a + background.g * backgroundWeight) / a),
    b: Math.round((foreground.b * foreground.a + background.b * backgroundWeight) / a),
    a,
  };
}

function createPathMarks<
  S extends FillStyle & StrokeStyle & DefaultColorStyle & SizeStyle & OffsetStyle & AngleStyle & PathStyle,
>(callback: (path: Path2D, arg: { dx: number; dy: number; l: number; style: S }) => void, directed = true) {
  return function (points: ParsedPoint[], style: S) {
    const path = new Path2D();
    const transform: DOMMatrix2DInit = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

    for (const point of points) {
      const dx = point.x2 - point.x1;
      const dy = point.y2 - point.y1;
      const l = Math.hypot(dx, dy);
      const direction = directed ? Math.atan2(dy, dx) : 0;
      const angle = direction + ((style.angle ?? 0) * Math.PI) / 180;
      const offsetX = style.offset?.[0] ?? 0;
      const offsetY = style.offset?.[1] ?? 0;

      const markPath = new Path2D();
      callback(markPath, { style, dx, dy, l });

      const directionCos = Math.cos(direction);
      const directionSin = Math.sin(direction);
      transform.a = Math.cos(angle);
      transform.b = Math.sin(angle);
      transform.c = -transform.b;
      transform.d = transform.a;
      transform.e = point.x1 + directionCos * offsetX - directionSin * offsetY;
      transform.f = point.y1 + directionSin * offsetX + directionCos * offsetY;

      path.addPath(markPath, transform);
    }

    const strokeStyle = createStrokeStyle(style);
    const fillStyle = createFillStyle(style);

    return { strokePath: path, fillPath: path, strokeStyle, fillStyle };
  };
}

type UnitMarkScale<S> = (style: S, dx: number, dy: number, l: number, scale: { x: number; y: number }) => void;

export function createUnitPathMarks<
  S extends FillStyle & StrokeStyle & DefaultColorStyle & SizeStyle & OffsetStyle & AngleStyle & PathStyle,
>(createTemplate: (path: Path2D) => void, scaleFor: UnitMarkScale<S>, directed = true) {
  let template: Path2D | undefined;
  return function (points: ParsedPoint[], style: S) {
    template ??= (() => {
      const path = new Path2D();
      createTemplate(path);
      return path;
    })();

    const path = new Path2D();
    const transform: DOMMatrix2DInit = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
    const scale = { x: 1, y: 1 };
    for (const point of points) {
      const dx = point.x2 - point.x1;
      const dy = point.y2 - point.y1;
      const l = Math.hypot(dx, dy);
      const direction = directed ? Math.atan2(dy, dx) : 0;
      const angle = direction + ((style.angle ?? 0) * Math.PI) / 180;
      const angleCos = Math.cos(angle);
      const angleSin = Math.sin(angle);
      const directionCos = Math.cos(direction);
      const directionSin = Math.sin(direction);
      const offsetX = style.offset?.[0] ?? 0;
      const offsetY = style.offset?.[1] ?? 0;
      scaleFor(style, dx, dy, l, scale);

      transform.a = angleCos * scale.x;
      transform.b = angleSin * scale.x;
      transform.c = -angleSin * scale.y;
      transform.d = angleCos * scale.y;
      transform.e = point.x1 + directionCos * offsetX - directionSin * offsetY;
      transform.f = point.y1 + directionSin * offsetX + directionCos * offsetY;
      path.addPath(template, transform);
    }

    return {
      strokePath: path,
      fillPath: path,
      strokeStyle: createStrokeStyle(style),
      fillStyle: createFillStyle(style),
    };
  };
}

function createTextPoint(points: ParsedPoint[]) {
  return { path: points.map(({ x1, y1 }) => ({ x: x1, y: y1 })) };
}

function opacity(c: string, i: number, base: string = 'transparent') {
  return `color-mix(in srgb, ${c} ${i * 100}%, ${base})`;
}

function parseColorToRgba(color: string) {
  const trimmed = color.trim().toLowerCase();
  if (trimmed === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };

  if (trimmed.startsWith('#')) {
    const hex = trimmed.slice(1);
    if (hex.length === 3 || hex.length === 4) {
      const r = parseInt(hex[0] + hex[0], 16);
      const g = parseInt(hex[1] + hex[1], 16);
      const b = parseInt(hex[2] + hex[2], 16);
      const a = hex.length === 4 ? parseInt(hex[3] + hex[3], 16) / 255 : 1;
      return { r, g, b, a };
    }
    if (hex.length === 6 || hex.length === 8) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
      return { r, g, b, a };
    }
  }

  const rgbMatch = trimmed.match(/^rgba?\((.+)\)$/);
  if (!rgbMatch) return null;
  const parts = rgbMatch[1].split(',').map((s) => s.trim());
  if (parts.length < 3) return null;
  const parseChannel = (value: string) => {
    if (value.endsWith('%')) {
      const v = parseFloat(value.slice(0, -1));
      return Math.max(0, Math.min(255, (v / 100) * 255));
    }
    return Math.max(0, Math.min(255, parseFloat(value)));
  };
  const r = parseChannel(parts[0]);
  const g = parseChannel(parts[1]);
  const b = parseChannel(parts[2]);
  const a = parts.length >= 4 ? Math.max(0, Math.min(1, parseFloat(parts[3]))) : 1;
  return { r, g, b, a };
}

function parsePaddingLike(padding: number | [number, number?, number?, number?] | undefined) {
  if (typeof padding === 'number' || padding == null) padding = [padding ?? 0];
  return {
    t: padding[0],
    r: padding[1] ?? padding[0],
    b: padding[2] ?? padding[0],
    l: padding[3] ?? padding[1] ?? padding[0],
  };
}

function markGroupKey(mark: RenderedChartMark) {
  const styleEntries = Object.entries(mark.style ?? {}).sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify([mark.draw, styleEntries]);
}

export function groupMarkPointsByLayer(marksByPoint: RenderedChartMark[][]) {
  const layers: Map<string, { mark: RenderedChartMark; points: ParsedPoint[] }>[] = [];
  for (let pointIndex = 0; pointIndex < marksByPoint.length; pointIndex++) {
    const marks = marksByPoint[pointIndex];
    for (let layerIndex = 0; layerIndex < marks.length; layerIndex++) {
      const mark = marks[layerIndex];
      const layer = (layers[layerIndex] ??= new Map());
      const key = markGroupKey(mark);
      const group = layer.get(key);
      if (group) group.points.push(mark.point);
      else layer.set(key, { mark, points: [mark.point] });
    }
  }
  return layers;
}

const pathCreators: Record<
  `mark:${MarkOp['draw']}`,
  [
    (
      points: ParsedPoint[],
      style: StrokeStyle &
        FillStyle &
        SizeStyle &
        AngleStyle &
        TextStyle &
        IconStyle &
        PathStyle &
        BoxStyle &
        OffsetStyle &
        DefaultColorStyle,
    ) => {
      strokePath?: Path2D;
      fillPath?: Path2D;
      path?: { x: number; y: number }[];
      strokeStyle?: string;
      fillStyle?: string;
      postFillStyle?: string;
    },
    flags: FlagsStyle,
  ]
> = {
  'mark:circle': [
    createUnitPathMarks(
      (path) => {
        path.moveTo(0.5, 0);
        path.arc(0, 0, 0.5, 0, Math.PI * 2);
      },
      (style, _dx, _dy, _l, scale) => {
        scale.x = scale.y = style.size ?? 5;
      },
    ),
    { stroke: true, fill: true },
  ],

  'mark:minus': [
    createUnitPathMarks(
      (path) => {
        path.moveTo(-0.5, 0);
        path.lineTo(0.5, 0);
      },
      (style, _dx, _dy, _l, scale) => {
        scale.x = scale.y = style.size ?? 5;
      },
    ),
    { stroke: true, fill: false },
  ],

  'mark:triangle': [
    createUnitPathMarks(
      (path) => {
        const r = 0.5;
        path.moveTo(0, -r);
        path.lineTo((+r * Math.sqrt(3)) / 2, r / 2);
        path.lineTo((-r * Math.sqrt(3)) / 2, r / 2);
        path.closePath();
      },
      (style, _dx, _dy, _l, scale) => {
        scale.x = scale.y = style.size ?? 5;
      },
    ),
    { stroke: true, fill: true },
  ],

  'mark:square': [
    createUnitPathMarks(
      (path) => {
        const size = Math.SQRT2 / 2;
        path.rect(-size / 2, -size / 2, size, size);
      },
      (style, _dx, _dy, _l, scale) => {
        scale.x = scale.y = style.size ?? 5;
      },
    ),
    { stroke: true, fill: true },
  ],

  'mark:diamond': [
    createUnitPathMarks(
      (path) => {
        path.moveTo(0, -0.5);
        path.lineTo(0.5, 0);
        path.lineTo(0, 0.5);
        path.lineTo(-0.5, 0);
        path.closePath();
      },
      (style, _dx, _dy, _l, scale) => {
        scale.x = scale.y = style.size ?? 5;
      },
    ),
    { stroke: true, fill: true },
  ],

  'mark:star': [
    createUnitPathMarks(
      (path) => {
        const rOuter = 0.5;
        const rInner = rOuter * 0.4;

        for (let i = 0; i < 10; i++) {
          const r = i % 2 === 0 ? rOuter : rInner;
          const angle = (Math.PI / 5) * i - Math.PI / 2;
          const x = r * Math.cos(angle);
          const y = r * Math.sin(angle);
          if (i === 0) {
            path.moveTo(x, y);
          } else {
            path.lineTo(x, y);
          }
        }
        path.closePath();
      },
      (style, _dx, _dy, _l, scale) => {
        scale.x = scale.y = style.size ?? 5;
      },
    ),
    { stroke: true, fill: true },
  ],

  'mark:plus': [
    createUnitPathMarks(
      (path) => {
        path.moveTo(-0.5, 0);
        path.lineTo(0.5, 0);
        path.moveTo(0, -0.5);
        path.lineTo(0, 0.5);
      },
      (style, _dx, _dy, _l, scale) => {
        scale.x = scale.y = style.size ?? 5;
      },
    ),
    { stroke: true },
  ],

  'mark:cross': [
    createUnitPathMarks(
      (path) => {
        const size = Math.SQRT2 / 2;
        path.moveTo(-size / 2, -size / 2);
        path.lineTo(size / 2, size / 2);
        path.moveTo(-size / 2, size / 2);
        path.lineTo(size / 2, -size / 2);
      },
      (style, _dx, _dy, _l, scale) => {
        scale.x = scale.y = style.size ?? 5;
      },
    ),
    { stroke: true },
  ],

  'mark:path': [
    createPathMarks((path, { style: { path: stylePath, size, scale, origin } }) => {
      const mat = new DOMMatrix();
      mat.scaleSelf(scale ?? 1);
      mat.scaleSelf(size ?? 5);
      mat.translateSelf(-(origin?.[0] ?? 0), -(origin?.[1] ?? 0));

      path.addPath(new Path2D(stylePath), mat);
    }),
    { stroke: true, fill: true },
  ],

  // ----------

  'mark:line': [
    createUnitPathMarks(
      (path) => {
        path.moveTo(0, 0);
        path.lineTo(1, 0);
      },
      (_style, _dx, _dy, l, scale) => {
        scale.x = l;
        scale.y = 1;
      },
    ),
    { stroke: true },
  ],

  'mark:bar': [
    createPathMarks((path, { l, style: { size, radius, extrude } }) => {
      size = size ?? 5;

      const pad = parsePaddingLike(extrude);
      const x = -pad.l;
      const y = -(pad.t + size / 2);
      const w = pad.l + l + pad.r;
      const h = pad.t + size + pad.b;

      if (radius && radius > 0) {
        path.roundRect(x, y, w, h, radius);
      } else {
        path.rect(x, y, w, h);
      }
    }),
    { stroke: true, fill: true },
  ],

  'mark:section': [
    createUnitPathMarks(
      (path) => {
        path.moveTo(0, -0.5);
        path.lineTo(0, 0.5);

        path.moveTo(0, 0);
        path.lineTo(1, 0);

        path.moveTo(1, -0.5);
        path.lineTo(1, 0.5);
      },
      (style, _dx, _dy, l, scale) => {
        scale.x = l;
        scale.y = style.size ?? 5;
      },
    ),
    { stroke: true },
  ],

  // ----------
  'mark:region': [
    createPathMarks((path, { dx, dy, style: { radius, extrude } }) => {
      const pad = parsePaddingLike(extrude);
      const x = -pad.l;
      const y = -pad.t;
      const w = pad.l + dx + pad.r;
      const h = pad.t + dy + pad.b;

      if (radius && radius > 0) {
        path.roundRect(x, y, w, h, radius);
      } else {
        path.rect(x, y, w, h);
      }
    }, false),
    { stroke: true, fill: true },
  ],
  // ----------

  'mark:icon': [createTextPoint, { fill: true }],
  'mark:text': [createTextPoint, { fill: true }],
};

export class TimescopeSeriesChartLayer extends TimescopeLayer {
  #background = '#fff';

  updateOptions(options: TimescopeRenderEngineOptions): void {
    super.updateOptions(options);
    if ('background' in options && options.background !== this.#background) {
      this.#background = options.background ?? '#fff';
      this.#plotData = {};
    }
  }

  #plotData: Record<
    string,
    {
      trackId: string;
      trackRevision: number;
      revision: number;

      xOrigin: Decimal;
      renderResolution: Decimal;

      linkOps: LinkOp[];
      markOps: MarkOp[];
    }
  > = {};

  render(timescope: TimescopeRenderingContext): void {
    super.render(timescope);

    this.#prepareRenderOps(timescope);
    this.#renderCharts(timescope);
  }

  #prepareRenderOps(timescope: TimescopeRenderingContext) {
    if (!timescope.options.series) return;

    const activeSeries = new Set(Object.keys(timescope.options.series));
    for (const key of Object.keys(this.#plotData)) {
      if (!activeSeries.has(key)) delete this.#plotData[key];
    }

    const renderResolution = timescope.timeAxis.current.resolution;

    for (const track of timescope.tracks) {
      const dataCacheFor = (k: string) =>
        timescope.dataCaches[`series:${k}:chart`] as TimescopeDataCache<TimescopeSeriesChartData>;

      for (const k of track.seriesKeys) {
        const cache = dataCacheFor(k);
        if (!cache || !cache.data) continue;

        const {
          data: { data: records, meta },
          revision,
        } = cache;

        const previous = this.#plotData[k];
        if (
          previous &&
          previous.revision === revision &&
          previous.trackId === track.id &&
          previous.trackRevision === track.revision &&
          previous.renderResolution.eq(renderResolution) &&
          !track.animating
        ) {
          continue;
        }

        const plot: NonNullable<typeof previous> = {
          xOrigin: meta.time,
          renderResolution,
          trackId: track.id,
          trackRevision: track.revision,
          revision,
          linkOps: [],
          markOps: [],
        };
        this.#plotData[k] = plot;

        const color = meta.color;
        const floating = track.fadeForDomain(meta.projection.domainId);

        const scaleX = renderScaleX(meta.resolution, renderResolution);
        const y = (value: TimescopeProjectedChartMark['point']['y1']) => {
          if (typeof value === 'number') return track.yForDomain(meta.projection.domainId, value);
          if (value === 'zero') return track.y0;
          if (value === 'top') return track.top;
          return track.bottom;
        };
        const renderedMarks = records.marks.map((marks) =>
          marks.map((mark): RenderedChartMark => ({
            ...mark,
            point: {
              x1: mark.point.x1 * scaleX,
              y1: y(mark.point.y1),
              x2: mark.point.x2 * scaleX,
              y2: y(mark.point.y2),
            },
          })),
        );

        for (const layer of groupMarkPointsByLayer(renderedMarks)) {
          for (const { mark, points: markPoints } of layer.values()) {
            const style = { color, ...(mark.style ?? {}) };
            const [creator, flags] = pathCreators[`mark:${mark.draw}`] ?? [];
            const { strokePath, fillPath, path, strokeStyle, postFillStyle } = creator?.(markPoints, style) ?? {};
            plot.markOps.push({
              draw: mark.draw,
              strokePath,
              fillPath,
              path,
              style: {
                ...style,
                strokeStyle,
                fillStyle: createMarkFillStyle(style, this.#background),
                postFillStyle,
                ...flags,
                floating,
              },
            });
          }
        }

        const affine = track.affineForDomain(meta.projection.domainId);
        const rebase = createLinkProjectionRebase(meta.linkProjection, meta.projection);
        const scaleY = affine && rebase ? affine.scale * rebase.scale : 0;
        const offsetY = affine && rebase ? affine.offset + affine.scale * rebase.offset : 0;
        for (let linkIndex = 0; affine && rebase && linkIndex < records.links.length; linkIndex++) {
          const link = records.links[linkIndex];
          const style = { color, ...(link.style ?? {}) };
          const previousLink = previous?.linkOps[linkIndex];
          const compiled = createCompiledLinkPath(
            link.commands,
            scaleX,
            scaleY,
            offsetY,
            track.y0,
            track.top,
            track.bottom,
            previousLink?.pathCache,
          );
          const fill = link.draw.includes('area');
          plot.linkOps.push({
            draw: link.draw,
            pathCache: compiled,
            strokePath: fill ? undefined : compiled.path,
            fillPath: fill ? compiled.path : undefined,
            style: {
              ...style,
              strokeStyle: createStrokeStyle(style),
              fillStyle: createFillStyle(style),
              stroke: !fill,
              fill,
              floating,
              baseline: track.y0,
            },
          });
        }
      }
    }
  }

  #renderCharts(timescope: TimescopeRenderingContext) {
    if (!timescope.options.series) return;

    const reordered: Record<string, Record<string, ((LinkOp | MarkOp) & { ox: number; oy: number })[]>> = {};
    for (const k in this.#plotData) {
      const plot = this.#plotData[k];

      if (!reordered[plot.trackId]) reordered[plot.trackId] = {};
      const ox = timescope.timeAxis.p(plot.xOrigin);

      for (const link of plot.linkOps) {
        const key = link.draw.includes('area') ? `link:fill` : `link:stroke`;

        if (!reordered[plot.trackId][key]) reordered[plot.trackId][key] = [];
        reordered[plot.trackId][key].push({ ...link, ox, oy: 0 });
      }
      for (const mark of plot.markOps) {
        if (!reordered[plot.trackId].marks) reordered[plot.trackId].marks = [];
        reordered[plot.trackId].marks.push({ ...mark, ox, oy: 0 });
      }
    }

    for (const track of timescope.tracks) {
      clipToTrack(timescope, track, () => {
        const ctx = timescope.ctx;
        const fadeoutStyles = new Map<string, string | CanvasGradient>();
        const resolveFadeoutStyle = (color: string, floating?: number, baseline?: number) => {
          if (!floating) return color;
          const key = `${color}\0${floating}\0${baseline}`;
          let style = fadeoutStyles.get(key);
          if (!style) {
            style = createFadeoutStyle(timescope, color, floating, baseline);
            fadeoutStyles.set(key, style);
          }
          return style;
        };

        for (const kind of ['link:fill', 'link:stroke', 'marks'] as const) {
          for (const op of reordered?.[track.id]?.[kind] ?? []) {
            ctx.save();
            ctx.translate(op.ox, op.oy);
            if (op.strokePath || op.fillPath) {
              renderPath(timescope, op.strokePath, op.fillPath, op.style, resolveFadeoutStyle);
            } else if (op.path) {
              for (const point of op.path) {
                if (op.draw === 'icon') renderIconAt(timescope, point.x, point.y, op.style);
                if (op.draw === 'text') renderTextAt(timescope, point.x, point.y, op.style);
              }
            }
            ctx.restore();
          }
        }
      });
    }
  }
}

function createFadeoutStyle(
  timescope: TimescopeRenderingContext,
  color: string,
  floating?: number,
  baseline = timescope.renderingTrack!.y0,
) {
  const y0 = baseline;
  if (!floating) return color;

  const y1 = y0 - floating;
  if (!isFinite(y1)) return color;

  const style = timescope.ctx.createLinearGradient(0, y1, 0, y0);

  style.addColorStop(0, color);
  style.addColorStop(0.2, color);
  style.addColorStop(0.8, `color-mix(in srgb, ${color} 1%, transparent)`);
  style.addColorStop(1, `transparent`);

  return style;
}

function renderPath(
  timescope: TimescopeRenderingContext,
  strokePath: Path2D | undefined,
  fillPath: Path2D | undefined,
  style: MarkOp['style'] & LinkOp['style'],
  resolveFadeoutStyle = (color: string, floating?: number, baseline?: number) =>
    createFadeoutStyle(timescope, color, floating, baseline ?? style.baseline),
  floating = style.floating,
) {
  const ctx = timescope.ctx;

  if (style.fill && !style.fillPost && style.fillStyle && fillPath) {
    ctx.fillStyle = resolveFadeoutStyle(style.fillStyle, floating, style.baseline);
    ctx.fill(fillPath);
  }

  if (style.stroke && style.strokeStyle && (style.lineWidth ?? 1) > 0 && strokePath) {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = resolveFadeoutStyle(style.strokeStyle, floating, style.baseline);
    ctx.lineWidth = style.lineWidth ?? 1;
    if (style.lineDashArray) {
      ctx.setLineDash(style.lineDashArray);
      ctx.lineDashOffset = style.lineDashOffset ?? 0;
    }
    ctx.stroke(strokePath);
  }

  if (style.fill && style.fillPost && style.fillStyle && fillPath) {
    ctx.fillStyle = resolveFadeoutStyle(style.fillStyle, floating, style.baseline);
    ctx.fill(fillPath);
  }
}

function renderTextAt(
  { ctx }: TimescopeRenderingContext,
  x: number,
  y: number,
  style: TextStyle & SizeStyle & { color: string } & OffsetStyle & AngleStyle,
) {
  if (!style.text) return;

  ctx.font = `${style.fontWeight ?? 'normal'} ${style.size ?? 14}px ${style.fontFamily ?? 'sans-serif'}`;
  ctx.textAlign = style.textAlign ?? 'center';
  ctx.textBaseline = style.textBaseline ?? 'middle';

  ctx.save();
  ctx.translate(x + (style.offset?.[0] ?? 0), y + (style.offset?.[1] ?? 0));
  if (style.angle) ctx.rotate((style.angle / 180) * Math.PI);

  if (style.textOutline || style.textOutlineColor !== undefined || style.textOutlineWidth !== undefined) {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = style.textOutlineColor ?? 'white';
    ctx.lineWidth = style.textOutlineWidth ?? 2;
    ctx.strokeText(style.text ?? '', 0, 0);
  }

  ctx.fillStyle = opacity(style.textColor ?? style.color ?? 'black', style.textOpacity ?? 1);
  ctx.fillText(style.text ?? '', 0, 0);
  ctx.restore();
}

function renderIconAt(
  { ctx }: TimescopeRenderingContext,
  x: number,
  y: number,
  style: IconStyle & SizeStyle & { color: string } & OffsetStyle & AngleStyle,
) {
  if (!style.icon) return;

  ctx.font = `${style.iconFontWeight ?? 'normal'} ${style.size ?? 16}px ${style.iconFontFamily ?? 'icons'}`;
  ctx.textAlign = style.iconAlign ?? 'center';
  ctx.textBaseline = style.iconBaseline ?? 'middle';

  ctx.save();
  ctx.translate(x + (style.offset?.[0] ?? 0), y + (style.offset?.[1] ?? 0));
  if (style.angle) ctx.rotate((style.angle / 180) * Math.PI);

  if (style.iconOutline || style.iconOutlineColor !== undefined || style.iconOutlineWidth !== undefined) {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = style.iconOutlineColor ?? 'white';
    ctx.lineWidth = style.iconOutlineWidth ?? 2;
    ctx.strokeText(style.icon ?? '', 0, 0);
  }

  ctx.fillStyle = opacity(style.iconColor ?? style.color ?? 'black', style.iconOpacity ?? 1);
  ctx.fillText(style.icon ?? '', 0, 0);
  ctx.restore();
}
