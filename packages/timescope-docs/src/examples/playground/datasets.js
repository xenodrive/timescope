import { annotationData } from '../annotation-data.js';

const recording = annotationData();
export const datasets = {
  basicChart: {
    fields: ['value'],
    data: [12, 24, 18, 42, 35, 48, 20, 32, 26].map((value, index) => ({ time: index * 7.5, value })),
  },
  response: {
    fields: ['value'],
    data: Array.from({ length: 16 }, (_, index) => {
      const time = index * 4;
      const decay = 10 ** (4 - time / 12);
      const bump = 1 + 6 * Math.exp(-(((time - 44) / 2.8) ** 2));
      return { time, value: decay * bump };
    }),
  },
  autoRange: {
    fields: ['value', 'comparison', 'sine', 'activity'],
    data: Array.from({ length: 1001 }, (_, index) => {
      const time = index / 2;
      const section = Math.min(4, Math.floor(time / 100));
      const local = time % 100;
      const base = [4, 4, 4, 120, -80][section];
      const impact = section === 1 ? 45 * Math.exp(-(((local - 50) / 5) ** 2)) : 0;
      const value = base + Math.sin(time * 0.25) * 1.4 + Math.cos(time * 0.63) * 0.4 + impact;
      return {
        time,
        values: {
          value,
          comparison:
            base * 0.65 +
            2 +
            3 * Math.sin(time * 0.17 + 1.2) +
            (section === 1 ? 28 * Math.exp(-(((local - 62) / 9) ** 2)) : 0),
          sine: 22 * Math.sin((2 * Math.PI * time) / 80),
          activity:
            35 + 18 * Math.sin(time / 28) + 9 * Math.cos(time / 11) + 20 * Math.exp(-(((time - 235) / 45) ** 2)),
        },
      };
    }),
  },
  measurements: {
    fields: ['value', 'min', 'max'],
    data: Array.from({ length: 121 }, (_, index) => {
      const time = index / 2;
      const value = 30 + 12 * Math.sin(time / 5);
      return { time, values: { value, min: value - 5, max: value + 5 } };
    }),
  },
  tasks: {
    fields: ['lane@start', 'lane@middle', 'lane@end'],
    data: [
      { name: 'Receive', start: 0, end: 2.4, lane: 4, color: '#38bdf8' },
      { name: 'Decode', start: 1.8, end: 4.8, lane: 3, color: '#818cf8' },
      { name: 'Transform', start: 3.4, end: 7.5, lane: 2, color: '#c084fc' },
      { name: 'Render', start: 6.5, end: 9.6, lane: 1, color: '#2dd4bf' },
    ].map((task) => ({
      times: { start: task.start, middle: (task.start + task.end) / 2, end: task.end },
      values: { lane: task.lane },
      data: task,
    })),
  },
  signal: { fields: ['value'], data: recording.samples },
  events: { fields: ['value', 'labelHeight'], data: recording.events },
};
