import { defineCalls, listenCalls, unserialize, type WorkerMessagePort } from '#src/bridge/rpc';
import { Decimal, type Decimal as DecimalValue } from '#src/core/decimal';
import { describe, expect, it } from 'vitest';

type Payload = {
  decimal: DecimalValue;
  resolution: DecimalValue;
  aliases: DecimalValue[];
  date: Date;
  regexp: RegExp;
  values: Float64Array;
  map: Map<string, number>;
  optional: undefined;
};

type TestCommands = {
  roundtrip: (payload: Payload) => Payload;
  transfer: (buffer: ArrayBuffer) => number;
  responseTransfer: () => Float64Array;
};

describe('worker RPC transport', () => {
  it('rejects failed calls and releases pending requests on disposal', async () => {
    const channel = new MessageChannel();
    channel.port1.start();
    channel.port2.start();
    const lifetime = new AbortController();
    type Calls = { fail: () => never; pending: () => Promise<void> };
    listenCalls<Calls>(
      channel.port1 as unknown as WorkerMessagePort,
      {
        fail() {
          throw new RangeError('Invalid frame');
        },
        pending: () => new Promise(() => {}),
      },
      undefined,
      lifetime.signal,
    );
    const call = defineCalls<Calls>(channel.port2 as unknown as WorkerMessagePort, lifetime.signal);
    try {
      await expect(call('fail', undefined, { rpc: true })).rejects.toMatchObject({
        name: 'RangeError',
        message: 'Invalid frame',
      });
      const pending = call('pending', undefined, { rpc: true });
      lifetime.abort(new DOMException('Disposed', 'AbortError'));
      await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    } finally {
      channel.port1.close();
      channel.port2.close();
    }
  });

  it('uses native structured clone and revives Decimal values in place', async () => {
    const channel = new MessageChannel();
    channel.port1.start();
    channel.port2.start();
    const decimal = Decimal('123456789012345678901234567890.00000000000000000001');
    const resolution = Decimal('0.000000000000000000000000000001');

    listenCalls<TestCommands>(channel.port1 as unknown as WorkerMessagePort, {
      roundtrip(payload) {
        expect(payload.decimal.eq(decimal)).toBe(true);
        expect(payload.resolution.eq(resolution)).toBe(true);
        expect(payload.decimal.coeff).toBe(decimal.coeff);
        expect(payload.decimal.digits).toBe(decimal.digits);
        expect(payload.aliases[0]).toBe(payload.aliases[1]);
        expect(payload.date).toBeInstanceOf(Date);
        expect(payload.regexp).toBeInstanceOf(RegExp);
        expect(payload.values).toBeInstanceOf(Float64Array);
        expect(payload.map).toBeInstanceOf(Map);
        expect('optional' in payload).toBe(true);
        return payload;
      },
      transfer(buffer) {
        return buffer.byteLength;
      },
      responseTransfer: () => new Float64Array(),
    });

    const call = defineCalls<TestCommands>(channel.port2 as unknown as WorkerMessagePort);
    try {
      const result = await call(
        'roundtrip',
        {
          decimal,
          resolution,
          aliases: [decimal, decimal],
          date: new Date('2024-01-01T00:00:00Z'),
          regexp: /timescope/gi,
          values: new Float64Array([1, NaN, 3]),
          map: new Map([['value', 1]]),
          optional: undefined,
        },
        { rpc: true },
      );

      expect(result.decimal.eq(decimal)).toBe(true);
      expect(result.resolution.eq(resolution)).toBe(true);
      expect(result.decimal.coeff).toBe(decimal.coeff);
      expect(result.decimal.digits).toBe(decimal.digits);
      expect(result.aliases[0]).toBe(result.aliases[1]);
      expect(result.date.toISOString()).toBe('2024-01-01T00:00:00.000Z');
      expect(result.regexp.source).toBe('timescope');
      expect(result.values[1]).toBeNaN();
      expect(result.map.get('value')).toBe(1);
    } finally {
      channel.port1.close();
      channel.port2.close();
    }
  });

  it('preserves cycles while reviving nested Decimal values', () => {
    const value: { decimal: DecimalValue; self?: unknown } = { decimal: Decimal(1) };
    value.self = value;
    const cloned = structuredClone(value);
    const revived = unserialize(cloned);

    expect(revived.self).toBe(revived);
    expect(revived.decimal.add(1).eq(2)).toBe(true);
  });

  it('keeps transfer-list ownership semantics', async () => {
    const channel = new MessageChannel();
    channel.port1.start();
    channel.port2.start();
    listenCalls<TestCommands>(channel.port1 as unknown as WorkerMessagePort, {
      roundtrip: (payload) => payload,
      transfer: (buffer) => buffer.byteLength,
      responseTransfer: () => new Float64Array(),
    });
    const call = defineCalls<TestCommands>(channel.port2 as unknown as WorkerMessagePort);
    const buffer = new ArrayBuffer(32);

    try {
      const size = await call('transfer', buffer, { rpc: true, transfer: [buffer] });
      expect(size).toBe(32);
      expect(buffer.byteLength).toBe(0);
    } finally {
      channel.port1.close();
      channel.port2.close();
    }
  });

  it('transfers selected RPC response buffers without copying', async () => {
    const channel = new MessageChannel();
    channel.port1.start();
    channel.port2.start();
    const response = new Float64Array([1, NaN, Infinity]);
    listenCalls<TestCommands>(
      channel.port1 as unknown as WorkerMessagePort,
      {
        roundtrip: (payload) => payload,
        transfer: (buffer) => buffer.byteLength,
        responseTransfer: () => response,
      },
      (command, result) => (command === 'responseTransfer' && result instanceof Float64Array ? [result.buffer] : []),
    );
    const call = defineCalls<TestCommands>(channel.port2 as unknown as WorkerMessagePort);

    try {
      const result = await call('responseTransfer', undefined, { rpc: true });
      expect([...result]).toEqual([1, NaN, Infinity]);
      expect(response.buffer.byteLength).toBe(0);
    } finally {
      channel.port1.close();
      channel.port2.close();
    }
  });
});
