import { PathCommand, type TimescopePathCommands } from '#src/core/path';

// Observe the curve at a coordinate, independently of how it is split into commands.
export function yAtX(commands: TimescopePathCommands, x: number, tolerance = 0): number {
  const values = commands.values;
  let fromX = NaN;
  let fromY = NaN;
  for (let i = 0; i < commands.length;) {
    const command = values[i++];
    if (command === PathCommand.moveTo) {
      fromX = values[i++];
      fromY = values[i++];
    } else if (command === PathCommand.lineTo) {
      const toX = values[i++];
      const toY = values[i++];
      if (fromX - tolerance <= x && x <= toX + tolerance && fromX !== toX) {
        const sampleX = Math.max(fromX, Math.min(toX, x));
        return fromY + ((toY - fromY) * (sampleX - fromX)) / (toX - fromX);
      }
      fromX = toX;
      fromY = toY;
    } else if (command === PathCommand.bezierCurveTo) {
      const [c1x, c1y, c2x, c2y, toX, toY] = values.subarray(i, i + 6);
      i += 6;
      if (fromX - tolerance <= x && x <= toX + tolerance) {
        const cubic = (a: number, b: number, c: number, d: number, t: number) =>
          (1 - t) ** 3 * a + 3 * (1 - t) ** 2 * t * b + 3 * (1 - t) * t ** 2 * c + t ** 3 * d;
        let lower = 0;
        let upper = 1;
        for (let step = 0; step < 60; step++) {
          const t = (lower + upper) / 2;
          if (cubic(fromX, c1x, c2x, toX, t) < x) lower = t;
          else upper = t;
        }
        return cubic(fromY, c1y, c2y, toY, (lower + upper) / 2);
      }
      fromX = toX;
      fromY = toY;
    } else {
      throw new Error(`Expected an open line or curve, got command ${command}`);
    }
  }
  throw new Error(`No segment at x=${x}`);
}
