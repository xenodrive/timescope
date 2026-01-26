import type { TimescopeOptionsForWorker, TimescopeSeriesChartProviderData } from '#src/bridge/protocol';
import { TimescopeAnimatedValue, TimescopeAnimation } from '#src/core/animation';
import { Decimal } from '#src/core/decimal';
import type {
  AngleStyle,
  BoxStyle,
  FillStyle,
  IconStyle,
  PathStyle,
  SizeStyle,
  StrokeStyle,
  TextStyle,
  Using,
} from '#src/core/types';
import { parseUsing } from '#src/core/using';
import { TimescopeRenderer } from '#src/worker/renderer/TimescopeRenderer';
import type { TimescopeRenderingContext } from '#src/worker/types';
import { clipToTrack } from '#src/worker/utils';
import type { TimescopeDataCache } from '../TimescopeDataCache';

type Point = { x: Record<string, number>; y: Record<string, number> };
type StepPoint = { x: number; y: number };

type OffsetStyle = { offset?: [number, number] };
type DefaultColorStyle = { color: string };
type FlagsStyle = { stroke?: boolean; fill?: boolean };
type FillMesh = {
  data: Float32Array;
  count: number;
  stride: number;
  mode: 0 | 1;
  buffer?: WebGLBuffer | null;
  version?: number;
  dirty?: boolean;
};

type MarkOp = {
  type: 'mark';
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
  time: Decimal;

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
  type: 'link';
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
  time: Decimal;

  strokePath?: Path2D;
  fillPath?: Path2D;
  style: StrokeStyle &
    FillStyle &
    DefaultColorStyle &
    FlagsStyle & { fillStyle?: string; strokeStyle?: string; floating?: number };
  fillMesh?: FillMesh;
};

const MIN_ISOLATED_POINT_RADIUS = 0.75;
const MIN_ISOLATED_STRIP_WIDTH = 1;
function createStrokeStyle(style: StrokeStyle & DefaultColorStyle) {
  const strokeStyle = style.lineColor ?? style.color ?? 'black';
  return strokeStyle;
}

function createFillStyle(style: FillStyle & DefaultColorStyle) {
  const color = style.fillColor ?? style.color ?? 'black';
  const rgba = parseColorToRgba(color);
  if (!rgba) return color;
  const a = Math.max(0, Math.min(1, rgba.a * (style.fillOpacity ?? 0.25)));
  return `rgba(${rgba.r}, ${rgba.g}, ${rgba.b}, ${a})`;
}

function drawIsolatedPoint(path: Path2D, point: { x: number; y: number }, style: StrokeStyle) {
  const strokeWidth = typeof style.lineWidth === 'number' && isFinite(style.lineWidth) ? style.lineWidth : 1;
  const radius = Math.max(MIN_ISOLATED_POINT_RADIUS, strokeWidth / 2);
  const dot = new Path2D();
  dot.arc(point.x, point.y, radius, 0, Math.PI * 2);
  path.addPath(dot);
}

function drawIsolatedStrip(path: Path2D, top: StepPoint, bottom: StepPoint, style: StrokeStyle) {
  if (isNaN(top.y) || isNaN(bottom.y)) return;
  const strokeWidth = typeof style.lineWidth === 'number' && isFinite(style.lineWidth) ? style.lineWidth : 1;
  const width = Math.max(MIN_ISOLATED_STRIP_WIDTH, strokeWidth);
  const half = width / 2;

  path.moveTo(top.x - half, top.y);
  path.lineTo(top.x + half, top.y);
  path.lineTo(bottom.x + half, bottom.y);
  path.lineTo(bottom.x - half, bottom.y);
  path.closePath();
}

function createPathLines(
  points: Point[],
  using: Using | undefined,
  style: FillStyle & StrokeStyle & DefaultColorStyle,
) {
  const path = new Path2D();

  const parser = makeUsingParser(using ?? 'value@time');
  const parsed = points.map(parser);
  let segmentStart: { x: number; y: number } | null = null;
  let segmentLength = 0;

  const flush = () => {
    if (segmentLength === 1 && segmentStart) {
      drawIsolatedPoint(path, segmentStart, style);
    }
    segmentStart = null;
    segmentLength = 0;
  };

  for (const p of parsed) {
    const { x1: x, y1: y } = p;

    if (isNaN(y)) {
      flush();
      continue;
    }

    if (segmentLength === 0) {
      path.moveTo(x, y);
      segmentStart = { x, y };
    } else {
      path.lineTo(x, y);
    }

    segmentLength++;
  }

  flush();

  const strokeStyle = createStrokeStyle(style);
  const fillStyle = createFillStyle(style);

  return { strokePath: path, strokeStyle, fillStyle };
}

function appendMonotoneCurve(path: Path2D, segment: { x: number; y: number }[]) {
  if (!segment.length) return;

  if (segment.length === 1) {
    path.moveTo(segment[0].x, segment[0].y);
    return;
  }

  if (segment.length === 2) {
    path.moveTo(segment[0].x, segment[0].y);
    path.lineTo(segment[1].x, segment[1].y);
    return;
  }

  const n = segment.length;
  const h: number[] = new Array(n - 1);
  const delta: number[] = new Array(n - 1);
  for (let i = 0; i < n - 1; i++) {
    h[i] = segment[i + 1].x - segment[i].x;
    delta[i] = h[i] !== 0 ? (segment[i + 1].y - segment[i].y) / h[i] : 0;
  }

  const m: number[] = new Array(n);
  m[0] = delta[0];
  for (let i = 1; i < n - 1; i++) m[i] = (delta[i - 1] + delta[i]) / 2;
  m[n - 1] = delta[n - 2];

  for (let i = 0; i < n - 1; i++) {
    if (delta[i] === 0 || !isFinite(delta[i])) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }

    if (m[i] === 0 && m[i + 1] === 0) continue;

    if (m[i] * delta[i] < 0 || m[i + 1] * delta[i] < 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }

    const a = m[i] / delta[i];
    const b = m[i + 1] / delta[i];
    const sumSq = a * a + b * b;

    if (sumSq > 9) {
      const t = 3 / Math.sqrt(sumSq);
      m[i] = t * a * delta[i];
      m[i + 1] = t * b * delta[i];
    }
  }

  path.moveTo(segment[0].x, segment[0].y);
  for (let i = 0; i < n - 1; i++) {
    const hi = h[i];
    const p0 = segment[i];
    const p1 = segment[i + 1];

    const cp1x = p0.x + hi / 3;
    const cp1y = p0.y + (m[i] * hi) / 3;
    const cp2x = p1.x - hi / 3;
    const cp2y = p1.y - (m[i + 1] * hi) / 3;

    path.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p1.x, p1.y);
  }
}

function createPathCurve(
  pointsSrc: Point[],
  using: Using | undefined,
  style: FillStyle & StrokeStyle & DefaultColorStyle,
) {
  const path = new Path2D();
  const parser = makeUsingParser(using ?? 'value@time');
  const points = pointsSrc.map(parser);
  let segment: { x: number; y: number }[] = [];

  const flush = () => {
    if (!segment.length) return;

    if (segment.length === 1) {
      drawIsolatedPoint(path, segment[0], style);
      segment = [];
      return;
    }

    appendMonotoneCurve(path, segment);

    segment = [];
  };

  for (const p of points) {
    const { x1: x, y1: y } = p;

    if (isNaN(y)) {
      flush();
      continue;
    }

    segment.push({ x, y });
  }

  flush();

  const strokeStyle = createStrokeStyle(style);
  const fillStyle = createFillStyle(style);

  return { strokePath: path, strokeStyle, fillStyle };
}

function createPathCurveArea(
  pointsSrc: Point[],
  using: Using | undefined,
  style: FillStyle & StrokeStyle & DefaultColorStyle,
) {
  const path = new Path2D();
  const parser = makeUsingParser(using ?? ['value@time', '_zero@time']);
  const points = pointsSrc.map(parser);
  const fillMesh = createCurveAreaMesh(points);

  let idx = 0;
  while (idx < points.length) {
    while (idx < points.length && (isNaN(points[idx].y1) || isNaN(points[idx].y2))) idx++;
    if (idx >= points.length) break;

    const segment: ParsedPoint[] = [];
    while (idx < points.length && !isNaN(points[idx].y1) && !isNaN(points[idx].y2)) {
      segment.push(points[idx]);
      idx++;
    }

    if (segment.length === 1) {
      drawIsolatedStrip(path, { x: segment[0].x1, y: segment[0].y1 }, { x: segment[0].x2, y: segment[0].y2 }, style);
      continue;
    }

    appendMonotoneCurve(
      path,
      segment.map((p) => ({
        x: p.x1,
        y: p.y1,
      })),
    );

    const last = segment[segment.length - 1];
    path.lineTo(last.x2, last.y2);
    for (let i = segment.length - 2; i >= 0; i--) {
      path.lineTo(segment[i].x2, segment[i].y2);
    }
    path.closePath();
  }

  const strokeStyle = createStrokeStyle(style);
  const fillStyle = createFillStyle(style);

  return { fillPath: path, fillMesh, strokeStyle, fillStyle };
}

function createPathContours(
  pointsSrc: Point[],
  using: Using | undefined,
  style: FillStyle & StrokeStyle & DefaultColorStyle,
) {
  const path = new Path2D();
  const parser = makeUsingParser(using ?? ['value@time', '_zero@time']);
  const points = pointsSrc.map(parser);
  const fillMesh = createLinearAreaMesh(points);

  let idx = 0;
  while (idx < points.length) {
    while (idx < points.length && isNaN(points[idx].y1)) idx++;
    if (idx >= points.length) break;

    const sidx = idx;
    path.moveTo(points[sidx].x1, points[sidx].y1);
    while (idx < points.length && !isNaN(points[idx].y1)) {
      path.lineTo(points[idx].x1, points[idx].y1);
      idx++;
    }
    const eidx = idx--;
    let bottomDrawn = false;
    while (idx >= sidx && !isNaN(points[idx].y2)) {
      path.lineTo(points[idx].x2, points[idx].y2);
      idx--;
      bottomDrawn = true;
    }
    if (!bottomDrawn && !isNaN(points[sidx].y2)) {
      path.lineTo(points[sidx].x2, points[sidx].y2);
      bottomDrawn = true;
    }
    path.lineTo(points[sidx].x1, points[sidx].y1);
    if (eidx - sidx === 1 && bottomDrawn) {
      drawIsolatedStrip(
        path,
        { x: points[sidx].x1, y: points[sidx].y1 },
        { x: points[sidx].x2, y: points[sidx].y2 },
        style,
      );
    }
    idx = eidx;
  }

  const strokeStyle = createStrokeStyle(style);
  const fillStyle = createFillStyle(style);

  return { fillPath: path, fillMesh, strokeStyle, fillStyle };
}

function createPathMarks<
  S extends FillStyle & StrokeStyle & DefaultColorStyle & SizeStyle & OffsetStyle & AngleStyle & PathStyle,
>(
  callback: (path: Path2D, arg: { dx: number; dy: number; l: number; style: S }) => void,
  defaultUsing: Using = 'value@time',
  directed = true,
) {
  return function (pointsSrc: Point[], using: Using | undefined, style: S) {
    const path = new Path2D();
    const parser = makeUsingParser(using ?? defaultUsing);
    const points = pointsSrc.map(parser);

    for (const point of points) {
      const dx = point.x2 - point.x1;
      const dy = point.y2 - point.y1;
      const l = Math.hypot(dx, dy);
      const angle = directed ? (Math.atan2(dy, dx) * 180) / Math.PI : 0;

      const markPath = new Path2D();
      callback(markPath, { style, dx, dy, l });

      const mat = new DOMMatrix()
        .translate(point.x1, point.y1)
        .rotate(angle)
        .translate(style.offset?.[0] ?? 0, style.offset?.[1] ?? 0)
        .rotate(style.angle ?? 0);

      path.addPath(markPath, mat);
    }

    const strokeStyle = createStrokeStyle(style);
    const fillStyle = createFillStyle(style);

    return { strokePath: path, fillPath: path, strokeStyle, fillStyle };
  };
}

function createTextPoint(pointsSrc: Point[], using: Using | undefined) {
  const parser = makeUsingParser(using ?? 'value@time');

  return { path: pointsSrc.map(parser).map(({ x1, y1 }) => ({ x: x1, y: y1 })) };
}

type ParsedPoint = ReturnType<ReturnType<typeof makeUsingParser>>;

type StepPathMode = {
  defaultUsing: Using;
  predicate: (point: ParsedPoint) => boolean;
  hasBottom: boolean;
};

const stepPathModes: Record<'line' | 'area', StepPathMode> = {
  line: {
    defaultUsing: 'value@time',
    predicate: (point) => !isNaN(point.y1),
    hasBottom: false,
  },
  area: {
    defaultUsing: ['value@time', '_zero@time'],
    predicate: (point) => !isNaN(point.y1) && !isNaN(point.y2),
    hasBottom: true,
  },
};

function stepPoints(prev: StepPoint, curr: StepPoint, pos: 'start' | 'mid' | 'end'): StepPoint[] {
  if (pos === 'start') {
    return [
      { x: curr.x, y: prev.y },
      { x: curr.x, y: curr.y },
    ];
  }

  if (pos === 'end') {
    return [
      { x: prev.x, y: curr.y },
      { x: curr.x, y: curr.y },
    ];
  }

  const mid = (prev.x + curr.x) / 2;
  return [
    { x: mid, y: prev.y },
    { x: mid, y: curr.y },
    { x: curr.x, y: curr.y },
  ];
}

function buildStepPolyline(
  points: ParsedPoint[],
  accessor: (p: ParsedPoint) => StepPoint,
  pos: 'start' | 'mid' | 'end',
) {
  const polyline: StepPoint[] = [];
  let prev: StepPoint | null = null;

  for (const point of points) {
    const curr = accessor(point);
    if (isNaN(curr.y)) {
      prev = null;
      continue;
    }

    if (!prev) {
      polyline.push(curr);
    } else {
      polyline.push(...stepPoints(prev, curr, pos));
    }

    prev = curr;
  }

  return polyline;
}

function createPathSteps(pos: 'start' | 'mid' | 'end', type: 'line' | 'area') {
  const mode = stepPathModes[type];

  return function (pointsSrc: Point[], using: Using | undefined, style: FillStyle & StrokeStyle & DefaultColorStyle) {
    const parser = makeUsingParser(using ?? mode.defaultUsing);
    const points = pointsSrc.map(parser);
    const isolatedPoints: StepPoint[] = [];
    const path = buildStepPath(points, pos, mode, style, isolatedPoints);
    const fillMesh = type === 'area' ? createStepAreaMesh(points, pos, mode) : null;

    if (type === 'line') {
      for (const point of isolatedPoints) {
        drawIsolatedPoint(path, point, style);
      }
    }

    const strokeStyle = createStrokeStyle(style);
    const fillStyle = createFillStyle(style);

    return type === 'area'
      ? { fillPath: path, fillMesh: fillMesh ?? undefined, strokeStyle, fillStyle }
      : { strokePath: path, strokeStyle, fillStyle };
  };
}

function buildStepPath(
  points: ParsedPoint[],
  pos: 'start' | 'mid' | 'end',
  mode: StepPathMode,
  style: StrokeStyle,
  isolatedPoints: StepPoint[] = [],
) {
  const path = new Path2D();
  let idx = 0;

  while (idx < points.length) {
    while (idx < points.length && !mode.predicate(points[idx])) idx++;
    if (idx >= points.length) break;

    const segmentStart = idx;
    const segment: ParsedPoint[] = [];
    while (idx < points.length && mode.predicate(points[idx])) {
      segment.push(points[idx]);
      idx++;
    }
    const segmentEnd = idx;

    if (!segment.length) continue;

    const extendedSegment = createBoundaryExtendedSegment(segment, pos, {
      left: segmentStart > 0 ? points[segmentStart - 1] : null,
      right: segmentEnd < points.length ? points[segmentEnd] : null,
    });

    const top = buildStepPolyline(extendedSegment, (p) => ({ x: p.x1, y: p.y1 }), pos);
    if (!top.length) continue;
    const isIsolated = top.length === 1;

    let bottom: StepPoint[] = [];
    if (mode.hasBottom) {
      bottom = buildStepPolyline(extendedSegment, (p) => ({ x: p.x2, y: p.y2 }), pos);
      if (!bottom.length) continue;

      if (isIsolated && bottom.length === 1) {
        drawIsolatedStrip(path, top[0], bottom[0], style);
        continue;
      }
    }

    path.moveTo(top[0].x, top[0].y);
    for (let i = 1; i < top.length; i++) path.lineTo(top[i].x, top[i].y);

    if (!mode.hasBottom) {
      if (isIsolated) {
        isolatedPoints.push(top[0]);
      }
      continue;
    }

    for (let i = bottom.length - 1; i >= 0; i--) path.lineTo(bottom[i].x, bottom[i].y);
    path.lineTo(top[0].x, top[0].y);
  }

  return path;
}

function createBoundaryExtendedSegment(
  segment: ParsedPoint[],
  pos: 'start' | 'mid' | 'end',
  neighbors: { left: ParsedPoint | null; right: ParsedPoint | null },
) {
  const points = segment.map((p) => ({ ...p }));
  if (!points.length) return points;

  maybeUnshiftBoundaryPoint(points, pos, neighbors.left);
  maybePushBoundaryPoint(points, pos, neighbors.right);

  return points;
}

function maybeUnshiftBoundaryPoint(points: ParsedPoint[], pos: 'start' | 'mid' | 'end', neighbor: ParsedPoint | null) {
  if (!neighbor) return;
  const boundaryX = boundaryBeforeX(pos, neighbor.x1, points[0].x1);
  if (boundaryX == null || boundaryX === points[0].x1) return;
  points.unshift(clonePointWithX(points[0], boundaryX));
}

function maybePushBoundaryPoint(points: ParsedPoint[], pos: 'start' | 'mid' | 'end', neighbor: ParsedPoint | null) {
  if (!neighbor) return;
  const last = points[points.length - 1];
  const boundaryX = boundaryAfterX(pos, neighbor.x1, last.x1);
  if (boundaryX == null || boundaryX === last.x1) return;
  points.push(clonePointWithX(last, boundaryX));
}

function boundaryBeforeX(pos: 'start' | 'mid' | 'end', neighborX: number | undefined, pointX: number) {
  if (neighborX == null || isNaN(neighborX)) return null;
  if (pos === 'start') return null;
  if (pos === 'end') return neighborX;
  const mid = (neighborX + pointX) / 2;
  return isNaN(mid) ? null : mid;
}

function boundaryAfterX(pos: 'start' | 'mid' | 'end', neighborX: number | undefined, pointX: number) {
  if (neighborX == null || isNaN(neighborX)) return null;
  if (pos === 'end') return null;
  if (pos === 'start') return neighborX;
  const mid = (pointX + neighborX) / 2;
  return isNaN(mid) ? null : mid;
}

function clonePointWithX(point: ParsedPoint, x: number): ParsedPoint {
  return { x1: x, y1: point.y1, x2: x, y2: point.y2 };
}

function opacity(c: string, i: number, base: string = 'transparent') {
  return `color-mix(in srgb, ${c} ${i * 100}%, ${base})`;
}

function parseColorToRgba(color: string) {
  const trimmed = color.trim().toLowerCase();
  if (trimmed === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };

  if (trimmed.startsWith('#')) {
    const hex = trimmed.slice(1);
    if (hex.length === 3) {
      const r = parseInt(hex[0] + hex[0], 16);
      const g = parseInt(hex[1] + hex[1], 16);
      const b = parseInt(hex[2] + hex[2], 16);
      return { r, g, b, a: 1 };
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

function createLinearAreaMesh(points: ParsedPoint[]) {
  const data: number[] = [];
  let segment: ParsedPoint[] = [];

  const flush = () => {
    if (segment.length === 0) {
      segment = [];
      return;
    }
    if (segment.length === 1) {
      const point = segment[0];
      const width = MIN_ISOLATED_STRIP_WIDTH;
      const half = width / 2;
      const x0 = point.x1 - half;
      const x1 = point.x1 + half;
      appendQuad(data, x0, x1, point.y1, point.y1, 0, 0, point.y2, point.y2);
      segment = [];
      return;
    }
    for (let i = 0; i < segment.length - 1; i++) {
      const a = segment[i];
      const b = segment[i + 1];
      appendQuad(data, a.x1, b.x1, a.y1, b.y1, 0, 0, a.y2, b.y2);
    }
    segment = [];
  };

  for (const point of points) {
    if (isNaN(point.y1) || isNaN(point.y2) || isNaN(point.x1)) {
      flush();
      continue;
    }
    segment.push(point);
  }

  flush();
  return finalizeMesh(data, 0);
}

function createCurveAreaMesh(points: ParsedPoint[]) {
  const data: number[] = [];
  let segment: ParsedPoint[] = [];

  const flush = () => {
    if (segment.length === 0) {
      segment = [];
      return;
    }
    if (segment.length === 1) {
      const point = segment[0];
      const width = MIN_ISOLATED_STRIP_WIDTH;
      const half = width / 2;
      const x0 = point.x1 - half;
      const x1 = point.x1 + half;
      appendQuad(data, x0, x1, point.y1, point.y1, 0, 0, point.y2, point.y2);
      segment = [];
      return;
    }

    const top = segment.map((p) => ({ x: p.x1, y: p.y1 }));
    const tangents = computeMonotoneTangents(top);
    for (let i = 0; i < segment.length - 1; i++) {
      const a = segment[i];
      const b = segment[i + 1];
      appendQuad(data, a.x1, b.x1, a.y1, b.y1, tangents[i], tangents[i + 1], a.y2, b.y2);
    }
    segment = [];
  };

  for (const point of points) {
    if (isNaN(point.y1) || isNaN(point.y2) || isNaN(point.x1)) {
      flush();
      continue;
    }
    segment.push(point);
  }

  flush();
  return finalizeMesh(data, 1);
}

function createStepAreaMesh(points: ParsedPoint[], pos: 'start' | 'mid' | 'end', mode: StepPathMode) {
  const data: number[] = [];
  let idx = 0;

  while (idx < points.length) {
    while (idx < points.length && !mode.predicate(points[idx])) idx++;
    if (idx >= points.length) break;

    const segmentStart = idx;
    const segment: ParsedPoint[] = [];
    while (idx < points.length && mode.predicate(points[idx])) {
      segment.push(points[idx]);
      idx++;
    }
    const segmentEnd = idx;
    if (!segment.length) continue;

    const extendedSegment = createBoundaryExtendedSegment(segment, pos, {
      left: segmentStart > 0 ? points[segmentStart - 1] : null,
      right: segmentEnd < points.length ? points[segmentEnd] : null,
    });

    const top = buildStepPolyline(extendedSegment, (p) => ({ x: p.x1, y: p.y1 }), pos);
    const bottom = buildStepPolyline(extendedSegment, (p) => ({ x: p.x2, y: p.y2 }), pos);
    if (top.length < 2 || bottom.length < 2) continue;

    const xs = top.map((p) => p.x);
    const bottomYs =
      bottom.length === top.length && bottom.every((p, i) => p.x === xs[i])
        ? bottom.map((p) => p.y)
        : samplePolylineYs(bottom, xs);

    for (let i = 0; i < xs.length - 1; i++) {
      const x0 = xs[i];
      const x1 = xs[i + 1];
      if (x0 === x1) continue;
      appendQuad(data, x0, x1, top[i].y, top[i + 1].y, 0, 0, bottomYs[i], bottomYs[i + 1]);
    }
  }

  return finalizeMesh(data, 0);
}

const MESH_STRIDE = 10;
function appendQuad(
  data: number[],
  x0: number,
  x1: number,
  y0t: number,
  y1t: number,
  m0: number,
  m1: number,
  y0b: number,
  y1b: number,
) {
  if (!isFinite(x0) || !isFinite(x1)) return;
  if (x0 === x1) return;
  const minY = Math.min(y0t, y1t, y0b, y1b);
  const maxY = Math.max(y0t, y1t, y0b, y1b);
  const verts = [
    x0, minY,
    x1, minY,
    x1, maxY,
    x0, minY,
    x1, maxY,
    x0, maxY,
  ];
  for (let i = 0; i < verts.length; i += 2) {
    data.push(
      verts[i],
      verts[i + 1],
      x0,
      x1,
      y0t,
      y1t,
      m0,
      m1,
      y0b,
      y1b,
    );
  }
}

function finalizeMesh(data: number[], mode: 0 | 1): FillMesh {
  return {
    data: new Float32Array(data),
    count: data.length / MESH_STRIDE,
    stride: MESH_STRIDE * 4,
    mode,
    dirty: true,
  };
}

function computeMonotoneTangents(points: { x: number; y: number }[]) {
  if (points.length < 2) return points.map(() => 0);
  const n = points.length;
  const h: number[] = new Array(n - 1);
  const delta: number[] = new Array(n - 1);
  for (let i = 0; i < n - 1; i++) {
    h[i] = points[i + 1].x - points[i].x;
    delta[i] = h[i] !== 0 ? (points[i + 1].y - points[i].y) / h[i] : 0;
  }

  const m: number[] = new Array(n);
  m[0] = delta[0];
  for (let i = 1; i < n - 1; i++) m[i] = (delta[i - 1] + delta[i]) / 2;
  m[n - 1] = delta[n - 2];

  for (let i = 0; i < n - 1; i++) {
    if (delta[i] === 0 || !isFinite(delta[i])) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    if (m[i] === 0 && m[i + 1] === 0) continue;
    if (m[i] * delta[i] < 0 || m[i + 1] * delta[i] < 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i] / delta[i];
    const b = m[i + 1] / delta[i];
    const sumSq = a * a + b * b;
    if (sumSq > 9) {
      const t = 3 / Math.sqrt(sumSq);
      m[i] = t * a * delta[i];
      m[i + 1] = t * b * delta[i];
    }
  }

  return m;
}

function samplePolylineYs(points: { x: number; y: number }[], xs: number[]) {
  if (!points.length) return xs.map(() => NaN);
  const out: number[] = [];
  let j = 0;
  for (const x of xs) {
    while (j < points.length - 2 && points[j + 1].x < x) j++;
    const p0 = points[j];
    const p1 = points[j + 1] ?? points[j];
    if (p0.x === p1.x) {
      out.push(p1.y);
    } else {
      const t = (x - p0.x) / (p1.x - p0.x);
      out.push(p0.y + (p1.y - p0.y) * t);
    }
  }
  return out;
}

function makeUsingParser(usingInput: Using) {
  const [[l1, r1], [l2, r2]] = parseUsing(usingInput);

  return function (p: Point) {
    return { x1: p.x[r1], y1: p.y[l1], x2: p.x[r2], y2: p.y[l2] };
  };
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

const pathCreators: Record<
  `mark:${MarkOp['draw']}` | `link:${LinkOp['draw']}`,
  [
    (
      points: Point[],
      using: Using | undefined,
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
      fillMesh?: FillMesh;
      strokeStyle?: string;
      fillStyle?: string;
      postFillStyle?: string;
    },
    flags: FlagsStyle,
  ]
> = {
  'link:line': [createPathLines, { stroke: true }],
  'link:curve': [createPathCurve, { stroke: true }],
  'link:area': [createPathContours, { fill: true }],
  'link:curve-area': [createPathCurveArea, { fill: true }],

  'link:step-area-start': [createPathSteps('start', 'area'), { fill: true }],
  'link:step-area': [createPathSteps('mid', 'area'), { fill: true }],
  'link:step-area-end': [createPathSteps('end', 'area'), { fill: true }],

  'link:step-start': [createPathSteps('start', 'line'), { stroke: true }],
  'link:step': [createPathSteps('mid', 'line'), { stroke: true }],
  'link:step-end': [createPathSteps('end', 'line'), { stroke: true }],

  // ----------

  'mark:circle': [
    createPathMarks((path, { style: { size } }) => {
      const r = (size ?? 5) / 2;
      path.moveTo(r, 0);
      path.arc(0, 0, r, 0, Math.PI * 2);
    }),
    { stroke: true, fill: true },
  ],

  'mark:minus': [
    createPathMarks((path, { style: { size } }) => {
      const r = (size ?? 5) / 2;
      path.moveTo(-r, 0);
      path.lineTo(r, 0);
    }),
    { stroke: true, fill: false },
  ],

  'mark:triangle': [
    createPathMarks((path, { style: { size } }) => {
      const r = (size ?? 5) / 2;

      path.moveTo(0, -r);
      path.lineTo((+r * Math.sqrt(3)) / 2, r / 2);
      path.lineTo((-r * Math.sqrt(3)) / 2, r / 2);
      path.closePath();
    }),
    { stroke: true, fill: true },
  ],

  'mark:square': [
    createPathMarks((path, { style: { size } }) => {
      size = ((size ?? 5) / 2) * Math.sqrt(2);
      path.rect(-size / 2, -size / 2, size, size);
    }),
    { stroke: true, fill: true },
  ],

  'mark:diamond': [
    createPathMarks((path, { style: { size } }) => {
      size = size ?? 5;

      path.moveTo(0, -size / 2);
      path.lineTo(+size / 2, 0);
      path.lineTo(0, +size / 2);
      path.lineTo(-size / 2, 0);
      path.closePath();
    }),
    { stroke: true, fill: true },
  ],

  'mark:star': [
    createPathMarks((path, { style: { size } }) => {
      size = size ?? 5;
      const rOuter = size / 2;
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
    }),
    { stroke: true, fill: true },
  ],

  'mark:plus': [
    createPathMarks((path, { style: { size } }) => {
      size = size ?? 5;

      path.moveTo(-size / 2, 0);
      path.lineTo(+size / 2, 0);
      path.moveTo(0, -size / 2);
      path.lineTo(0, +size / 2);
    }),
    { stroke: true },
  ],

  'mark:cross': [
    createPathMarks((path, { style: { size } }) => {
      size = ((size ?? 5) / 2) * Math.sqrt(2);

      path.moveTo(-size / 2, -size / 2);
      path.lineTo(+size / 2, +size / 2);
      path.moveTo(-size / 2, +size / 2);
      path.lineTo(+size / 2, -size / 2);
    }),
    { stroke: true },
  ],

  'mark:path': [
    createPathMarks((path, { style: { path: stylePath, size, scale, origin } }) => {
      const mat = new DOMMatrix()
        .scale(scale ?? 1)
        .scale(size ?? 5)
        .translate(-(origin?.[0] ?? 0), -(origin?.[1] ?? 0));

      path.addPath(new Path2D(stylePath), mat);
    }),
    { stroke: true, fill: true },
  ],

  // ----------

  'mark:line': [
    createPathMarks(
      (path, { l }) => {
        path.moveTo(0, 0);
        path.lineTo(l, 0);
      },
      ['min', 'max'],
    ),
    { stroke: true },
  ],

  'mark:bar': [
    createPathMarks(
      (path, { l, style: { size, radius, extrude } }) => {
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
      },
      ['min', 'max'],
    ),
    { stroke: true, fill: true },
  ],

  'mark:section': [
    createPathMarks(
      (path, { l, style: { size } }) => {
        size = size ?? 5;

        path.moveTo(0, -size / 2);
        path.lineTo(0, +size / 2);

        path.moveTo(0, 0);
        path.lineTo(l, 0);

        path.moveTo(l, -size / 2);
        path.lineTo(l, +size / 2);
      },
      ['min', 'max'],
    ),
    { stroke: true },
  ],

  // ----------
  'mark:region': [
    createPathMarks(
      (path, { dx, dy, style: { radius, extrude } }) => {
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
      },
      ['_bottom@_minTime', '_top@_maxTime'],
      false,
    ),
    { stroke: true, fill: true },
  ],
  // ----------

  'mark:icon': [createTextPoint, { fill: true }],
  'mark:text': [createTextPoint, { fill: true }],
};

export class TimescopeSeriesChartRenderer extends TimescopeRenderer {
  #fillRenderer = new WebglFillRenderer();

  updateOptions(options: TimescopeOptionsForWorker): void {
    super.updateOptions(options);
  }

  #plotData: Record<
    string,
    {
      trackId: string;
      trackRevision: number;
      revision: number;

      time: Decimal;
      resolution: Decimal;
      renderResolution: Decimal;

      linkOps: LinkOp[];
      markOps: MarkOp[];

      params: TimescopeAnimatedValue[];
    }
  > = {};

  render(timescope: TimescopeRenderingContext): void {
    super.render(timescope);

    this.#prepareRenderOps(timescope);
    this.#renderCharts(timescope);
  }

  #prepareRenderOps(timescope: TimescopeRenderingContext) {
    if (!timescope.options.series) return;

    const renderResolution = timescope.timeAxis.current.resolution;

    for (const track of timescope.tracks) {
      const dataCacheFor = (k: string) =>
        timescope.dataCaches[`series:${k}:chart`] as TimescopeDataCache<TimescopeSeriesChartProviderData>;

      const _zero = track.y(0);
      const _top = track.top;
      const _bottom = track.bottom;

      for (const k of track.seriesKeys) {
        const cache = dataCacheFor(k);
        if (!cache || !cache.data) continue;

        const {
          data: { data: records, meta },
          revision,
        } = cache;

        if (
          this.#plotData[k] &&
          this.#plotData[k].revision === revision &&
          this.#plotData[k].trackId === track.id &&
          this.#plotData[k].trackRevision === track.revision &&
          this.#plotData[k].renderResolution?.eq(renderResolution) &&
          this.#plotData[k].params?.every((v) => !v.animating)
        ) {
          continue;
        }

        this.#plotData[k] = {
          time: meta.time,
          resolution: meta.resolution,
          renderResolution,
          trackId: track.id,
          trackRevision: track.revision,
          revision,
          linkOps: [],
          markOps: [],
          params: this.#plotData[k]?.params,
        };

        if (!this.#plotData[k].params) {
          this.#plotData[k].params = [
            new TimescopeAnimatedValue(),
            new TimescopeAnimatedValue(),
            new TimescopeAnimatedValue(),
          ];
          this.#plotData[k].params.forEach((p) => {
            p.on('changed', () => this.changed());
          });
        }

        const color = meta.color;
        const points: Point[] = [];
        const scaleX = meta.resolution.div(renderResolution, 3).number();

        this.#plotData[k].params[0].setValue(meta.scaleY, { animation: 'linear', duration: 200 });
        this.#plotData[k].params[1].setValue(meta.baseY, { animation: 'linear', duration: 200 });
        this.#plotData[k].params[2].setValue(meta.floating ?? 0, { animation: 'linear', duration: 200 });

        const scaleY = this.#plotData[k].params[0];
        const baseY = this.#plotData[k].params[1];
        const floating = this.#plotData[k].params[2];

        for (const data of records) {
          const point = {
            x: {} as Record<string, number>,
            y: { _zero, _top, _bottom } as Record<string, number>,
          };

          for (const key in data.point.x) {
            point.x[key] = data.point.x[key] * scaleX;
          }
          for (const key in data.point.y) {
            point.y[key] = track.y((data.point.y[key] - baseY.value!) * scaleY.value!, floating.value ?? 0) ?? NaN;
          }
          points.push(point);

          for (const mark of data.marks) {
            if (!mark) continue;

            const style = { color, ...(mark.style ?? {}) };
            const [creator, flags] = pathCreators[`mark:${mark.draw}`];
            const { strokePath, fillPath, path, strokeStyle, fillStyle, postFillStyle } =
              creator?.([point], mark.using, style) ?? {};

            this.#plotData[k].markOps.push({
              type: 'mark',
              draw: mark.draw,
              time: this.#plotData[k].time,
              strokePath,
              fillPath,
              path,
              style: { ...style, strokeStyle, fillStyle, postFillStyle, ...flags, floating: floating.value ?? 0 },
            });
          }
        }

        for (const link of meta.links ?? []) {
          if (!link) continue;

          const style = { color, ...(link.style ?? {}) };
          const [creator, flags] = pathCreators[`link:${link.draw}`];
          const { strokePath, fillPath, fillMesh, strokeStyle, fillStyle } = creator?.(points, link.using, style) ?? {};

          this.#plotData[k].linkOps.push({
            type: 'link',
            draw: link.draw,
            time: this.#plotData[k].time,
            strokePath,
            fillPath,
            fillMesh,
            style: { ...style, strokeStyle, fillStyle, ...flags, floating: floating.value ?? 0 },
          });
        }
      }
    }
  }

  #renderCharts(timescope: TimescopeRenderingContext) {
    if (!timescope.options.series) return;

    const resolution = timescope.timeAxis.current.resolution;

    const reordered: Record<string, Record<string, ((LinkOp | MarkOp) & { ox: number; oy: number })[]>> = {};
    for (const k in this.#plotData) {
      const plot = this.#plotData[k];

      if (!reordered[plot.trackId]) reordered[plot.trackId] = {};
      if (!plot.time) continue;

      const ox =
        plot.time
          .sub(timescope.timeAxis.current.time ?? timescope.timeAxis.now)
          .div(resolution, 3)
          .number() + timescope.timeAxis.axisLength[0];

      for (const link of plot.linkOps) {
        const key = link.draw.includes('area') ? `link:fill` : `link:stroke`;

        if (!reordered[plot.trackId][key]) reordered[plot.trackId][key] = [];
        reordered[plot.trackId][key].push({ ...link, ox, oy: 0 });
      }
      for (const mark of plot.markOps) {
        const key = `marks`;
        if (!reordered[plot.trackId][key]) reordered[plot.trackId][key] = [];

        reordered[plot.trackId][key].push({ ...mark, ox, oy: 0 });
      }
    }

    const canvasSize = {
      width: timescope.ctx.canvas.width / timescope.dpr,
      height: timescope.ctx.canvas.height / timescope.dpr,
    };
    const glReady = this.#fillRenderer.ensure(canvasSize, timescope.dpr);
    if (glReady) {
      this.#fillRenderer.beginFrame();
    }

    for (const track of timescope.tracks) {
      clipToTrack(timescope, track, () => {
        const ctx = timescope.ctx;
        const fillOps = reordered?.[track.id]?.['link:fill'];
        if (!fillOps?.length) return;

        if (glReady) {
          this.#fillRenderer.setScissor(
            {
              x: 0,
              y: track.oy,
              width: canvasSize.width,
              height: track.height,
            },
            canvasSize,
            timescope.dpr,
          );
        }

        for (const op of fillOps) {
          const drew =
            glReady && op.fillMesh && op.style.fillStyle
              ? this.#fillRenderer.drawFillMesh(
                  op.fillMesh,
                  op.style.fillStyle,
                  op.style.floating,
                  op.ox,
                  track.oy + op.oy,
                  (timescope.renderingTrack?.y0 ?? 0) + track.oy,
                  (timescope.renderingTrack?.y(0, 10 * (op.style.floating ?? 0)) ?? NaN) + track.oy,
                )
              : false;

          if (!drew && op.fillPath) {
            ctx.save();
            ctx.translate(op.ox, op.oy);
            renderPath(timescope, op.strokePath, op.fillPath, op.style);
            ctx.restore();
          }
        }
      });
    }

    if (glReady && this.#fillRenderer.hasDrawn) {
      this.#fillRenderer.composite(timescope.ctx, canvasSize);
    }

    for (const track of timescope.tracks) {
      clipToTrack(timescope, track, () => {
        const ctx = timescope.ctx;

        for (const k of ['link:stroke', 'marks'] as const) {
          if (!reordered?.[track.id]?.[k]) continue;

          const ops = reordered[track.id][k];

          for (const op of ops) {
            ctx.save();
            ctx.translate(op.ox, op.oy);

            if (op.strokePath || op.fillPath) {
              renderPath(timescope, op.strokePath, op.fillPath, op.style);
            } else if (op.path) {
              renderIcon(timescope, op.path, op.style);
              renderText(timescope, op.path, op.style);
            }

            ctx.restore();
          }
        }
      });
    }
  }
}

function createFadeoutStyle(timescope: TimescopeRenderingContext, color: string, floating?: number) {
  const y0 = timescope.renderingTrack!.y0;
  if (!floating) return color;

  const y1 = timescope.renderingTrack!.y(0, 10 * floating);
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
) {
  const ctx = timescope.ctx;

  if (style.fill && !style.fillPost && style.fillStyle && fillPath) {
    ctx.fillStyle = createFadeoutStyle(timescope, style.fillStyle, style.floating);
    ctx.fill(fillPath);
  }

  if (style.stroke && style.strokeStyle && (style.lineWidth ?? 1) > 0 && strokePath) {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = createFadeoutStyle(timescope, style.strokeStyle, style.floating);
    ctx.lineWidth = style.lineWidth ?? 1;
    if (style.lineDashArray) {
      ctx.setLineDash(style.lineDashArray);
      ctx.lineDashOffset = style.lineDashOffset ?? 0;
    }
    ctx.stroke(strokePath);
  }

  if (style.fill && style.fillPost && style.fillStyle && fillPath) {
    ctx.fillStyle = createFadeoutStyle(timescope, style.fillStyle, style.floating);
    ctx.fill(fillPath);
  }
}

class WebglFillRenderer {
  #canvas: OffscreenCanvas | null = null;
  #gl: WebGLRenderingContext | null = null;
  #program: WebGLProgram | null = null;
  #buffer: WebGLBuffer | null = null;
  #attribPos = -1;
  #attribSegX = -1;
  #attribSegYTop = -1;
  #attribSegM = -1;
  #attribSegYBottom = -1;
  #uniformResolution: WebGLUniformLocation | null = null;
  #uniformTranslate: WebGLUniformLocation | null = null;
  #uniformColor: WebGLUniformLocation | null = null;
  #uniformMode: WebGLUniformLocation | null = null;
  #uniformY0: WebGLUniformLocation | null = null;
  #uniformY1: WebGLUniformLocation | null = null;
  #uniformUseGradient: WebGLUniformLocation | null = null;
  #uniformDpr: WebGLUniformLocation | null = null;
  #width = 0;
  #height = 0;
  #dpr = 1;
  #version = 0;
  hasDrawn = false;

  ensure(size: { width: number; height: number }, dpr: number) {
    const width = Math.max(1, Math.floor(size.width * dpr));
    const height = Math.max(1, Math.floor(size.height * dpr));

    const sizeChanged = this.#width !== width || this.#height !== height;
    const dprChanged = this.#dpr !== dpr;

    if (!this.#canvas || sizeChanged || dprChanged) {
      this.#canvas = new OffscreenCanvas(width, height);
      this.#width = width;
      this.#height = height;
      this.#dpr = dpr;
      this.#gl = null;
      this.#program = null;
      this.#buffer = null;
      this.#attribPos = -1;
      this.#attribSegX = -1;
      this.#attribSegYTop = -1;
      this.#attribSegM = -1;
      this.#attribSegYBottom = -1;
      this.#uniformResolution = null;
      this.#uniformTranslate = null;
      this.#uniformColor = null;
      this.#uniformMode = null;
      this.#uniformY0 = null;
      this.#uniformY1 = null;
      this.#uniformUseGradient = null;
      this.#uniformDpr = null;
    }

    if (!this.#gl) {
      this.#gl = this.#canvas.getContext('webgl', {
        alpha: true,
        antialias: false,
        premultipliedAlpha: true,
      }) as WebGLRenderingContext | null;
      if (!this.#gl) return false;
      this.#version += 1;
    }

    if (!this.#program || !this.#buffer) {
      const gl = this.#gl;
      const vert = gl.createShader(gl.VERTEX_SHADER)!;
      gl.shaderSource(
        vert,
        `
attribute vec2 a_pos;
attribute vec2 a_seg_x;
attribute vec2 a_seg_y_top;
attribute vec2 a_seg_m;
attribute vec2 a_seg_y_bottom;
uniform vec2 u_resolution;
uniform vec2 u_translate;
uniform float u_dpr;
varying vec2 v_seg_y_top;
varying vec2 v_seg_y_bottom;
varying vec2 v_seg_m;
varying float v_t;
varying float v_dx;
varying float v_y_local;
varying float v_y_world;
void main() {
  vec2 pos = (a_pos + u_translate) * u_dpr;
  vec2 zeroToOne = pos / u_resolution;
  vec2 clip = zeroToOne * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
  float dx = a_seg_x.y - a_seg_x.x;
  v_t = dx != 0.0 ? (a_pos.x - a_seg_x.x) / dx : 0.0;
  v_dx = dx;
  v_seg_y_top = a_seg_y_top;
  v_seg_y_bottom = a_seg_y_bottom;
  v_seg_m = a_seg_m;
  v_y_local = a_pos.y;
  v_y_world = a_pos.y + u_translate.y;
}
`,
      );
      gl.compileShader(vert);

      const frag = gl.createShader(gl.FRAGMENT_SHADER)!;
      gl.shaderSource(
        frag,
        `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec4 u_color;
uniform int u_mode;
uniform float u_y0;
uniform float u_y1;
uniform float u_useGradient;
varying vec2 v_seg_y_top;
varying vec2 v_seg_y_bottom;
varying vec2 v_seg_m;
varying float v_t;
varying float v_dx;
varying float v_y_local;
varying float v_y_world;
void main() {
  float t = clamp(v_t, 0.0, 1.0);
  float y0t = v_seg_y_top.x;
  float y1t = v_seg_y_top.y;
  float y0b = v_seg_y_bottom.x;
  float y1b = v_seg_y_bottom.y;
  float yTop;
  if (u_mode == 1) {
    float m0 = v_seg_m.x;
    float m1 = v_seg_m.y;
    float t2 = t * t;
    float t3 = t2 * t;
    float h00 = 2.0 * t3 - 3.0 * t2 + 1.0;
    float h10 = t3 - 2.0 * t2 + t;
    float h01 = -2.0 * t3 + 3.0 * t2;
    float h11 = t3 - t2;
    yTop = h00 * y0t + h10 * v_dx * m0 + h01 * y1t + h11 * v_dx * m1;
  } else {
    yTop = mix(y0t, y1t, t);
  }
  float yBottom = mix(y0b, y1b, t);
  float minY = min(yTop, yBottom);
  float maxY = max(yTop, yBottom);
  if (v_y_local < minY || v_y_local > maxY) discard;

  float alpha = u_color.a;
  if (u_useGradient > 0.5) {
    float denom = (u_y0 - u_y1);
    if (abs(denom) > 0.0001) {
      float t = clamp((v_y_world - u_y1) / denom, 0.0, 1.0);
      if (t > 0.8) {
        alpha *= (1.0 - (t - 0.8) / 0.2);
      }
    }
  }
  vec3 rgb = u_color.rgb * alpha;
  gl_FragColor = vec4(rgb, alpha);
}
`,
      );
      gl.compileShader(frag);

      const program = gl.createProgram()!;
      gl.attachShader(program, vert);
      gl.attachShader(program, frag);
      gl.linkProgram(program);

      this.#program = program;
      this.#attribPos = gl.getAttribLocation(program, 'a_pos');
      this.#attribSegX = gl.getAttribLocation(program, 'a_seg_x');
      this.#attribSegYTop = gl.getAttribLocation(program, 'a_seg_y_top');
      this.#attribSegM = gl.getAttribLocation(program, 'a_seg_m');
      this.#attribSegYBottom = gl.getAttribLocation(program, 'a_seg_y_bottom');
      this.#uniformResolution = gl.getUniformLocation(program, 'u_resolution');
      this.#uniformTranslate = gl.getUniformLocation(program, 'u_translate');
      this.#uniformColor = gl.getUniformLocation(program, 'u_color');
      this.#uniformMode = gl.getUniformLocation(program, 'u_mode');
      this.#uniformY0 = gl.getUniformLocation(program, 'u_y0');
      this.#uniformY1 = gl.getUniformLocation(program, 'u_y1');
      this.#uniformUseGradient = gl.getUniformLocation(program, 'u_useGradient');
      this.#uniformDpr = gl.getUniformLocation(program, 'u_dpr');
      this.#buffer = gl.createBuffer();
    }

    return true;
  }

  beginFrame() {
    if (!this.#gl || !this.#program || !this.#buffer) return;
    const gl = this.#gl;
    this.hasDrawn = false;
    gl.viewport(0, 0, this.#width, this.#height);
    gl.disable(gl.SCISSOR_TEST);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.#program);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.#buffer);
    gl.enableVertexAttribArray(this.#attribPos);
    gl.enableVertexAttribArray(this.#attribSegX);
    gl.enableVertexAttribArray(this.#attribSegYTop);
    gl.enableVertexAttribArray(this.#attribSegM);
    gl.enableVertexAttribArray(this.#attribSegYBottom);
    gl.uniform2f(this.#uniformResolution, this.#width, this.#height);
    gl.uniform1f(this.#uniformDpr, this.#dpr);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(0, 0, this.#width, this.#height);
  }

  setScissor(
    rect: { x: number; y: number; width: number; height: number },
    size: { width: number; height: number },
    dpr: number,
  ) {
    if (!this.#gl) return;
    const gl = this.#gl;
    const x = Math.max(0, rect.x);
    const y = Math.max(0, size.height - (rect.y + rect.height));
    const w = Math.max(0, rect.width);
    const h = Math.max(0, rect.height);
    gl.scissor(Math.floor(x * dpr), Math.floor(y * dpr), Math.floor(w * dpr), Math.floor(h * dpr));
  }

  drawFillMesh(
    mesh: FillMesh,
    fillStyle: string,
    floating: number | undefined,
    ox: number,
    oy: number,
    y0: number,
    y1: number,
  ) {
    if (!this.#gl || !this.#program || !this.#buffer) return false;
    if (!mesh.count) return false;
    const rgba = parseColorToRgba(fillStyle);
    if (!rgba) return false;

    const gl = this.#gl;
    const version = this.#version;
    const needsUpload = mesh.dirty || mesh.version !== version || !mesh.buffer;
    if (needsUpload) {
      if (mesh.version !== version) mesh.buffer = null;
      const buffer = mesh.buffer ?? gl.createBuffer();
      if (!buffer) return false;
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, mesh.data, gl.STATIC_DRAW);
      mesh.buffer = buffer;
      mesh.version = version;
      mesh.dirty = false;
    } else {
      gl.bindBuffer(gl.ARRAY_BUFFER, mesh.buffer!);
    }

    gl.vertexAttribPointer(this.#attribPos, 2, gl.FLOAT, false, mesh.stride, 0);
    gl.vertexAttribPointer(this.#attribSegX, 2, gl.FLOAT, false, mesh.stride, 8);
    gl.vertexAttribPointer(this.#attribSegYTop, 2, gl.FLOAT, false, mesh.stride, 16);
    gl.vertexAttribPointer(this.#attribSegM, 2, gl.FLOAT, false, mesh.stride, 24);
    gl.vertexAttribPointer(this.#attribSegYBottom, 2, gl.FLOAT, false, mesh.stride, 32);
    gl.uniform2f(this.#uniformTranslate, ox, oy);
    gl.uniform4f(this.#uniformColor, rgba.r / 255, rgba.g / 255, rgba.b / 255, rgba.a);
    gl.uniform1i(this.#uniformMode, mesh.mode);

    const useGradient = floating && isFinite(y1) && isFinite(y0) ? 1 : 0;
    gl.uniform1f(this.#uniformUseGradient, useGradient);
    gl.uniform1f(this.#uniformY0, isFinite(y0) ? y0 : 0);
    gl.uniform1f(this.#uniformY1, isFinite(y1) ? y1 : 0);

    gl.drawArrays(gl.TRIANGLES, 0, mesh.count);
    this.hasDrawn = true;
    return true;
  }

  composite(ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D, size: { width: number; height: number }) {
    if (!this.#canvas || !this.hasDrawn) return;
    ctx.drawImage(this.#canvas, 0, 0, size.width, size.height);
  }
}

function renderText(
  { ctx }: TimescopeRenderingContext,
  points: { x: number; y: number }[],
  style: TextStyle & SizeStyle & { color: string } & OffsetStyle & AngleStyle,
) {
  if (!style.text) return;

  ctx.translate(style.offset?.[0] ?? 0, style.offset?.[1] ?? 0);

  ctx.font = `${style.fontWeight ?? 'normal'} ${style.size ?? 14}px ${style.fontFamily ?? 'sans-serif'}`;
  ctx.textAlign = style.textAlign ?? 'center';
  ctx.textBaseline = style.textBaseline ?? 'middle';

  for (const point of points) {
    ctx.save();
    ctx.translate(point.x, point.y);
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
}

function renderIcon(
  { ctx }: TimescopeRenderingContext,
  points: { x: number; y: number }[],
  style: IconStyle & SizeStyle & { color: string } & OffsetStyle & AngleStyle,
) {
  if (!style.icon) return;

  ctx.translate(style.offset?.[0] ?? 0, style.offset?.[1] ?? 0);

  ctx.font = `${style.iconFontWeight ?? 'normal'} ${style.size ?? 16}px ${style.iconFontFamily ?? 'icons'}`;
  ctx.textAlign = style.iconAlign ?? 'center';
  ctx.textBaseline = style.iconBaseline ?? 'middle';

  for (const point of points) {
    ctx.save();
    ctx.translate(point.x, point.y);
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
}
