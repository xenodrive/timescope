import { TimescopeEventEmitter } from '#src/core/event';
import { Timescope } from '#src/main/Timescope';
import { createDataSource, chunkStoreForDataSource } from '#src/main/TimescopeDataSource';
import { describe, expect, it, vi } from 'vitest';

describe('event lifecycle', () => {
  it('delivers queued events before clearing registrations on disposal', async () => {
    const emitter = new TimescopeEventEmitter<'change'>();
    const beforeDispose = vi.fn();
    emitter.on('change', beforeDispose);

    emitter.dispatchEvent('change');
    emitter.dispose();
    expect(beforeDispose).not.toHaveBeenCalled();

    const afterDispose = vi.fn();
    emitter.on('change', afterDispose);
    emitter.dispatchEvent('change');
    await Promise.resolve();
    expect(beforeDispose).toHaveBeenCalledOnce();
    expect(afterDispose).not.toHaveBeenCalled();

    emitter.dispatchEvent('change');
    await Promise.resolve();
    expect(beforeDispose).toHaveBeenCalledOnce();
  });

  it('keeps Timescope state available to pending unmount listeners', async () => {
    const timescope = new Timescope({ time: 5 });
    const onUnmount = vi.fn(() => {
      expect(timescope.time?.number()).toBe(5);
      timescope.setTime(6, false);
    });
    timescope.on('unmount', onUnmount);
    vi.spyOn(timescope, 'unmount').mockImplementation(() => timescope.dispatchEvent('unmount'));

    timescope.dispose();
    await Promise.resolve();
    expect(onUnmount).toHaveBeenCalledOnce();
    expect(timescope.time?.number()).toBe(6);
  });

  it('does not run a deferred mount after disposal begins', async () => {
    const timescope = new Timescope({ target: '#missing' });
    timescope.dispose();
    await Promise.resolve();
    expect(() => timescope.mount('#missing')).toThrow('Timescope is disposed');
  });

  it('notifies a retained chunk store when its source is disposed', async () => {
    const source = createDataSource({ data: [{ time: 0, value: 1 }] });
    const store = chunkStoreForDataSource(source);
    const onInvalidate = vi.fn();
    store.on('invalidate', onInvalidate);

    source.dispose?.();
    await Promise.resolve();
    await Promise.resolve();
    expect(source.revision).toBe(1);
    expect(onInvalidate).toHaveBeenCalledOnce();
    store.dispose();
  });
});
