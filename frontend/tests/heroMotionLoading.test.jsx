import { StrictMode } from 'react';
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useHeroMotion } from '../src/components/home-hero/useHeroMotion.js';
import { gsap } from 'gsap';

vi.mock('gsap', () => ({ gsap: {
  registerPlugin: vi.fn(), utils: { clamp: () => value => value },
  matchMedia: () => ({ add() {}, revert() {} }),
} }));
vi.mock('gsap/SplitText', () => ({ SplitText: {} }));
vi.mock('gsap/ScrollTrigger', () => ({ ScrollTrigger: {} }));

const motion = vi.hoisted(() => ({ loads: 0, resolve: null, reject: null, runtime: null }));
vi.mock('../src/components/home-hero/heroMotion.js', async () => {
  motion.loads++;
  return new Promise((resolve, reject) => { motion.resolve = resolve; motion.reject = reject; });
});

let preference;
let heroRef;
beforeEach(() => {
  preference = new EventTarget();
  preference.matches = false;
  vi.stubGlobal('matchMedia', () => preference);
  const hero = document.createElement('section');
  hero.innerHTML = '<h1>کتاب بعدی‌ات را پیدا کن</h1><a href="/books">مرور کتاب‌ها</a>';
  document.body.append(hero);
  heroRef = { current: hero };
  motion.runtime = { startHeroText: vi.fn(() => vi.fn()), startHeroDepth: vi.fn(() => vi.fn()) };
});
afterEach(() => { cleanup(); heroRef.current.remove(); });
const changePreference = async matches => {
  await act(async () => { preference.matches = matches; preference.dispatchEvent(new Event('change')); });
};

it('keeps reduced-motion content visible without importing the optional runtime', () => {
  renderHook(() => useHeroMotion(heroRef, true));
  expect(motion.loads).toBe(0);
  expect(gsap.registerPlugin).not.toHaveBeenCalled();
  expect(getComputedStyle(heroRef.current.querySelector('h1')).visibility).toBe('visible');
  expect(heroRef.current.querySelector('a').getAttribute('href')).toBe('/books');
});

it('cancels stale imports, responds to preference changes, and cleans up both motion owners', async () => {
  const { unmount, rerender } = renderHook(({ ready }) => useHeroMotion(heroRef, ready), {
    initialProps: { ready: false }, wrapper: StrictMode,
  });
  await changePreference(true);
  expect(motion.loads).toBe(1);
  expect(getComputedStyle(heroRef.current.querySelector('h1')).visibility).toBe('visible');
  const stale = renderHook(() => useHeroMotion(heroRef, true), { wrapper: StrictMode });
  stale.unmount();
  await changePreference(false);
  await act(async () => { motion.resolve(motion.runtime); });
  expect(motion.runtime.startHeroText).not.toHaveBeenCalled();
  await changePreference(true);
  expect(motion.runtime.startHeroText).toHaveBeenCalledTimes(1);
  expect(motion.runtime.startHeroDepth).not.toHaveBeenCalled();
  rerender({ ready: true });
  expect(motion.runtime.startHeroDepth).toHaveBeenCalledTimes(1);
  const stopText = motion.runtime.startHeroText.mock.results[0].value;
  const stopDepth = motion.runtime.startHeroDepth.mock.results[0].value;
  await changePreference(false);
  expect(stopText).toHaveBeenCalledTimes(1);
  expect(stopDepth).toHaveBeenCalledTimes(1);
  unmount();
  expect(stopText).toHaveBeenCalledTimes(1);
});
