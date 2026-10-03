---
title: Live Streaming
---

<script setup>
import ExampleLiveStream from '../../examples/live-stream.vue';
</script>

# Live Streaming

Draw samples as they arrive and keep the view on the latest data. Data updates and time navigation are independent: append to a source to change the signal, and advance the clock to follow it. Try the [Live Stream example](/examples/gallery#live-stream) to see both together.

<ClientOnly><ExampleLiveStream /></ClientOnly>

Press **Start** to append samples, pan away to inspect history, and use **Follow live** to return to the newest data. The demo starts with six seconds of a synthetic pulse signal and produces new samples at 100 Hz. The excerpts below come from this running example.

## Append incoming samples {#append-live-points}

Use a `'point-aggregate'` source for an ordered stream. Its `append()` method updates the chart automatically and supports [decimation](/guide/drawing-a-chart#decimation) as the recording grows. Here `pulse(time)` generates a sample value; an application would receive those values from its data producer:

<<< ../../examples/live-signal.js#stream-source{js}

Each timer tick generates the next batch, awaits `append()`, then advances the playback clock. The timer skips ticks while a batch is in progress or the stream is paused:

<<< ../../examples/live-signal.js#append-batch{js}

::: details Chart configuration used in this example
The source is registered as `signal`. The drawing combines an average line with a min/max envelope, as in [Styling](./styling#show-an-aggregate-envelope). `running` is initially `false`, so the first view is paused at the latest recorded sample. `target` is the demo's host element.

<<< ../../examples/live-signal.js#stream-chart{js}
:::

Supply points in time order, including across calls. Equal times are allowed, but a new point cannot precede an earlier one. Serialize incoming batches if your producer invokes an asynchronous receiver without awaiting it.

There is no need to call `reload()` after appending. Invalidation replaces the source's snapshot from its original input, so it would discard appended points absent from that input. Only `'point-aggregate'` supports appending; see the [append API](/api/interfaces#timescopeappendonlydatasource) for input transforms and completion semantics.

## Follow live time or playback {#follow-a-live-or-playback-clock}

`time: null` follows the wall clock by default. Use that for samples timestamped in Unix epoch seconds. For elapsed recording time or media playback, supply an application-driven clock with `setPlaybackTime()`:

```ts
timescope.setPlaybackTime(12.5);
timescope.setTime(null, false); // Follow the playback clock immediately.
timescope.setPlaybackTime(12.6); // Advance it on the next data or media tick.
```

The playback clock does not advance by itself. Update it in the same time units as your data. Appending samples does not move the view, and changing playback time does not append samples. A range-loaded source acquires data as needed when the followed view moves.

Users can pan away from the live position to inspect history. A "Follow live" control can call `timescope.setTime(null, false)` to resume following. Call `timescope.setTime(30, false)` to hold a selected time, or `timescope.setPlaybackTime(null)` to restore the wall clock.

## Refresh changed data

For a remote history, use [Chunk Loading](/guide/advanced/chunk-loading) and notify its DataSource when new or corrected samples are available. For example, if the chart uses a source named `history`:

```ts
history.invalidate([120, 180]); // Corrected samples in this interval.
history.invalidate([180, undefined]); // New or corrected samples from time 180 onward.
```

Include late-arriving samples in the invalidated interval. Timescope reacquires affected data on demand, allowing the same range endpoint to serve both past and current data.

For a complete snapshot, call `timescope.reload(['measurements'])` after its URL, callback result, or input array has changed. This reloads the entire snapshot; range invalidation does not make a snapshot incremental. Omit the names to reload all sources.

Neither `invalidate()` nor `await reload()` waits for replacement data and drawing. When you need completed pixels, use a [prepared view](/api/interfaces#timescopepreparedview).

## Stop a stream

When removing the view, stop the application-owned subscription or timer and dispose the Timescope instance. Framework components dispose the instance automatically, but your application still owns its data producer. See [lifecycle handling](/guide/advanced/frameworks/overview#lifecycle).
