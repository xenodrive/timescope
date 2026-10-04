# Timescope

**User Interface for Time Travel**

An infinite time slider that can display charts

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
<div id="timescope" style="height: 160px; background: #f5f5f5"></div>
```

```TypeScript
import { Timescope } from 'timescope';

new Timescope({
  target: '#timescope',
  time: 0,
  zoom: 4,

  sources: {
    temperature: [
      { time: 0, value: 22 },
      { time: 30, value: 25 },
      { time: 60, value: 24 },
    ],
    envelope: [
      { time: 0, values: { min: 20, max: 28, value: 24 } },
      { time: 30, values: { min: 21, max: 30, value: 25.5 } },
      { time: 60, values: { min: 22, max: 27, value: 24.5 } },
    ],
  },

  series: {
    temperature: {
      data: {
        source: 'temperature',
      },
      chart: 'linespoints',
    },
    envelope: {
      data: {
        source: 'envelope',
        color: '#8888ff',
      },
      chart: {
        marks: [
          { draw: 'triangle', using: 'value', style: { size: 6 } },
          { draw: 'bar', using: ['min', 'max'] },
        ],
        links: [
          { draw: 'line', using: 'value' },
        ],
      },
    },
  },
});
```

## Advanced rendering

To share chart configuration and data loaders between the browser and server, see [Running on Node.js](https://xenodrive.github.io/timescope/guide/advanced/running-on-node).

## Documentation

See the [documentation](https://xenodrive.github.io/timescope/) for more details.
