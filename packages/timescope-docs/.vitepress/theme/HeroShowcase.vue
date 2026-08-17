<template>
  <section
    class="landing-section landing-primary-example"
    aria-labelledby="financial-chart-title"
  >
    <article class="landing-card landing-card--primary">
      <header class="landing-card-header">
        <div>
          <h2 id="financial-chart-title">
            <a href="./guide/examples/financial-chart">Financial Chart</a>
          </h2>
          <p>
            BTC / USDT <span aria-hidden="true">·</span>
            <a
              href="https://data.binance.vision/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Data source: Binance
            </a>
          </p>
        </div>
        <span
          class="landing-card-status"
          :class="{ error: loadError }"
          aria-live="polite"
        >
          {{ loadError ?? latestPrice ?? 'Loading market data...' }}
        </span>
      </header>
      <div class="landing-card-body hero-showcase-body">
        <div ref="timescope" class="hero-showcase-canvas"></div>
      </div>
    </article>
  </section>
</template>

<script setup lang="ts">
import { Decimal, Timescope, type TimescopeResolutionContext } from 'timescope';
import { onBeforeUnmount, onMounted, ref, useTemplateRef } from 'vue';

const element = useTemplateRef('timescope');
const latestPrice = ref<string>();
const loadError = ref<string>();

const DAY = 86400;
const CANDLE_SPACING = 5;
const CHUNK_SIZE = 960;

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
] as const;

const resolutions = intervals.map(({ seconds }) => Decimal(seconds));
const viewResolutions = resolutions.map((resolution) =>
  resolution.div(CANDLE_SPACING),
);
const initialResolution = Decimal(15 * 60)
  .div(CANDLE_SPACING)
  .number();
const candleResolution = {
  resolve: ({ resolution }: TimescopeResolutionContext) =>
    resolution.mul(CANDLE_SPACING),
  snap: 'ceil',
} as const;
const priceFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

type BinanceKline = [
  openTime: number,
  open: string,
  high: string,
  low: string,
  close: string,
  volume: string,
  ...rest: unknown[],
];

function intervalFor(resolution: Decimal) {
  const index = resolutions.findIndex((value) => value.eq(resolution));
  if (index < 0)
    throw new RangeError(`Unsupported Binance resolution: ${resolution}`);
  return intervals[index];
}

function candleSize(resolution: Decimal, intervalSeconds: number) {
  return Math.max(
    1,
    Math.min(8, (intervalSeconds / resolution.number()) * 0.72),
  );
}

onMounted(() => {
  const now = Math.floor(Date.now() / 1000);
  let latestOpenTime = 0;

  const timescope = new Timescope({
    style: { height: '280px' },
    time: now - DAY,
    timeRange: ['2017-08-17T00:00:00Z', null],
    zoom: -Math.log2(initialResolution),
    zoomRange: [
      -Math.log2(viewResolutions.at(-1)!.number()),
      -Math.log2(viewResolutions[0].number()),
    ],
    selection: { color: 'rgba(14, 118, 149, 0.16)' },
    sources: {
      market: {
        chunkSize: CHUNK_SIZE,
        resolutions,
        loader: async (chunk, api) => {
          const config = intervalFor(chunk.resolution);
          const contextSeconds =
            config.interval === '1M' ? 32 * DAY : config.seconds;
          const startTime = Math.max(
            0,
            chunk.range[0]!.sub(contextSeconds).mul(1000).floor().number(),
          );
          const endTime = Math.min(
            Date.now(),
            chunk.range[1]!.add(contextSeconds).mul(1000).ceil().number() - 1,
          );

          if (endTime < startTime) return [];

          const params = new URLSearchParams({
            symbol: 'BTCUSDT',
            interval: config.interval,
            startTime: String(startTime),
            endTime: String(endTime),
            limit: '1000',
          });

          try {
            const response = await fetch(
              `https://data-api.binance.vision/api/v3/klines?${params}`,
            );
            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const klines = (await response.json()) as BinanceKline[];
            const latest = klines.at(-1);
            if (latest && latest[0] > latestOpenTime) {
              latestOpenTime = latest[0];
              latestPrice.value = priceFormatter.format(Number(latest[4]));
            }
            loadError.value = undefined;

            if (endTime >= Date.now() - contextSeconds * 1000) {
              api.expiresIn(
                Math.max(5000, Math.min(60000, config.seconds * 1000)),
              );
            }

            return klines.map(([openTime, open, high, low, close, volume]) => ({
              time: openTime / 1000,
              values: { open, high, low, close, volume },
              data: { intervalSeconds: config.seconds },
            }));
          } catch (error) {
            loadError.value = 'Market data unavailable';
            api.expiresIn(30000);
            console.warn('Failed to load Binance market data', error);
            return [];
          }
        },
      },
    },
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
                size: ({ resolution, data }) =>
                  candleSize(resolution, data.intervalSeconds),
                lineColor: ({ values }) =>
                  values.close!.ge(values.open!) ? '#10b981' : '#ef4444',
                lineWidth: 1,
              },
            },
            {
              draw: 'bar',
              using: ['open', 'close'],
              style: ({ resolution, data, values }) => {
                const color = values.close!.ge(values.open!)
                  ? '#10b981'
                  : '#ef4444';
                return {
                  size: candleSize(resolution, data.intervalSeconds),
                  lineColor: color,
                  fillColor: color,
                };
              },
            },
          ],
        },
        tooltip: {
          format: ({ value }) =>
            value ? priceFormatter.format(value.number()) : '—',
        },
        track: 'price',
      },
      volume: {
        data: {
          source: 'market',
          name: 'Volume',
          domain: 'volume',
          resolution: candleResolution,
        },
        chart: {
          marks: [
            {
              draw: 'bar',
              using: ['volume', '#zero'],
              style: ({ resolution, data, values }) => ({
                size: candleSize(resolution, data.intervalSeconds),
                fillColor: values.close!.ge(values.open!)
                  ? '#10b981'
                  : '#ef4444',
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
      price: { height: 210, timeAxis: false },
      volume: { height: 70, timeAxis: true },
    },
  });

  timescope.on('load', () => {
    timescope.fitTo([now - 2 * DAY, now], { animation: false, padding: 16 });
  });

  if (element.value) timescope.mount(element.value);

  onBeforeUnmount(() => timescope.dispose());
});
</script>
