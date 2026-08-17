---
title: Audio Waveform Visualization
---

<template>
  <!-- #region html -->
  <div>
    <div id="example-audio-waveform"></div>
    <audio
      id="example-audio-player"
      src="/timescope/audio.wav"
      controls
      style="width: 100%"
    />
  </div>
  <!-- #endregion html -->
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted } from "vue";

// #region code
import { Timescope } from "timescope";

// #region docs-ignore
onMounted(() => {
  // #endregion docs-ignore

  const player = document.getElementById(
    "example-audio-player",
  ) as HTMLAudioElement;

  const audioContext = new AudioContext();

  async function decodeAudio(response: Response) {
    const audio = await audioContext.decodeAudioData(
      await response.arrayBuffer(),
    );
    const left = audio.getChannelData(0);
    const right = audio.numberOfChannels > 1 ? audio.getChannelData(1) : left;
    return Array.from({ length: audio.length }, (_, index) => ({
      time: index / audio.sampleRate,
      values: { waveformL: left[index], waveformR: right[index] },
    }));
  }

  const timescope = new Timescope({
    target: "#example-audio-waveform",
    style: { height: "320px" },
    time: 0,
    timeRange: [0, 0],
    zoom: 8,
    sources: {
      waveform: {
        url: player.src,
        decoder: decodeAudio,
        reducer: "min-max-avg",
      },
    },
    series: {
      waveformL: {
        data: {
          source: "waveform",
          domain: { range: [-1, 1] },
        },
        chart: {
          links: ({ resolution }) =>
            resolution.lt(0.00001)
              ? []
              : [
                  { draw: "line", using: "waveformL#avg" },
                  {
                    draw: "area",
                    using: ["waveformL#min", "waveformL#max"],
                  },
                ],
          marks: ({ resolution }) =>
            resolution.lt(0.00001)
              ? [
                  { draw: "line", using: ["waveformL#avg", "#zero"] },
                  { draw: "circle", using: "waveformL#avg" },
                ]
              : [],
        },
        track: "waveformL",
        tooltip: false,
      },
      waveformR: {
        data: {
          source: "waveform",
          domain: { range: [-1, 1] },
        },
        chart: {
          links: ({ resolution }) =>
            resolution.lt(0.00001)
              ? []
              : [
                  { draw: "line", using: "waveformR#avg" },
                  {
                    draw: "area",
                    using: ["waveformR#min", "waveformR#max"],
                  },
                ],
          marks: ({ resolution }) =>
            resolution.lt(0.00001)
              ? [
                  { draw: "line", using: ["waveformR#avg", "#zero"] },
                  { draw: "circle", using: "waveformR#avg" },
                ]
              : [],
        },
        track: "waveformR",
        tooltip: false,
      },
    },
    tracks: {
      waveformL: {
        symmetric: true,
        timeAxis: false,
      },
      waveformR: {
        symmetric: true,
        timeAxis: { relative: true },
      },
    },
  });

  let playing = false;
  let frameLatch: ReturnType<Timescope["latchFrame"]> | null = null;
  let animationFrame: number | null = null;
  let playbackStartedAt = 0;
  let playbackStartedFrom = 0;

  function resetPlaybackClock() {
    playbackStartedAt = Date.now();
    playbackStartedFrom = player.currentTime;
    timescope.setPlaybackTime(0);
    timescope.setTime(null, false);
  }

  function currentPlaybackTime() {
    return (
      playbackStartedFrom +
      ((Date.now() - playbackStartedAt) / 1000) * player.playbackRate
    );
  }

  async function update() {
    if (!playing) return;

    frameLatch = timescope.latchFrame();
    timescope.setPlaybackTime(currentPlaybackTime());

    try {
      await frameLatch.commit();
    } catch {
      // A direct interaction can supersede the pending playback frame.
    } finally {
      frameLatch = null;
    }

    if (playing) animationFrame = requestAnimationFrame(update);
  }

  function onPlay() {
    resetPlaybackClock();
    playing = true;
    void update();
  }

  function onPause() {
    playing = false;
    frameLatch?.abort();
    timescope.setPlaybackTime(player.currentTime);
  }

  function onSeeking() {
    if (playing) {
      resetPlaybackClock();
    } else if (!timescope.editing && !timescope.animating) {
      timescope.setTime(player.currentTime, false);
    }
  }

  function onRateChange() {
    if (playing) resetPlaybackClock();
  }

  timescope.on("timechanging", (e) => {
    if (!playing) {
      player.currentTime = e.value?.number() ?? 0;
    }
  });

  function onDurationChange() {
    timescope.setTimeRange([0, player.duration]);
  }

  player.addEventListener("play", onPlay);
  player.addEventListener("pause", onPause);
  player.addEventListener("seeking", onSeeking);
  player.addEventListener("ratechange", onRateChange);
  player.addEventListener("durationchange", onDurationChange);

  // #endregion code

  onBeforeUnmount(() => {
    playing = false;
    frameLatch?.abort();
    if (animationFrame != null) cancelAnimationFrame(animationFrame);
    player.removeEventListener("play", onPlay);
    player.removeEventListener("pause", onPause);
    player.removeEventListener("seeking", onSeeking);
    player.removeEventListener("ratechange", onRateChange);
    player.removeEventListener("durationchange", onDurationChange);
    void audioContext.close();
    timescope.dispose();
  });
});
</script>
