# Timescope

Canvas for Time-Series Visualization

## Features

- Infinite scrolling and unlimited zoom
- Arbitrary-precision cursors and ranges so any timestamp can be represented exactly
- Chunked data loading with various data sources (static arrays, HTTP, custom loaders)
- Multi-track layouts with per-track time axes and synchronized cursors
- Rich chart presets plus configurable marks and links, fully typed for TypeScript

## Installation

```bash
npm i timescope
```

## Quick Start

```html
<div id="timescope"></div>
```

```TypeScript
import { Timescope } from 'timescope';

new Timescope({
  target: '#timescope',
  style: { height: '160px', background: '#f5f5f5' },
  time: 0,
  zoom: 4,

  sources: {
    telemetry: [
      { time: 0, temperature: 22, envelope: { min: 20, max: 28 } },
      { time: 30, temperature: 25, envelope: { min: 21, max: 30 } },
      { time: 60, temperature: 24, envelope: { min: 22, max: 27 } },
    ],
  },

  series: {
    temperature: {
      data: {
        source: 'telemetry',
        value: 'temperature',
      },
      chart: 'linespoints',
    },
    envelope: {
      data: {
        source: 'telemetry',
        value: {
          min: 'envelope.min',
          max: 'envelope.max',
          value: (row) => (row.envelope.min + row.envelope.max) / 2,
        },
        color: '#8888ff',
      },
      chart: {
        marks: [
          { draw: 'triangle', using: 'value', style: { size: 6 } },
          { draw: 'box', using: ['min', 'max'] },
        ],
        links: [
          { draw: 'line', using: 'value' },
        ],
      },
    },
  },
});
```

## Documents

See the [documents](https://xenodrive.github.io/timescope/) for more details.
