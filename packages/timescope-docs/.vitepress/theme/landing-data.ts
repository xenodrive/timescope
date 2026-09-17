import { Decimal, type TimescopeOptionsInitial, type TimescopeSourceInput, type TimescopeSeriesInput } from 'timescope';

export type LandingExampleKind = 'picker' | 'tasks' | 'audio' | 'stock';
type Options = TimescopeOptionsInitial<
  Record<string, TimescopeSourceInput>,
  Record<string, TimescopeSeriesInput>,
  string
>;
const DAY = 86400;
const MARCH = Date.UTC(2026, 2, 10) / 1000;

// Fixed inputs make the examples useful offline and the printed sheet reproducible.
const tasks = [
  { start: 0.15, end: 1.3, lane: 3, label: 'Driving', color: '#1688a5' },
  { start: 1.35, end: 2.25, lane: 2, label: 'Parking', color: '#ac7de4' },
  { start: 2.3, end: 3.6, lane: 4, label: 'Charging', color: '#54a88c' },
  { start: 3.7, end: 4.5, lane: 1, label: 'Idle', color: '#eeb740' },
  { start: 4.65, end: 5.6, lane: 3, label: 'Driving', color: '#1688a5' },
].map((task) => ({
  times: {
    start: MARCH + task.start * DAY,
    middle: MARCH + ((task.start + task.end) / 2) * DAY,
    end: MARCH + task.end * DAY,
  },
  values: { lane: task.lane },
  data: task,
}));

const waveform = Array.from({ length: 12000 }, (_, i) => {
  const time = i / 4000;
  const envelope =
    0.8 * Math.exp(-(((time - 0.45) / 0.18) ** 2)) +
    0.52 * Math.exp(-(((time - 1.05) / 0.26) ** 2)) +
    0.95 * Math.exp(-(((time - 1.95) / 0.3) ** 2)) +
    0.35 * Math.exp(-(((time - 2.6) / 0.12) ** 2));
  return { time, value: envelope * (0.65 * Math.sin(time * 1130) + 0.35 * Math.sin(time * 2710)) };
});

const STOCK_START = Date.UTC(2025, 9, 1) / 1000;
const prices = Array.from({ length: 96 }, (_, i) => {
  const open = 110 + i * 0.6 + 13 * Math.sin(i * 0.12) + 3 * Math.sin(i * 0.63);
  const close = open + 4 * Math.sin(i * 1.71 + 0.7);
  return {
    time: STOCK_START + i * 3.5 * DAY,
    values: {
      open,
      close,
      high: Math.max(open, close) + 2.5,
      low: Math.min(open, close) - 2.2,
      volume: 20 + 65 * Math.sin(i * 1.37) ** 2,
    },
  };
});

const averages = prices.map((price, i) => ({
  time: price.time,
  values: Object.fromEntries(
    [5, 15].map((period) => {
      const window = prices.slice(Math.max(0, i - period + 1), i + 1);
      return [`ma${period}`, window.reduce((sum, p) => sum + p.values.close, 0) / window.length];
    }),
  ),
}));

export function exampleRange(kind: LandingExampleKind): [number, number] {
  switch (kind) {
    case 'picker':
      return [37, 49];
    case 'tasks':
      return [MARCH, MARCH + 6 * DAY];
    case 'audio':
      return [0, 3];
    case 'stock':
      return [STOCK_START - 5 * DAY, STOCK_START + 340 * DAY];
  }
}

export function exampleOptions(kind: LandingExampleKind): Options {
  const range = exampleRange(kind);
  const common: Options = {
    time: (range[0] + range[1]) / 2,
    timeRange: [undefined, undefined],
    style: { width: '100%', ...(kind === 'picker' ? {} : { height: '100%' }), background: '#fff' },
    selection: { color: 'rgba(14, 118, 149, 0.13)' },
  };
  if (kind === 'picker')
    return {
      ...common,
      tracks: {
        default: {
          timeAxis: {
            timeZone: 'utc',
            timeFormat: {
              seconds: ({ minute, second, subseconds, digits }) =>
                `${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}${digits ? subseconds.toFixed(digits).slice(1) : ''}`,
            },
          },
        },
      },
    };
  if (kind === 'tasks')
    return {
      ...common,
      sources: { tasks },
      tracks: {
        default: {
          timeAxis: {
            timeZone: 'utc',
            timeFormat: ({ time, level }) => {
              const date = new Date(time.number() * 1000);
              return (level === 'hour' || level === 'minute') && !time.mod(DAY).isZero()
                ? `${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}`
                : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
            },
          },
        },
      },
      series: {
        tasks: {
          data: { source: 'tasks', domain: { range: [0, 5] } },
          tooltip: false,
          chart: {
            marks: [
              {
                draw: 'bar',
                using: ['lane@start', 'lane@end'],
                style: {
                  size: 17,
                  radius: 4,
                  fillColor: ({ data }) => (data as (typeof tasks)[number]['data']).color,
                  lineWidth: 0,
                },
              },
              {
                draw: 'text',
                using: 'lane@middle',
                style: {
                  size: 11,
                  text: ({ data }) => (data as (typeof tasks)[number]['data']).label,
                  textColor: '#fff',
                },
              },
            ],
          },
        },
      },
    };
  if (kind === 'audio')
    return {
      ...common,
      sources: { waveform: { data: waveform, type: 'point-aggregate' } },
      tracks: { default: { symmetric: true, timeAxis: { relative: true } } },
      series: {
        waveform: {
          data: { source: 'waveform', color: '#10b981', domain: { range: [-1, 1] } },
          tooltip: false,
          chart: {
            links: ({ resolution }: { resolution: Decimal }) =>
              resolution.lt(0.0003)
                ? []
                : [
                    { draw: 'area', using: ['value#min', 'value#max'], style: { fillOpacity: 0.72 } },
                    { draw: 'line', using: 'value#avg', style: { lineWidth: 0.7 } },
                  ],
            marks: ({ resolution }: { resolution: Decimal }) =>
              resolution.lt(0.0003)
                ? [
                    { draw: 'line', using: ['value#avg', '#zero'], style: { lineWidth: 1 } },
                    { draw: 'circle', using: 'value#avg', style: { size: 3 } },
                  ]
                : [],
          },
        },
      },
    };
  return {
    ...common,
    sources: { prices, averages },
    domains: {
      price: { range: { shrink: true, expand: true, default: [undefined, undefined] } },
      volume: { range: [0, undefined] },
    },
    tracks: {
      price: {
        height: 130,
        timeAxis: false,
      },
      volume: {
        height: 60,
        timeAxis: {
          timeZone: 'utc',
          timeFormat: ({ time }) =>
            new Date(time.number() * 1000).toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }),
        },
      },
    },
    series: {
      averages: {
        track: 'price',
        data: { source: 'averages', domain: 'price' },
        tooltip: false,
        chart: {
          links: [
            { draw: 'line', using: 'ma5', style: { lineColor: '#19b6df', lineWidth: 1.3 } },
            { draw: 'line', using: 'ma15', style: { lineColor: '#f5a623', lineWidth: 1.3 } },
          ],
        },
      },
      volume: {
        track: 'volume',
        data: { source: 'prices', domain: 'volume', instantaneous: { using: 'volume' } },
        tooltip: false,
        chart: {
          marks: [
            {
              draw: 'bar',
              using: ['volume', '#zero'],
              style: {
                size: ({ resolution }) => Math.max(1, Math.min(12, ((3.5 * DAY) / resolution.number()) * 0.7)),
                lineWidth: 0,
                fillOpacity: 0.5,
                fillColor: ({ values }) => (values.close!.ge(values.open!) ? '#10b981' : '#fb7185'),
              },
            },
          ],
        },
      },
      price: {
        track: 'price',
        data: { source: 'prices', domain: 'price', instantaneous: { using: 'close' } },
        tooltip: false,
        chart: {
          marks: [
            {
              draw: 'line',
              using: ['low', 'high'],
              style: {
                lineWidth: 1,
                lineColor: ({ values }) => (values.close!.ge(values.open!) ? '#298f83' : '#db8270'),
              },
            },
            {
              draw: 'bar',
              using: ['open', 'close'],
              style: {
                size: ({ resolution }) => Math.max(1, Math.min(12, ((3.5 * DAY) / resolution.number()) * 0.7)),
                lineWidth: 1,
                lineColor: ({ values }) => (values.close!.ge(values.open!) ? '#298f83' : '#db8270'),
                fillColor: ({ values }) => (values.close!.ge(values.open!) ? '#298f83' : '#db8270'),
              },
            },
          ],
        },
      },
    },
  };
}
