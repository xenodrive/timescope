import { Timescope } from 'timescope';

const timescope = new Timescope({
  target: '#timescope',
  style: { height: '160px', background: '#f5f5f5' },
  time: 0,
  zoom: 4,
  showFps: true,

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
        links: [{ draw: 'line', using: 'value' }],
      },
    },
  },
});

const button = document.getElementById('button');
button?.addEventListener('click', () => {
  timescope.fitTo(['2000-01-01', '2020-12-31'], { padding: 100 });
});
