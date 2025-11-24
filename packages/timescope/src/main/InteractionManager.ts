import type {
  InteractionEventName,
  InteractionInfo,
  InteractionPointerInfo,
  InteractionState,
} from '#src/bridge/protocol';
import { Vector2f } from '#src/core/vector';

/** @internal */
type InteractionEventHandler = (
  info: InteractionInfo,
) => Promise<boolean | undefined | void> | boolean | undefined | void;
type InteractionCursorHandler = (info: InteractionInfo) => Promise<string | void> | string | void;

/** @internal */
type InteractionOptions = {
  transform?: (p: Vector2f, e: PointerEvent) => Vector2f;
  handler?: InteractionEventHandler;
  cursor?: InteractionCursorHandler;
  element?: HTMLElement;
};

/** @internal */
export class InteractionManager {
  #state: InteractionState = 'none';
  #record: Record<number, InteractionPointerInfo> = {};
  #pointers: InteractionPointerInfo[] = [];

  #element?: HTMLElement;

  #transform: (p: Vector2f, e: PointerEvent) => Vector2f;

  #stateMachine: Record<
    InteractionState,
    [
      [
        type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel' | '*',
        buttons?: number,
        ((e: PointerEvent) => boolean)?,
      ],
      InteractionState,
      InteractionEventName[]?,
    ][]
  > = {
    none: [[['pointerdown', 1, this.#onDown.bind(this)], 'down', ['down']]],
    down: [
      [['pointerdown', 2, this.#pinchStart.bind(this)], 'pinch', ['drag:start', 'pinch:start']],
      [['pointermove', 1, this.#dragStart.bind(this)], 'drag', ['drag:start']],
      [['pointerup', 0], 'none', ['click', 'up']],
      [['pointercancel', 0], 'none', ['up']],
    ],
    drag: [
      [['pointerdown', 2, this.#pinchStart.bind(this)], 'pinch', ['pinch:start']],
      [['pointermove', 1], 'drag', ['drag:update']],
      [['pointerup', 0], 'none', ['drag:end', 'up']],
      [['pointercancel', 0], 'none', ['drag:end', 'up']],
    ],
    pinch: [
      [['pointermove', 2], 'pinch', ['pinch:update']],
      [['pointerup', 1, this.#pinchEnd.bind(this)], 'drag', ['pinch:end']],
      [['pointercancel', 0], 'none', ['pinch:end', 'up']],
    ],
  } as const;

  get state() {
    return this.#state;
  }

  disabled = false;

  #onDown(_e: PointerEvent) {
    this.#pointers.forEach((p) => (p.anchor = p.latest.clone()));
    return true;
  }

  #pinchStart(_e: PointerEvent) {
    this.#pointers.forEach((p) => (p.anchor = p.latest.clone()));
    return true;
  }

  #pinchEnd(_e: PointerEvent) {
    this.#pointers.forEach((p) => (p.anchor = p.latest.clone()));
    return true;
  }

  #dragStart() {
    const pressed = this.#pointers.find((p) => p.pressed) || this.#pointers[0];
    const dist = pressed.latest.distanceTo(pressed.anchor);
    if (dist < 4) return false;

    this.#pointers.forEach((p) => (p.anchor = p.latest.clone()));
    return true;
  }

  #feed(e: PointerEvent) {
    if (this.disabled) return;

    const op = new Vector2f(e.clientX, e.clientY);
    const p = this.#transform(op, e) ?? op;
    const down = Boolean(e.buttons & 1);
    const last = this.#record[e.pointerId]?.latest ?? p;

    this.#record[e.pointerId] = {
      pointerId: e.pointerId,
      last: last,
      latest: p,
      delta: p.clone().sub(last),
      anchor: this.#record[e.pointerId]?.anchor ?? p,
      pressed: down,
    };
    const values = Object.values(this.#record);
    const pressed = values.filter((p) => p.pressed).length;
    this.#pointers = values.filter((p) => p.pressed || p.pointerId === e.pointerId);

    this.#nextState(e, pressed);

    this.#applyCursor(e);

    if (!down) {
      delete this.#record[e.pointerId];
    }
  }

  #cursorHandler?: InteractionCursorHandler;
  async #applyCursor(e: PointerEvent) {
    if (this.#element && this.#cursorHandler) {
      this.#element.style.cursor =
        (await this.#cursorHandler({
          type: 'cursor',
          state: this.#state,
          buttons: this.#pointers,
          latest: this.#record[e.pointerId],
          shiftKey: e.shiftKey,
        })) ?? '';
    }
  }

  #emit: InteractionEventHandler;

  #nextState(e: PointerEvent, pressed: number) {
    const [[_t, _n, validate], nextState, events] = this.#stateMachine[this.#state].find(
      ([[type, n]]) => (type === '*' || type === e.type) && (n === undefined || n === pressed),
    ) ?? [['*'], this.#state];

    if (validate?.(e) === false) return;
    this.#state = nextState;

    if (events)
      events.forEach((event) =>
        this.#emit({
          type: event,
          state: this.#state,
          buttons: this.#pointers,
          latest: this.#record[e.pointerId],
          shiftKey: e.shiftKey,
        }),
      );
  }

  constructor(opts: InteractionOptions = {}) {
    this.#transform = opts.transform ?? ((p) => p);
    this.#emit = opts.handler ?? (async () => undefined);
    this.#cursorHandler = opts.cursor;

    if (opts.element) this.attach(opts.element);
  }

  #abortController?: AbortController;

  attach(el: HTMLElement) {
    this.#abortController?.abort();
    this.#abortController = new AbortController();
    const signal = this.#abortController.signal;

    const feed = (e: PointerEvent) => this.#feed(e);
    el.addEventListener('pointerdown', feed, { signal });
    window.addEventListener('pointermove', feed, { passive: true, signal });
    window.addEventListener('pointerup', feed, { passive: true, signal });
    window.addEventListener('pointercancel', feed, { passive: true, signal });

    // disables long tap
    el.addEventListener('touchstart', (e) => e.preventDefault(), { signal });

    this.#element = el;

    return this;
  }

  detach() {
    this.#abortController?.abort();
  }
}
