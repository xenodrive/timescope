import { Timescope } from 'timescope';

export function createTimelineDemo(target) {
  // #region example
  const timeline = [
    { time: '2026-10-05T08:35:00Z', color: '#0d9488' },
    { time: '2026-10-05T09:10:00Z', color: '#8b5cf6' },
    { time: '2026-10-05T10:50:00Z', color: '#3b82f6' },
    { time: '2026-10-05T11:45:00Z', color: '#0d9488' },
    { time: '2026-10-05T13:40:00Z', color: '#f59e0b' },
    { time: '2026-10-05T14:20:00Z', color: '#3b82f6' },
    { time: '2026-10-05T16:10:00Z', color: '#8b5cf6' },
    { time: '2026-10-05T17:25:00Z', color: '#f59e0b' },
    { time: '2026-10-05T18:10:00Z', color: '#0d9488' },
  ];
  const timescope = new Timescope({
    target,
    fit: ['2026-10-05T08:00:00Z', '2026-10-05T19:00:00Z'],
    timeRange: [undefined, undefined],
    sources: {
      timeline: timeline.map(({ time, color }) => ({ time, values: {}, data: { color } })),
    },
    series: {
      timeline: {
        data: { source: 'timeline' },
        chart: {
          marks: [
            {
              draw: 'path',
              using: '#zero',
              style: {
                // MDI map-marker (24 × 24 SVG), anchored at its bottom-center tip.
                path: 'M12 11.5A2.5 2.5 0 0 1 9.5 9A2.5 2.5 0 0 1 12 6.5A2.5 2.5 0 0 1 14.5 9a2.5 2.5 0 0 1-2.5 2.5M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7',
                origin: [12, 22],
                scale: 1 / 24,
                size: 24,
                fillColor: ({ data }) => data.color,
                lineWidth: 0,
              },
            },
          ],
        },
      },
    },
    tracks: { default: { timeAxis: { timeZone: 'utc' } } },
  });
  // #endregion example
  return () => timescope.dispose();
}
