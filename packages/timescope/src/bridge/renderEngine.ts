import type { RenderEngineCommandsWire } from '#src/bridge/protocol';
import type { RenderEngineCommands, RendererCommands } from '#src/bridge/protocol';
import { defineCalls, listenCalls, type WorkerMessagePort } from '#src/bridge/rpc';
import type { RenderCall } from '#src/bridge/rpc';
import { TimescopeRenderEngine, type TimescopeRenderEngineEnvironment } from '#src/renderer/TimescopeRenderEngine';

export function dataBuffers(result: unknown): ArrayBuffer[] {
  if (!result || typeof result !== 'object' || !('data' in result)) return [];
  const data = (
    result as {
      data?: {
        x?: Record<string, Float64Array>;
        y?: Record<string, Float64Array> | Float64Array;
        links?: { commands?: { values?: Float64Array } }[];
      };
    }
  ).data;
  const buffers = new Set<ArrayBuffer>();
  const add = (value: Float64Array | undefined) => {
    if (value?.buffer instanceof ArrayBuffer) buffers.add(value.buffer);
  };
  for (const value of Object.values(data?.x ?? {})) add(value);
  if (data?.y instanceof Float64Array) add(data.y);
  else for (const value of Object.values(data?.y ?? {})) add(value);
  for (const link of data?.links ?? []) add(link.commands?.values);
  return [...buffers];
}

export function connectWorkerRenderer(port: WorkerMessagePort, callbacks: RendererCommands, canvas: OffscreenCanvas) {
  const lifetime = new AbortController();
  const rpc = defineCalls<RenderEngineCommandsWire>(port, lifetime.signal);
  listenCalls<RendererCommands>(
    port,
    callbacks,
    (command, result) => (command === 'data:load' ? dataBuffers(result) : []),
    lifetime.signal,
  );
  const initialized = rpc('init', { canvas }, { rpc: true, transfer: [canvas] });
  void initialized.catch(() => {});
  const call: RenderCall<RenderEngineCommands> = (command, payload) => {
    if (command === 'init') return Promise.reject(new Error('Render engine already initialized'));
    // Dispatch immediately to preserve message order and snapshot ownership.
    const result = rpc(command, payload as never, { rpc: true });
    return Promise.all([initialized, result]).then(([, value]) => value) as never;
  };
  return {
    call,
    dispose() {
      lifetime.abort(new DOMException('Renderer disposed', 'AbortError'));
    },
  };
}

export function connectWorkerEngine(
  port: WorkerMessagePort,
  environment: Omit<TimescopeRenderEngineEnvironment, 'call'> = {},
) {
  const lifetime = new AbortController();
  const rpc = defineCalls<RendererCommands>(port, lifetime.signal);
  const call: RenderCall<RendererCommands> = (command, payload) => {
    return rpc(command, payload as never, { rpc: true }) as never;
  };
  const engine = new TimescopeRenderEngine({ ...environment, call });
  listenCalls<RenderEngineCommandsWire>(port, engine.commands, undefined, lifetime.signal);
  return {
    engine,
    dispose() {
      engine.dispose();
      lifetime.abort(new DOMException('Render engine disposed', 'AbortError'));
    },
  };
}
