import { PathCommand, type TimescopePathCommands } from '#src/core/path';
import {
  createCompiledLinkPath,
  createUnitPathMarks,
  groupMarkPointsByLayer,
} from '#src/renderer/layers/TimescopeSeriesChartLayer';
import { afterEach, describe, expect, it, vi } from 'vitest';

type MatrixSnapshot = Pick<DOMMatrix2DInit, 'a' | 'b' | 'c' | 'd' | 'e' | 'f'>;

class MockPath2D {
  static instances: MockPath2D[] = [];

  readonly additions: { path: MockPath2D; transform: MatrixSnapshot }[] = [];
  readonly commands: unknown[][] = [];

  constructor() {
    MockPath2D.instances.push(this);
  }

  moveTo(...args: number[]) {
    this.commands.push(['moveTo', ...args]);
  }

  lineTo(...args: number[]) {
    this.commands.push(['lineTo', ...args]);
  }

  bezierCurveTo(...args: number[]) {
    this.commands.push(['bezierCurveTo', ...args]);
  }

  closePath() {
    this.commands.push(['closePath']);
  }

  addPath(path: MockPath2D, transform: DOMMatrix2DInit = {}) {
    const { a, b, c, d, e, f } = transform;
    this.additions.push({ path, transform: { a, b, c, d, e, f } });
  }
}

function pathCommands(values: number[]): TimescopePathCommands {
  return { values: new Float64Array(values), length: values.length };
}

afterEach(() => {
  vi.unstubAllGlobals();
  MockPath2D.instances = [];
});

describe('mark and path rendering', () => {
  it('transforms cubic endpoints and control points', () => {
    vi.stubGlobal('Path2D', MockPath2D);
    const commands = pathCommands([PathCommand.moveTo, 0, 0, PathCommand.bezierCurveTo, 1, 1, 2, 1, 3, 0]);
    const first = createCompiledLinkPath(commands, 1, -100, 200, 10, 0, 20);
    const firstPath = first.path;
    const second = createCompiledLinkPath(commands, 2, -80, 160, 10, 0, 20, first);
    expect((firstPath as unknown as MockPath2D).commands).toEqual([
      ['moveTo', 0, 200],
      ['bezierCurveTo', 1, 100, 2, 100, 3, 200],
    ]);
    expect((second.path as unknown as MockPath2D).commands).toEqual([
      ['moveTo', 0, 160],
      ['bezierCurveTo', 2, 80, 4, 80, 6, 160],
    ]);
  });

  it('resolves special Y coordinates against the shared track axes', () => {
    vi.stubGlobal('Path2D', MockPath2D);
    const commands = pathCommands([
      PathCommand.moveTo,
      0,
      NaN,
      PathCommand.lineTo,
      1,
      Infinity,
      PathCommand.lineTo,
      2,
      -Infinity,
      PathCommand.closePath,
    ]);
    const compiled = createCompiledLinkPath(commands, 2, -100, 160, 80, 4, 156);

    expect((compiled.path as unknown as MockPath2D).commands).toEqual([
      ['moveTo', 0, 80],
      ['lineTo', 2, 4],
      ['lineTo', 4, 156],
      ['closePath'],
    ]);
  });

  it('preserves special Y roles when the projection scale is zero', () => {
    vi.stubGlobal('Path2D', MockPath2D);
    const commands = pathCommands([
      PathCommand.moveTo,
      0,
      2,
      PathCommand.lineTo,
      1,
      NaN,
      PathCommand.lineTo,
      2,
      Infinity,
      PathCommand.lineTo,
      3,
      -Infinity,
    ]);
    const compiled = createCompiledLinkPath(commands, 2, 0, 42, 80, 4, 156);

    expect((compiled.path as unknown as MockPath2D).commands).toEqual([
      ['moveTo', 0, 42],
      ['lineTo', 2, 80],
      ['lineTo', 4, 4],
      ['lineTo', 6, 156],
    ]);
  });

  it('rejects invalid link command streams and transforms', () => {
    vi.stubGlobal('Path2D', MockPath2D);
    const truncated = pathCommands([PathCommand.lineTo, 1]);
    const unknown = pathCommands([99, 1, 2]);
    const invalidLength = { ...pathCommands([]), length: 1 };

    expect(() => createCompiledLinkPath(truncated, 1, -1, 0, 0, 0, 100)).toThrow(RangeError);
    expect(() => createCompiledLinkPath(unknown, 1, -1, 0, 0, 0, 100)).toThrow(RangeError);
    expect(() => createCompiledLinkPath(invalidLength, 1, -1, 0, 0, 0, 100)).toThrow(RangeError);
    expect(() => createCompiledLinkPath(pathCommands([]), 1, -Infinity, 0, 0, 0, 100)).toThrow(RangeError);
  });

  it('positions and rotates a mark using its endpoints and style offset', () => {
    vi.stubGlobal('Path2D', MockPath2D);

    const createMarks = createUnitPathMarks(
      (path) => {
        path.moveTo(0, 0);
        path.lineTo(1, 0);
      },
      (_style, _dx, _dy, length, scale) => {
        scale.x = length;
        scale.y = 2;
      },
    );
    const point = { x1: 10, y1: 20, x2: 13, y2: 24 };
    const style = { color: 'black', offset: [2, 3] as [number, number] };

    const result = createMarks([point], style);
    const path = result.strokePath as unknown as MockPath2D;
    expect(path.additions[0].transform).toEqual({
      a: expect.closeTo(3),
      b: expect.closeTo(4),
      c: expect.closeTo(-1.6),
      d: expect.closeTo(1.2),
      e: expect.closeTo(8.8),
      f: expect.closeTo(23.4),
    });
  });

  it('preserves declaration layers and per-point styles when grouping marks', () => {
    const points = [
      { x1: 1, y1: 2, x2: 1, y2: 2 },
      { x1: 3, y1: 4, x2: 3, y2: 4 },
      { x1: 5, y1: 6, x2: 5, y2: 6 },
    ];
    const marks = [
      [
        {
          draw: 'line' as const,
          style: { lineWidth: 1, lineColor: 'red' },
          point: points[0],
        },
        { draw: 'circle' as const, style: { size: 3 }, point: points[0] },
      ],
      [
        {
          draw: 'line' as const,
          style: { lineColor: 'red', lineWidth: 1 },
          point: points[1],
        },
        { draw: 'circle' as const, style: { size: 5 }, point: points[1] },
      ],
      [
        {
          draw: 'line' as const,
          style: { lineWidth: 1, lineColor: 'red' },
          point: points[2],
        },
        { draw: 'circle' as const, style: { size: 3 }, point: points[2] },
      ],
    ];

    const layers = groupMarkPointsByLayer(marks);

    expect(layers).toHaveLength(2);
    for (const [index, draw] of ['line', 'circle'].entries()) {
      const entries = [...layers[index].values()].flatMap(({ mark, points }) =>
        points.map((point) => ({ draw: mark.draw, style: mark.style, point })),
      );
      expect(entries.map((entry) => entry.draw)).toEqual([draw, draw, draw]);
      expect(entries.toSorted((a, b) => a.point.x1 - b.point.x1)).toEqual(marks.map((row) => row[index]));
    }
  });
});
