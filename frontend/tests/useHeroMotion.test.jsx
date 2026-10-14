import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { gsap } from 'gsap';
import { SplitText } from 'gsap/SplitText';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useHeroMotion } from '../src/components/home-hero/useHeroMotion.js';

const media = vi.hoisted(() => ({ contexts: [], ticking: new Set() }));
vi.mock('gsap', () => {
  const timeline = () => {
    const tl = {};
    for (const key of ['set', 'from', 'to', 'progress', 'eventCallback']) tl[key] = vi.fn(() => tl);
    return tl;
  };
  return { gsap: {
    registerPlugin: vi.fn(), set: vi.fn(), to: vi.fn(), killTweensOf: vi.fn(), timeline,
    utils: { clamp: (min, max) => value => Math.min(max, Math.max(min, value)), toArray: () => [] },
    ticker: { add: fn => media.ticking.add(fn), remove: fn => media.ticking.delete(fn) },
    matchMedia: () => {
      const owned = [];
      return {
        add(query, callback) {
          const disposers = [];
          const context = {
            conditions: { motion: true, finePointer: true },
            add(fn) { const dispose = fn(); if (typeof dispose === 'function') disposers.push(dispose); },
            revert() { disposers.splice(0).forEach(dispose => dispose()); },
          };
          const dispose = callback(context);
          if (typeof dispose === 'function') disposers.push(dispose);
          owned.push(context);
          media.contexts.push(context);
        },
        revert() { owned.forEach(context => context.revert()); },
      };
    },
  } };
});
vi.mock('gsap/SplitText', () => ({ SplitText: { create: vi.fn(() => ({ words: [], revert: vi.fn() })) } }));
vi.mock('gsap/ScrollTrigger', () => ({ ScrollTrigger: { create: vi.fn(), refresh: vi.fn() } }));

let resolveFonts;
let hero;
const originalFonts = Object.getOwnPropertyDescriptor(document, 'fonts');
beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  media.contexts = [];
  media.ticking.clear();
  const ready = new Promise(resolve => { resolveFonts = resolve; });
  Object.defineProperty(document, 'fonts', { configurable: true, value: { ready } });
  hero = document.createElement('section');
  hero.innerHTML = '<div class="hero-stage"></div><div class="hero-runway"></div>' +
    '<div class="depth-world"></div><div class="depth-copy"></div><div class="hero-depth"></div>';
  document.body.append(hero);
});
afterEach(() => {
  cleanup();
  hero.remove();
  if (originalFonts) Object.defineProperty(document, 'fonts', originalFonts);
  else delete document.fonts;
  vi.useRealTimers();
});
const finishFonts = async () => { await act(async () => { resolveFonts(); }); };

it('does not initialize text motion after its media context has ended', async () => {
  renderHook(() => useHeroMotion({ current: hero }, false));
  media.contexts[0].revert();
  await finishFonts();
  expect(SplitText.create).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
});

it('ignores font callbacks after unmount', async () => {
  const { unmount } = renderHook(() => useHeroMotion({ current: hero }, false));
  unmount();
  await finishFonts();
  expect(SplitText.create).not.toHaveBeenCalled();
});

it('does not refresh a flight context that ended while fonts were loading', async () => {
  renderHook(() => useHeroMotion({ current: hero }, true));
  media.contexts[1].revert();
  await finishFonts();
  expect(ScrollTrigger.refresh).not.toHaveBeenCalled();
  expect(media.ticking.size).toBe(0);
});

it('cleans up pointer tweens, listeners, ticker callbacks, and safety timers', async () => {
  const removeWindowListener = vi.spyOn(window, 'removeEventListener');
  const removeHeroListener = vi.spyOn(hero, 'removeEventListener');
  const { unmount } = renderHook(() => useHeroMotion({ current: hero }, true));
  await finishFonts();
  hero.dispatchEvent(new MouseEvent('pointermove', { clientX: 10, clientY: 20 }));
  const look = gsap.to.mock.calls.at(-1)[0];
  expect(media.ticking.size).toBe(1);
  unmount();
  expect(gsap.killTweensOf).toHaveBeenCalledWith(look);
  expect(removeWindowListener).toHaveBeenCalledWith('resize', expect.any(Function));
  expect(removeHeroListener).toHaveBeenCalledWith('pointermove', expect.any(Function));
  expect(media.ticking.size).toBe(0);
  expect(vi.getTimerCount()).toBe(0);
});
