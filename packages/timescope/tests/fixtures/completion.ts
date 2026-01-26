import { describe, it } from 'vitest';

import { defineTimescopeSeries } from '../../src/index';

// Test case 1: No time/value defined
// Expected completions: 'time', 'value', '_zero', '_top', '_bottom', '_minTime', '_maxTime', '@time', 'value@time', etc.
export const test1 = defineTimescopeSeries({
  a: {
    data: {
      source: 'test',
      time: ['time'],
      value: ['value'],
    },
    chart: {
      marks: [
        {
          draw: 'star',
          // @ts-expect-error for completion testing
          using: '', // COMPLETION_TEST_1: Should suggest '@time', 'value'
        },
      ],
    },
  },
});

// Test case 2: Custom time=['maxtime'], value=['foobar']
// Expected completions: 'foobar', 'maxtime', '_zero', '_top', '_bottom', '_minTime', '_maxTime', '@maxtime', 'foobar@maxtime', etc.
// NOT expected: 'time', 'value', '@time', 'value@time'
export const test2 = defineTimescopeSeries({
  b: {
    data: {
      source: 'test',
      time: ['maxtime'],
      value: ['foobar'],
    },
    chart: {
      marks: [
        {
          draw: 'star',
          // @ts-expect-error for completion testing
          using: '', // COMPLETION_TEST_2: Should suggest 'foobar', 'maxtime' but NOT 'time', 'value'
        },
      ],
    },
  },
});

// Test case 3: Multiple series with different time/value
export const test3 = defineTimescopeSeries({
  series1: {
    data: {
      source: 'test',
      time: ['timestamp'],
      value: ['price'],
    },
    chart: {
      marks: [
        {
          draw: 'star',
          // @ts-expect-error for completion testing
          using: '', // COMPLETION_TEST_3: Should suggest 'timestamp', 'price'
        },
      ],
    },
  },
  series2: {
    data: {
      source: 'test',
      time: ['date'],
      value: ['amount'],
    },
    chart: {
      marks: [
        {
          draw: 'star',
          // @ts-expect-error for completion testing
          using: '', // COMPLETION_TEST_4: Should suggest 'date', 'amount'
        },
      ],
    },
  },
});

export const test4 = defineTimescopeSeries({
  a: {
    data: {
      source: 'test',
    },
    chart: {
      marks: [
        {
          draw: 'star',
          // @ts-expect-error for completion testing
          using: '', // COMPLETION_TEST_5
        },
      ],
    },
  },
});
describe('completion fixtures', () => {
  it('loads', () => {});
});
