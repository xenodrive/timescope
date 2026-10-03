import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Canvas, loadImage } from 'skia-canvas';
import { Timescope } from 'timescope';
import { presets } from '../src/examples/playground/presets.js';
import { buildOptions } from '../src/examples/playground/options.js';

const output = new URL('../src/guide/assets/node-multiple-series.png', import.meta.url);
const state = presets.find(({ id }) => id === 'multiple-series').create();
state.fitPadding = 24;
const options = buildOptions(state);
options.domains.sharedAmplitude.axis.label = 'Amplitude';
options.domains.activity.axis.label = 'Activity';
for (const series of Object.values(options.series)) series.tooltip = false;

const canvas = new Canvas(960, 360);
const timescope = new Timescope({
  ...options,
  target: canvas,
  backend: 'skia-canvas',
  cursor: false,
  selection: false,
  font: { family: 'sans-serif' },
});

try {
  await timescope.nextFrame();
  await timescope.resize(960, 360, 2);
  await timescope.prepareView().fetch();
  await timescope.nextFrame();
  await mkdir(new URL('.', output), { recursive: true });
  // Flatten the finished pixels onto white after label knockout compositing.
  const image = await loadImage(await canvas.toBuffer('png'));
  const flattened = new Canvas(canvas.width, canvas.height);
  const context = flattened.getContext('2d');
  context.fillStyle = 'white';
  context.fillRect(0, 0, flattened.width, flattened.height);
  context.drawImage(image, 0, 0);
  await flattened.toFile(fileURLToPath(output));
  console.log(`Rendered ${fileURLToPath(output)}`);
} finally {
  timescope.dispose();
}
