import { Decimal, Timescope } from 'timescope';

const NUM_POINTS = 100000;
const start = new Date('2021-04-01 00:00:00').getTime() / 1000;
const STEP = 30;

const largeData: { time: Decimal; value: number }[] = [];
for (let i = 0; i < NUM_POINTS; i++) {
  const max = Math.random() < 0.001 ? 100 : 20;
  largeData.push({ time: Decimal(start + i * STEP), value: Math.random() * max });
}

const timescope = new Timescope({
  target: '#timescope',
  style: { height: '160px', background: '#f5f5f5' },
  time: '2021-04-10',
  zoom: 8,
  showFps: true,

  // timeRange: [largeData[0].time, largeData.at(-1).time],

  sources: {
    telemetry: {
      data: largeData,
      immediate: true,
      //reducer: 'percentiles',
    },
  },

  domains: {
    temperature: {
      range: [0, 120],
      unit: '°C',
      digits: 1,
    },
  },

  series: {
    temperature: {
      data: {
        source: 'telemetry',
        domain: 'temperature',
      },
      chart: {
        links: [
          { draw: 'line', using: 'value' },
          { draw: 'area', using: ['value#min', 'value#max'] },
        ],
        /*
        links: ({ resolution }) =>
          resolution.le(STEP / 8)
            ? []
            : [
                { draw: 'line', using: 'value#p50' },
                { draw: 'area', using: ['value#min', 'value#max'] },
              ],
        marks: ({ resolution }) => {
          return resolution.le(STEP / 8)
            ? [{ draw: 'circle', using: 'value#p50' }, { draw: 'line', using: ['value#p50', '#zero'] }]
            : [];
        },
        */
      },
    },
    temperatureInline: {
      data: {
        source: 'telemetry',
        domain: {
          range: [0, 80],
          unit: '°C',
          digits: 1,
        },
      },
      chart: {
        links: [
          { draw: 'line', using: 'value' },
          { draw: 'area', using: ['value#min', 'value#max'] },
        ],
      },
    },
    temperatureAuto: {
      data: {
        source: 'telemetry',
      },
      chart: {
        links: [
          { draw: 'line', using: 'value' },
          { draw: 'area', using: ['value#min', 'value#max'] },
        ],
      },
    },
  },
});

timescope.on('load', () => {
  //  timescope.fitTo([largeData[0].time, largeData.at(-1).time], { padding: 100, animation: false });
});

timescope.on('selectionrangechanged', (e) => {
  if (e.value) timescope.fitTo(e.value);
});

const button = document.getElementById('button');
button?.addEventListener('click', () => {
  // timescope.fitTo(['2021-01-01', '2020-12-31'], { padding: 100 });
  timescope.fitTo([largeData[0].time, largeData.at(-1).time], { padding: 100 });
  //  timescope.redraw();
});
document.getElementById('plus')?.addEventListener('click', () => {
  timescope.setZoom(timescope.zoom + 1);
});
document.getElementById('minus')?.addEventListener('click', () => {
  timescope.setZoom(timescope.zoom - 1);
});
