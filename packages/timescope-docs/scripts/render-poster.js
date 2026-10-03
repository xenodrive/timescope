import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Timescope } from 'timescope';
import { presets } from '../src/examples/playground/presets.js';
import { buildOptions } from '../src/examples/playground/options.js';

process.env.FONTCONFIG_FILE = fileURLToPath(new URL('ogp-fonts.conf', import.meta.url));
const { Canvas, loadImage } = await import('skia-canvas');

const width = 760;
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

await render('time-slider', 64, { tracks: { default: { timeAxis } } });
await render('time-slider-charts', 280, chart);

async function render(name, height, options) {
  const canvas = new Canvas(width, height);
  canvas.gpu = false;
  const timescope = new Timescope({ ...shared, ...options, target: canvas });
  try {
    await timescope.nextFrame();
    await timescope.resize(width, height, 3);
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
