export type TimescopeAnimationType = 'in-out' | 'linear' | 'out';

export type TimescopeAnimationInput =
  | false
  | TimescopeAnimationType
  | { animation: TimescopeAnimationType | false; duration: number; lazy?: boolean };

export type TimescopeAnimationOptions = {
  origin: () => number;
  target: () => number;
  animation?: TimescopeAnimationType | false;
  update: (value: number, ratio: number) => void;
  done?: (value: number) => void;
  duration?: number;

  overshoot?: number;
};

const requestAnimationFrame =
  globalThis.requestAnimationFrame ?? ((cb: (...args: unknown[]) => void) => setTimeout(cb, 0));

const cancelAnimationFrame = globalThis.cancelAnimationFrame ?? ((id: number) => clearTimeout(id));

export class TimescopeAnimation {
  #id: number | null = null;
  #done?: () => void;

  start(opts: TimescopeAnimationOptions) {
    opts = { animation: 'in-out', duration: 500, ...opts };
    this.cancel();

    this.#done = () => opts.done?.(opts.target());

    const c = opts.overshoot ?? 0;

    const duration = opts.duration ?? 500;
    const started = performance.now();
    const easingFn = opts.animation
      ? {
          linear: (t: number) => t,
          'in-out': (t: number) => t * t * t * (t * (t * 6 - 15) + 10),
          out: (t: number) => 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2),
        }[String(opts.animation)]
      : null;

    if (!easingFn || opts.origin() === opts.target()) {
      this.done();
      return;
    }

    const tick: FrameRequestCallback = () => {
      const time = performance.now();
      const elapsed = time - started;
      if (elapsed < duration) {
        const t = easingFn(elapsed / duration);
        const v = opts.origin() * (1 - t) + opts.target() * t;

        opts.update(v, t);

        this.#id = requestAnimationFrame(tick);
      } else {
        this.done();
      }
    };

    this.#id = requestAnimationFrame(tick);
  }

  done() {
    this.cancel();
    this.#done?.();
  }

  cancel() {
    if (!this.#id) return;
    cancelAnimationFrame(this.#id);
    this.#id = null;
  }

  get animating() {
    return this.#id !== null;
  }
}
