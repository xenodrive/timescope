import { mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Timescope } from 'timescope';
import { presets } from '../src/examples/playground/presets.js';
import { buildOptions } from '../src/examples/playground/options.js';

process.env.FONTCONFIG_FILE = fileURLToPath(new URL('ogp-fonts.conf', import.meta.url));
const { Canvas, loadImage } = await import('skia-canvas');

const width = 640;
const height = 112;
const start = Date.parse('2026-01-15T10:00:00Z') / 1000;
// Leave ten minutes at each edge so the hour labels are fully visible.
const duration = (4 * 60 + 20) * 60;
const timeAxis = {
  timeZone: 'UTC',
  labels: { color: '#486575', font: { size: 13 } },
  axis: { color: '#a3bac3' },
  ticks: { color: '#b1c6cd' },
};
const shared = {
  backend: 'skia-canvas',
  time: start + 2 * 60 * 60,
  zoom: -Math.log2(duration / width),
  cursor: { color: '#e28568', borderColor: '#ffffff' },
  selection: false,
};
const state = presets.find(({ id }) => id === 'multiple-series').create();
const chart = buildOptions(state);
delete chart.target;
delete chart.fit;
delete chart.cursor;
// Map the example's relative samples onto the same four hours as the plain slider.
chart.sources.autoRange = chart.sources.autoRange.map((row) => ({
  ...row,
  time: start + ((row.time - state.range[0]) / (state.range[1] - state.range[0])) * 4 * 60 * 60,
}));
chart.tracks.default = { symmetric: true, timeAxis };
chart.domains.sharedAmplitude.axis = { side: 'left', color: '#486575', label: 'Amplitude' };
chart.domains.activity.axis = { side: 'right', color: '#486575', label: 'Activity' };
for (const domain of Object.values(chart.domains)) domain.animation = false;

await render('time-slider', { tracks: { default: { symmetric: true, timeAxis } } });
await render('time-slider-charts', chart);

// Use the same local recording as the interactive audio example.
const waveform = await readWaveform();
await render('audio-waveform', {
  time: 1.25,
  zoom: -Math.log2(2.6 / width),
  sources: { waveform: { type: 'point-aggregate', data: waveform } },
  domains: { amplitude: { range: [-1, 1], animation: false } },
  tracks: { default: { symmetric: true, timeAxis: { ...timeAxis, relative: true } } },
  series: {
    waveform: {
      data: { source: 'waveform', domain: 'amplitude', color: '#10b981' },
      tooltip: false,
      chart: {
        links: [
          { draw: 'area', using: ['value#min', 'value#max'], style: { fillOpacity: 0.8 } },
          { draw: 'line', using: 'value#avg' },
        ],
      },
    },
  },
});

// Keep the Binance snapshot local, including history for the moving averages.
const { klines } = JSON.parse(await readFile(new URL('data/btcusdt-monthly.json', import.meta.url), 'utf8'));
const market = klines.map(([time, open, high, low, close, volume]) => ({
  time: time / 1000,
  values: { open: Number(open), high: Number(high), low: Number(low), close: Number(close), volume: Number(volume) },
}));
for (let i = 0; i < market.length; i++) {
  for (const period of [5, 20]) {
    const window = market.slice(Math.max(0, i - period + 1), i + 1);
    market[i].values[`ma${period}`] =
      window.length === period ? window.reduce((sum, row) => sum + row.values.close, 0) / period : null;
  }
}
const marketStart = Date.parse('2020-10-01T00:00:00Z') / 1000;
const marketEnd = Date.parse('2026-08-01T00:00:00Z') / 1000;
const priceFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const candleColor = ({ values }) => (values.close.ge(values.open) ? '#10b981' : '#ef4444');
await render('stock-chart', {
  time: (marketStart + marketEnd) / 2,
  zoom: -Math.log2((marketEnd - marketStart) / width),
  sources: { market },
  domains: {
    price: {
      range: [0, undefined],
      animation: false,
      axis: { side: 'right', label: '', color: '#486575' },
    },
    volume: { range: [0, Math.max(...market.map((row) => row.values.volume)) * 1.5], animation: false },
  },
  tracks: {
    price: { height: 86, timeAxis },
    volume: { height: 26, timeAxis: false },
  },
  series: {
    price: {
      data: {
        source: 'market',
        domain: 'price',
        name: 'BTC / USDT',
        color: '#0d9488',
        instantaneous: { using: 'close' },
      },
      track: 'price',
      tooltip: { side: 'right', format: ({ value }) => (value ? priceFormatter.format(value.number()) : '') },
      chart: {
        marks: [
          { draw: 'section', using: ['high', 'low'], style: { size: 5, lineColor: candleColor } },
          { draw: 'bar', using: ['open', 'close'], style: { size: 5, lineColor: candleColor, fillColor: candleColor } },
        ],
        links: [
          { draw: 'line', using: 'ma5', style: { lineColor: '#3b82f6', lineWidth: 1 } },
          { draw: 'line', using: 'ma20', style: { lineColor: '#f59e0b', lineWidth: 1 } },
        ],
      },
    },
    volume: {
      data: { source: 'market', domain: 'volume' },
      track: 'volume',
      tooltip: false,
      chart: {
        marks: [
          {
            draw: 'bar',
            using: ['volume', '#zero'],
            style: { size: 5, fillColor: candleColor, fillOpacity: 0.55, lineWidth: 0 },
          },
        ],
      },
    },
  },
});

async function readWaveform() {
  const wav = await readFile(new URL('../src/public/audio.wav', import.meta.url));
  const chunks = new Map();
  for (let offset = 12; offset + 8 <= wav.length;) {
    const length = wav.readUInt32LE(offset + 4);
    chunks.set(wav.toString('ascii', offset, offset + 4), wav.subarray(offset + 8, offset + 8 + length));
    offset += 8 + length + (length % 2);
  }
  const format = chunks.get('fmt ');
  if (!format || format.readUInt16LE(0) !== 1 || format.readUInt16LE(2) !== 1 || format.readUInt16LE(14) !== 8) {
    throw new Error('The poster recording must be mono 8-bit PCM WAV.');
  }
  const sampleRate = format.readUInt32LE(4);
  const samples = chunks.get('data');
  if (!samples) throw new Error('The poster recording has no audio samples.');
  return Array.from(samples, (sample, index) => ({ time: index / sampleRate, value: (sample - 128) / 128 }));
}

async function render(name, options) {
  const canvas = new Canvas(width, height);
  canvas.gpu = false;
  const timescope = new Timescope({ ...shared, ...options, target: canvas });
  try {
    await timescope.nextFrame();
    await timescope.resize(width, height, 3.5);
    await timescope.prepareView().fetch();
    await timescope.nextFrame();

    // Flatten after rendering, since axis labels use knockout compositing.
    const image = await loadImage(await canvas.toBuffer('png'));
    const flattened = new Canvas(canvas.width, canvas.height);
    flattened.gpu = false;
    const context = flattened.getContext('2d');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, flattened.width, flattened.height);
    context.drawImage(image, 0, 0);
    const output = new URL(`../src/assets/poster/${name}.png`, import.meta.url);
    await mkdir(new URL('.', output), { recursive: true });
    await flattened.toFile(fileURLToPath(output));
    console.log(`Rendered ${fileURLToPath(output)} (${canvas.width} × ${canvas.height})`);
  } finally {
    timescope.dispose();
  }
}
