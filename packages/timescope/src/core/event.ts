import { setUid } from '#src/core/uid';

type ExtractEventValue<E, T extends string> =
  E extends TimescopeEvent<T, infer R> ? TimescopeEvent<T, R> : E extends T ? E : never;

type ExtractEventName<E> = E extends TimescopeEvent<infer T, any> ? T : E extends string ? E : never;

export class TimescopeEventEmitter<E extends TimescopeEvent<string, unknown> | string> {
  uid = setUid(this);

  #eventHandlers: Record<string, ((e: ExtractEventValue<E, string>) => void)[]> = {} as any;

  dispatchEvent<T extends string>(event: ExtractEventValue<E, T>) {
    const type = typeof event === 'string' ? event : event.type;
    const handlers = this.#eventHandlers[type];
    if (!handlers) return;

    for (const handler of handlers) {
      handler(event as unknown as ExtractEventValue<E, string>);
    }
  }

  on<T extends ExtractEventName<E>>(type: T, cb: (e: ExtractEventValue<E, T>) => void) {
    const handlers = this.#eventHandlers[type] ?? [];
    handlers.push(cb as unknown as (x: ExtractEventValue<E, string>) => void);
    this.#eventHandlers[type] = handlers;

    return () => this.un(type, cb);
  }

  un<T extends ExtractEventName<E>>(type: T, cb: (e: ExtractEventValue<E, T>) => void) {
    const handlers = this.#eventHandlers[type];
    if (!handlers) return;

    const idx = handlers.indexOf(cb as (x: unknown) => void);
    if (idx >= 0) handlers.splice(idx, 1);
  }
}

export class TimescopeEvent<T extends string, V = any> {
  type: T;
  value: V;
  origin?: string;

  stopped = false;
  prevented = false;

  constructor(type: T, value: V, origin?: string) {
    this.type = type;
    this.value = value;
    this.origin = origin;
  }

  stopPropagation() {
    this.stopped = true;
  }

  preventDefaults() {
    this.prevented = true;
  }
}

export class TimescopeObservable<
  E extends TimescopeEvent<string, unknown> | string = TimescopeEvent<string, unknown> | string,
> extends TimescopeEventEmitter<E | 'change'> {
  #revision = 0;

  changed() {
    this.#revision++;
    this.dispatchEvent('change');
  }

  get revision() {
    return this.#revision;
  }
}

export type Un = undefined | (() => void);

export function unAll(uns: Un[]) {
  uns.forEach((un) => un?.());
  uns.length = 0;
}
