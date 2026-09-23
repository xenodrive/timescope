import { createDataSource, Timescope } from 'timescope';

// A synthetic pulse train, sampled at 100 Hz.
function pulse(time) {
  const phase = time % 1.2;
  return (
    0.08 * Math.exp(-(((phase - 0.2) / 0.045) ** 2)) -
    0.16 * Math.exp(-(((phase - 0.39) / 0.018) ** 2)) +
    Math.exp(-(((phase - 0.43) / 0.014) ** 2)) -
    0.23 * Math.exp(-(((phase - 0.47) / 0.02) ** 2)) +
    0.22 * Math.exp(-(((phase - 0.72) / 0.09) ** 2)) +
    0.025 * Math.sin(time * 2)
  );
}

export function createLiveSignal(target, { running = false, speed = 1, onProgress = () => {} } = {}) {
  const sampleRate = 100;
  const frameInterval = 1 / 60;
  let index = 600;
  let playbackTime = (index - 1) / sampleRate;
  let disposed = false;
  let appending = false;
  const source = createDataSource({
    type: 'point-aggregate',
    data: Array.from({ length: index }, (_, i) => ({ time: i / sampleRate, value: pulse(i / sampleRate) })),
  });
  const options = {
    target,
    time: running ? null : playbackTime,
    zoom: 6,
    style: { height: '300px' },
    sources: { signal: source },
    series: {
      signal: {
        data: {
          source: 'signal',
          name: 'Pulse',
          color: '#e11d48',
          domain: { range: [-0.35, 1.1], axis: 'left' },
          instantaneous: { resolution: 1 / sampleRate },
        },
        chart: {
          links: [
            { draw: 'area', using: ['value#min', 'value#max'], style: { fillColor: '#fda4af', fillOpacity: 0.5 } },
            { draw: 'line', using: 'value#avg', style: { lineColor: '#e11d48', lineWidth: 1.5 } },
          ],
        },
      },
    },
    tracks: { default: { timeAxis: { relative: true } } },
  };
  const timescope = new Timescope(options);
  timescope.setPlaybackTime(playbackTime);
  onProgress({ samples: index, time: playbackTime });
  let initialPause = !running;
  const timer = setInterval(async () => {
    if (!running || disposed || appending) return;
    appending = true;
    try {
      const nextTime = playbackTime + frameInterval * speed;
      const nextIndex = Math.floor(nextTime * sampleRate) + 1;
      const rows = Array.from({ length: nextIndex - index }, () => {
        const time = index++ / sampleRate;
        return { time, value: pulse(time) };
      });
      await source.append(rows);
      if (disposed) return;
      playbackTime = nextTime;
      timescope.setPlaybackTime(playbackTime);
      onProgress({ samples: index, time: playbackTime });
    } catch (error) {
      if (!disposed) {
        running = false;
        console.error('Failed to append signal samples', error);
      }
    } finally {
      appending = false;
    }
  }, frameInterval * 1000);
  return {
    timescope,
    setRunning(value) {
      if (value && initialPause && timescope.time?.eq(playbackTime)) timescope.setTime(null, false);
      if (value) initialPause = false;
      running = value;
    },
    setSpeed(value) {
      speed = value;
    },
    follow() {
      timescope.setTime(null, false);
    },
    cleanup() {
      disposed = true;
      clearInterval(timer);
      timescope.dispose();
      source.dispose?.();
    },
  };
}
