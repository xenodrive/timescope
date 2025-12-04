import type {
  TimescopeOptionsForWorker,
  TimescopeSeriesChartProviderData,
  TimescopeSeriesChartProviderMeta,
} from '#src/bridge/protocol';
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
import { createScaleY } from '../scale';
import type { TimescopeDataCacheSeries } from '../TimescopeDataCacheSeries';

type Point = { x: Record<string, number>; y: Record<string, number> };
type StepPoint = { x: number; y: number };

const renderingOrder = ['link:fill', 'link:stroke', 'marks'] as const;

type OffsetStyle = { offset?: [number, number] };
type DefaultColorStyle = { color: string };
type FlagsStyle = { stroke?: boolean; fill?: boolean };

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
    | 'box'
    | 'section'
    | 'text'
    | 'icon'
    | 'path';
  time: Decimal;

  path?: Path2D | { x: number; y: number }[];
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
    FlagsStyle & { fillStyle?: string; strokeStyle?: string; postFillStyle?: string };
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

  path?: Path2D | { x: number; y: number }[];
  style: StrokeStyle & FillStyle & DefaultColorStyle & FlagsStyle & { fillStyle?: string; strokeStyle?: string };
};

const MIN_ISOLATED_POINT_RADIUS = 0.75;
const MIN_ISOLATED_STRIP_WIDTH = 1;

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
  let segmentStart: { x: number; y: number } | null = null;
  let segmentLength = 0;

  const flush = () => {
    if (segmentLength === 1 && segmentStart) {
      drawIsolatedPoint(path, segmentStart, style);
    }
    segmentStart = null;
    segmentLength = 0;
  };

  for (const p of points) {
    const { x1: x, y1: y } = parser(p);

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

  const strokeStyle = style.lineColor ?? style.color ?? 'black';
  const fillStyle = opacity(style.fillColor ?? style.color ?? 'black', style.fillOpacity ?? 0.25, 'transparent');

  return { path, strokeStyle, fillStyle };
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

  for (const p of pointsSrc) {
    const { x1: x, y1: y } = parser(p);

    if (isNaN(y)) {
      flush();
      continue;
    }

    segment.push({ x, y });
  }

  flush();

  const strokeStyle = style.lineColor ?? style.color ?? 'black';
  const fillStyle = opacity(style.fillColor ?? style.color ?? 'black', style.fillOpacity ?? 0.25, 'transparent');

  return { path, strokeStyle, fillStyle };
}

function createPathCurveArea(
  pointsSrc: Point[],
  using: Using | undefined,
  style: FillStyle & StrokeStyle & DefaultColorStyle,
) {
  const path = new Path2D();
  const parser = makeUsingParser(using ?? ['value@time', 'zero@time']);
  const points = pointsSrc.map(parser);

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

  const strokeStyle = style.lineColor ?? style.color ?? 'black';
  const fillStyle = opacity(style.fillColor ?? style.color ?? 'black', style.fillOpacity ?? 0.25, 'transparent');

  return { path, strokeStyle, fillStyle };
}

function createPathContours(
  pointsSrc: Point[],
  using: Using | undefined,
  style: FillStyle & StrokeStyle & DefaultColorStyle,
) {
  const path = new Path2D();
  const parser = makeUsingParser(using ?? ['value@time', 'zero@time']);
  const points = pointsSrc.map(parser);

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

  const strokeStyle = style.lineColor ?? style.color ?? 'black';
  const fillStyle = opacity(style.fillColor ?? style.color ?? 'black', style.fillOpacity ?? 0.25, 'transparent');

  return { path, strokeStyle, fillStyle };
}

function createPathMarks<
  S extends FillStyle & StrokeStyle & DefaultColorStyle & SizeStyle & OffsetStyle & AngleStyle & PathStyle,
>(
  callback: (path: Path2D, arg: { dx: number; dy: number; l: number; style: S }) => void,
  defaultUsing: Using = 'value@time',
) {
  return function (pointsSrc: Point[], using: Using | undefined, style: S) {
    const path = new Path2D();
    const parser = makeUsingParser(using ?? defaultUsing);
    const points = pointsSrc.map(parser);

    for (const point of points) {
      const dx = point.x2 - point.x1;
      const dy = point.y2 - point.y1;
      const l = Math.hypot(dx, dy);
      const angle = (Math.atan2(dy, dx) * 180) / Math.PI;

      const markPath = new Path2D();
      callback(markPath, { style, dx, dy, l });

      const mat = new DOMMatrix()
        .translate(point.x1, point.y1)
        .rotate(angle)
        .translate(style.offset?.[0] ?? 0, style.offset?.[1] ?? 0)
        .rotate(style.angle ?? 0);

      path.addPath(markPath, mat);
    }

    const strokeStyle = style.lineColor ?? style.color ?? 'black';
    const fillStyle = opacity(style.fillColor ?? style.color ?? 'black', style.fillOpacity ?? 0.25, 'white'); // XXX: flatten on white

    return { path, strokeStyle, fillStyle };
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
    defaultUsing: ['value@time', 'zero@time'],
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

    if (type === 'line') {
      for (const point of isolatedPoints) {
        drawIsolatedPoint(path, point, style);
      }
    }

    const strokeStyle = style.lineColor ?? style.color ?? 'black';
    const fillStyle = opacity(style.fillColor ?? style.color ?? 'black', style.fillOpacity ?? 0.25, 'transparent');

    return { path, strokeStyle, fillStyle };
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

function makeUsingParser(usingInput: Using) {
  const [[l1, r1], [l2, r2]] = parseUsing(usingInput);

  return function (p: Point) {
    return { x1: p.x[r1], y1: p.y[l1], x2: p.x[r2], y2: p.y[l2] };
  };
}

function parsePadding(padding: number | [number, number?, number?, number?] | undefined) {
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
      path: Path2D | { x: number; y: number }[];
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

  'mark:box': [
    createPathMarks(
      (path, { l, style: { size, radius, padding } }) => {
        size = size ?? 5;

        const pad = parsePadding(padding);
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

  'mark:icon': [createTextPoint, { fill: true }],
  'mark:text': [createTextPoint, { fill: true }],
};

export class TimescopeSeriesChartRenderer extends TimescopeRenderer {
  updateOptions(options: TimescopeOptionsForWorker): void {
    super.updateOptions(options);
  }

  #resolution = Decimal(0);
  #plotData: Record<
    string,
    {
      trackId: string;
      revision: number;

      time: Decimal;

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
    const zoomChanged = this.#resolution.neq(timescope.timeAxis.current.resolution);
    this.#resolution = timescope.timeAxis.current.resolution.clone();

    if (!timescope.options.series) return;

    for (const k in timescope.options.series) {
      const series = timescope.options.series[k];
      const trackId = series.track ?? timescope.tracks[0].id;
      const track = timescope.tracks.find((t) => t.id === trackId)!;

      const { data, meta, revision } = timescope.dataCaches[`series:${k}:chart`] as TimescopeDataCacheSeries<
        TimescopeSeriesChartProviderData,
        TimescopeSeriesChartProviderMeta
      >;

      if (
        this.#plotData[k] &&
        !zoomChanged &&
        this.#plotData[k].revision === revision &&
        this.#plotData[k].trackId === trackId
      ) {
        continue;
      }
      this.#plotData[k] = { time: timescope.timeAxis.current.range[0], trackId, revision, linkOps: [], markOps: [] };

      const color = meta.color;
      const points: Point[] = [];

      const scaleY = createScaleY(track.symmetric, series.data.scale === 'log', meta);
      if (!scaleY) continue;

      for (let i = 0; i < data.length; i++) {
        const time = data[i].time;
        const value = data[i].value;

        const point = {
          x: {} as Record<string, number>,
          y: { zero: track.y(0) } as Record<string, number>,
        };
        for (const key in time) {
          point.x[key] = time[key].sub(this.#plotData[k].time).div(this.#resolution, 3).number();
        }
        for (const key in value) {
          point.y[key] = track.y(scaleY(value[key]));
        }
        points.push(point);

        for (const mark of data[i].marks) {
          if (!mark) continue;

          const style = { color, ...(mark.style ?? {}) };
          const [creator, flags] = pathCreators[`mark:${mark.draw}`];
          const { path, strokeStyle, fillStyle, postFillStyle } = creator?.([point], mark.using, style) ?? {};

          if (!this.#plotData[k].markOps) {
            this.#plotData[k].markOps = [];
          }

          this.#plotData[k].markOps.push({
            type: 'mark',
            draw: mark.draw,
            time: this.#plotData[k].time,
            path,
            style: { ...style, strokeStyle, fillStyle, postFillStyle, ...flags },
          });
        }
      }

      for (const link of meta.links ?? []) {
        if (!link) continue;

        const style = { color, ...(link.style ?? {}) };
        const [creator, flags] = pathCreators[`link:${link.draw}`];
        const { path, strokeStyle, fillStyle } = creator?.(points, link.using, style) ?? {};

        if (!this.#plotData[k].linkOps) {
          this.#plotData[k].linkOps = [];
        }

        this.#plotData[k].linkOps.push({
          type: 'link',
          draw: link.draw,
          time: this.#plotData[k].time,
          path,
          style: { ...style, strokeStyle, fillStyle, ...flags },
        });
      }
    }
  }

  #renderCharts(timescope: TimescopeRenderingContext) {
    if (!timescope.options.series) return;

    const reordered: Record<string, Record<string, ((LinkOp | MarkOp) & { ox: number; oy: number })[]>> = {};
    for (const k in this.#plotData) {
      const plot = this.#plotData[k];

      if (!reordered[plot.trackId]) reordered[plot.trackId] = {};

      const ox =
        plot.time
          .sub(timescope.timeAxis.current.time ?? timescope.timeAxis.now)
          .div(this.#resolution, 3)
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

    for (const track of timescope.tracks) {
      clipToTrack(timescope, track, () => {
        const ctx = timescope.ctx;

        for (const k of renderingOrder) {
          if (!reordered?.[track.id]?.[k]) continue;

          const ops = reordered[track.id][k];

          for (const op of ops) {
            ctx.save();
            ctx.translate(op.ox, op.oy);

            if (op.path instanceof Path2D) {
              renderPath(timescope, op.path, op.style);
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

function renderPath(
  { ctx }: TimescopeRenderingContext,
  path: Path2D | undefined,
  style: MarkOp['style'] & LinkOp['style'],
) {
  if (!path || !(path instanceof Path2D)) return;

  if (style.fill && !style.fillPost && style.fillStyle) {
    ctx.fillStyle = style.fillStyle;
    ctx.fill(path);
  }

  if (style.stroke && style.strokeStyle && (style.lineWidth ?? 1) > 0) {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = style.strokeStyle;
    ctx.lineWidth = style.lineWidth ?? 1;
    if (style.lineDashArray) {
      ctx.setLineDash(style.lineDashArray);
      ctx.lineDashOffset = style.lineDashOffset ?? 0;
    }
    ctx.stroke(path);
  }

  if (style.fill && style.fillPost && style.fillStyle) {
    ctx.fillStyle = style.fillStyle;
    ctx.fill(path);
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
