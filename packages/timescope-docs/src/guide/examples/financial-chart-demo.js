import { createDataSource, Decimal, Timescope } from 'timescope';

const DAY = 86400;
const CANDLE_SPACING = 5;
const CHUNK_SIZE = 960;
const MA_CONTEXT = 20;

const intervals = [
  { interval: '1s', seconds: 1 },
  { interval: '1m', seconds: 60 },
  { interval: '3m', seconds: 180 },
  { interval: '5m', seconds: 300 },
  { interval: '15m', seconds: 900 },
  { interval: '30m', seconds: 1800 },
  { interval: '1h', seconds: 3600 },
  { interval: '2h', seconds: 7200 },
  { interval: '4h', seconds: 14400 },
  { interval: '6h', seconds: 21600 },
  { interval: '8h', seconds: 28800 },
  { interval: '12h', seconds: 43200 },
  { interval: '1d', seconds: DAY },
  { interval: '3d', seconds: 3 * DAY },
  { interval: '1w', seconds: 7 * DAY },
  // Binance months are calendar-based. Thirty days is used only for Timescope's fixed zoom resolution.
  { interval: '1M', seconds: 30 * DAY },
];

const resolutions = intervals.map(({ seconds }) => Decimal(seconds));
const viewResolutions = resolutions.map((resolution) => resolution.divExact(CANDLE_SPACING));
const candleResolution = {
  resolve: ({ resolution }) => resolution.mul(CANDLE_SPACING),
  snap: 'ceil',
};
const priceFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function intervalFor(resolution) {
  const index = resolutions.findIndex((value) => value.eq(resolution));
  if (index < 0) throw new RangeError(`Unsupported Binance resolution: ${resolution}`);
  return intervals[index];
}

function candleSize(resolution, intervalSeconds) {
  return Math.max(1, Math.min(8, (intervalSeconds / resolution.number()) * 0.72));
}

function movingAverage(klines, index, period) {
  if (index < period - 1) return null;
  let sum = 0;
  for (let i = index - period + 1; i <= index; i++) sum += Number(klines[i][4]);
  return sum / period;
}

export function createFinancialChartDemo(target) {
  // #region example
  const now = Math.floor(Date.now() / 1000);
  const market = createDataSource({
    chunkSize: CHUNK_SIZE,
    resolutions,
    loader: async (chunk) => {
      const config = intervalFor(chunk.resolution);
      const contextSeconds = config.interval === '1M' ? 32 * DAY : config.seconds;
      const startTime = Math.max(
        0,
        chunk.range[0]
          .sub(contextSeconds * MA_CONTEXT)
          .mul(1000)
          .floor()
          .number(),
      );
      const endTime = Math.min(Date.now(), chunk.range[1].add(contextSeconds).mul(1000).ceil().number() - 1);
      if (endTime < startTime) return [];

      const params = new URLSearchParams({
        symbol: 'BTCUSDT',
        interval: config.interval,
        startTime: String(startTime),
        endTime: String(endTime),
        limit: '1000',
      });
      try {
        const response = await fetch(`https://data-api.binance.vision/api/v3/klines?${params}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const klines = await response.json();
        return klines.map(([openTime, open, high, low, close, volume], index) => ({
          time: openTime / 1000,
          values: {
            open,
            high,
            low,
            close,
            volume,
            ma5: movingAverage(klines, index, 5),
            ma20: movingAverage(klines, index, 20),
          },
          data: { intervalSeconds: config.seconds },
        }));
      } catch (error) {
        console.warn('Failed to load Binance market data', error);
        throw error;
      }
    },
  });
  // Refresh the unfinished candle at every available resolution.
  const refresh = setInterval(() => market.invalidate([Date.now() / 1000 - 60, undefined]), 5000);
  const timescope = new Timescope({
    target,
    style: { height: '280px' },
    time: now - (365 * DAY) / 2,
    timeRange: ['2017-08-17T00:00:00Z', null],
    zoom: -15,
    zoomRange: [-Math.log2(viewResolutions.at(-1).number()), -Math.log2(viewResolutions[0].number())],
    selection: { color: 'rgba(14, 118, 149, 0.16)' },
    sources: { market },
    domains: {
      price: {
        range: { shrink: true, expand: true, default: [undefined, undefined] },
        unit: 'USDT',
        digits: 2,
      },
      volume: { range: [0, undefined], unit: 'BTC', digits: 2 },
    },
    series: {
      price: {
        data: {
          source: 'market',
          name: 'BTC / USDT',
          instantaneous: { using: 'close' },
          domain: 'price',
          resolution: candleResolution,
        },
        chart: {
          marks: [
            {
              draw: 'section',
              using: ['high', 'low'],
              style: {
                size: ({ resolution, data }) => candleSize(resolution, data.intervalSeconds),
                lineColor: ({ values }) => (values.close.ge(values.open) ? '#10b981' : '#ef4444'),
                lineWidth: 1,
              },
            },
            {
              draw: 'bar',
              using: ['open', 'close'],
              style: ({ resolution, data, values }) => {
                const color = values.close.ge(values.open) ? '#10b981' : '#ef4444';
                return { size: candleSize(resolution, data.intervalSeconds), lineColor: color, fillColor: color };
              },
            },
          ],
          links: [
            { draw: 'line', using: 'ma5', style: { lineColor: '#3b82f6', lineWidth: 1.5 } },
            { draw: 'line', using: 'ma20', style: { lineColor: '#f59e0b', lineWidth: 1.5 } },
          ],
        },
        tooltip: { format: ({ value }) => (value ? priceFormatter.format(value.number()) : '—') },
        track: 'price',
      },
      volume: {
        data: { source: 'market', name: 'Volume', domain: 'volume', resolution: candleResolution },
        chart: {
          marks: [
            {
              draw: 'bar',
              using: ['volume', '#zero'],
              style: ({ resolution, data, values }) => ({
                size: candleSize(resolution, data.intervalSeconds),
                fillColor: values.close.ge(values.open) ? '#10b981' : '#ef4444',
                fillOpacity: 0.55,
                lineWidth: 0,
              }),
            },
          ],
        },
        tooltip: false,
        track: 'volume',
      },
    },
    tracks: {
      price: { height: 210, timeAxis: true },
      volume: { height: 70, timeAxis: true },
    },
  });

  timescope.on('mount', () => timescope.fitTo([now - 365 * DAY, now], { animation: false }));

  // #endregion example
  return () => {
    clearInterval(refresh);
    timescope.dispose();
  };
}
