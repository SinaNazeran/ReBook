import { expect, it, vi } from 'vitest';
import { depthOpacity, depthSlot, wrapDepth } from '../src/components/home-hero/depthGeometry.js';

vi.mock('gsap', () => { throw new Error('Static geometry must work without the motion library'); });

it('keeps static cover opacity bounded at both ends of the depth range', () => {
  for (const [depth, opacity] of [[-4000, 0], [-2600, 0], [-1800, 1], [0, 1], [150, 0.5], [300, 0]]) {
    expect(depthOpacity(depth)).toBe(opacity);
  }
});

it('places static covers and wraps depth without requiring the motion runtime', () => {
  expect(depthSlot(0, 1).z).toBe(-150);
  expect(Number.isFinite(depthSlot(0, 1).x)).toBe(true);
  expect(depthSlot(12, 13).z).toBe(-2600);
  expect(wrapDepth(300)).toBe(-2600);
  expect(wrapDepth(-2601)).toBe(299);
});
