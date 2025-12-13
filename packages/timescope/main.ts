import { Timescope } from 'timescope';

const timescope = new Timescope({
  target: '#timescope',
  style: { height: '160px', background: '#f5f5f5' },
  time: 34,
  zoom: 1,
  showFps: true,

  sources: {
    telemetry: [
      { time: 0, temperature: -20, envelope: { min: 20, max: 28 }, test: -30 },
      { time: 30, temperature: 25, envelope: { min: 21, max: 30 }, test: -15 },
      { time: 60, temperature: 24, envelope: { min: 22, max: 27 }, test: -21 },
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
    /*
    test: {
      data: {
        source: 'telemetry',
        value: 'test',
      },
      chart: 'linespoints',
    },
    envelope: {
      data: {
        source: 'telemetry',
        value: {
          min: 'envelope.min',
          max: 'envelope.max',
          //value: (row) => (row.envelope.min + row.envelope.max) / 2,
          value: 'envelope.min',
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
    /*
    */
  },
  /*
  tracks: {
    default: {
      timeAxis: {
        timeFormat: {
          date: (opt) => {
            return `${String(opt.month).padStart(2, '0')}/${String(opt.day).padStart(2, '0')} (${'日月火水木金土'[opt.week]})`;
          },
        },
      }
    }
  },
  */
});

const button = document.getElementById('button');
button?.addEventListener('click', () => {
  // timescope.fitTo(['2000-01-01', '2020-12-31'], { padding: 100 });
  timescope.redraw();
});
