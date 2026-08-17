import { Decimal, isDecimal } from '#src/core/decimal';
import { PathCommand, type TimescopePathCommands } from '#src/core/path';
import type { Using } from '#src/core/types';
import { parseUsing } from '#src/core/using';

export type LinkGeometryKind =
  | 'line'
  | 'curve'
  | 'step'
  | 'step-start'
  | 'step-end'
  | 'area'
  | 'curve-area'
  | 'step-area'
  | 'step-area-start'
  | 'step-area-end';

export type LinkGeometryRole = 'zero' | 'top' | 'bottom';
export type LinkGeometryCoordinate =
  Decimal | { value: Decimal; number: number } | { value: Decimal; role: LinkGeometryRole };

export type LinkGeometrySource = {
  length: number;
  x: (index: number, key: string) => LinkGeometryCoordinate | null | undefined;
  y: (index: number, key: string) => LinkGeometryCoordinate | null | undefined;
};

type Point = { x: Decimal; y: Decimal; nx?: number; ny?: number; yRole?: LinkGeometryRole };
type PointColumns = {
  length: number;
  x: Decimal[];
  y: Decimal[];
  nx: (number | undefined)[];
  ny: (number | undefined)[];
  yRole: (LinkGeometryRole | undefined)[];
};
type PointRange = { columns: PointColumns; start: number; end: number };
type LineSegment = { kind: 'line'; p0: Point; p1: Point };
type CubicSegment = { kind: 'cubic'; p0: Point; c1: Point; c2: Point; p1: Point };
type Segment = LineSegment | CubicSegment;
type SegmentRun = { segments: Segment[]; start: Point; end: Point };
type ClipTarget = {
  xRange: readonly [Decimal, Decimal];
  yRange: readonly [Decimal, Decimal];
};

const DEFAULT_Y_RANGE = [Decimal(-16_384), Decimal(16_384)] as const;
const ZERO = Decimal(0);
const ONE = Decimal(1);
const TWO = Decimal(2);
const THREE = Decimal(3);
const MIN_PRECISION = 32;
const MAX_PRECISION = 4096;

function createPointColumns(capacity = 0): PointColumns {
  return {
    length: 0,
    x: new Array<Decimal>(capacity),
    y: new Array<Decimal>(capacity),
    nx: new Array<number | undefined>(capacity),
    ny: new Array<number | undefined>(capacity),
    yRole: new Array<LinkGeometryRole | undefined>(capacity),
  };
}

function appendPoint(columns: PointColumns, point: Point) {
  setPoint(columns, columns.length, point);
}

function appendCoordinatePoint(
  columns: PointColumns,
  xCoordinate: LinkGeometryCoordinate | null | undefined,
  yCoordinate: LinkGeometryCoordinate | null | undefined,
  x: Decimal,
  y: Decimal,
) {
  const index = columns.length++;
  columns.x[index] = x;
  columns.y[index] = y;
  columns.nx[index] = coordinateNumber(xCoordinate);
  columns.ny[index] = coordinateNumber(yCoordinate);
  columns.yRole[index] = coordinateRole(yCoordinate);
}

function pointFromColumns(columns: PointColumns, index: number): Point {
  return {
    x: columns.x[index],
    y: columns.y[index],
    nx: columns.nx[index],
    ny: columns.ny[index],
    yRole: columns.yRole[index],
  };
}

function rangeLength(range: PointRange) {
  return range.end - range.start;
}

function pointFromRange(range: PointRange, index: number) {
  return pointFromColumns(range.columns, range.start + index);
}

function clearPointColumns(columns: PointColumns) {
  columns.length = 0;
}

function releasePointColumns(columns: PointColumns) {
  const length = columns.length;
  releaseReferences(columns.x, length);
  releaseReferences(columns.y, length);
  columns.length = 0;
}

function releaseReferences(values: unknown[], length: number) {
  values.fill(undefined, 0, length);
}

function pointsFromRange(range: PointRange) {
  const points = new Array<Point>(rangeLength(range));
  for (let index = 0; index < points.length; index++) points[index] = pointFromRange(range, index);
  return points;
}

function coordinateValue(value: LinkGeometryCoordinate | null | undefined) {
  return isDecimal(value) ? (value as Decimal) : value?.value;
}

function coordinateNumber(value: LinkGeometryCoordinate | null | undefined) {
  return value && !isDecimal(value) && 'number' in value ? value.number : undefined;
}

function coordinateRole(value: LinkGeometryCoordinate | null | undefined) {
  return value && !isDecimal(value) && 'role' in value ? value.role : undefined;
}

function precisionFor(sourceSpan: Decimal, clipSpan: Decimal) {
  if (sourceSpan.isZero() || clipSpan.isZero()) return MIN_PRECISION;
  const extra = Number(sourceSpan.abs().order() - clipSpan.abs().order());
  return Math.max(
    MIN_PRECISION,
    Math.min(MAX_PRECISION, Number.isFinite(extra) ? extra + MIN_PRECISION : MAX_PRECISION),
  );
}

function targetPrecision(points: readonly Point[], target: ClipTarget) {
  let xSpan = ZERO;
  let ySpan = ZERO;
  for (let index = 1; index < points.length; index++) {
    const dx = points[index].x.sub(points[index - 1].x).abs();
    const dy = points[index].y.sub(points[index - 1].y).abs();
    if (dx.gt(xSpan)) xSpan = dx;
    if (dy.gt(ySpan)) ySpan = dy;
  }
  return Math.max(
    precisionFor(xSpan, target.xRange[1].sub(target.xRange[0])),
    precisionFor(ySpan, target.yRange[1].sub(target.yRange[0])),
  );
}

function finiteNumber(value: Decimal, range: readonly [Decimal, Decimal]) {
  const numeric = value.number();
  if (Number.isFinite(numeric)) return numeric;
  return value.clamp(range[0], range[1]).number();
}

function finiteCoordinate(value: number) {
  if (!Number.isFinite(value)) throw new RangeError('Link geometry produced a non-finite coordinate');
  return Object.is(value, -0) ? 0 : value;
}

function roleCoordinate(role: LinkGeometryRole) {
  if (role === 'zero') return NaN;
  return role === 'top' ? Infinity : -Infinity;
}

class PathCommandWriter {
  #values = new Float64Array(0);
  #length = 0;

  constructor(private readonly initialCapacity: number) {}

  #ensure(size: number) {
    const required = this.#length + size;
    if (required > this.#values.length) {
      const capacity = Math.max(required, this.#values.length * 2, this.initialCapacity);
      const expanded = new Float64Array(capacity);
      expanded.set(this.#values);
      this.#values = expanded;
    }
  }

  #x(point: Point, target: ClipTarget) {
    return finiteCoordinate(point.nx ?? finiteNumber(point.x, target.xRange));
  }

  #y(point: Point, target: ClipTarget) {
    return point.yRole
      ? roleCoordinate(point.yRole)
      : finiteCoordinate(point.ny ?? finiteNumber(point.y, target.yRange));
  }

  pointValues(
    command: typeof PathCommand.moveTo | typeof PathCommand.lineTo,
    x: Decimal,
    y: Decimal,
    nx: number | undefined,
    ny: number | undefined,
    yRole: LinkGeometryRole | undefined,
    target: ClipTarget,
  ) {
    this.#ensure(3);
    this.#values[this.#length++] = command;
    this.#values[this.#length++] = finiteCoordinate(nx ?? finiteNumber(x, target.xRange));
    this.#values[this.#length++] = yRole
      ? roleCoordinate(yRole)
      : finiteCoordinate(ny ?? finiteNumber(y, target.yRange));
  }

  point(command: typeof PathCommand.moveTo | typeof PathCommand.lineTo, point: Point, target: ClipTarget) {
    this.pointValues(command, point.x, point.y, point.nx, point.ny, point.yRole, target);
  }

  cubic(segment: CubicSegment, target: ClipTarget) {
    this.#ensure(7);
    this.#values[this.#length++] = PathCommand.bezierCurveTo;
    this.#values[this.#length++] = this.#x(segment.c1, target);
    this.#values[this.#length++] = this.#y(segment.c1, target);
    this.#values[this.#length++] = this.#x(segment.c2, target);
    this.#values[this.#length++] = this.#y(segment.c2, target);
    this.#values[this.#length++] = this.#x(segment.p1, target);
    this.#values[this.#length++] = this.#y(segment.p1, target);
  }

  close() {
    this.#ensure(1);
    this.#values[this.#length++] = PathCommand.closePath;
  }

  finish(): TimescopePathCommands {
    return { values: this.#values, length: this.#length };
  }
}

function pointAt(p0: Point, p1: Point, t: Decimal): Point {
  return {
    x: p0.x.add(p1.x.sub(p0.x).mul(t)),
    y: p0.y.add(p1.y.sub(p0.y).mul(t)),
    yRole: p0.yRole && p0.yRole === p1.yRole ? p0.yRole : undefined,
  };
}

function sameY(a: Point, b: Point) {
  return a.yRole === b.yRole && a.y.eq(b.y);
}

function inside(point: Point, target: ClipTarget) {
  return (
    point.x.ge(target.xRange[0]) &&
    point.x.le(target.xRange[1]) &&
    point.y.ge(target.yRange[0]) &&
    point.y.le(target.yRange[1])
  );
}

function clipLine(p0: Point, p1: Point, target: ClipTarget): LineSegment | undefined {
  if (inside(p0, target) && inside(p1, target)) {
    return p0.x.eq(p1.x) && sameY(p0, p1) ? undefined : { kind: 'line', p0, p1 };
  }
  if (
    (p0.x.lt(target.xRange[0]) && p1.x.lt(target.xRange[0])) ||
    (p0.x.gt(target.xRange[1]) && p1.x.gt(target.xRange[1])) ||
    (p0.y.lt(target.yRange[0]) && p1.y.lt(target.yRange[0])) ||
    (p0.y.gt(target.yRange[1]) && p1.y.gt(target.yRange[1]))
  ) {
    return;
  }

  const dx = p1.x.sub(p0.x);
  const dy = p1.y.sub(p0.y);
  const precision = Math.max(
    precisionFor(dx, target.xRange[1].sub(target.xRange[0])),
    precisionFor(dy, target.yRange[1].sub(target.yRange[0])),
  );
  const cuts: { t: Decimal; x?: Decimal; y?: Decimal }[] = [{ t: ZERO }, { t: ONE }];
  const addCut = (t: Decimal, boundary: { x?: Decimal; y?: Decimal }) => {
    if (t.ge(ZERO) && t.le(ONE)) cuts.push({ t, ...boundary });
  };
  if (!dx.isZero()) {
    const bounds = dx.isPositive() ? target.xRange : [target.xRange[1], target.xRange[0]];
    for (const x of bounds) addCut(x.sub(p0.x).div(dx, precision), { x });
  }
  if (!dy.isZero()) {
    const bounds = dy.isPositive() ? target.yRange : [target.yRange[1], target.yRange[0]];
    for (const y of bounds) addCut(y.sub(p0.y).div(dy, precision), { y });
  }
  cuts.sort((a, b) => a.t.cmp(b.t));

  for (let index = 0; index < cuts.length - 1; index++) {
    const start = cuts[index];
    const end = cuts[index + 1];
    const middle = pointAt(p0, p1, start.t.add(end.t).div(TWO, precision));
    if (!inside(middle, target)) continue;
    const startPoint = pointAt(p0, p1, start.t);
    const endPoint = pointAt(p0, p1, end.t);
    if (start.x) startPoint.x = start.x;
    if (start.y) startPoint.y = start.y;
    if (end.x) endPoint.x = end.x;
    if (end.y) endPoint.y = end.y;
    startPoint.x = startPoint.x.clamp(target.xRange[0], target.xRange[1]);
    startPoint.y = startPoint.y.clamp(target.yRange[0], target.yRange[1]);
    endPoint.x = endPoint.x.clamp(target.xRange[0], target.xRange[1]);
    endPoint.y = endPoint.y.clamp(target.yRange[0], target.yRange[1]);
    if (startPoint.x.eq(endPoint.x) && startPoint.y.eq(endPoint.y)) continue;
    return { kind: 'line', p0: startPoint, p1: endPoint };
  }
}

function monotoneControls(points: readonly Point[], precision: number) {
  const h = new Array<Decimal>(points.length - 1);
  const delta = new Array<Decimal>(points.length - 1);
  for (let index = 0; index < h.length; index++) {
    h[index] = points[index + 1].x.sub(points[index].x);
    delta[index] = h[index].isZero() ? ZERO : points[index + 1].y.sub(points[index].y).div(h[index], precision);
  }
  const tangent = new Array<Decimal>(points.length);
  tangent[0] = delta[0];
  for (let index = 1; index < points.length - 1; index++) {
    const left = delta[index - 1];
    const right = delta[index];
    if (left.isZero() || right.isZero() || left.mul(right).isNegative()) {
      tangent[index] = ZERO;
      continue;
    }
    const previousWidth = h[index - 1];
    const nextWidth = h[index];
    const leftWeight = nextWidth.mul(TWO).add(previousWidth);
    const rightWeight = nextWidth.add(previousWidth.mul(TWO));
    tangent[index] = leftWeight
      .add(rightWeight)
      .div(leftWeight.div(left, precision).add(rightWeight.div(right, precision)), precision);
  }
  tangent[points.length - 1] = delta[delta.length - 1];
  return { h, tangent };
}

function cubicSegments(points: readonly Point[], target: ClipTarget) {
  const precision = targetPrecision(points, target);
  const { h, tangent } = monotoneControls(points, precision);
  return points.slice(0, -1).map((start, index): CubicSegment => {
    const end = points[index + 1];
    return {
      kind: 'cubic',
      p0: start,
      c1: {
        x: start.x.add(h[index].div(THREE, precision)),
        y: start.y.add(tangent[index].mul(h[index]).div(THREE, precision)),
        yRole: start.yRole,
      },
      c2: {
        x: end.x.sub(h[index].div(THREE, precision)),
        y: end.y.sub(tangent[index + 1].mul(h[index]).div(THREE, precision)),
        yRole: end.yRole,
      },
      p1: end,
    };
  });
}

function lerpPoint(a: Point, b: Point, t: Decimal): Point {
  return {
    x: a.x.add(b.x.sub(a.x).mul(t)),
    y: a.y.add(b.y.sub(a.y).mul(t)),
    yRole: a.yRole && a.yRole === b.yRole ? a.yRole : undefined,
  };
}

function splitCubic(segment: CubicSegment, t: Decimal): [CubicSegment, CubicSegment] {
  const p01 = lerpPoint(segment.p0, segment.c1, t);
  const p12 = lerpPoint(segment.c1, segment.c2, t);
  const p23 = lerpPoint(segment.c2, segment.p1, t);
  const p012 = lerpPoint(p01, p12, t);
  const p123 = lerpPoint(p12, p23, t);
  const middle = lerpPoint(p012, p123, t);
  return [
    { kind: 'cubic', p0: segment.p0, c1: p01, c2: p012, p1: middle },
    { kind: 'cubic', p0: middle, c1: p123, c2: p23, p1: segment.p1 },
  ];
}

function cubicSubsegment(segment: CubicSegment, start: Decimal, end: Decimal, precision: number) {
  if (start.isZero() && end.eq(ONE)) return segment;
  const left = end.eq(ONE) ? segment : splitCubic(segment, end)[0];
  return start.isZero() ? left : splitCubic(left, start.div(end, precision))[1];
}

function cubicValue(segment: CubicSegment, axis: 'x' | 'y', t: Decimal) {
  const mt = ONE.sub(t);
  return segment.p0[axis]
    .mul(mt.mul(mt).mul(mt))
    .add(segment.c1[axis].mul(THREE).mul(mt.mul(mt)).mul(t))
    .add(segment.c2[axis].mul(THREE).mul(mt).mul(t.mul(t)))
    .add(segment.p1[axis].mul(t.mul(t).mul(t)));
}

function cubicParameterAt(segment: CubicSegment, axis: 'x' | 'y', target: Decimal, precision: number) {
  if (axis === 'x') return target.sub(segment.p0.x).div(segment.p1.x.sub(segment.p0.x), precision);
  const increasing = segment.p1.y.ge(segment.p0.y);
  let low = ZERO;
  let high = ONE;
  const iterations = Math.min(16_384, Math.ceil(precision * 3.5));
  for (let iteration = 0; iteration < iterations; iteration++) {
    const middle = low.add(high).div(TWO, precision);
    if (cubicValue(segment, axis, middle).lt(target) === increasing) low = middle;
    else high = middle;
  }
  return low.add(high).div(TWO, precision);
}

function monotoneInterval(
  segment: CubicSegment,
  axis: 'x' | 'y',
  range: readonly [Decimal, Decimal],
  precision: number,
) {
  const start = segment.p0[axis];
  const end = segment.p1[axis];
  const low = start.lt(end) ? start : end;
  const high = start.gt(end) ? start : end;
  if (high.lt(range[0]) || low.gt(range[1])) return;
  if (start.eq(end)) return start.ge(range[0]) && start.le(range[1]) ? ([ZERO, ONE] as const) : undefined;
  if (start.lt(end)) {
    return [
      start.lt(range[0]) ? cubicParameterAt(segment, axis, range[0], precision) : ZERO,
      end.gt(range[1]) ? cubicParameterAt(segment, axis, range[1], precision) : ONE,
    ] as const;
  }
  return [
    start.gt(range[1]) ? cubicParameterAt(segment, axis, range[1], precision) : ZERO,
    end.lt(range[0]) ? cubicParameterAt(segment, axis, range[0], precision) : ONE,
  ] as const;
}

function clipCubic(segment: CubicSegment, target: ClipTarget) {
  const precision = targetPrecision([segment.p0, segment.p1], target);
  const x = monotoneInterval(segment, 'x', target.xRange, precision);
  const y = monotoneInterval(segment, 'y', target.yRange, precision);
  if (!x || !y) return;
  const start = x[0].gt(y[0]) ? x[0] : y[0];
  const end = x[1].lt(y[1]) ? x[1] : y[1];
  if (!start.lt(end)) return;
  return cubicSubsegment(segment, start, end, precision);
}

function samePoint(a: Point, b: Point) {
  return a.x.eq(b.x) && sameY(a, b);
}

type StoredSegmentBuffer = {
  capacity: number;
  length: number;
  kind: (0 | 1)[];
  p0: PointColumns;
  p1: PointColumns;
  c1?: PointColumns;
  c2?: PointColumns;
  runOffsets: number[];
};

type StoredRun = { buffer: StoredSegmentBuffer; start: number; end: number };

function createStoredSegmentBuffer(capacity = 0): StoredSegmentBuffer {
  return {
    capacity,
    length: 0,
    kind: new Array<0 | 1>(capacity),
    p0: createPointColumns(capacity),
    p1: createPointColumns(capacity),
    runOffsets: [0],
  };
}

function clearStoredSegmentBuffer(buffer: StoredSegmentBuffer) {
  buffer.length = 0;
  releasePointColumns(buffer.p0);
  releasePointColumns(buffer.p1);
  if (buffer.c1) releasePointColumns(buffer.c1);
  if (buffer.c2) releasePointColumns(buffer.c2);
  buffer.runOffsets.length = 1;
  buffer.runOffsets[0] = 0;
}

function storedPointEquals(columns: PointColumns, index: number, point: Point) {
  return columns.x[index].eq(point.x) && columns.yRole[index] === point.yRole && columns.y[index].eq(point.y);
}

function setPoint(columns: PointColumns, index: number, point: Point) {
  columns.x[index] = point.x;
  columns.y[index] = point.y;
  columns.nx[index] = point.nx;
  columns.ny[index] = point.ny;
  columns.yRole[index] = point.yRole;
  if (index >= columns.length) columns.length = index + 1;
}

function appendStoredSegment(buffer: StoredSegmentBuffer, segment: Segment) {
  const index = buffer.length++;
  if (index && !storedPointEquals(buffer.p1, index - 1, segment.p0)) buffer.runOffsets.push(index);
  buffer.kind[index] = segment.kind === 'line' ? 0 : 1;
  appendPoint(buffer.p0, segment.p0);
  appendPoint(buffer.p1, segment.p1);
  if (segment.kind === 'cubic') {
    setPoint((buffer.c1 ??= createPointColumns(buffer.capacity)), index, segment.c1);
    setPoint((buffer.c2 ??= createPointColumns(buffer.capacity)), index, segment.c2);
  }
}

function finishStoredSegmentBuffer(buffer: StoredSegmentBuffer) {
  if (buffer.length && buffer.runOffsets.at(-1) !== buffer.length) {
    buffer.runOffsets.push(buffer.length);
  }
}

function storedSegment(buffer: StoredSegmentBuffer, index: number): Segment {
  const p0 = pointFromColumns(buffer.p0, index);
  const p1 = pointFromColumns(buffer.p1, index);
  return buffer.kind[index] === 0
    ? { kind: 'line', p0, p1 }
    : {
        kind: 'cubic',
        p0,
        c1: pointFromColumns(buffer.c1!, index),
        c2: pointFromColumns(buffer.c2!, index),
        p1,
      };
}

function storedRun(buffer: StoredSegmentBuffer, runIndex: number): StoredRun {
  return { buffer, start: buffer.runOffsets[runIndex], end: buffer.runOffsets[runIndex + 1] };
}

function groupSegments(segments: readonly (Segment | undefined)[]) {
  const runs: SegmentRun[] = [];
  for (const segment of segments) {
    if (!segment) continue;
    const run = runs.at(-1);
    if (!run || !samePoint(run.end, segment.p0)) {
      runs.push({ segments: [segment], start: segment.p0, end: segment.p1 });
    } else {
      run.segments.push(segment);
      run.end = segment.p1;
    }
  }
  return runs;
}

function appendSegment(writer: PathCommandWriter, segment: Segment, target: ClipTarget) {
  if (segment.kind === 'line') writer.point(PathCommand.lineTo, segment.p1, target);
  else writer.cubic(segment, target);
}

function appendOpenRuns(writer: PathCommandWriter, runs: readonly SegmentRun[], target: ClipTarget) {
  for (const run of runs) {
    writer.point(PathCommand.moveTo, run.start, target);
    for (const segment of run.segments) appendSegment(writer, segment, target);
  }
}

function pointsAreCached(points: readonly Point[], target: ClipTarget) {
  for (const point of points) {
    if (point.nx == null || point.ny == null || !inside(point, target)) return false;
  }
  return true;
}

function appendCachedBoundary(
  writer: PathCommandWriter,
  points: readonly Point[],
  kind: LinkGeometryKind,
  target: ClipTarget,
) {
  if (points.length < 2 || !pointsAreCached(points, target)) return false;
  writer.point(PathCommand.moveTo, points[0], target);
  if ((kind === 'curve' || kind === 'curve-area') && points.length >= 3) {
    for (const segment of cubicSegments(points, target)) writer.cubic(segment, target);
  } else {
    for (let index = 1; index < points.length; index++) writer.point(PathCommand.lineTo, points[index], target);
  }
  return true;
}

function rangePointsAreCached(range: PointRange, target: ClipTarget) {
  const { columns, start, end } = range;
  for (let index = start; index < end; index++) {
    if (
      columns.nx[index] == null ||
      columns.ny[index] == null ||
      columns.x[index].lt(target.xRange[0]) ||
      columns.x[index].gt(target.xRange[1]) ||
      columns.y[index].lt(target.yRange[0]) ||
      columns.y[index].gt(target.yRange[1])
    ) {
      return false;
    }
  }
  return true;
}

function appendCachedRange(writer: PathCommandWriter, range: PointRange, kind: LinkGeometryKind, target: ClipTarget) {
  const length = rangeLength(range);
  if (length < 2 || !rangePointsAreCached(range, target)) return false;
  if ((kind === 'curve' || kind === 'curve-area') && length >= 3) {
    return appendCachedBoundary(writer, pointsFromRange(range), kind, target);
  }
  const { columns, start, end } = range;
  writer.pointValues(
    PathCommand.moveTo,
    columns.x[start],
    columns.y[start],
    columns.nx[start],
    columns.ny[start],
    columns.yRole[start],
    target,
  );
  for (let index = start + 1; index < end; index++) {
    writer.pointValues(
      PathCommand.lineTo,
      columns.x[index],
      columns.y[index],
      columns.nx[index],
      columns.ny[index],
      columns.yRole[index],
      target,
    );
  }
  return true;
}

function stepPosition(kind: LinkGeometryKind): 'start' | 'mid' | 'end' {
  if (kind.endsWith('-start')) return 'start';
  if (kind.endsWith('-end')) return 'end';
  return 'mid';
}

function appendClippedPointSequence(
  writer: PathCommandWriter,
  target: ClipTarget,
  emit: (visit: (point: Point) => void) => void,
) {
  let previous: Point | undefined;
  let retainedEnd: Point | undefined;
  emit((point) => {
    if (previous) {
      const segment = clipLine(previous, point, target);
      if (segment) {
        if (!retainedEnd || !samePoint(retainedEnd, segment.p0)) {
          writer.point(PathCommand.moveTo, segment.p0, target);
        }
        writer.point(PathCommand.lineTo, segment.p1, target);
        retainedEnd = segment.p1;
      }
    }
    previous = point;
  });
}

function emitBoundaryPoints(
  range: PointRange,
  kind: LinkGeometryKind,
  neighbors: { left?: Decimal; right?: Decimal },
  visit: (point: Point) => void,
) {
  if (!kind.startsWith('step')) {
    for (let index = 0; index < rangeLength(range); index++) visit(pointFromRange(range, index));
    return;
  }

  const position = stepPosition(kind);
  const first = pointFromRange(range, 0);
  const last = pointFromRange(range, rangeLength(range) - 1);
  let previous: Point | undefined;
  const emitExtended = (current: Point) => {
    if (!previous) {
      visit(current);
    } else if (sameY(previous, current)) {
      visit(current);
    } else if (position === 'start') {
      visit({ x: current.x, y: previous.y, ny: previous.ny, yRole: previous.yRole });
      visit(current);
    } else if (position === 'end') {
      visit({ x: previous.x, y: current.y, ny: current.ny, yRole: current.yRole });
      visit(current);
    } else {
      const middle = previous.x.add(current.x).div(TWO);
      visit({ x: middle, y: previous.y, ny: previous.ny, yRole: previous.yRole });
      visit({ x: middle, y: current.y, ny: current.ny, yRole: current.yRole });
      visit(current);
    }
    previous = current;
  };

  if (neighbors.left && position !== 'start') {
    const x = position === 'end' ? neighbors.left : neighbors.left.add(first.x).div(TWO);
    if (!x.eq(first.x)) emitExtended({ x, y: first.y, ny: first.ny, yRole: first.yRole });
  }
  for (let index = 0; index < rangeLength(range); index++) emitExtended(pointFromRange(range, index));
  if (neighbors.right && position !== 'end') {
    const x = position === 'start' ? neighbors.right : last.x.add(neighbors.right).div(TWO);
    if (!x.eq(last.x)) emitExtended({ x, y: last.y, ny: last.ny, yRole: last.yRole });
  }
}

function appendLinearRange(
  writer: PathCommandWriter,
  range: PointRange,
  kind: LinkGeometryKind,
  target: ClipTarget,
  neighbors: { left?: Decimal; right?: Decimal },
) {
  if (rangeLength(range) < 2) return;
  appendClippedPointSequence(writer, target, (visit) => emitBoundaryPoints(range, kind, neighbors, visit));
}

function lineRuns(points: readonly Point[], target: ClipTarget) {
  return groupSegments(points.slice(0, -1).map((point, index) => clipLine(point, points[index + 1], target)));
}

function curveRuns(points: readonly Point[], target: ClipTarget) {
  if (points.length < 3) return lineRuns(points, target);
  if (
    points.every((point) => point.x.lt(target.xRange[0])) ||
    points.every((point) => point.x.gt(target.xRange[1])) ||
    points.every((point) => point.y.lt(target.yRange[0])) ||
    points.every((point) => point.y.gt(target.yRange[1]))
  ) {
    return [];
  }
  return groupSegments(cubicSegments(points, target).map((segment) => clipCubic(segment, target)));
}

function segmentValue(segment: Segment, axis: 'x' | 'y', t: Decimal) {
  return segment.kind === 'cubic'
    ? cubicValue(segment, axis, t)
    : segment.p0[axis].add(segment.p1[axis].sub(segment.p0[axis]).mul(t));
}

function segmentSubsegment(segment: Segment, start: Decimal, end: Decimal, precision: number): Segment {
  if (segment.kind === 'cubic') return cubicSubsegment(segment, start, end, precision);
  return { kind: 'line', p0: pointAt(segment.p0, segment.p1, start), p1: pointAt(segment.p0, segment.p1, end) };
}

function segmentParameterAtY(segment: Segment, target: Decimal, precision: number) {
  if (segment.kind === 'cubic') return cubicParameterAt(segment, 'y', target, precision);
  return target.sub(segment.p0.y).div(segment.p1.y.sub(segment.p0.y), precision);
}

function forEachClampedSegmentY(
  segment: Segment,
  range: readonly [Decimal, Decimal],
  precision: number,
  emit: (segment: Segment) => void,
) {
  if (
    segment.p0.y.ge(range[0]) &&
    segment.p0.y.le(range[1]) &&
    segment.p1.y.ge(range[0]) &&
    segment.p1.y.le(range[1])
  ) {
    emit(segment);
    return;
  }
  const cuts = [ZERO, ONE];
  const low = segment.p0.y.lt(segment.p1.y) ? segment.p0.y : segment.p1.y;
  const high = segment.p0.y.gt(segment.p1.y) ? segment.p0.y : segment.p1.y;
  if (low.lt(range[0]) && high.gt(range[0])) cuts.push(segmentParameterAtY(segment, range[0], precision));
  if (low.lt(range[1]) && high.gt(range[1])) cuts.push(segmentParameterAtY(segment, range[1], precision));
  cuts.sort((a, b) => a.cmp(b));
  for (let index = 0; index < cuts.length - 1; index++) {
    const start = cuts[index];
    const end = cuts[index + 1];
    if (!start.lt(end)) continue;
    const clipped = segmentSubsegment(segment, start, end, precision);
    const middleY = segmentValue(segment, 'y', start.add(end).div(TWO, precision));
    if (middleY.lt(range[0]) || middleY.gt(range[1])) {
      const y = middleY.lt(range[0]) ? range[0] : range[1];
      emit({ kind: 'line', p0: { x: clipped.p0.x, y }, p1: { x: clipped.p1.x, y } });
    } else {
      clipped.p0.y = clipped.p0.y.clamp(range[0], range[1]);
      clipped.p1.y = clipped.p1.y.clamp(range[0], range[1]);
      emit(clipped);
    }
  }
}

function trimSegmentX(segment: Segment, range: readonly [Decimal, Decimal], precision: number): Segment | undefined {
  if (
    segment.p0.x.ge(range[0]) &&
    segment.p0.x.le(range[1]) &&
    segment.p1.x.ge(range[0]) &&
    segment.p1.x.le(range[1])
  ) {
    return segment;
  }
  if (segment.kind === 'cubic') {
    const interval = monotoneInterval(segment, 'x', range, precision);
    if (!interval || !interval[0].lt(interval[1])) return;
    return cubicSubsegment(segment, interval[0], interval[1], precision);
  }
  const dx = segment.p1.x.sub(segment.p0.x);
  if (dx.isZero()) return segment.p0.x.ge(range[0]) && segment.p0.x.le(range[1]) ? segment : undefined;
  const first = range[0].sub(segment.p0.x).div(dx, precision);
  const second = range[1].sub(segment.p0.x).div(dx, precision);
  const start = first.lt(second) ? first.clamp(ZERO, ONE) : second.clamp(ZERO, ONE);
  const end = first.gt(second) ? first.clamp(ZERO, ONE) : second.clamp(ZERO, ONE);
  if (!start.lt(end)) return;
  const clipped = segmentSubsegment(segment, start, end, precision) as LineSegment;
  if (start.gt(ZERO)) clipped.p0.x = dx.isPositive() ? range[0] : range[1];
  if (end.lt(ONE)) clipped.p1.x = dx.isPositive() ? range[1] : range[0];
  return clipped;
}

function targetPrecisionRange(points: PointRange, target: ClipTarget) {
  let xSpan = ZERO;
  let ySpan = ZERO;
  const { columns, start, end } = points;
  for (let index = start + 1; index < end; index++) {
    const dx = columns.x[index].sub(columns.x[index - 1]).abs();
    const dy = columns.y[index].sub(columns.y[index - 1]).abs();
    if (dx.gt(xSpan)) xSpan = dx;
    if (dy.gt(ySpan)) ySpan = dy;
  }
  return Math.max(
    precisionFor(xSpan, target.xRange[1].sub(target.xRange[0])),
    precisionFor(ySpan, target.yRange[1].sub(target.yRange[0])),
  );
}

function areaBoundaryBuffer(
  points: PointRange,
  kind: LinkGeometryKind,
  target: ClipTarget,
  neighbors: { left?: Decimal; right?: Decimal } = {},
) {
  let output = createStoredSegmentBuffer();
  if (rangeLength(points) < 2) return output;
  let allBefore = true;
  let allAfter = true;
  for (let index = points.start; index < points.end; index++) {
    if (!points.columns.x[index].lt(target.xRange[0])) allBefore = false;
    if (!points.columns.x[index].gt(target.xRange[1])) allAfter = false;
  }
  if (allBefore || allAfter) return output;

  let source = points;
  let expanded: PointColumns | undefined;
  if (kind.startsWith('step')) {
    expanded = createPointColumns(rangeLength(points) * 3 + 2);
    emitBoundaryPoints(points, kind, neighbors, (point) => appendPoint(expanded!, point));
    source = { columns: expanded, start: 0, end: expanded.length };
  }
  output = createStoredSegmentBuffer(Math.max(0, rangeLength(source) - 1));
  const precision = targetPrecisionRange(source, target);
  const processSegment = (segment: Segment) => {
    const clipped = trimSegmentX(segment, target.xRange, precision);
    if (!clipped) return;
    forEachClampedSegmentY(clipped, target.yRange, precision, (part) => appendStoredSegment(output, part));
  };

  if (kind === 'curve-area' && rangeLength(source) >= 3) {
    for (const segment of cubicSegments(pointsFromRange(source), target)) processSegment(segment);
  } else {
    let previous = pointFromRange(source, 0);
    for (let index = 1; index < rangeLength(source); index++) {
      const current = pointFromRange(source, index);
      processSegment({ kind: 'line', p0: previous, p1: current });
      previous = current;
    }
  }
  finishStoredSegmentBuffer(output);
  return output;
}

function trimStoredRunX(
  run: StoredRun,
  range: readonly [Decimal, Decimal],
  precision: number,
  output: StoredSegmentBuffer,
) {
  clearStoredSegmentBuffer(output);
  for (let index = run.start; index < run.end; index++) {
    const segment = trimSegmentX(storedSegment(run.buffer, index), range, precision);
    if (segment) appendStoredSegment(output, segment);
  }
  finishStoredSegmentBuffer(output);
  return output.runOffsets.length > 1 ? storedRun(output, 0) : undefined;
}

function flatStoredRunPoint(run: StoredRun) {
  const start = pointFromColumns(run.buffer.p0, run.start);
  for (let index = run.start; index < run.end; index++) {
    if (
      run.buffer.kind[index] !== 0 ||
      !sameY(pointFromColumns(run.buffer.p0, index), start) ||
      !sameY(pointFromColumns(run.buffer.p1, index), start)
    ) {
      return;
    }
  }
  return start;
}

function writeStoredPoint(
  writer: PathCommandWriter,
  command: typeof PathCommand.moveTo | typeof PathCommand.lineTo,
  columns: PointColumns,
  index: number,
  target: ClipTarget,
) {
  writer.pointValues(
    command,
    columns.x[index],
    columns.y[index],
    columns.nx[index],
    columns.ny[index],
    columns.yRole[index],
    target,
  );
}

function appendStoredPathSegment(
  writer: PathCommandWriter,
  buffer: StoredSegmentBuffer,
  index: number,
  target: ClipTarget,
) {
  if (buffer.kind[index] === 0) writeStoredPoint(writer, PathCommand.lineTo, buffer.p1, index, target);
  else writer.cubic(storedSegment(buffer, index) as CubicSegment, target);
}

function appendAreaBuffers(
  writer: PathCommandWriter,
  topBuffer: StoredSegmentBuffer,
  bottomBuffer: StoredSegmentBuffer,
  target: ClipTarget,
) {
  const topScratch = createStoredSegmentBuffer(topBuffer.length);
  const bottomScratch = createStoredSegmentBuffer(bottomBuffer.length);
  for (let topRunIndex = 0; topRunIndex < topBuffer.runOffsets.length - 1; topRunIndex++) {
    const originalTop = storedRun(topBuffer, topRunIndex);
    const topStartPoint = pointFromColumns(topBuffer.p0, originalTop.start);
    const topEndPoint = pointFromColumns(topBuffer.p1, originalTop.end - 1);
    const topStart = topStartPoint.x.lt(topEndPoint.x) ? topStartPoint.x : topEndPoint.x;
    const topEnd = topStartPoint.x.gt(topEndPoint.x) ? topStartPoint.x : topEndPoint.x;
    for (let bottomRunIndex = 0; bottomRunIndex < bottomBuffer.runOffsets.length - 1; bottomRunIndex++) {
      const originalBottom = storedRun(bottomBuffer, bottomRunIndex);
      const bottomStartPoint = pointFromColumns(bottomBuffer.p0, originalBottom.start);
      const bottomEndPoint = pointFromColumns(bottomBuffer.p1, originalBottom.end - 1);
      const bottomStart = bottomStartPoint.x.lt(bottomEndPoint.x) ? bottomStartPoint.x : bottomEndPoint.x;
      const bottomEnd = bottomStartPoint.x.gt(bottomEndPoint.x) ? bottomStartPoint.x : bottomEndPoint.x;
      const start = topStart.gt(bottomStart) ? topStart : bottomStart;
      const end = topEnd.lt(bottomEnd) ? topEnd : bottomEnd;
      if (!start.lt(end)) continue;
      const precision = Math.max(
        precisionFor(topEnd.sub(topStart), end.sub(start)),
        precisionFor(bottomEnd.sub(bottomStart), end.sub(start)),
      );
      const range = [start, end] as const;
      const top =
        start.eq(topStart) && end.eq(topEnd) ? originalTop : trimStoredRunX(originalTop, range, precision, topScratch);
      const bottom =
        start.eq(bottomStart) && end.eq(bottomEnd)
          ? originalBottom
          : trimStoredRunX(originalBottom, range, precision, bottomScratch);
      if (!top || !bottom) continue;
      const topPoint = flatStoredRunPoint(top);
      const bottomPoint = flatStoredRunPoint(bottom);
      if (topPoint && bottomPoint && sameY(topPoint, bottomPoint)) continue;

      writeStoredPoint(writer, PathCommand.moveTo, top.buffer.p0, top.start, target);
      for (let index = top.start; index < top.end; index++) {
        appendStoredPathSegment(writer, top.buffer, index, target);
      }
      writeStoredPoint(writer, PathCommand.lineTo, bottom.buffer.p1, bottom.end - 1, target);
      for (let index = bottom.end - 1; index >= bottom.start; index--) {
        if (bottom.buffer.kind[index] === 0) {
          writeStoredPoint(writer, PathCommand.lineTo, bottom.buffer.p0, index, target);
        } else {
          writer.cubic(
            {
              kind: 'cubic',
              p0: pointFromColumns(bottom.buffer.p1, index),
              c1: pointFromColumns(bottom.buffer.c2!, index),
              c2: pointFromColumns(bottom.buffer.c1!, index),
              p1: pointFromColumns(bottom.buffer.p0, index),
            },
            target,
          );
        }
      }
      writer.close();
    }
  }
}

function compilePointRun(
  writer: PathCommandWriter,
  range: PointRange,
  kind: LinkGeometryKind,
  target: ClipTarget,
  neighbors: { left?: Decimal; right?: Decimal },
) {
  if ((kind === 'line' || kind === 'curve') && appendCachedRange(writer, range, kind, target)) return;
  if (kind === 'curve') {
    appendOpenRuns(writer, curveRuns(pointsFromRange(range), target), target);
  } else {
    appendLinearRange(writer, range, kind, target, neighbors);
  }
}

function compileAreaRun(
  writer: PathCommandWriter,
  top: PointRange,
  bottom: PointRange,
  kind: LinkGeometryKind,
  target: ClipTarget,
  neighbors: { leftTop?: Decimal; leftBottom?: Decimal; rightTop?: Decimal; rightBottom?: Decimal },
) {
  const length = rangeLength(top);
  if (length < 2) return;
  let aligned = true;
  for (let index = 0; index < length; index++) {
    if (!top.columns.x[top.start + index].eq(bottom.columns.x[bottom.start + index])) {
      aligned = false;
      break;
    }
  }
  const cachedTop = rangePointsAreCached(top, target);
  const cachedBottom = rangePointsAreCached(bottom, target);
  if (
    aligned &&
    cachedTop &&
    cachedBottom &&
    !neighbors.leftTop &&
    !neighbors.leftBottom &&
    !neighbors.rightTop &&
    !neighbors.rightBottom &&
    (kind === 'area' || kind === 'curve-area')
  ) {
    const first = top.start;
    writer.pointValues(
      PathCommand.moveTo,
      top.columns.x[first],
      top.columns.y[first],
      top.columns.nx[first],
      top.columns.ny[first],
      top.columns.yRole[first],
      target,
    );
    if (kind === 'curve-area' && length >= 3) {
      for (const segment of cubicSegments(pointsFromRange(top), target)) writer.cubic(segment, target);
    } else {
      for (let index = top.start + 1; index < top.end; index++) {
        writer.pointValues(
          PathCommand.lineTo,
          top.columns.x[index],
          top.columns.y[index],
          top.columns.nx[index],
          top.columns.ny[index],
          top.columns.yRole[index],
          target,
        );
      }
    }
    for (let index = bottom.end - 1; index >= bottom.start; index--) {
      writer.pointValues(
        PathCommand.lineTo,
        bottom.columns.x[index],
        bottom.columns.y[index],
        bottom.columns.nx[index],
        bottom.columns.ny[index],
        bottom.columns.yRole[index],
        target,
      );
    }
    writer.close();
    return;
  }
  const topRuns = areaBoundaryBuffer(top, kind, target, {
    left: neighbors.leftTop,
    right: neighbors.rightTop,
  });
  const bottomRuns = areaBoundaryBuffer(bottom, kind === 'curve-area' ? 'area' : kind, target, {
    left: neighbors.leftBottom,
    right: neighbors.rightBottom,
  });
  appendAreaBuffers(writer, topRuns, bottomRuns, target);
}

export function compileLinkGeometry(options: {
  source: LinkGeometrySource;
  kind: LinkGeometryKind;
  using: Using;
  target: { xRange: readonly [Decimal, Decimal]; yRange?: readonly [Decimal, Decimal] };
}) {
  const { source, kind, using } = options;
  const yRange = options.target.yRange ?? DEFAULT_Y_RANGE;
  if (!options.target.xRange[0].lt(options.target.xRange[1])) throw new RangeError('Invalid link geometry X range');
  if (yRange[0].gt(yRange[1])) throw new RangeError('Invalid link geometry Y range');
  const target: ClipTarget = { xRange: options.target.xRange, yRange };
  if (![...target.xRange, ...target.yRange].every((value) => Number.isFinite(value.number()))) {
    throw new RangeError('Link geometry clipping range must be finite');
  }

  const [[topKey, topTime], [bottomKey, bottomTime]] = parseUsing(using);
  const area = kind.includes('area');
  const writer = new PathCommandWriter(source.length * (area ? 8 : kind === 'curve' ? 7 : 4));
  const points = area ? undefined : createPointColumns(source.length);
  const topPoints = area ? createPointColumns(source.length) : undefined;
  const bottomPoints = area ? createPointColumns(source.length) : undefined;
  let previousX: Decimal | undefined;
  let pointRunLeft: Decimal | undefined;
  let previousAreaTopX: Decimal | undefined;
  let previousAreaBottomX: Decimal | undefined;
  let areaRunLeftTopX: Decimal | undefined;
  let areaRunLeftBottomX: Decimal | undefined;
  const flush = (nextX?: Decimal, nextAreaTopX?: Decimal, nextAreaBottomX?: Decimal) => {
    if (area) {
      compileAreaRun(
        writer,
        { columns: topPoints!, start: 0, end: topPoints!.length },
        { columns: bottomPoints!, start: 0, end: bottomPoints!.length },
        kind,
        target,
        {
          leftTop: areaRunLeftTopX,
          leftBottom: areaRunLeftBottomX,
          rightTop: nextAreaTopX,
          rightBottom: nextAreaBottomX,
        },
      );
    } else {
      compilePointRun(writer, { columns: points!, start: 0, end: points!.length }, kind, target, {
        left: pointRunLeft,
        right: nextX,
      });
    }
    if (points) clearPointColumns(points);
    if (topPoints) clearPointColumns(topPoints);
    if (bottomPoints) clearPointColumns(bottomPoints);
    pointRunLeft = undefined;
    areaRunLeftTopX = undefined;
    areaRunLeftBottomX = undefined;
  };

  for (let index = 0; index < source.length; index++) {
    const topXCoordinate = source.x(index, topTime);
    const topYCoordinate = source.y(index, topKey);
    const topX = coordinateValue(topXCoordinate);
    const topY = coordinateValue(topYCoordinate);
    if (area) {
      const bottomXCoordinate = source.x(index, bottomTime);
      const bottomYCoordinate = source.y(index, bottomKey);
      const bottomX = coordinateValue(bottomXCoordinate);
      const bottomY = coordinateValue(bottomYCoordinate);
      if (!topX || !bottomX || !topY || !bottomY) {
        flush(topX, topX && bottomX ? topX : undefined, topX && bottomX ? bottomX : undefined);
        previousX = topX;
        previousAreaTopX = topX && bottomX ? topX : undefined;
        previousAreaBottomX = topX && bottomX ? bottomX : undefined;
        continue;
      }
      if (!topPoints!.length) {
        areaRunLeftTopX = previousAreaTopX;
        areaRunLeftBottomX = previousAreaBottomX;
      }
      appendCoordinatePoint(topPoints!, topXCoordinate, topYCoordinate, topX, topY);
      appendCoordinatePoint(bottomPoints!, bottomXCoordinate, bottomYCoordinate, bottomX, bottomY);
      previousAreaTopX = topX;
      previousAreaBottomX = bottomX;
    } else if (topX && topY) {
      if (!points!.length) pointRunLeft = previousX;
      appendCoordinatePoint(points!, topXCoordinate, topYCoordinate, topX, topY);
    } else {
      flush(topX);
    }
    previousX = topX;
  }
  flush();
  return writer.finish();
}
