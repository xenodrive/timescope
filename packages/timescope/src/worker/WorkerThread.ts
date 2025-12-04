import type {
  InteractionInfo,
  RendererCommands,
  RendererInitOptions,
  RendererResizeOptions,
  TimescopeEventMessage,
  TimescopeFont,
  TimescopeOptionsForWorker,
  TimescopeSyncMessage,
  WorkerCommands,
} from '#src/bridge/protocol';
import { defineCalls, listenCalls, type WorkerMessagePort } from '#src/bridge/rpc';
import type { TimescopeEvent } from '#src/core/event';
import { mergeOptions } from '#src/core/utils';
import type { TimescopeRenderer } from '#src/worker/renderer/TimescopeRenderer';
import { TimescopeSelectionRenderer } from '#src/worker/renderer/TimescopeSelectionRenderer';
import { TimescopeSeriesChartRenderer } from '#src/worker/renderer/TimescopeSeriesChartRenderer';
import { TimescopeSeriesTooltipRenderer } from '#src/worker/renderer/TimescopeSeriesTooltipRenderer';
import { TimescopeTimeAxisRenderer } from '#src/worker/renderer/TimescopeTimeAxisRenderer';
import { renderIndicator, renderTimeRangeInverse } from '#src/worker/rendering';
import { TimescopeDataCache, type TimescopeDataCacheOptions } from '#src/worker/TimescopeDataCache';
import { TimescopeTimeAxis } from '#src/worker/TimescopeTimeAxis';
import { TimescopeTrack } from '#src/worker/TimescopeTrack';
import type { Interaction, TimescopeRenderingContext } from '#src/worker/types';
import { clipToTrack } from '#src/worker/utils';

declare global {
  interface FontFaceSet {
    add(font: FontFace): void;
  }
}

export function createTimescopeWorkerThread(
  port: WorkerMessagePort,
  fontFaceSet: FontFaceSet | undefined,
  requestAnimationFrame: (callback: () => void) => void = globalThis.requestAnimationFrame,
) {
  let ctx: OffscreenCanvasRenderingContext2D | undefined | null;
  let canvas: OffscreenCanvas | undefined;

  const call = defineCalls<RendererCommands>(port);

  const timeAxis = new TimescopeTimeAxis();
  timeAxis.on('change', () => render());
  timeAxis.on('sync', (e) => call('sync', e.value));
  timeAxis.on('viewchanging', () => viewChanged());
  //timeAxis.on('viewchanged', () => viewChanged());

  const basicHandler = {
    onPointerEvent: (info: InteractionInfo) => {
      const events = {
        click: (p1: number) => timeAxis.click(p1),
        'drag:start': (p1: number) => timeAxis.dragStart(p1),
        'drag:update': (p1: number, d1: number) => timeAxis.dragUpdate(p1, d1),
        'drag:end': () => timeAxis.dragEnd(),
        'pinch:start': (p1: number, _d1: number, p2: number) => timeAxis.pinchStart(p1, p2),
        'pinch:update': (p1: number, _d1: number, p2: number) => timeAxis.pinchUpdate(p1, p2),
        'pinch:end': () => timeAxis.pinchEnd(),
      };

      if (info.type in events) {
        events[info.type as keyof typeof events](
          info.buttons[0]?.latest.x ?? 0,
          info.buttons[0]?.delta.x ?? 0,
          info.buttons[1]?.latest.x ?? 0,
        );
        return true;
      }
    },

    pointerStyle: () => {
      return undefined;
    },
  };

  const renderers: TimescopeRenderer[] = [
    new TimescopeTimeAxisRenderer(), //
    new TimescopeSeriesChartRenderer(), //
    new TimescopeSeriesTooltipRenderer(), //
    new TimescopeSelectionRenderer(), //
  ];

  renderers.forEach((r) => {
    r.on('change', () => render());
    r.on('renderer:event', (e: TimescopeEvent<'renderer:event', TimescopeEventMessage>) =>
      call('renderer:event', { value: e.value, uid: r.uid }),
    );
  });

  const renderingContext = {
    ctx: null!,

    options: {},
    tracks: [],
    renderingTrack: null, // current track

    dataCaches: {},

    chart: {
      ox: 0,
      oy: 0,
      width: 1,
      height: 1,

      get axisY() {
        return (
          (renderingContext.symmetric ? renderingContext.chart.height / 2 : renderingContext.chart.height) +
          renderingContext.chart.oy
        );
      },
    },
    size: {
      width: 1,
      height: 1,
    },

    get symmetric() {
      return this.renderingTrack?.symmetric ?? false;
    },

    dpr: 1,
    timeAxis,
  } as TimescopeRenderingContext;

  async function viewChanged() {
    const next = timeAxis.current;

    const revision = timeAxis.revision;
    await call(
      'view:changed',
      {
        time: next.time,
        zoom: next.zoom.number(),
        resolution: next.resolution,
        range: next.range,
      },
      { rpc: true },
    );

    if (timeAxis.revision === revision) {
      Object.values(renderingContext.dataCaches).forEach((r) => loadMeta(r).then(() => render()));
    }
  }

  async function loadMeta(r: TimescopeDataCache) {
    const { revision } = r;
    const { resolution, zoom } = timeAxis.value;
    const meta = await call(
      'provider:loadMeta',
      {
        key: r.name,
        zoom: zoom.number(),
        resolution,
      },
      { rpc: true },
    );
    if (r.revision === revision) r.updateMeta(meta);
  }

  function createDataCache(key: string, opts: Omit<TimescopeDataCacheOptions<unknown>, 'loader' | 'name'> = {}) {
    const options: TimescopeDataCacheOptions<any[]> = {
      ...opts,
      name: key,
      loader: async (chunk) => await call('provider:loadChunk', { key, chunk }, { rpc: true }),
    };

    if (renderingContext.dataCaches[key]) {
      const r = renderingContext.dataCaches[key];
      r.updateOptions(options);
      r.invalidate();
      return r;
    }

    const r = new TimescopeDataCache(options);
    r.on('change', () => render());
    r.on('datachanged', async () => viewChanged());
    return r;
  }

  function maintainDataCaches(renderingContext: TimescopeRenderingContext) {
    const old = { ...renderingContext.dataCaches };

    for (const key in renderingContext.options.dataCacheOptions) {
      renderingContext.dataCaches[key] = createDataCache(key, renderingContext.options.dataCacheOptions[key]);
      delete old[key];
    }

    Object.keys(old).forEach((key) => delete renderingContext.dataCaches[key]);
  }

  function updateDataCaches(context: TimescopeRenderingContext) {
    for (const cache of Object.values(context.dataCaches)) {
      cache.update(context);
    }
  }

  let capturedInteraction: Interaction[] | undefined = undefined;

  function resizeTracks() {
    if (!canvas) return;
    const height = canvas.height / renderingContext.dpr;
    const tracks = Object.entries(renderingContext.options.tracks ?? { default: {} });

    const remain = Math.max(0, height - tracks.reduce((acc, [, val]) => acc + (val?.height ?? 0), 0));
    const autoTracks = tracks.filter(([, t]) => t.height == null).length;
    const avgH = remain / autoTracks;

    let sumH = 0;

    renderingContext.tracks = tracks.map(([id, track]) => {
      const theight = track.height ?? avgH;
      sumH += theight;

      return new TimescopeTrack({
        id,
        //oy: height - sumH, // grow to the top
        oy: sumH - theight, // grow to the bottom
        height: theight,
        symmetric: track.symmetric ?? false,

        labelHeight:
          !track.symmetric &&
          track.timeAxis !== false &&
          (typeof track.timeAxis !== 'object' || track.timeAxis.labels !== false)
            ? 14
            : 0,

        seriesKeys: Object.entries(renderingContext.options.series ?? {})
          .filter(([, s]) => (s.track ?? tracks[0][0]) === id)
          .map(([k]) => k),
      });
    });
  }

  const commands: WorkerCommands = {
    init: ({ canvas: theCanvas }: RendererInitOptions) => {
      canvas = theCanvas;
      ctx = canvas?.getContext('2d');
    },

    fonts: (fonts?: TimescopeFont[]) => {
      if (fonts) {
        for (const font of fonts) {
          try {
            const m = typeof font.source === 'string' && font.source.match(/url\("([^"]+)"\) *format\("woff2"\)/);
            if (m && m?.[1]) {
              fetch(m[1])
                .then((r) => r.arrayBuffer())
                .then((buf) => {
                  const u8 = new Uint8Array(buf);
                  const face = new FontFace(font.family, u8, font.desc);
                  face.loaded.then(() => {
                    fontFaceSet?.add(face);
                    render();
                  });
                  face.load();
                });
            } else {
              const face = new FontFace(font.family, font.source, font.desc);
              face.loaded.then(() => {
                fontFaceSet?.add(face);
                render();
              });
              face.load();
            }
          } catch (e) {
            console.error('Failed to load the font:', e);
          }
        }
      }

      render();
    },

    'options:update': (options: TimescopeOptionsForWorker) => {
      mergeOptions(renderingContext.options, options);

      if (options.dataCacheOptions) maintainDataCaches(renderingContext);
      if ('tracks' in options || 'series' in options) resizeTracks();

      for (const r of renderers) {
        r.updateOptions(options);
      }

      render();
    },

    resize: async ({ size, context }: RendererResizeOptions) => {
      if (!canvas) return;

      const dpr = context?.dpr ?? renderingContext.dpr ?? 1;
      canvas.width = size.width * dpr;
      canvas.height = size.height * dpr;
      timeAxis.setAxisLength([size.width / 2, size.width / 2]);

      renderingContext.dpr = dpr;

      resizeTracks();
      render();
    },

    pointer: async (info: InteractionInfo) => {
      const interactions = [...(renderers ?? []), basicHandler];
      const interaction = (capturedInteraction ?? interactions).find((interaction) =>
        interaction.onPointerEvent(info, renderingContext),
      );
      capturedInteraction = info.type === 'up' || !interaction ? undefined : [interaction];
      return true;
    },

    cursor: async (info: InteractionInfo) => {
      const interactions = [...(renderers ?? []), basicHandler];
      return (capturedInteraction ?? interactions)
        .map((interaction) => interaction.pointerStyle(info, renderingContext))
        .find((x) => x);
    },

    sync: (sync: TimescopeSyncMessage) => {
      timeAxis.handleSyncEvent(sync);
    },

    reload: () => {
      for (const cache of Object.values(renderingContext.dataCaches)) {
        cache.invalidate();
      }
      render();
    },
  };

  listenCalls(port, commands);

  let dirty = false;
  function render() {
    dirty = true;
  }

  let frames = 0;
  let fpsTime = 0;
  function fpsTick() {
    frames++;
  }

  function showFps() {
    const t = Date.now();
    const fps = ((frames * 1000) / (t - fpsTime)).toFixed(1);
    if (fpsTime + 1000 <= t) {
      fpsTime = t;
      frames = 0;
    }
    ctx?.clearRect(0, 0, 60, 15);
    ctx?.fillText(`FPS: ${fps}`, 5, 10);
  }

  function forEachRenderer(callback: (renderer: TimescopeRenderer) => void) {
    for (const renderer of renderers) {
      ctx?.save();
      callback(renderer);
      ctx?.restore();
    }
  }

  function renderSync(renderingContext: TimescopeRenderingContext) {
    if (!canvas || !ctx) return;

    renderingContext.ctx = ctx;
    dirty = false;

    updateDataCaches(renderingContext);

    fpsTick();

    ctx.reset();

    ctx.scale(renderingContext.dpr, renderingContext.dpr);

    /*
    for (const cache of Object.values(renderingContext.dataCaches)) {
      cache.renderCache(renderingContext.ctx, renderingContext);
    }
    */

    forEachRenderer((renderer) => {
      renderer.preRender(renderingContext);
    });

    // available range
    clipToTrack(renderingContext, null, () => {
      renderTimeRangeInverse(renderingContext, timeAxis.range.time, '#00000010');
    });

    // render
    forEachRenderer((renderer) => {
      renderer.render(renderingContext);
    });

    // indicator
    if (renderingContext.options.indicator !== false) {
      clipToTrack(renderingContext, null, () => renderIndicator(renderingContext));
    }

    // post-render
    forEachRenderer((renderer) => {
      renderer.postRender(renderingContext);
    });
  }

  function renderRequired() {
    const range = timeAxis.range;
    const borderIsInView =
      (range.time[0] === null && 0 <= range.p[0] && range.p[0] < renderingContext.size.width) ||
      (range.time[1] === null && 0 <= range.p[1] && range.p[1] < renderingContext.size.width);

    return dirty || timeAxis.value.time === null || borderIsInView;
  }

  const update = () => {
    requestAnimationFrame(update);

    if (renderRequired()) renderSync(renderingContext);
    if (renderingContext.options.showFps) showFps();
  };

  requestAnimationFrame(update);
}
