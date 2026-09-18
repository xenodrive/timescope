import { Decimal } from '#src/core/decimal';
import { PathCommand, type TimescopePathCommands } from '#src/core/path';
import {
  compileLinkGeometry as compileSourceCommands,
  type LinkGeometryCoordinate,
  type LinkGeometryKind,
} from '#src/main/layers/LinkGeometry';
import { describe, expect, it } from 'vitest';
import { yAtX } from '../helpers/geometry';

type TestRow = {
  x: Record<string, LinkGeometryCoordinate | null | undefined>;
  y: Record<string, LinkGeometryCoordinate | null | undefined>;
};

function row(x: number, y: number | null, bottom = 0): TestRow {
  return {
    x: { time: Decimal(x) },
    y: { value: y == null ? null : Decimal(y), '#zero': Decimal(bottom) },
  };
}

function compile(rows: TestRow[], kind: LinkGeometryKind = 'line') {
  return compileLinkGeometry({
    rows,
    kind,
    using: kind.includes('area') ? ['value@time', '#zero@time'] : 'value@time',
    target: { xRange: [Decimal(-100), Decimal(100)] },
  });
}

function expectPathClose(actual: string, expected: string) {
  const tokens = (path: string) => path.match(/[MLCZ]|-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/g) ?? [];
  const actualTokens = tokens(actual);
  const expectedTokens = tokens(expected);
  expect(actualTokens).toHaveLength(expectedTokens.length);
  for (let index = 0; index < expectedTokens.length; index++) {
    const expectedToken = expectedTokens[index];
    if (/^[MLCZ]$/.test(expectedToken)) {
      expect(actualTokens[index]).toBe(expectedToken);
    } else {
      expect(Number(actualTokens[index])).toBeCloseTo(Number(expectedToken), 12);
    }
  }
}

function firstCubic(path: string) {
  const values = path.match(/-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/gi)?.map(Number) ?? [];
  return {
    p0: { x: values[0], y: values[1] },
    c1: { x: values[2], y: values[3] },
    c2: { x: values[4], y: values[5] },
    p1: { x: values[6], y: values[7] },
  };
}

describe('link geometry', () => {
  it('preserves curve tangents when the X and Y spans have very different magnitudes', () => {
    const rows = [0, 1, 2].map((i) => ({ x: { time: Decimal('1e60').mul(i) }, y: { value: Decimal(i) } }));
    const path = compileLinkGeometry({
      rows,
      kind: 'curve',
      using: 'value@time',
      target: { xRange: [Decimal(0), Decimal('2e60')] },
    });
    const segment = firstCubic(path);
    expect(segment.c1.y).toBeCloseTo(1 / 3, 12);
    expect(segment.c2.y).toBeCloseTo(2 / 3, 12);
    expect(segment.p1.y).toBe(1);
  });

  it('emits vector line commands and splits null runs', () => {
    expect(compile([row(0, 1), row(1, 2), row(2, null), row(3, 4), row(4, 5)])).toBe('M0 1 L1 2 M3 4 L4 5');
  });

  it('interpolates curve samples monotonically between extrema', () => {
    const commands = compileCommands({
      rows: [row(0, 0), row(2, 2), row(4, 0)],
      kind: 'curve',
      using: 'value@time',
      target: { xRange: [Decimal(0), Decimal(4)] },
    });
    expect(yAtX(commands, 0)).toBeCloseTo(0, 12);
    expect(yAtX(commands, 2)).toBeCloseTo(2, 12);
    expect(yAtX(commands, 4)).toBeCloseTo(0, 12);
    for (const x of [0.5, 1, 1.5, 2]) {
      expect(yAtX(commands, x)).toBeGreaterThan(yAtX(commands, x - 0.5));
      expect(yAtX(commands, x + 2)).toBeLessThan(yAtX(commands, x + 1.5));
    }
  });

  it('keeps clipped curve segments stable with neighboring context on each side', () => {
    const rows = [1e100, 0, 100, 101, 102, 103, 104, 204, 205, -1e100].map((y, x) => row(x, y));
    const target = { xRange: [Decimal(3), Decimal(6)] as const };
    const full = compileCommands({ rows, kind: 'curve', using: 'value@time', target });
    const contextual = compileCommands({ rows: rows.slice(2, 8), kind: 'curve', using: 'value@time', target });
    const insufficient = compileCommands({ rows: rows.slice(3, 7), kind: 'curve', using: 'value@time', target });

    for (const x of [3, 3.25, 3.5, 4, 4.5, 5, 5.5, 5.75, 6]) {
      expect(yAtX(contextual, x)).toBeCloseTo(yAtX(full, x), 12);
    }
    expect(yAtX(insufficient, 5.5)).not.toBeCloseTo(yAtX(full, 5.5), 12);
  });

  it('does not let a point beyond the right halo alter the visible segment', () => {
    const rows = [0.2, 0.45, 0.6, 0.4].map((y, x) => row(x, y));
    const target = { xRange: [Decimal(0), Decimal(0.75)] as const };
    const withHalo = compileCommands({ rows: rows.slice(0, 3), kind: 'curve', using: 'value@time', target });
    const withDistantPoint = compileCommands({ rows, kind: 'curve', using: 'value@time', target });

    for (const x of [0, 0.25, 0.5, 0.75]) {
      expect(yAtX(withDistantPoint, x)).toBeCloseTo(yAtX(withHalo, x), 12);
    }
  });

  it('encodes special Y roles as binary sentinels', () => {
    const commands = compileCommands({
      rows: [0, 1].map((x) => ({
        x: { time: Decimal(x) },
        y: {
          zero: { value: Decimal(0), role: 'zero' as const },
          top: { value: Decimal(0), role: 'top' as const },
        },
      })),
      kind: 'area',
      using: ['top@time', 'zero@time'],
      target: { xRange: [Decimal(-1), Decimal(2)] },
    });
    const values = [...commands.values.subarray(0, commands.length)];

    expect(values.some(Number.isNaN)).toBe(true);
    expect(values).toContain(Infinity);
  });

  it.each([
    ['step-start', 'M0 0 L4 0 L4 4'],
    ['step', 'M0 0 L2 0 L2 4 L4 4'],
    ['step-end', 'M0 0 L0 4 L4 4'],
  ] as const)('emits %s transitions', (kind, expected) => {
    expect(compile([row(0, 0), row(4, 4)], kind)).toBe(expected);
  });

  it('extends step runs to the transition boundary beside null values', () => {
    expect(compile([row(0, null), row(2, 2), row(4, 4), row(6, null)], 'step')).toBe('M1 2 L2 2 L3 2 L3 4 L4 4 L5 4');
  });

  it('extends step area runs to independently selected transition boundaries', () => {
    expect(compile([row(0, null), row(2, 2), row(4, 4), row(6, null)], 'step-area')).toBe(
      'M1 2 L2 2 L3 2 L3 4 L4 4 L5 4 L5 0 L4 0 L2 0 L1 0 Z',
    );
  });

  it('keeps clipped line fragments disconnected', () => {
    expectPathClose(
      compileLinkGeometry({
        rows: [row(0, 0), row(1, 2), row(2, 2), row(3, 0)],
        kind: 'line',
        using: 'value@time',
        target: { xRange: [Decimal(0), Decimal(3)], yRange: [Decimal(0), Decimal(1)] },
      }),
      'M0 0 L0.5 1 M2.5 1 L3 0',
    );
  });

  it.each([
    ['step-start', 'M4 4 L0 4 L0 0'],
    ['step', 'M4 4 L2 4 L2 0 L0 0'],
    ['step-end', 'M4 4 L4 0 L0 0'],
  ] as const)('preserves descending %s transitions', (kind, expected) => {
    expect(compile([row(4, 4), row(0, 0)], kind)).toBe(expected);
  });

  it.each([
    ['step-area-start', 'M0 2 L4 2 L4 4 L4 0 L4 -1 L0 -1 Z'],
    ['step-area-end', 'M0 2 L0 4 L4 4 L4 0 L0 0 L0 -1 Z'],
  ] as const)('preserves %s closure', (kind, expected) => {
    const rows: TestRow[] = [
      { x: { time: Decimal(0) }, y: { top: Decimal(2), bottom: Decimal(-1) } },
      { x: { time: Decimal(4) }, y: { top: Decimal(4), bottom: Decimal(0) } },
    ];
    expect(
      compileLinkGeometry({
        rows,
        kind,
        using: ['top@time', 'bottom@time'],
        target: { xRange: [Decimal(-100), Decimal(100)] },
      }),
    ).toBe(expected);
  });

  it('drops isolated source runs', () => {
    expect(compile([row(0, 1)])).toBe('');
    expect(compile([row(0, 1)], 'area')).toBe('');
  });

  it('closes vector areas and preserves cubic top boundaries', () => {
    expect(compile([row(0, 1), row(2, 2), row(4, 1)], 'area')).toBe('M0 1 L2 2 L4 1 L4 0 L2 0 L0 0 Z');
    const curve = compile([row(0, 1), row(2, 2), row(4, 1)], 'curve-area');
    expect(curve).toMatch(/^M0 1 C/);
    expect(curve).toMatch(/L4 0 L2 0 L0 0 Z$/);
  });

  it('keeps independently positioned area boundaries', () => {
    const rows: TestRow[] = [
      { x: { top: Decimal(0), bottom: Decimal(1) }, y: { high: Decimal(2), low: Decimal(-2) } },
      { x: { top: Decimal(4), bottom: Decimal(3) }, y: { high: Decimal(1), low: Decimal(-1) } },
    ];
    expectPathClose(
      compileLinkGeometry({
        rows,
        kind: 'area',
        using: ['high@top', 'low@bottom'],
        target: { xRange: [Decimal(-100), Decimal(100)] },
      }),
      'M1 1.75 L3 1.25 L3 -1 L1 -2 Z',
    );
  });

  it('clips lines to finite X and Y ranges before Number conversion', () => {
    const huge = Decimal('1e1000');
    const d = compileLinkGeometry({
      rows: [
        { x: { time: Decimal(-1) }, y: { value: huge.neg() } },
        { x: { time: Decimal(1) }, y: { value: huge } },
      ],
      kind: 'line',
      using: 'value@time',
      target: { xRange: [Decimal(-1), Decimal(1)], yRange: [Decimal(-2), Decimal(2)] },
    });
    expect(d).toBe('M0 -2 L0 2');
    expect(d).not.toMatch(/NaN|Infinity/);
  });

  it('clips huge X coordinates without losing the visible segment', () => {
    const huge = Decimal('1e1000');
    expect(
      compileLinkGeometry({
        rows: [
          { x: { time: huge.neg() }, y: { value: Decimal(1) } },
          { x: { time: huge }, y: { value: Decimal(1) } },
        ],
        kind: 'line',
        using: 'value@time',
        target: { xRange: [Decimal(-2), Decimal(2)] },
      }),
    ).toBe('M-2 1 L2 1');
  });

  it('uses Decimal clipping for finite cached coordinates with insufficient relative precision', () => {
    const distant = Decimal(2).pow(70);
    const cached = (value: Decimal) => ({ value, number: value.number() });
    const line = compileLinkGeometry({
      rows: [
        { x: { time: cached(distant.neg()) }, y: { value: cached(Decimal('0.45')) } },
        { x: { time: cached(Decimal(0)) }, y: { value: cached(Decimal('0.6')) } },
      ],
      kind: 'line',
      using: 'value@time',
      target: { xRange: [Decimal(-100), Decimal(100)] },
    });
    expect(line).toMatch(/^M-100 /);
    expect(line).toMatch(/L0 0.6$/);

    const curve = compileLinkGeometry({
      rows: [
        { x: { time: cached(distant.neg()) }, y: { value: cached(Decimal(0)) } },
        { x: { time: cached(Decimal(0)) }, y: { value: cached(Decimal(2)) } },
        { x: { time: cached(distant) }, y: { value: cached(Decimal(0)) } },
      ],
      kind: 'curve',
      using: 'value@time',
      target: { xRange: [Decimal(-100), Decimal(100)] },
    });
    expect(curve.match(/C/g)).toHaveLength(2);
    expect(curve).not.toMatch(/NaN|Infinity/);
  });

  it('keeps representable short lines inside narrow non-zero clipping ranges', () => {
    expect(
      compileLinkGeometry({
        rows: [row(0, 0), row(0.0000000001, 0)],
        kind: 'line',
        using: 'value@time',
        target: { xRange: [Decimal(-1), Decimal(1)] },
      }),
    ).toBe('M0 0 L1e-10 0');

    const d = compileLinkGeometry({
      rows: [row(100, 0), row(101, 20)],
      kind: 'line',
      using: 'value@time',
      target: {
        xRange: [Decimal(99), Decimal(102)],
        yRange: [Decimal(10), Decimal('10.0000000001')],
      },
    });
    const values = d.match(/-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/gi)?.map(Number) ?? [];
    expect(values[0]).toBeCloseTo(100.5, 10);
    expect(values[1]).toBe(10);
    expect(values[2]).toBeGreaterThan(values[0]);
    expect(values[3]).toBe(10.0000000001);
  });

  it('preserves the visible curve when clipping its X range', () => {
    const rows = [row(0, 0), row(2, 2), row(4, 0)];
    const full = compileCommands({
      rows,
      kind: 'curve',
      using: 'value@time',
      target: { xRange: [Decimal(0), Decimal(4)] },
    });
    const clipped = compileCommands({
      rows,
      kind: 'curve',
      using: 'value@time',
      target: { xRange: [Decimal(1), Decimal(3)] },
    });
    for (const x of [1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3]) {
      // Clipped endpoints may round slightly inside the requested X boundary.
      expect(yAtX(clipped, x, 1e-12)).toBeCloseTo(yAtX(full, x), 12);
    }
  });

  it('preserves visible curve fragments and their gap when clipping its Y range', () => {
    const rows = [row(0, 0), row(2, 2), row(4, 0)];
    const full = compileCommands({
      rows,
      kind: 'curve',
      using: 'value@time',
      target: { xRange: [Decimal(0), Decimal(4)] },
    });
    const clipped = compileCommands({
      rows,
      kind: 'curve',
      using: 'value@time',
      target: { xRange: [Decimal(0), Decimal(4)], yRange: [Decimal(0), Decimal(1)] },
    });
    for (const x of [0, 0.25, 0.5, 3.5, 3.75, 4]) {
      const y = yAtX(clipped, x);
      expect(y).toBeCloseTo(yAtX(full, x), 12);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(1);
    }
    expect(() => yAtX(clipped, 2)).toThrow();
  });

  it('does not create boundary curves for source runs wholly outside the clip', () => {
    const huge = Decimal('1e1000');
    expect(
      compileLinkGeometry({
        rows: [0, 1, 2].map((index) => ({
          x: { time: huge.add(index) },
          y: { value: Decimal(index) },
        })),
        kind: 'curve',
        using: 'value@time',
        target: { xRange: [Decimal(-2), Decimal(2)] },
      }),
    ).toBe('');
    expect(
      compileLinkGeometry({
        rows: [0, 1, 2].map((index) => ({
          x: { time: Decimal(index) },
          y: { value: huge.add(index) },
        })),
        kind: 'curve',
        using: 'value@time',
        target: { xRange: [Decimal(-2), Decimal(2)] },
      }),
    ).toBe('');
  });

  it('preserves consistently descending vector runs', () => {
    const rows = [row(4, 0), row(2, 2), row(0, 0)];
    expect(
      compileLinkGeometry({ rows, kind: 'line', using: 'value@time', target: { xRange: [Decimal(0), Decimal(4)] } }),
    ).toBe('M4 0 L2 2 L0 0');
    expect(
      compileLinkGeometry({
        rows,
        kind: 'curve',
        using: 'value@time',
        target: { xRange: [Decimal(0), Decimal(4)] },
      }).match(/C/g),
    ).toHaveLength(2);
  });

  it('preserves cubic area boundaries while clipping their common X range', () => {
    const d = compileLinkGeometry({
      rows: [row(0, 1), row(2, 3), row(4, 1)],
      kind: 'curve-area',
      using: ['value@time', '#zero@time'],
      target: { xRange: [Decimal(1), Decimal(3)], yRange: [Decimal(-1), Decimal(4)] },
    });
    expect(d).toMatch(/^M1 /);
    expect(d.match(/C/g)).toHaveLength(2);
    expect(d).toMatch(/L3 0 L2 0 L1 0 Z$/);
    expect(d).not.toMatch(/NaN|Infinity/);
  });

  it('clips areas against Y without dropping visible fill', () => {
    const rows: TestRow[] = [0, 2].map((x) => ({
      x: { time: Decimal(x) },
      y: { top: Decimal(2), bottom: Decimal(-2) },
    }));
    expect(
      compileLinkGeometry({
        rows,
        kind: 'area',
        using: ['top@time', 'bottom@time'],
        target: { xRange: [Decimal(0), Decimal(2)], yRange: [Decimal(-1), Decimal(1)] },
      }),
    ).toBe('M0 1 L2 1 L2 -1 L0 -1 Z');

    const outside = rows.map((row) => ({ ...row, y: { top: Decimal(3), bottom: Decimal(2) } }));
    expect(
      compileLinkGeometry({
        rows: outside,
        kind: 'area',
        using: ['top@time', 'bottom@time'],
        target: { xRange: [Decimal(0), Decimal(2)], yRange: [Decimal(-1), Decimal(1)] },
      }),
    ).toBe('');
  });
});
function pathString(commands: TimescopePathCommands) {
  const parts: string[] = [];
  const values = commands.values;
  for (let index = 0; index < commands.length;) {
    const command = values[index++];
    const size = command === PathCommand.bezierCurveTo ? 6 : command === PathCommand.closePath ? 0 : 2;
    const name =
      command === PathCommand.moveTo
        ? 'M'
        : command === PathCommand.lineTo
          ? 'L'
          : command === PathCommand.bezierCurveTo
            ? 'C'
            : 'Z';
    parts.push(name + Array.from(values.subarray(index, index + size)).join(' '));
    index += size;
  }
  return parts.join(' ');
}

function compileCommands(options: {
  rows: TestRow[];
  kind: LinkGeometryKind;
  using: Parameters<typeof compileSourceCommands>[0]['using'];
  target: Parameters<typeof compileSourceCommands>[0]['target'];
}) {
  return compileSourceCommands({
    source: {
      length: options.rows.length,
      x: (index, key) => options.rows[index].x[key],
      y: (index, key) => options.rows[index].y[key],
    },
    kind: options.kind,
    using: options.using,
    target: options.target,
  });
}

function compileLinkGeometry(options: Parameters<typeof compileCommands>[0]) {
  return pathString(compileCommands(options));
}
