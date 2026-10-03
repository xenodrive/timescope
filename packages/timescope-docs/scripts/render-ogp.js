import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { parse } from 'yaml';
import pkg from '../../../package.json' with { type: 'json' };

const { values } = parseArgs({
  options: {
    output: { type: 'string', short: 'o' },
    seed: { type: 'string', default: 'timescope-ogp' },
    help: { type: 'boolean', short: 'h' },
  },
});

if (values.help) {
  console.log('Usage: node packages/timescope-docs/scripts/render-ogp.js [--seed TEXT] [--output FILE]');
  process.exit(0);
}

// Register only our local fonts; avoid machine-specific font discovery on Linux.
process.env.FONTCONFIG_FILE = fileURLToPath(new URL('ogp-fonts.conf', import.meta.url));
const { Canvas, FontLibrary, loadImage } = await import('skia-canvas');

const width = 1200;
const height = 630;
const output = values.output
  ? resolve(values.output)
  : fileURLToPath(new URL('../src/public/ogp.png', import.meta.url));

// Read the shared description and the landing page's remaining copy and logo.
const markdown = await readFile(new URL('../src/index.md', import.meta.url), 'utf8');
const frontmatter = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
if (!frontmatter) throw new Error('Missing landing page frontmatter.');
const { hero } = parse(frontmatter[1]);
hero.text = pkg.description;
for (const key of ['name', 'text', 'tagline']) {
  if (typeof hero?.[key] !== 'string' || !hero[key].trim()) throw new Error(`Missing hero.${key}.`);
}
if (typeof hero.image?.src !== 'string') throw new Error('Missing hero.image.src.');

FontLibrary.use(
  'OGP Inter',
  ['Inter_18pt-Regular.ttf', 'Inter_18pt-SemiBold.ttf', 'Inter_18pt-Bold.ttf'].map((file) =>
    fileURLToPath(new URL(`../../../misc/static/${file}`, import.meta.url)),
  ),
);
FontLibrary.use('OGP Timescope', [
  fileURLToPath(new URL('../../timescope/src/assets/fonts/Timescope.woff2', import.meta.url)),
]);

const canvas = new Canvas(width, height);
canvas.gpu = false;
const context = canvas.getContext('2d');
context.fontHinting = false;

drawBackground(context, values.seed);

// Fixed-size OGP layout, following the landing page's typography and spacing.
const x = 72;
context.font = '600 36px "OGP Inter"';
context.letterSpacing = '-0.9px';
const headline = wrapText(context, hero.text, 620, true);
context.font = '400 18px "OGP Inter"';
context.letterSpacing = '0px';
const description = wrapText(context, hero.tagline, 620);
const contentHeight = 60 + headline.length * 45 + 14 + description.length * 28 + 16 + 38;
if (contentHeight > height - 96) throw new Error('Hero copy is too long for the OGP layout.');
let y = (height - contentHeight) / 2;

context.textBaseline = 'alphabetic';
context.font = '700 54px "OGP Inter"';
context.letterSpacing = '-0.4px';
const nameGradient = context.createLinearGradient(x, y, x + context.measureText(hero.name).width, y + 60);
nameGradient.addColorStop(0, '#7ce7ff');
nameGradient.addColorStop(0.45, '#38c2e4');
nameGradient.addColorStop(1, '#26a7c6');
context.fillStyle = nameGradient;
context.fillText(hero.name, x, y + 49);
y += 60;

context.font = '600 36px "OGP Inter"';
context.letterSpacing = '-0.9px';
context.fillStyle = '#f2f8fb';
for (const line of headline) {
  context.fillText(line, x, y + 35);
  y += 45;
}
y += 14;
context.font = '400 18px "OGP Inter"';
context.letterSpacing = '0px';
context.fillStyle = '#a9c2ce';
for (const line of description) {
  context.fillText(line, x, y + 20);
  y += 28;
}
y += 16;

context.beginPath();
context.roundRect(x + 0.5, y + 0.5, 265, 37, 8);
context.fillStyle = '#062b40';
context.fill();
context.strokeStyle = '#297393';
context.lineWidth = 1;
context.stroke();
context.font = '400 14px "OGP Timescope"';
context.fillStyle = '#7aa0ae';
context.fillText('$', x + 13, y + 24);
context.fillStyle = '#eefaff';
context.fillText('npm install timescope', x + 37, y + 24);
context.strokeStyle = '#83afbf';
context.strokeRect(x + 237, y + 15, 9, 9);
context.beginPath();
context.moveTo(x + 237, y + 21);
context.lineTo(x + 234, y + 21);
context.lineTo(x + 234, y + 12);
context.lineTo(x + 243, y + 12);
context.lineTo(x + 243, y + 15);
context.stroke();

const logoPath = new URL(`../src/public/${hero.image.src.replace(/^\//, '')}`, import.meta.url);
const svg = await readFile(logoPath, 'utf8');
// Decode at the display size rather than upscaling the SVG's 22px intrinsic size.
const logo = await loadImage(
  Buffer.from(svg.replace(/\bwidth="[^"]*"/, 'width="210"').replace(/\bheight="[^"]*"/, 'height="210"')),
);
context.drawImage(logo, 865, (height - 210) / 2, 210, 210);

const png = await canvas.toBuffer('png', { density: 1 });
await mkdir(dirname(output), { recursive: true });
await writeFile(output, png);
console.log(`Rendered ${output} (${width} × ${height}, seed: ${JSON.stringify(values.seed)})`);
console.log(`SHA-256: ${createHash('sha256').update(png).digest('hex')}`);

function wrapText(ctx, text, maxWidth, balance = false) {
  const words = text.trim().split(/\s+/);
  if (words.some((word) => ctx.measureText(word).width > maxWidth)) {
    throw new Error('A word in the hero copy is too wide for the OGP layout.');
  }
  const wrap = (limit) => {
    const lines = [];
    let line = '';
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(next).width > limit) {
        lines.push(line);
        line = word;
      } else {
        line = next;
      }
    }
    return [...lines, line];
  };
  const lines = wrap(maxWidth);
  if (!balance || lines.length === 1) return lines;
  // Find the narrowest width that preserves the line count, like text-wrap: balance.
  let low = Math.max(...words.map((word) => ctx.measureText(word).width));
  let high = maxWidth;
  while (high - low > 0.25) {
    const middle = (low + high) / 2;
    if (wrap(middle).length > lines.length) low = middle;
    else high = middle;
  }
  return wrap(high);
}

function drawBackground(ctx, seed) {
  const image = ctx.createImageData(width, height);
  const light = new Float32Array(width * height * 3);
  let state = createHash('sha256').update(seed).digest().readUInt32LE(0);
  // Mulberry32: fixed integer arithmetic, independent of Math.random and wall time.
  const random = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), state | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
  const smoothstep = (a, b, value) => {
    const t = Math.max(0, Math.min(1, (value - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  const lift = 1 - smoothstep(15, 55, 40);

  // Straight flight through a fixed cylindrical star field; a 75ms exposure at 40 units/s.
  // Light profiles follow warp-background.worker.ts: a white core, colored halo,
  // fading trail and a round flare at the leading tip. Evaluate them on the CPU.
  for (let i = 0; i < 1200; i++) {
    const angle = random() * Math.PI * 2;
    const radial = random();
    const depth = 3 + random() * 137;
    const radius = Math.sqrt(9 + radial * 1591);
    const scale = 0.55 + 1.05 * random() ** 2;
    const proximity = 1 - smoothstep(3, 110, depth);
    const spread = (0.55 + 8 * proximity ** 3) * scale;
    const distance = (radius * height * 0.9) / depth;
    const trailLength = Math.max(0.5, distance - (radius * height * 0.9) / (depth + 3 * scale));
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    const headX = width / 2 + dx * distance;
    const headY = height / 2 + dy * distance;
    const tailX = headX - dx * trailLength;
    const tailY = headY - dy * trailLength;
    const minX = Math.max(0, Math.floor(Math.min(headX, tailX) - spread));
    const maxX = Math.min(width - 1, Math.ceil(Math.max(headX, tailX) + spread));
    const minY = Math.max(0, Math.floor(Math.min(headY, tailY) - spread));
    const maxY = Math.min(height - 1, Math.ceil(Math.max(headY, tailY) + spread));
    const brightness =
      (1 - smoothstep(100, 140, depth)) *
      (0.015 + 0.07 * lift + (1.285 - 0.07 * lift) * proximity ** (3 - 0.7 * lift)) *
      (0.25 + radial * 0.7);
    const color = radial > 0.82 ? [1, 0.55, 0.25] : [0.28 + 0.58 * radial, 0.61 + 0.33 * radial, 1];

    for (let py = minY; py <= maxY; py++) {
      for (let px = minX; px <= maxX; px++) {
        if (Math.abs(-(px + 0.5 - headX) * dy + (py + 0.5 - headY) * dx) > spread + 1) continue;
        const offset = (py * width + px) * 3;
        // Fixed 4×4 subpixel sampling keeps the fine cores smooth at every angle.
        for (let sample = 0; sample < 16; sample++) {
          const x = px + ((sample % 4) + 0.5) / 4 - headX;
          const y = py + (Math.floor(sample / 4) + 0.5) / 4 - headY;
          const along = -(x * dx + y * dy);
          const across = Math.abs(-x * dy + y * dx) / spread;
          if (across >= 1 || along < -spread || along > trailLength + spread) continue;
          const u = along / trailLength;
          const core = Math.exp(-across * across * 110);
          const halo = Math.exp(-across * across * 4) * 0.36;
          const tail = Math.max(0, 1 - u) ** 0.65 * smoothstep(0, 0.12, u);
          const glow = (core + halo) * (1 - smoothstep(0.7, 1, across));
          const radiusSquared = (along / spread) ** 2 + across * across;
          const pointCore = Math.exp(-radiusSquared * 85);
          const pointHalo = Math.exp(-radiusSquared * 5) * 0.55 * (1 - smoothstep(0.7, 1, Math.sqrt(radiusSquared)));
          const alpha = ((glow * tail + pointCore + pointHalo) * brightness) / 16;
          const white = Math.max(core * 0.5, pointCore * 0.9);
          for (let channel = 0; channel < 3; channel++) {
            light[offset + channel] += (color[channel] + (1 - color[channel]) * white) * alpha;
          }
        }
      }
    }
  }

  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      const blue = Math.max(0, 1 - Math.hypot(px / width, (py / height - 0.85) * 1.4) / 0.65);
      const violet = Math.max(0, 1 - Math.hypot(px / width - 0.9, (py / height - 0.15) * 1.4) / 0.7);
      const pixel = py * width + px;
      const base = [2 + blue * 16 + violet * 14, 6 + blue * 45 + violet * 21, 12 + blue * 61 + violet * 37];
      for (let channel = 0; channel < 3; channel++) {
        image.data[pixel * 4 + channel] = Math.min(255, Math.round(base[channel] + light[pixel * 3 + channel] * 255));
      }
      image.data[pixel * 4 + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
}
