import type { Using } from '#src/renderer/types';

export function unwrapFn<T, A extends unknown[]>(obj: T | ((...args: A) => T), ...args: A): T {
  if (typeof obj === 'function') return (obj as (...args: A) => T)(...args);
  if (Array.isArray(obj)) return obj.map((v) => unwrapFn(v, ...args)) as T;
  if (typeof obj === 'object' && obj) {
    return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, unwrapFn(v, ...args)])) as T;
  }
  return obj as T;
}

export function parseUsing(usingInput: Using) {
  const using = (
    typeof usingInput === 'string'
      ? [usingInput, usingInput]
      : usingInput.length === 1
        ? [usingInput[0], usingInput[0]]
        : usingInput
  ) as [string, string];

  const part1 = using[0].split('@') as [value: string, time: string];
  const part2 = using[1].split('@') as [value: string, time: string];

  return [
    [part1[0] || 'value', part1[1] || 'time'],
    [part2[0] || 'value', part2[1] || 'time'],
  ] as const;
}
