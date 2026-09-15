import { createDataSource, defineTimescopeSeries, defineTimescopeSources } from '#src/index';

const defaultSource = defineTimescopeSources({
  test: { data: [] as { time: number; value: number }[] },
});

export const test1 = defineTimescopeSeries(
  {
    a: {
      data: { source: 'test' },
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
  },
  defaultSource,
);

const customSource = defineTimescopeSources({
  test: {
    data: [],
    mappings: { times: { maxtime: 'time' }, values: { foobar: 'value' } },
  },
});

export const test2 = defineTimescopeSeries(
  {
    b: {
      data: { source: 'test' },
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
  customSource,
);

const multipleSources = defineTimescopeSources({
  prices: { data: [], mappings: { times: { timestamp: 'time' }, values: { price: 'value' } } },
  amounts: { data: [], mappings: { times: { date: 'time' }, values: { amount: 'value' } } },
});

export const test3 = defineTimescopeSeries(
  {
    series1: {
      data: { source: 'prices' },
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
    series2: {
      data: { source: 'amounts' },
      chart: {
        marks: [
          {
            draw: 'star',
            // @ts-expect-error for completion testing
            using: '', // COMPLETION_TEST_4
          },
        ],
      },
    },
  },
  multipleSources,
);

export const test4 = defineTimescopeSeries(
  {
    a: {
      data: { source: 'test' },
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
  },
  defineTimescopeSources({
    test: {
      data: [] as { time: number; value: number }[],
      reducer: 'min-max-avg',
    },
  }),
);

const loaderSources = defineTimescopeSources({
  decoded: {
    loader: async () => ({ samples: [{ timestamp: 1, temperature: 2 }] }),
    decoder: (payload: { samples: { timestamp: number; temperature: number }[] }) =>
      payload.samples.map((sample) => ({ time: sample.timestamp, value: sample.temperature })),
    chunked: false,
    reducer: 'percentiles',
  },
  mapped: {
    loader: async () => [{ timestamp: 1, metric: 2 }],
    mappings: { times: { timestamp: 'timestamp' }, values: { 'metric#raw': 'metric' } },
    chunked: false,
    reducer: 'percentiles',
  },
});

export const test5 = defineTimescopeSeries(
  {
    decoded: {
      data: { source: 'decoded' },
      chart: {
        marks: [
          {
            draw: 'star',
            // @ts-expect-error for completion testing
            using: '', // COMPLETION_TEST_6
          },
        ],
      },
    },
    mapped: {
      data: { source: 'mapped' },
      chart: {
        marks: [
          {
            draw: 'star',
            // @ts-expect-error for completion testing
            using: '', // COMPLETION_TEST_7
          },
        ],
      },
    },
  },
  loaderSources,
);

const instanceSources = defineTimescopeSources({
  instance: createDataSource({
    data: [] as { times: { recorded: number }; values: { load: number } }[],
    reducer: 'null',
  }),
});

export const test6 = defineTimescopeSeries(
  {
    instance: {
      data: { source: 'instance' },
      chart: {
        marks: [
          {
            draw: 'star',
            // @ts-expect-error for completion testing
            using: '', // COMPLETION_TEST_8
          },
        ],
      },
    },
  },
  instanceSources,
);

const chunkedSources = defineTimescopeSources({
  url: {
    url: '/api/{start}/{end}',
    mappings: { times: { sample: 'time' }, values: { reading: 'value' } },
  },
  loader: {
    loader: async () => [{ times: { stamp: 1 }, values: { signal: 2 } }],
  },
});

export const test7 = defineTimescopeSeries(
  {
    url: {
      data: { source: 'url' },
      chart: {
        marks: [
          {
            draw: 'star',
            // @ts-expect-error for completion testing
            using: '', // COMPLETION_TEST_9
          },
        ],
      },
    },
    loader: {
      data: { source: 'loader' },
      chart: {
        marks: [
          {
            draw: 'star',
            // @ts-expect-error for completion testing
            using: '', // COMPLETION_TEST_10
          },
        ],
      },
    },
  },
  chunkedSources,
);
