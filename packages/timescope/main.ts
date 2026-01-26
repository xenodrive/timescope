import { Decimal, Timescope, type DecimalLike } from 'timescope';

const NUM_POINTS = 100000;
const start = new Date('2021-04-01 00:00:00').getTime() / 1000;
const STEP = 30;

const largeData: { time: Decimal; value: number }[] = [];
for (let i = 0; i < NUM_POINTS; i++) {
  const max = Math.random() < 0.001 ? 100 : 20;
  largeData.push({ time: Decimal(start + i * STEP), value: Math.random() * max });
}

import { IntervalTree } from './interval';

const tree = new IntervalTree<(typeof largeData)[number]>();
tree.bulkInsert(largeData, (x) => [x.time, x.time, '[]']);

// query on `largeData`
async function query(range: [Decimal | undefined, Decimal | undefined], resolution: Decimal) {
  if (!range[0] || !range[1]) return [];

  const result: { time: Decimal; value: number; min: number; max: number }[] = [];

  //let idx = largeData.findIndex((a) => a.time.ge(range[0]!));
  for (let t = range[0]; t.lt(range[1]); t = t.add(resolution)) {
    const values = tree.query(t, t.add(resolution)).map((item) => item.value);
    /*
    const eidx = largeData.findIndex((a) => a.time.ge(t));
    const values = largeData.slice(idx, eidx).map((v) => v.value);
    */
    if (values.length) {
      const value = values.reduce((a, b) => a + b, 0) / values.length;
      const min = Math.min(...values);
      const max = Math.max(...values);

      result.push({ time: t, value, min, max });
    }

    //idx = eidx;
  }

  if (result.length <= 1) {
    // includes prev / next points
    const last = tree.findMaxEndBefore(range[0]);
    const next = tree.findMinStartAfter(range[1]);

    return [last?.data, ...result, next?.data].filter(Boolean);
  }

  //  await new Promise((resolve) => setTimeout(resolve, 1000 * Math.random()));

  return result;
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
      async loader(chunk) {
        return query(chunk.range, chunk.resolution);
      },
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
        value: ['min', 'max', 'value'],
        domain: 'temperature',
      },
      chart: {
        links: [{ draw: 'line' }, { draw: 'area', using: ['min', 'max'] }],
        /*
        links: ({ resolution }) =>
          resolution.le(STEP / 8) ? [] : [{ draw: 'line' }, { draw: 'area', using: ['min', 'max'] }],
        marks: ({ resolution }) => {
          return resolution.le(STEP / 8) ? [{ draw: 'circle' }, { draw: 'line', using: ['value', '_zero'] }] : [];
        },
        */
      },
    },
    temperatureInline: {
      data: {
        source: 'telemetry',
        value: ['min', 'max', 'value'],
        domain: {
          range: [0, 80],
          unit: '°C',
          digits: 1,
        },
      },
      chart: {
        links: [{ draw: 'line' }, { draw: 'area', using: ['min', 'max'] }],
      },
    },
    temperatureAuto: {
      data: {
        source: 'telemetry',
        value: ['min', 'max', 'value'],
      },
      chart: {
        links: [{ draw: 'line' }, { draw: 'area', using: ['min', 'max'] }],
      },
    },
  },
});

timescope.on('load', () => {
  //  timescope.fitTo([largeData[0].time, largeData.at(-1).time], { padding: 100, animation: false });
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
