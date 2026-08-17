import { PathCommand, type TimescopePathCommands } from '#src/core/path';
import {
  createCompiledLinkPath,
  createFillStyle,
  createMarkFillStyle,
  createUnitPathMarks,
  groupMarkPointsByLayer,
} from '#src/worker/renderer/TimescopeSeriesChartRenderer';
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

describe('series mark geometry', () => {
  it('decodes binary cubic paths while applying matrices', () => {
    vi.stubGlobal('Path2D', MockPath2D);
    const commands = pathCommands([PathCommand.moveTo, 0, 0, PathCommand.bezierCurveTo, 1, 1, 2, 1, 3, 0]);
    const first = createCompiledLinkPath(commands, 1, -100, 200, 10, 0, 20);
    const firstPath = first.path;
    const second = createCompiledLinkPath(commands, 2, -80, 160, 10, 0, 20, first);
    const cached = createCompiledLinkPath(commands, 2, -80, 160, 10, 0, 20, second);

    expect(MockPath2D.instances).toHaveLength(2);
    expect((firstPath as unknown as MockPath2D).commands).toEqual([
      ['moveTo', 0, 200],
      ['bezierCurveTo', 1, 100, 2, 100, 3, 200],
    ]);
    expect(second).toBe(first);
    expect(cached).toBe(second);
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

  it('rejects a positive link Y scale', () => {
    vi.stubGlobal('Path2D', MockPath2D);
    const commands = pathCommands([PathCommand.moveTo, 0, 0]);

    expect(() => createCompiledLinkPath(commands, 1, 1, 0, 0, 0, 100)).toThrow(
      'Link path Y scale must not be positive',
    );
  });

  it('rejects invalid link command streams and transforms', () => {
    vi.stubGlobal('Path2D', MockPath2D);
    const truncated = pathCommands([PathCommand.lineTo, 1]);
    const unknown = pathCommands([99, 1, 2]);
    const invalidLength = { ...pathCommands([]), length: 1 };

    expect(() => createCompiledLinkPath(truncated, 1, -1, 0, 0, 0, 100)).toThrow('Truncated link path command');
    expect(() => createCompiledLinkPath(unknown, 1, -1, 0, 0, 0, 100)).toThrow('Unknown link path command: 99');
    expect(() => createCompiledLinkPath(invalidLength, 1, -1, 0, 0, 0, 100)).toThrow(
      'Invalid link path command length',
    );
    expect(() => createCompiledLinkPath(pathCommands([]), 1, -Infinity, 0, 0, 0, 100)).toThrow(
      'Link path transform must be finite',
    );
  });

  it('flattens mark color alpha against the background before applying fill opacity', () => {
    expect(createMarkFillStyle({ color: 'rgba(255, 0, 0, 0.5)' }, '#fff')).toBe('rgba(255, 223, 223, 1)');
    expect(createMarkFillStyle({ color: '#f00' }, '#fff')).toBe('rgba(255, 191, 191, 1)');
    expect(createMarkFillStyle({ color: '#f00', fillColor: 'rgba(255, 0, 0, 0.5)' }, '#fff')).toBe(
      'rgba(255, 128, 128, 1)',
    );
    expect(createMarkFillStyle({ color: '#00f', fillColor: '#0008', fillOpacity: 0.4 }, '#fff')).toBe(
      'rgba(119, 119, 119, 0.4)',
    );
  });

  it('keeps the existing link fill opacity behavior', () => {
    expect(createFillStyle({ color: 'rgba(255, 0, 0, 0.5)' })).toBe('rgba(255, 0, 0, 0.125)');
  });

  it('reuses one unit path and does not allocate DOMMatrix objects per point', () => {
    const DOMMatrixMock = vi.fn();
    vi.stubGlobal('Path2D', MockPath2D);
    vi.stubGlobal('DOMMatrix', DOMMatrixMock);

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

    const first = createMarks([point, point], style);
    const second = createMarks([point], style);

    expect(MockPath2D.instances).toHaveLength(3);
    expect(DOMMatrixMock).not.toHaveBeenCalled();
    expect(first.strokePath).toBe(first.fillPath);
    expect(second.strokePath).toBe(second.fillPath);

    const template = MockPath2D.instances[0];
    expect(template.commands).toEqual([
      ['moveTo', 0, 0],
      ['lineTo', 1, 0],
    ]);
    expect(MockPath2D.instances[1].additions.map(({ path }) => path)).toEqual([template, template]);
    expect(MockPath2D.instances[2].additions[0].path).toBe(template);
    expect(MockPath2D.instances[1].additions[0].transform).toEqual({
      a: expect.closeTo(3),
      b: expect.closeTo(4),
      c: expect.closeTo(-1.6),
      d: expect.closeTo(1.2),
      e: expect.closeTo(8.8),
      f: expect.closeTo(23.4),
    });
  });

  it('batches equal resolved marks while preserving declaration layer order', () => {
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
    expect([...layers[0].values()].map(({ mark, points }) => [mark.draw, points])).toEqual([['line', points]]);
    expect(
      [...layers[1].values()].map(({ mark, points }) => [
        mark.draw === 'circle' ? (mark.style as { size?: number })?.size : null,
        points,
      ]),
    ).toEqual([
      [3, [points[0], points[2]]],
      [5, [points[1]]],
    ]);
  });
});
