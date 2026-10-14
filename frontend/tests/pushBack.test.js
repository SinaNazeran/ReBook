import { useEffect } from 'react';
import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { watchPushBack } from '../src/utils/pushBack.js';

let observers;
beforeEach(() => {
  observers = [];
  vi.stubGlobal('MutationObserver', class {
    constructor(callback) {
      this.callback = callback;
      this.observe = vi.fn();
      this.disconnect = vi.fn();
      observers.push(this);
    }
  });
});
afterEach(() => {
  cleanup();
  document.documentElement.style.removeProperty('--push-y');
});

it('disconnects its observer through the returned disposer', () => {
  const dispose = watchPushBack();
  expect(observers[0].observe).toHaveBeenCalledWith(document.body, { childList: true });
  expect(dispose).toBeTypeOf('function');
  dispose();
  expect(observers[0].disconnect).toHaveBeenCalledOnce();
});

it('leaves one active observer during StrictMode replay and none after unmount', () => {
  const { unmount } = renderHook(() => useEffect(() => watchPushBack(), []), { reactStrictMode: true });
  expect(observers).toHaveLength(2);
  expect(observers[0].disconnect).toHaveBeenCalledOnce();
  expect(observers[1].disconnect).not.toHaveBeenCalled();
  unmount();
  expect(observers[1].disconnect).toHaveBeenCalledOnce();
});
