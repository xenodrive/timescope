import { watchCanvasColor } from '#src/main/canvasColor';
import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => vi.unstubAllGlobals());

it('resolves inherited color, detects theme changes without resizing, and releases its observers', () => {
  const ancestor = { parentElement: null } as unknown as Element;
  const element = { parentElement: ancestor } as unknown as Element;
  let color = 'rgb(31, 41, 55)';
  vi.stubGlobal('getComputedStyle', () => ({ color }));
  let mutated!: () => void;
  const observe = vi.fn();
  const disconnect = vi.fn();
  vi.stubGlobal(
    'MutationObserver',
    class {
      constructor(callback: () => void) {
        mutated = callback;
      }
      observe = observe;
      disconnect = disconnect;
    },
  );
  const media = { addEventListener: vi.fn(), removeEventListener: vi.fn() };
  const addEventListener = vi.fn();
  const removeEventListener = vi.fn();
  vi.stubGlobal('window', { matchMedia: () => media, addEventListener, removeEventListener });
  const changed = vi.fn();
  const dispose = watchCanvasColor(element, changed);

  expect(changed).toHaveBeenLastCalledWith('rgb(31, 41, 55)');
  expect(observe.mock.calls.map(([node]) => node)).toEqual([element, ancestor]);
  mutated();
  expect(changed).toHaveBeenCalledOnce();
  color = 'rgb(229, 231, 235)';
  mutated();
  expect(changed).toHaveBeenLastCalledWith(color);
  expect(changed).toHaveBeenCalledTimes(2);

  color = 'rgb(17, 24, 39)';
  media.addEventListener.mock.calls[0][1]();
  expect(changed).toHaveBeenLastCalledWith(color);
  dispose();
  expect(disconnect).toHaveBeenCalledOnce();
  expect(media.removeEventListener).toHaveBeenCalledWith('change', media.addEventListener.mock.calls[0][1]);
  expect(removeEventListener.mock.calls).toEqual(addEventListener.mock.calls);
});
