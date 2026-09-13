import { Decimal } from '#src/core/decimal';

export type Commands = Record<string, (payload: any) => any | Promise<any>>;
export type CommandNames<C extends Commands> = keyof C;

export type CommandPayload<C extends Commands, K extends keyof C = keyof C> = C[K] extends (payload: infer P) => any
  ? P
  : never;
export type CommandResult<C extends Commands, K extends keyof C = keyof C> = C[K] extends (
  payload: any,
) => Promise<infer R>
  ? R
  : C[K] extends (payload: any) => infer R
    ? R
    : never;

export type WorkerMessage<C extends Commands, Payload> = {
  type: 'rpc' | 'rpc:ack' | 'event';
  command: CommandNames<C>;
  seq: number;
  payload: Payload;
  error?: { name: string; message: string };
};

let _seq = 0;

export type WorkerMessagePort = {
  postMessage(message: any, transfer: Transferable[]): void;
  postMessage(message: any, options?: StructuredSerializeOptions): void;
  addEventListener<K extends keyof WorkerEventMap>(
    type: K,
    listener: (this: Worker, ev: WorkerEventMap[K]) => any,
    options?: boolean | AddEventListenerOptions,
  ): void;
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ): void;
  removeEventListener<K extends keyof WorkerEventMap>(
    type: K,
    listener: (this: Worker, ev: WorkerEventMap[K]) => any,
    options?: boolean | EventListenerOptions,
  ): void;
  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | EventListenerOptions,
  ): void;
};

export function defineCalls<C extends Commands>(target: WorkerMessagePort, signal?: AbortSignal) {
  return function call<K extends CommandNames<C>>(
    command: K,
    payload: CommandPayload<C, K>,
    opts: {
      transfer?: Transferable[];
      rpc?: boolean;
    } = { rpc: false },
  ) {
    if (signal?.aborted) return Promise.reject(signal.reason) as CommandResult<C, K>;
    const seq = ++_seq;
    const message = { type: opts.rpc ? ('rpc' as const) : ('event' as const), command, seq, payload };
    if (!opts.rpc) {
      target.postMessage(message, opts.transfer ?? []);
      return Promise.resolve() as CommandResult<C, K>;
    }

    return new Promise<CommandResult<C, K>>((resolve, reject) => {
      const cleanup = () => {
        target.removeEventListener('message', handler);
        signal?.removeEventListener('abort', abort);
      };
      const abort = () => {
        cleanup();
        reject(signal?.reason);
      };
      const handler = (ev: MessageEvent<WorkerMessage<C, CommandResult<C, K>>>) => {
        if (ev.data.type === 'rpc:ack' && ev.data.command === command && ev.data.seq === seq) {
          cleanup();
          if (ev.data.error) {
            const error = new Error(ev.data.error.message);
            error.name = ev.data.error.name;
            reject(error);
          } else {
            resolve(unserialize(ev.data.payload));
          }
        }
      };
      target.addEventListener('message', handler);
      signal?.addEventListener('abort', abort, { once: true });
      try {
        target.postMessage(message, opts.transfer ?? []);
      } catch (error) {
        cleanup();
        reject(error);
      }
    });
  };
}

export function listenCalls<C extends Commands>(
  target: WorkerMessagePort,
  recvCommands: C,
  transferResult?: (command: CommandNames<C>, result: CommandResult<C>) => Transferable[],
  signal?: AbortSignal,
) {
  const handler = async ({
    data: { type, command, seq, payload },
  }: MessageEvent<WorkerMessage<C, CommandPayload<C>>>) => {
    if (signal?.aborted || (type !== 'rpc' && type !== 'event')) return;
    try {
      const result = command in recvCommands ? await recvCommands[command](unserialize(payload)) : null;
      if (type === 'rpc' && !signal?.aborted) {
        target.postMessage(
          { type: 'rpc:ack', command, seq, payload: result },
          result == null ? [] : (transferResult?.(command, result) ?? []),
        );
      }
    } catch (error) {
      if (signal?.aborted) return;
      if (type === 'rpc') {
        target.postMessage({
          type: 'rpc:ack',
          command,
          seq,
          payload: undefined,
          error: {
            name: error instanceof Error ? error.name : 'Error',
            message: error instanceof Error ? error.message : String(error),
          },
        });
      } else {
        console.error(`RPC ${String(command)} failed`, error);
      }
    }
  };
  if (!signal?.aborted) {
    target.addEventListener('message', handler);
    signal?.addEventListener('abort', () => target.removeEventListener('message', handler), { once: true });
  }
  return recvCommands;
}

function isDecimalLike(value: unknown) {
  return (
    typeof value === 'object' &&
    value != null &&
    'coeff' in value &&
    'digits' in value &&
    typeof value.coeff === 'bigint' &&
    typeof value.digits === 'number'
  );
}

export function unserialize(value: any, seen = new WeakMap<object, any>()): any {
  if (value == null) return value;

  const valueType = typeof value;
  if (valueType === 'string' || valueType === 'number' || valueType === 'boolean' || valueType === 'bigint') {
    return value;
  }

  if (valueType === 'undefined' || valueType === 'symbol' || valueType === 'function') {
    return value;
  }

  if (Decimal.isDecimal(value)) return value;
  const existing = seen.get(value);
  if (existing) return existing;
  if (isDecimalLike(value)) {
    const decimal = Decimal(value);
    seen.set(value, decimal);
    return decimal;
  }

  if (Array.isArray(value)) {
    seen.set(value, value);
    for (let index = 0; index < value.length; index++) value[index] = unserialize(value[index], seen);
    return value;
  }

  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return value;

  seen.set(value, value);
  for (const key in value) value[key] = unserialize(value[key], seen);
  return value;
}
