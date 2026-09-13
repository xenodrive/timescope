import type { Vector2f } from '#src/core/vector';

export type InteractionEventName =
  | 'cursor'
  | 'down'
  | 'click'
  | 'drag:start'
  | 'drag:update'
  | 'drag:end'
  | 'drag:cancel'
  | 'pinch:start'
  | 'pinch:update'
  | 'pinch:end'
  | 'pinch:cancel'
  | 'up';
export type InteractionPointerInfo = {
  pointerId: number;
  latest: Vector2f;
  last: Vector2f;
  delta: Vector2f;
  anchor: Vector2f;
  pressed: boolean;
};
export type InteractionState = 'none' | 'down' | 'drag' | 'pinch';
export type InteractionInfo = {
  type: InteractionEventName;
  state: InteractionState;
  latest: InteractionPointerInfo;
  buttons: InteractionPointerInfo[];
  shiftKey: boolean;
};
