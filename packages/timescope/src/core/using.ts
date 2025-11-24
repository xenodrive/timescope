import type { Using } from '#src/core/types';

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
