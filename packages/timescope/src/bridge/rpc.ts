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

/** A request resolves only after the remote handler completes. */
export type RenderCall<C extends Commands> = <K extends keyof C>(
  command: K,
  payload: CommandPayload<C, K>,
) => Promise<Awaited<ReturnType<C[K]>>>;

export function copyRenderPayload<T>(value: T): T {
  return unserialize(structuredClone(value));
}

/** Local equivalent of a request/reply message boundary. */
export function defineLocalCalls<C extends Commands>(commands: C, signal: AbortSignal): RenderCall<C> {
  return (command, payload) => {
    if (signal.aborted) return Promise.reject(signal.reason);
    let snapshot: CommandPayload<C, typeof command>;
    try {
      snapshot = copyRenderPayload(payload);
    } catch (error) {
      return Promise.reject(error);
    }
    return new Promise((resolve, reject) => {
      const abort = () => reject(signal.reason);
      signal.addEventListener('abort', abort, { once: true });
      void Promise.resolve()
        .then(async () => {
          signal.throwIfAborted();
          const result = await commands[command](snapshot);
          signal.throwIfAborted();
          return copyRenderPayload(result);
        })
        .then(resolve, (error) => {
          const remote = new Error(error instanceof Error ? error.message : String(error));
          remote.name = error instanceof Error ? error.name : 'Error';
          reject(remote);
        })
        .finally(() => signal.removeEventListener('abort', abort));
    });
  };
}

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
  const pending = new Map<
    number,
    { command: CommandNames<C>; resolve: (payload: unknown) => void; reject: (reason: unknown) => void }
  >();
  const handler = ({ data }: MessageEvent<WorkerMessage<C, unknown>>) => {
    if (data.type !== 'rpc:ack') return;
    const request = pending.get(data.seq);
    if (!request || request.command !== data.command) return;
    pending.delete(data.seq);
    if (data.error) {
      const error = new Error(data.error.message);
      error.name = data.error.name;
      request.reject(error);
    } else {
      request.resolve(data.payload);
    }
  };
  const abort = () => {
    target.removeEventListener('message', handler);
    for (const request of pending.values()) request.reject(signal?.reason);
    pending.clear();
  };
  if (!signal?.aborted) {
    target.addEventListener('message', handler);
    signal?.addEventListener('abort', abort, { once: true });
  }

  function call<K extends CommandNames<C>>(
    command: K,
    payload: CommandPayload<C, K>,
    opts: { transfer?: Transferable[]; rpc: true },
  ): Promise<Awaited<ReturnType<C[K]>>>;
  function call<K extends CommandNames<C>>(
    command: K,
    payload: CommandPayload<C, K>,
    opts?: { transfer?: Transferable[]; rpc?: false },
  ): Promise<void>;
  function call<K extends CommandNames<C>>(
    command: K,
    payload: CommandPayload<C, K>,
    opts: {
      transfer?: Transferable[];
      rpc?: boolean;
    } = { rpc: false },
  ) {
    if (signal?.aborted) return Promise.reject(signal.reason);
    const seq = ++_seq;
    const message = { type: opts.rpc ? ('rpc' as const) : ('event' as const), command, seq, payload };
    if (!opts.rpc) {
      try {
        target.postMessage(message, opts.transfer ?? []);
        return Promise.resolve();
      } catch (error) {
        return Promise.reject(error);
      }
    }

    return new Promise<CommandResult<C, K>>((resolve, reject) => {
      pending.set(seq, { command, resolve: (payload) => resolve(unserialize(payload)), reject });
      try {
        target.postMessage(message, opts.transfer ?? []);
      } catch (error) {
        pending.delete(seq);
        reject(error);
      }
    });
  }
  return call;
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
