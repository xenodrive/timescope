import type { RenderEngineCommands, RendererCommands } from '#src/renderer/types';

/** The worker receives a transferred canvas, while a local engine also accepts an HTML canvas. */
export type RenderEngineCommandsWire = Omit<RenderEngineCommands, 'init'> & {
  readonly init: (options: { canvas: OffscreenCanvas }) => void;
};

export type RendererCommandsWire = RendererCommands;
