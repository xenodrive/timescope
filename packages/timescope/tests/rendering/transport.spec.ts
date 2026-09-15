import { dataBuffers } from '#src/bridge/renderEngine';
import { defineCalls, defineLocalCalls, listenCalls, type RenderCall, type WorkerMessagePort } from '#src/bridge/rpc';
import { Decimal } from '#src/core/decimal';
import { describe, expect, it } from 'vitest';

type Payload = { value: Decimal; alias: Decimal; values: Float64Array; self?: Payload };
type Calls = { echo: (payload: Payload) => Promise<Payload>; wait: () => Promise<void>; fail: () => never };

function connection(kind: 'local' | 'worker', handlers: Calls) {
  const lifetime = new AbortController();
  const channel = kind === 'worker' ? new MessageChannel() : undefined;
  let call: RenderCall<Calls>;
  if (channel) {
    channel.port1.start();
    channel.port2.start();
    listenCalls(channel.port1 as unknown as WorkerMessagePort, handlers, undefined, lifetime.signal);
    const rpc = defineCalls<Calls>(channel.port2 as unknown as WorkerMessagePort, lifetime.signal);
    call = (command, payload) => rpc(command, payload, { rpc: true });
  } else {
    call = defineLocalCalls(handlers, lifetime.signal);
  }
  return {
    call,
    dispose() {
      lifetime.abort(new DOMException('Disposed', 'AbortError'));
      channel?.port1.close();
      channel?.port2.close();
    },
  };
}

describe.each(['local', 'worker'] as const)('%s request boundary', (kind) => {
  it('snapshots arguments at dispatch and isolates returned values, preserving precision, aliases and cycles', async () => {
    const value = Decimal('12345678901234567890.000000000000000000001');
    const payload: Payload = { value, alias: value, values: new Float64Array([1, 2]) };
    payload.self = payload;
    let received!: Payload;
    const transport = connection(kind, {
      async echo(input) {
        received = input;
        return input;
      },
      wait: async () => {},
      fail: () => {
        throw new Error();
      },
    });
    try {
      const pending = transport.call('echo', payload);
      payload.values[0] = 99;
      const result = await pending;
      expect(received.values[0]).toBe(1);
      expect(result.values[0]).toBe(1);
      expect(result.value.eq(value)).toBe(true);
      expect(result.value).toBe(result.alias);
      expect(result.self).toBe(result);
      expect(result).not.toBe(received);
      received.values[0] = 77;
      expect(result.values[0]).toBe(1);
      result.values[1] = 88;
      expect(received.values[1]).toBe(2);
    } finally {
      transport.dispose();
    }
  });

  it('propagates handler errors', async () => {
    const transport = connection(kind, {
      echo: async (input) => input,
      wait: async () => {},
      fail: () => {
        throw new RangeError('Invalid request');
      },
    });
    try {
      await expect(transport.call('fail', undefined)).rejects.toMatchObject({
        name: 'RangeError',
        message: 'Invalid request',
      });
    } finally {
      transport.dispose();
    }
  });

  it('waits for a void handler to finish', async () => {
    let started!: () => void;
    let finish!: () => void;
    const entered = new Promise<void>((resolve) => {
      started = resolve;
    });
    const waiting = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const transport = connection(kind, {
      echo: async (input) => input,
      wait: () => {
        started();
        return waiting;
      },
      fail: () => {
        throw new Error();
      },
    });
    try {
      let complete = false;
      const first = transport.call('wait', undefined).then(() => {
        complete = true;
      });
      await entered;
      expect(complete).toBe(false);
      finish();
      await first;
      expect(complete).toBe(true);
    } finally {
      transport.dispose();
    }
  });

  it('aborts unfinished calls and rejects new calls after disposal', async () => {
    let enteredPending!: () => void;
    const pendingStarted = new Promise<void>((resolve) => {
      enteredPending = resolve;
    });
    const blocked = connection(kind, {
      echo: async (input) => input,
      wait: () => {
        enteredPending();
        return new Promise(() => {});
      },
      fail: () => {
        throw new Error();
      },
    });
    const pending = blocked.call('wait', undefined);
    const aborted = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    await pendingStarted;
    blocked.dispose();
    await aborted;
    await expect(blocked.call('wait', undefined)).rejects.toMatchObject({ name: 'AbortError' });
  });
});

describe('worker buffer ownership', () => {
  it('transfers request and response buffers, including aliased drawing views', async () => {
    const channel = new MessageChannel();
    channel.port1.start();
    channel.port2.start();
    const lifetime = new AbortController();
    const backing = new ArrayBuffer(32);
    const response = {
      data: {
        x: { time: new Float64Array(backing, 0, 2) },
        y: { value: new Float64Array(backing, 16, 2) },
        links: [{ commands: { values: new Float64Array([1, NaN, Infinity]) } }],
      },
    };
    type Calls = { transfer: (buffer: ArrayBuffer) => typeof response };
    listenCalls<Calls>(
      channel.port1 as unknown as WorkerMessagePort,
      {
        transfer(buffer) {
          response.data.x.time[0] = new Float64Array(buffer)[0];
          return response;
        },
      },
      (_command, result) => dataBuffers(result),
      lifetime.signal,
    );
    const call = defineCalls<Calls>(channel.port2 as unknown as WorkerMessagePort, lifetime.signal);
    const input = new Float64Array([42]);
    try {
      const result = await call('transfer', input.buffer, { rpc: true, transfer: [input.buffer] });
      expect(input.byteLength).toBe(0);
      expect(backing.byteLength).toBe(0);
      expect(response.data.links[0].commands.values.byteLength).toBe(0);
      expect(result.data.x.time[0]).toBe(42);
      expect(result.data.x.time.buffer).toBe(result.data.y.value.buffer);
      expect([...result.data.links[0].commands.values]).toEqual([1, NaN, Infinity]);
    } finally {
      lifetime.abort();
      channel.port1.close();
      channel.port2.close();
    }
  });
});
