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

export function defineCalls<C extends Commands>(target: WorkerMessagePort) {
  return function call<K extends CommandNames<C>>(
    command: K,
    payload: CommandPayload<C, K>,
    opts: {
      transfer?: Transferable[];
      rpc?: boolean;
    } = { rpc: false },
  ) {
    const seq = ++_seq;
    target.postMessage(
      { type: opts.rpc ? 'rpc' : 'event', command, seq, payload: serialize(payload, opts.transfer) },
      opts.transfer ?? [],
    );

    if (!opts.rpc) return Promise.resolve() as CommandResult<C, K>;

    return new Promise<CommandResult<C, K>>((resolve) => {
      const handler = (ev: MessageEvent<WorkerMessage<C, CommandResult<C, K>>>) => {
        if (ev.data.type === 'rpc:ack' && ev.data.command === command && ev.data.seq === seq) {
          target.removeEventListener('message', handler);
          resolve(unserialize(ev.data?.payload));
        }
      };
      target.addEventListener('message', handler);
    });
  };
}

export function listenCalls<C extends Commands>(target: WorkerMessagePort, recvCommands: C) {
  target.addEventListener(
    'message',
    async ({ data: { type, command, seq, payload } }: MessageEvent<WorkerMessage<C, CommandPayload<C>>>) => {
      const result =
        (command in recvCommands && (await (recvCommands[command](unserialize(payload)) as CommandResult<C>))) || null;
      if (type === 'rpc') {
        target.postMessage({ type: 'rpc:ack', command, seq, payload: serialize(result) });
      }
    },
  );
  return recvCommands;
}

function cloneStructured(value: any, transfer: Transferable[] | undefined, seen: WeakSet<object>): any {
  if (value == null) return value;

  const valueType = typeof value;
  if (valueType === 'string' || valueType === 'number' || valueType === 'boolean' || valueType === 'bigint') {
    return value;
  }

  if (valueType === 'undefined' || valueType === 'symbol' || valueType === 'function') {
    return undefined;
  }

  if (value instanceof Date || value instanceof RegExp || ArrayBuffer.isView(value) || value instanceof ArrayBuffer) {
    return value;
  }

  if (transfer?.includes(value)) {
    return value;
  }

  if (seen.has(value)) {
    throw new TypeError('Cannot serialize circular reference');
  }

  seen.add(value);

  if (typeof value.toJSON === 'function') {
    const jsonValue = value.toJSON();
    if (jsonValue !== value) {
      const result = cloneStructured(jsonValue, transfer, seen);
      seen.delete(value);
      return result;
    }
  }

  if (Array.isArray(value)) {
    const result = new Array(value.length);
    for (let index = 0; index < value.length; index++) {
      const entry = cloneStructured(value[index], transfer, seen);
      result[index] = entry;
    }
    seen.delete(value);
    return result;
  }

  if (value instanceof Date || value instanceof RegExp || ArrayBuffer.isView(value) || value instanceof ArrayBuffer) {
    seen.delete(value);
    return value;
  }

  const result: Record<string, unknown> = {};
  for (const key of Object.keys(value)) {
    const entry = cloneStructured(value[key], transfer, seen);
    result[key] = entry;
  }

  seen.delete(value);
  return result;
}

export function serialize(obj: any, transfer?: Transferable[]): any {
  return cloneStructured(obj, transfer, new WeakSet());
}

function isDecimalLike(value: unknown) {
  return (
    typeof value === 'object' &&
    value != null &&
    'coeff' in value &&
    'digits' in value &&
    typeof value.coeff === 'bigint' &&
    typeof value.digits === 'bigint'
  );
}

function unserialize(value: any): any {
  if (value == null) return value;

  const valueType = typeof value;
  if (valueType === 'string' || valueType === 'number' || valueType === 'boolean' || valueType === 'bigint') {
    return value;
  }

  if (valueType === 'undefined' || valueType === 'symbol' || valueType === 'function') {
    return undefined;
  }

  if (value instanceof Date || value instanceof RegExp || ArrayBuffer.isView(value) || value instanceof ArrayBuffer) {
    return value;
  }

  if (typeof OffscreenCanvas !== 'undefined' && value instanceof OffscreenCanvas) {
    return value;
  }

  if (isDecimalLike(value)) {
    return Decimal(value);
  }

  if (Array.isArray(value)) {
    return value.map(unserialize);
  }

  if (value && typeof value === 'object') {
    const obj: Record<string, any> = {};
    for (const key of Object.keys(value)) {
      obj[key] = unserialize(value[key]);
    }
    return obj;
  }

  return value;
}
