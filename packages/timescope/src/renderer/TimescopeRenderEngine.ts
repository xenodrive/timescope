import type {
  InteractionInfoWire,
  RenderEngineCommands,
  RendererCommands,
  RendererInitOptions,
  RendererResizeOptions,
  TimescopeEventMessage,
  TimescopeFrameCaptureMessage,
  TimescopeFrameViewMessage,
  TimescopeSyncMessage,
  TimescopeViewportChangedMessage,
} from '#src/bridge/protocol';
import type { RenderCall } from '#src/bridge/rpc';
import { Decimal } from '#src/core/decimal';
import { defaultOptions } from '#src/core/defaults';
import type { TimescopeEvent } from '#src/core/event';
import { mergeOptions } from '#src/core/options';
import type { TimescopeRange } from '#src/core/range';
import type { TimescopeFont } from '#src/main/font';
import type { TimescopeLayer } from '#src/renderer/layers/TimescopeLayer';
import { TimescopeSelectionLayer } from '#src/renderer/layers/TimescopeSelectionLayer';
import { TimescopeSeriesChartLayer } from '#src/renderer/layers/TimescopeSeriesChartLayer';
import { TimescopeSeriesTooltipLayer } from '#src/renderer/layers/TimescopeSeriesTooltipLayer';
import { TimescopeTimeAxisLayer } from '#src/renderer/layers/TimescopeTimeAxisLayer';
import { TimescopeYAxisLayer } from '#src/renderer/layers/TimescopeYAxisLayer';
import { clipToTrack, OUTSIDE_TIME_RANGE_COLOR, renderCursor, renderTimeRangeInverse } from '#src/renderer/rendering';
import { TimescopeDataCache, type TimescopeDataCacheOptions } from '#src/renderer/TimescopeDataCache';
import { TimescopeTrack } from '#src/renderer/TimescopeTrack';
import { TimescopeViewport } from '#src/renderer/TimescopeViewport';
import type {
  Interaction,
  TimescopeRenderEngineOptions,
  TimescopePath2DConstructor,
  TimescopeRenderingContext,
  TimescopeYProjectionWire,
} from '#src/renderer/types';
import {
  asProjectionData,
  compareYProjection,
  createYProjectionRebase,
  rebaseYProjectionData,
} from '#src/renderer/yProjection';

declare global {
  interface FontFaceSet {
    add(font: FontFace): this;
  }
}

export type TimescopeRenderEngineEnvironment = {
  call: RenderCall<RendererCommands>;
  fonts?: FontFaceSet;
  requestAnimationFrame?: (callback: () => void) => number | void;
  cancelAnimationFrame?: (handle: number) => void;
  Path2D?: TimescopePath2DConstructor;
  layers?: TimescopeLayer[];
};

// Keep cache keys distinct across engines sharing the same rendering thread.
let nextFontEpoch = 0;

export class TimescopeRenderEngine {
  readonly commands: RenderEngineCommands;
  readonly dispose: () => void;

  constructor(environment: TimescopeRenderEngineEnvironment) {
    const fontFaceSet = environment.fonts;
    const layers: TimescopeLayer[] = environment.layers ?? [
      new TimescopeTimeAxisLayer(),
      new TimescopeSeriesChartLayer(),
      new TimescopeYAxisLayer(),
      new TimescopeSeriesTooltipLayer(),
      new TimescopeSelectionLayer(),
    ];
    let disposed = false;
    const pendingFrames = new Set<number>();
    const subscriptions: (() => void)[] = [];
    const ownedFonts = new Set<FontFace>();
    const loadedFonts = new Set<string>();
    const fontAbort = new AbortController();
    const fallbackFrames = new Map<number, ReturnType<typeof setTimeout>>();
    let nextFallbackFrame = 0;
    const schedule =
      environment.requestAnimationFrame ??
      globalThis.requestAnimationFrame?.bind(globalThis) ??
      ((callback: () => void) => {
        const id = ++nextFallbackFrame;
        fallbackFrames.set(
          id,
          setTimeout(() => {
            fallbackFrames.delete(id);
            callback();
          }, 0),
        );
        return id;
      });
    const cancelFrame =
      environment.cancelAnimationFrame ??
      ((handle: number) => {
        if (globalThis.cancelAnimationFrame) globalThis.cancelAnimationFrame(handle);
        else clearTimeout(fallbackFrames.get(handle));
        fallbackFrames.delete(handle);
      });
    function requestAnimationFrame(callback: () => void) {
      if (disposed) return;
      const handle = schedule(() => {
        if (typeof handle === 'number') pendingFrames.delete(handle);
        if (!disposed) callback();
      });
      if (typeof handle === 'number') pendingFrames.add(handle);
    }
    const call: RenderCall<RendererCommands> = (command, payload) => {
      if (disposed) return Promise.reject(new DOMException('Render engine disposed', 'AbortError'));
      const result = environment.call(command, payload);
      void result.catch((error) => {
        if (!disposed) console.error(`Renderer ${command} failed`, error);
      });
      return result;
    };
    let ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | undefined | null;
    let canvas: OffscreenCanvas | HTMLCanvasElement | undefined;
    const cacheUnsubs = new Map<TimescopeDataCache, (() => void)[]>();
    const activeProjections = new Map<string, TimescopeYProjectionWire>();

    let frameLatched = false;
    let frameLatchToken = 0;
    let abortFramePreparation: ((reason: DOMException) => void) | undefined;
    let renderPending = false;
    const redrawWaiters = new Set<{ resolve: () => void; reject: (error: unknown) => void }>();
    const deferredSyncs: TimescopeSyncMessage[] = [];
    const deferredDataChanges = new Set<string>();
    let deferredOptions: TimescopeRenderEngineOptions | undefined;
    let deferredResize: RendererResizeOptions | undefined;
    const readyFrame = {
      target: undefined as TimescopeFrameViewMessage | undefined,
      projections: new Map<string, TimescopeYProjectionWire>(),
      rebases: new Map<string, { scale: number; offset: number } | null>(),
      caches: [] as TimescopeDataCache[],
    };

    const timeAxis = new TimescopeViewport();
    subscriptions.push(
      timeAxis.on('change', () => render()),
      timeAxis.on('sync', (e) => {
        if (!disposed) void call('sync', e.value);
      }),
      timeAxis.on('viewchanging', () => viewChanging()),
      timeAxis.on('viewchanged', () => viewChanging()),
      timeAxis.on('timechanged', () => viewChanging(true)),
      timeAxis.on('viewanimated', () => viewChanged()),
    );

    const basicHandler = {
      onPointerEvent: (info: InteractionInfoWire) => {
        const events = {
          click: (p1: number) => timeAxis.click(p1),
          'drag:start': () => timeAxis.dragStart(),
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

    layers.forEach((layer) => {
      subscriptions.push(
        layer.on('change', () => render()),
        layer.on('renderer:event', (e: TimescopeEvent<'renderer:event', TimescopeEventMessage>) => {
          if (!disposed) void call('renderer:event', { value: e.value, uid: layer.uid });
        }),
      );
    });

    const renderingContext = {
      ctx: null!,
      Path2D: environment.Path2D ?? globalThis.Path2D,

      options: {},
      tracks: [],
      renderingTrack: null, // current track

      dataCaches: {},

      chart: {
        ox: 0,
        oy: 0,
        width: 1,
        height: 1,
      },
      size: {
        width: 1,
        height: 1,
      },

      get symmetric() {
        return this.renderingTrack?.symmetric ?? false;
      },

      dpr: 1,
      fontEpoch: 0,
      timeAxis,
    } as TimescopeRenderingContext;

    let _viewChanged = false;
    let _viewChanging = false;
    let lastReportedView: { range: TimescopeRange<Decimal>; resolution: Decimal } | undefined;

    function viewportState(): TimescopeViewportChangedMessage['viewport'] {
      const current = timeAxis.current;
      const candidate = timeAxis.candidate;
      const cursor = timeAxis.cursor;
      return {
        current: { center: current.time ?? timeAxis.now, resolution: current.resolution },
        candidate: { center: candidate.time ?? timeAxis.now, resolution: candidate.resolution },
        cursor: { center: cursor.time ?? timeAxis.now },
        axisSize: timeAxis.axisLength as [number, number],
        editing: timeAxis.editing,
        animating: timeAxis.animating,
      };
    }

    function viewChanging(force = false) {
      if (disposed) return;
      if (_viewChanging && !force) return;
      if (!_viewChanging) {
        _viewChanging = true;

        requestAnimationFrame(() => {
          _viewChanging = false;
        });
      }

      call('viewport:changing', { viewport: viewportState() });
      if (frameLatched) {
        call('viewport:prepare', { viewport: viewportState() });
      }
    }

    function viewChanged() {
      if (disposed) return;
      if (_viewChanged) return;
      _viewChanged = true;

      handleViewChanged();
    }

    function liveViewChangeRequired() {
      const next = timeAxis.value;
      return (
        next.time === null &&
        timeAxis.configuredPlaybackTime === null &&
        (!lastReportedView ||
          !next.resolution.eq(lastReportedView.resolution) ||
          next.range[0].sub(lastReportedView.range[0]).abs().ge(next.resolution))
      );
    }

    function handleViewChanged() {
      if (!_viewChanged) return;

      if (timeAxis.animating || timeAxis.editing) {
        requestAnimationFrame(handleViewChanged);
        return;
      }

      _viewChanged = false;

      const next = timeAxis.value;
      lastReportedView = { range: next.range, resolution: next.resolution };
      call('viewport:changed', { viewport: viewportState() });
    }

    function createDataCache(key: string, opts: Omit<TimescopeDataCacheOptions<unknown>, 'loader' | 'name'> = {}) {
      const options: TimescopeDataCacheOptions<object> = {
        ...opts,
        name: key,
        loader: async (request) => await call('data:load', { key, ...request }),
        prepare: (data, staging) => (staging ? data : reconcileProjection(data)),
      };

      if (renderingContext.dataCaches[key]) {
        const r = renderingContext.dataCaches[key];
        r.updateOptions(options);
        return r;
      }

      const r = new TimescopeDataCache(options);
      r.on('change', () => render());
      r.on('datachanged', () => {
        trackForData(key)?.adjustScale(renderingContext);
      });

      cacheUnsubs.set(r, [
        timeAxis.on('viewchanging', () => r.immediate && r.invalidate()),
        timeAxis.on('viewchanged', () => r.immediate && r.invalidate()),
        timeAxis.on('viewanimated', () => r.invalidate()),
      ]);

      return r;
    }

    function reconcileProjection(value: object) {
      const incoming = asProjectionData(value);
      if (!incoming) return value;

      const projection = incoming.meta.projection;
      const active = activeProjections.get(projection.domainId);
      if (active && compareYProjection(projection, active) < 0 && projection.domainEpoch !== active.domainEpoch) {
        return;
      }

      if (!active || compareYProjection(projection, active) > 0) {
        const rebase = active ? createYProjectionRebase(active, projection) : null;
        for (const cache of Object.values(renderingContext.dataCaches)) {
          cache.mutateData((cached) => {
            const data = asProjectionData(cached);
            return !!data && data.meta.projection.domainId === projection.domainId
              ? rebaseYProjectionData(data, projection)
              : false;
          });
        }
        activeProjections.set(projection.domainId, projection);
        const rebases = new Map([[projection.domainId, rebase?.scale ? rebase : null]]);
        for (const track of renderingContext.tracks) track.adjustScale(renderingContext, rebases);
      } else if (active) {
        rebaseYProjectionData(incoming, active);
      }

      return value;
    }

    function reconcileStagedProjections() {
      const projections = new Map(activeProjections);
      const staged = Object.values(renderingContext.dataCaches).flatMap((cache) => {
        const data = asProjectionData(cache.stagedData);
        return data ? [data] : [];
      });

      for (const data of staged) {
        const projection = data.meta.projection;
        const selected = projections.get(projection.domainId);
        if (!selected || compareYProjection(projection, selected) > 0) {
          projections.set(projection.domainId, projection);
        }
      }

      const rebases = new Map<string, { scale: number; offset: number } | null>();
      for (const [domainId, projection] of projections) {
        const active = activeProjections.get(domainId);
        if (!active || compareYProjection(projection, active) > 0) {
          const rebase = active ? createYProjectionRebase(active, projection) : null;
          rebases.set(domainId, rebase?.scale ? rebase : null);
        }
      }

      for (const data of staged) {
        const projection = data.meta.projection;
        const selected = projections.get(projection.domainId)!;
        if (projection.domainEpoch !== selected.domainEpoch && compareYProjection(projection, selected) < 0) return;
        rebaseYProjectionData(data, selected);
      }
      return { projections, rebases };
    }

    function trackForData(key: string) {
      const yAxisMatch = /^tracks:([^:]+):domains:[^:]+:yAxis$/.exec(key);
      if (yAxisMatch) return renderingContext.tracks.find((track) => track.id === yAxisMatch[1]);
      return renderingContext.tracks.find((candidate) =>
        candidate.seriesKeys.some(
          (seriesKey) => key === `series:${seriesKey}:chart` || key === `series:${seriesKey}:tooltip`,
        ),
      );
    }

    function captureFrameView({ time, zoom, playbackTime: configuredPlaybackTime }: TimescopeFrameCaptureMessage) {
      const candidate = timeAxis.candidate;
      const targetTime = time !== undefined ? time : candidate.time;
      const targetZoom = zoom ?? candidate.zoom;
      const playbackTime =
        (configuredPlaybackTime === undefined ? timeAxis.configuredPlaybackTime : configuredPlaybackTime) ??
        Decimal(Date.now() / 1000);
      const resolution = timeAxis.r(targetZoom);
      const viewport = viewportState();
      const target = { center: targetTime ?? playbackTime, resolution };
      return {
        time: targetTime,
        playbackTime,
        zoom: targetZoom.number(),
        resolution,
        range: timeAxis.rangeFor(targetTime ?? playbackTime, targetZoom),
        currentRange: timeAxis.current.range,
        viewport: {
          ...viewport,
          current: target,
          candidate: target,
          cursor: { center: target.center },
          editing: false,
          animating: false,
        },
      };
    }

    function clearReadyFrame() {
      readyFrame.target = undefined;
      readyFrame.projections.clear();
      readyFrame.rebases.clear();
      readyFrame.caches.length = 0;
    }

    function discardReadyFrame() {
      for (const cache of readyFrame.caches) cache.discardReady();
      clearReadyFrame();
      renderPending = false;
    }

    function activateReadyFrame() {
      const { target } = readyFrame;
      if (!target) return false;
      if (readyFrame.caches.some((cache) => !cache.readyData)) {
        discardReadyFrame();
        return false;
      }

      timeAxis.presentAt(target.playbackTime);
      for (const cache of readyFrame.caches) cache.activateReady();
      activeProjections.clear();
      for (const [domainId, projection] of readyFrame.projections) activeProjections.set(domainId, projection);
      for (const track of renderingContext.tracks) track.adjustScale(renderingContext, readyFrame.rebases);
      for (const cache of readyFrame.caches) cache.announceActivation();
      clearReadyFrame();
      return true;
    }

    function finishPendingRender() {
      if (frameLatched || renderPending || readyFrame.target) return;
      const syncs = deferredSyncs.splice(0);
      for (const sync of syncs) timeAxis.handleSyncEvent(sync);
      if (syncs.length) viewChanged();
      if (deferredDataChanges.size) {
        for (const key of deferredDataChanges) renderingContext.dataCaches[key]?.invalidate();
        deferredDataChanges.clear();
      }
      if (Object.values(renderingContext.dataCaches).some((cache) => cache.dirty)) render();
    }

    function applyOptions(options: TimescopeRenderEngineOptions) {
      if ('font' in options) renderingContext.options.font = options.font;
      if ('series' in options) renderingContext.options.series = options.series;
      if ('tracks' in options) renderingContext.options.tracks = options.tracks;
      if ('dataCacheOptions' in options) renderingContext.options.dataCacheOptions = options.dataCacheOptions;
      if ('cursor' in options) renderingContext.options.cursor = options.cursor;
      if ('selection' in options) renderingContext.options.selection = options.selection;
      mergeOptions(renderingContext.options, options);

      if (options.dataCacheOptions) maintainDataCaches(renderingContext);
      if ('tracks' in options || 'series' in options) resizeTracks();

      for (const layer of layers) {
        layer.updateOptions(options);
        layer.changed();
      }

      viewChanged();
    }

    function applyResize({ size, context }: RendererResizeOptions) {
      if (!canvas) return;

      const dpr = context?.dpr ?? renderingContext.dpr ?? 1;
      canvas.width = Math.round(size.width * dpr);
      canvas.height = Math.round(size.height * dpr);
      timeAxis.setAxisLength([size.width / 2, size.width / 2]);
      renderingContext.dpr = dpr;

      resizeTracks();
      viewChanged();
    }

    function deferOptions(options: TimescopeRenderEngineOptions) {
      deferredOptions ??= {};
      mergeOptions(deferredOptions, options);
      if ('font' in options) deferredOptions.font = options.font;
      if ('series' in options) deferredOptions.series = options.series;
      if ('tracks' in options) deferredOptions.tracks = options.tracks;
      if ('dataCacheOptions' in options) deferredOptions.dataCacheOptions = options.dataCacheOptions;
      if ('cursor' in options) deferredOptions.cursor = options.cursor;
      if ('selection' in options) deferredOptions.selection = options.selection;
    }

    function applyDeferredFrameChanges() {
      const options = deferredOptions;
      const resize = deferredResize;
      deferredOptions = undefined;
      deferredResize = undefined;
      if (options) applyOptions(options);
      if (resize) applyResize(resize);
    }

    function maintainDataCaches(renderingContext: TimescopeRenderingContext) {
      const old = { ...renderingContext.dataCaches };

      for (const key in renderingContext.options.dataCacheOptions) {
        renderingContext.dataCaches[key] = createDataCache(key, renderingContext.options.dataCacheOptions[key]);
        delete old[key];
      }

      Object.keys(old).forEach((key) => {
        cacheUnsubs.get(old[key])?.forEach((un) => un());
        cacheUnsubs.delete(old[key]);
        old[key].dispose();
        delete renderingContext.dataCaches[key];
      });
      renderingContext.tracks.forEach((track) => track.adjustScale(renderingContext));
    }

    let capturedInteraction: Interaction[] | undefined = undefined;

    function resizeTracks() {
      if (!canvas) return;
      for (const track of renderingContext.tracks) track.dispose();
      const height = canvas.height / renderingContext.dpr;
      const tracks = Object.entries(renderingContext.options.tracks ?? { default: {} });

      const remain = Math.max(0, height - tracks.reduce((acc, [, val]) => acc + (val?.height ?? 0), 0));
      const autoTracks = tracks.filter(([, t]) => t.height == null).length;
      const avgH = remain / autoTracks;

      let sumH = 0;

      renderingContext.tracks = tracks.map(([id, track]) => {
        const theight = track.height ?? avgH;
        sumH += theight;

        const t = new TimescopeTrack({
          id,
          //oy: height - sumH, // grow to the top
          oy: sumH - theight, // grow to the bottom
          height: theight,
          symmetric: track.symmetric ?? defaultOptions.track.symmetric,

          labelHeight:
            !track.symmetric &&
            (track.timeAxis ?? defaultOptions.track.timeAxis) !== false &&
            (typeof track.timeAxis !== 'object' || track.timeAxis.labels !== false)
              ? 7
              : 0,

          seriesKeys: Object.entries(renderingContext.options.series ?? {})
            .filter(([, s]) => (s.track ?? tracks[0][0]) === id)
            .map(([k]) => k),
        });
        t.on('change', () => render());
        return t;
      });
      renderingContext.tracks.forEach((track) => track.adjustScale(renderingContext));
    }

    const commands: RenderEngineCommands = {
      init: ({ canvas: theCanvas }: RendererInitOptions) => {
        canvas = theCanvas;
        // TS6 widens the return type when calling getContext on the canvas union.
        ctx = canvas.getContext('2d') as TimescopeRenderingContext['ctx'] | null;
      },

      // Backends using a different font API must send []; only nonempty inputs use FontFace.
      fonts: async (fonts: TimescopeFont[]) => {
        await Promise.all(
          fonts.map(async (font) => {
            if (disposed) return;
            const key = typeof font.source === 'string' ? JSON.stringify(font) : undefined;
            if (key && loadedFonts.has(key)) return;
            if (key) loadedFonts.add(key);
            try {
              const url =
                typeof font.source === 'string' && font.source.match(/url\("([^"]+)"\) *format\("woff2"\)/)?.[1];
              const source = url ? await (await fetch(url, { signal: fontAbort.signal })).arrayBuffer() : font.source;
              if (disposed) return;
              const face = await new FontFace(font.family, source, font.desc).load();
              if (disposed) return;
              fontFaceSet?.add(face);
              ownedFonts.add(face);
              renderingContext.fontEpoch = ++nextFontEpoch;
              render();
            } catch (error) {
              if (key) loadedFonts.delete(key);
              if (!disposed) console.error('Failed to load the font:', error);
            }
          }),
        );
        render();
      },

      'options:update': (options: TimescopeRenderEngineOptions) => {
        if (renderPending || readyFrame.target) {
          deferOptions(options);
          return;
        }
        applyOptions(options);
      },

      resize: async (options: RendererResizeOptions) => {
        if (renderPending || readyFrame.target) {
          deferredResize = options;
          return;
        }
        applyResize(options);
      },

      pointer: async (info: InteractionInfoWire) => {
        const interactions = [...layers, basicHandler];
        const interaction = (capturedInteraction ?? interactions).find((interaction) =>
          interaction.onPointerEvent(info, renderingContext),
        );
        capturedInteraction = info.type === 'up' || !interaction ? undefined : [interaction];
        return true;
      },

      cursor: async (info: InteractionInfoWire) => {
        const interactions = [...layers, basicHandler];
        return (capturedInteraction ?? interactions)
          .map((interaction) => interaction.pointerStyle(info, renderingContext))
          .find(Boolean);
      },

      sync: (sync: TimescopeSyncMessage) => {
        if (frameLatched || renderPending || readyFrame.target) {
          deferredSyncs.push(sync);
          return;
        }
        timeAxis.handleSyncEvent(sync);
        viewChanged();
      },

      'frame:latch': () => {
        frameLatched = true;
        frameLatchToken++;
        for (const cache of Object.values(renderingContext.dataCaches)) cache.beginFrame();
      },

      'frame:capture': async (target) => {
        if (!frameLatched) return { ok: false, message: 'Frame latch aborted' } as const;
        return { ok: true, view: captureFrameView(target) } as const;
      },

      'frame:prepare': async (target) => {
        const token = frameLatchToken;
        try {
          if (!frameLatched || token !== frameLatchToken) throw new DOMException('Frame latch aborted', 'AbortError');

          const aborted = new Promise<never>((_, reject) => {
            abortFramePreparation = reject;
          });
          const cachesReady = await Promise.race([
            Promise.all(Object.values(renderingContext.dataCaches).map((cache) => cache.stageTarget(target))),
            aborted,
          ]);
          if (cachesReady.some((ready) => !ready)) throw new Error('Failed to prepare target frame');
          if (!frameLatched || token !== frameLatchToken) throw new DOMException('Frame latch aborted', 'AbortError');

          const stagedProjections = reconcileStagedProjections();
          if (!stagedProjections) throw new Error('Failed to reconcile target frame projections');
          if (!frameLatched || token !== frameLatchToken) throw new DOMException('Frame latch aborted', 'AbortError');

          abortFramePreparation = undefined;
          const caches = Object.values(renderingContext.dataCaches);
          if (caches.some((cache) => !cache.stagedData)) throw new Error('Failed to activate target frame');
          for (const cache of caches) cache.readyStaged();
          readyFrame.target = target;
          readyFrame.projections.clear();
          for (const [domainId, projection] of stagedProjections.projections) {
            readyFrame.projections.set(domainId, projection);
          }
          readyFrame.rebases.clear();
          for (const [domainId, rebase] of stagedProjections.rebases) readyFrame.rebases.set(domainId, rebase);
          readyFrame.caches.length = 0;
          readyFrame.caches.push(...caches);
          frameLatched = false;
          return { ok: true } as const;
        } catch (error) {
          if (token === frameLatchToken) abortFramePreparation = undefined;
          if (token === frameLatchToken) {
            for (const cache of Object.values(renderingContext.dataCaches)) cache.abortFrame();
            frameLatched = false;
            finishPendingRender();
            viewChanged();
            render();
          }
          return { ok: false, message: error instanceof Error ? error.message : String(error) } as const;
        }
      },

      'frame:commit': async () => {
        if (!readyFrame.target) return { ok: false, message: 'Frame latch aborted' } as const;
        try {
          const syncs = deferredSyncs.splice(0);
          for (const sync of syncs) timeAxis.handleSyncEvent(sync);
          if (!activateReadyFrame()) return { ok: false, message: 'Frame latch aborted' } as const;
          renderPending = true;
          render();
          return { ok: true } as const;
        } catch (error) {
          if (readyFrame.target) discardReadyFrame();
          return { ok: false, message: error instanceof Error ? error.message : String(error) } as const;
        }
      },

      'frame:abort': () => {
        if (!frameLatched) {
          if (readyFrame.target) {
            discardReadyFrame();
            finishPendingRender();
            applyDeferredFrameChanges();
            viewChanged();
            render();
          }
          return;
        }
        const abort = abortFramePreparation;
        abortFramePreparation = undefined;
        frameLatchToken++;
        abort?.(new DOMException('Frame latch aborted', 'AbortError'));
        for (const cache of Object.values(renderingContext.dataCaches)) cache.abortFrame();
        frameLatched = false;
        finishPendingRender();
        viewChanged();
        render();
      },

      reload: () => {
        for (const cache of Object.values(renderingContext.dataCaches)) {
          cache.reset();
        }
        viewChanged();
      },

      redraw: () => {
        if (frameLatched || readyFrame.target) {
          return Promise.reject(new DOMException('A frame latch is active', 'InvalidStateError'));
        }
        if (disposed) return Promise.reject(new DOMException('Render engine disposed', 'AbortError'));
        const result = new Promise<void>((resolve, reject) => redrawWaiters.add({ resolve, reject }));
        render();
        return result;
      },

      'data:changed'(key) {
        if (frameLatched || readyFrame.target || renderPending) {
          deferredDataChanges.add(key);
          return;
        }
        const cache = renderingContext.dataCaches[key];
        cache?.invalidate();
        render();
      },
    };

    this.commands = commands;
    this.dispose = () => {
      if (disposed) return;
      disposed = true;
      for (const waiter of redrawWaiters) waiter.reject(new DOMException('Render engine disposed', 'AbortError'));
      redrawWaiters.clear();
      frameLatchToken++;
      abortFramePreparation?.(new DOMException('Render engine disposed', 'AbortError'));
      abortFramePreparation = undefined;
      for (const handle of pendingFrames) cancelFrame(handle);
      pendingFrames.clear();
      for (const unsubscribe of subscriptions) unsubscribe();
      for (const unsubs of cacheUnsubs.values()) for (const unsubscribe of unsubs) unsubscribe();
      cacheUnsubs.clear();
      for (const cache of Object.values(renderingContext.dataCaches)) cache.dispose();
      renderingContext.dataCaches = {};
      for (const track of renderingContext.tracks) track.dispose();
      renderingContext.tracks = [];
      for (const layer of layers) layer.dispose();
      timeAxis.dispose();
      clearReadyFrame();
      activeProjections.clear();
      deferredSyncs.length = 0;
      deferredDataChanges.clear();
      fontAbort.abort();
      for (const font of ownedFonts) fontFaceSet?.delete(font);
      ownedFonts.clear();
      canvas = undefined;
      ctx = undefined;
    };

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
      if (ctx) {
        ctx.fillStyle = '#888';
        ctx?.clearRect(0, 0, 60, 15);
        ctx?.fillText(`FPS: ${fps}`, 5, 10);
      }
    }

    function forEachLayer(callback: (layer: TimescopeLayer) => void) {
      for (const layer of layers) {
        ctx?.save();
        try {
          callback(layer);
        } finally {
          ctx?.restore();
        }
      }
    }

    function renderSync(renderingContext: TimescopeRenderingContext) {
      if (!canvas || !ctx) return;

      renderingContext.ctx = ctx;

      fpsTick();

      ctx.reset();

      ctx.scale(renderingContext.dpr, renderingContext.dpr);

      forEachLayer((layer) => {
        layer.preRender(renderingContext);
      });

      // available range
      clipToTrack(renderingContext, null, () => {
        renderTimeRangeInverse(renderingContext, timeAxis.range.time, OUTSIDE_TIME_RANGE_COLOR);
      });

      // render
      forEachLayer((layer) => {
        layer.render(renderingContext);
      });

      // cursor
      if (renderingContext.options.cursor !== false) {
        clipToTrack(renderingContext, null, () => renderCursor(renderingContext));
      }

      // post-render
      forEachLayer((layer) => {
        layer.postRender(renderingContext);
      });
    }

    function renderRequired() {
      const range = timeAxis.range;
      const rangeP = range.p;
      const borderIsInView =
        (range.time[0] === null && 0 <= rangeP[0] && rangeP[0] < renderingContext.size.width) ||
        (range.time[1] === null && 0 <= rangeP[1] && rangeP[1] < renderingContext.size.width);

      return (
        timeAxis.animating ||
        renderingContext.tracks.some((track) => track.animating) ||
        timeAxis.value.time === null ||
        borderIsInView
      );
    }

    function updateCaches(ctx: TimescopeRenderingContext) {
      for (const k in ctx.dataCaches) {
        ctx.dataCaches[k].update(ctx);
      }
    }

    let dirty = false;
    function render() {
      if (disposed || dirty) return;
      dirty = true;
      requestAnimationFrame(update);
    }

    const update = () => {
      dirty = false;
      let error: unknown;
      let rendered = false;
      try {
        if (renderPending) {
          renderPending = false;
          try {
            renderSync(renderingContext);
            rendered = true;
          } finally {
            finishPendingRender();
            applyDeferredFrameChanges();
          }
        } else if (!frameLatched && !readyFrame.target) {
          timeAxis.presentAt(timeAxis.configuredPlaybackTime ?? Decimal(Date.now() / 1000));
          if (renderRequired()) render();
          updateCaches(renderingContext);
          renderSync(renderingContext);
          rendered = true;
        }

        if (renderingContext.options.showFps) showFps();

        if (liveViewChangeRequired()) viewChanged();
      } catch (cause) {
        error = cause;
        if (!redrawWaiters.size) console.error('Failed to render frame:', cause);
      } finally {
        if (rendered || error) {
          const waiters = [...redrawWaiters];
          redrawWaiters.clear();
          for (const waiter of waiters) {
            if (error) waiter.reject(error);
            else waiter.resolve();
          }
        }
      }
    };
  }
}
