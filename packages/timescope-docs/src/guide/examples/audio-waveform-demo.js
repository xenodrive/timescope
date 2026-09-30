import { Timescope } from 'timescope';

export function createAudioWaveformDemo(target) {
  // #region example
  const player = document.getElementById('example-audio-player');
  const loadButton = document.getElementById('example-audio-load');
  const fileInput = document.getElementById('example-audio-file');
  let fileUrl = null;
  const audioContext = new AudioContext();

  async function decodeAudio(response) {
    const audio = await audioContext.decodeAudioData(await response.arrayBuffer());
    const left = audio.getChannelData(0);
    const right = audio.numberOfChannels > 1 ? audio.getChannelData(1) : left;
    return Array.from({ length: audio.length }, (_, index) => ({
      time: index / audio.sampleRate,
      values: { waveformL: left[index], waveformR: right[index] },
    }));
  }

  const timescope = new Timescope({
    target,
    time: 0,
    timeRange: [0, 0],
    zoom: 8,
    sources: { waveform: { url: player.src, decoder: decodeAudio, type: 'point-aggregate' } },
    series: {
      waveformL: {
        data: { source: 'waveform', domain: { range: [-1, 1] } },
        chart: {
          links: ({ resolution }) =>
            resolution.lt(0.00001)
              ? []
              : [
                  { draw: 'line', using: 'waveformL#avg' },
                  { draw: 'area', using: ['waveformL#min', 'waveformL#max'] },
                ],
          marks: ({ resolution }) =>
            resolution.lt(0.00001)
              ? [
                  { draw: 'line', using: ['waveformL#avg', '#zero'] },
                  { draw: 'circle', using: 'waveformL#avg' },
                ]
              : [],
        },
        track: 'waveformL',
        tooltip: false,
      },
      waveformR: {
        data: { source: 'waveform', domain: { range: [-1, 1] } },
        chart: {
          links: ({ resolution }) =>
            resolution.lt(0.00001)
              ? []
              : [
                  { draw: 'line', using: 'waveformR#avg' },
                  { draw: 'area', using: ['waveformR#min', 'waveformR#max'] },
                ],
          marks: ({ resolution }) =>
            resolution.lt(0.00001)
              ? [
                  { draw: 'line', using: ['waveformR#avg', '#zero'] },
                  { draw: 'circle', using: 'waveformR#avg' },
                ]
              : [],
        },
        track: 'waveformR',
        tooltip: false,
      },
    },
    tracks: {
      waveformL: { symmetric: true, timeAxis: { relative: true } },
      waveformR: { symmetric: true, timeAxis: { relative: true } },
    },
  });

  let playing = false;
  let playbackGeneration = 0;
  let pendingView = null;
  let animationFrame = null;

  function stopPlayback() {
    playing = false;
    playbackGeneration++;
    pendingView?.abort();
    pendingView = null;
    if (animationFrame != null) cancelAnimationFrame(animationFrame);
    animationFrame = null;
  }

  async function update(generation) {
    if (!playing || generation !== playbackGeneration) return;
    const view = timescope.prepareView();
    pendingView = view;
    view.setPlaybackTime(player.currentTime);
    try {
      await view.fetch();
    } catch {
      // A direct interaction can supersede the pending playback frame.
    } finally {
      if (pendingView === view) pendingView = null;
    }
    if (playing && generation === playbackGeneration) {
      animationFrame = requestAnimationFrame(() => {
        animationFrame = null;
        void update(generation);
      });
    }
  }

  function onPlay() {
    if (playing) return;
    timescope.setPlaybackTime(player.currentTime);
    timescope.setTime(null, false);
    playing = true;
    void update(++playbackGeneration);
  }

  function onPause() {
    stopPlayback();
    timescope.setPlaybackTime(player.currentTime);
  }

  function onSeeking() {
    timescope.setPlaybackTime(player.currentTime);
    if (!playing && !timescope.editing && !timescope.animating) timescope.setTime(player.currentTime, false);
  }

  timescope.on('timechanging', ({ value }) => {
    if (value !== null && player.currentTime !== value.number()) player.currentTime = value.number();
  });
  timescope.on('timechanged', ({ value }) => {
    if (playing && value !== null) timescope.setTime(null, false);
  });

  function onDurationChange() {
    if (Number.isFinite(player.duration)) timescope.setTimeRange([0, player.duration]);
  }

  function onFileChange() {
    const file = fileInput.files?.[0];
    if (!file) return;
    player.pause();
    stopPlayback();
    const url = URL.createObjectURL(file);
    timescope.setPlaybackTime(0);
    timescope.setTime(0, false);
    timescope.setTimeRange([0, 0]);
    timescope.updateOptions({ sources: { waveform: { url, decoder: decodeAudio, type: 'point-aggregate' } } });
    player.src = url;
    player.load();
    if (fileUrl) URL.revokeObjectURL(fileUrl);
    fileUrl = url;
    fileInput.value = '';
  }

  function onLoadClick() {
    fileInput.click();
  }

  loadButton.addEventListener('click', onLoadClick);
  fileInput.addEventListener('change', onFileChange);
  player.addEventListener('play', onPlay);
  player.addEventListener('pause', onPause);
  player.addEventListener('seeking', onSeeking);
  player.addEventListener('durationchange', onDurationChange);

  // #endregion example
  return () => {
    stopPlayback();
    player.removeEventListener('play', onPlay);
    player.removeEventListener('pause', onPause);
    player.removeEventListener('seeking', onSeeking);
    player.removeEventListener('durationchange', onDurationChange);
    loadButton.removeEventListener('click', onLoadClick);
    fileInput.removeEventListener('change', onFileChange);
    if (fileUrl) URL.revokeObjectURL(fileUrl);
    void audioContext.close();
    timescope.dispose();
  };
}
