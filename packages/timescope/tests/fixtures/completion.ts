import { createDataSource, defineTimescopeOptions } from '#src/index';

export const inline = defineTimescopeOptions({
  sources: {
    prices: {
      data: [] as { time: number; price: number }[],
      mappings: { times: { time: 'time' }, values: { price: 'price' } },
    },
    amounts: {
      data: [] as { time: number; amount: number }[],
      mappings: { times: { time: 'time' }, values: { amount: 'amount' } },
    },
  },
  series: {
    price: {
      data: { source: 'prices' },
      chart: {
        marks: [
          {
            draw: 'star',
            // @ts-expect-error for completion testing
            using: '', // COMPLETION_TEST_1
          },
        ],
      },
    },
    amount: {
      data: { source: 'amounts' },
      chart: {
        marks: [
          {
            draw: 'star',
            // @ts-expect-error for completion testing
            using: '', // COMPLETION_TEST_2
          },
        ],
      },
    },
  },
});

export const instance = defineTimescopeOptions({
  sources: {
    readings: createDataSource({ data: [] as { time: number; value: number }[], type: 'simple' }),
  },
  series: {
    reading: {
      data: { source: 'readings' },
      chart: {
        marks: [
          {
            draw: 'star',
            // @ts-expect-error for completion testing
            using: '', // COMPLETION_TEST_3
          },
        ],
      },
    },
  },
});
