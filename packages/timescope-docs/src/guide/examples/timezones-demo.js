import { Timescope } from 'timescope';

export function createTimezonesDemo(target) {
  // #region example
  const timescope = new Timescope({
    target,
    zoom: -5,
    tracks: {
      utc: { height: 80, timeAxis: { timeZone: 'utc' } },
      local: { height: 80, timeAxis: { timeZone: 'local' } },
      tokyo: { height: 80, timeAxis: { timeZone: 'Asia/Tokyo' } },
      newYork: { height: 80, timeAxis: { timeZone: 'America/New_York' } },
    },
  });
  // #endregion example
  return () => timescope.dispose();
}
