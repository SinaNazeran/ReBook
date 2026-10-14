import { gsap } from "gsap";
const clamp01 = gsap.utils.clamp(0, 1);
export const DEPTH_PERSPECTIVE = 900;
const DEPTH_NEAR = -150;
const DEPTH_FAR = -2600;
const DEPTH_LOOP = 2900;
export const DEPTH_TRAVEL = 3500;
export const DEPTH_DRIFT = 40;
export const depthSlot = (i, n) => {
  const a = i * 2.39996 + 0.6;
  const z = DEPTH_NEAR - i * (DEPTH_NEAR - DEPTH_FAR) / Math.max(1, n - 1);
  const k = 1 + ((DEPTH_PERSPECTIVE - z) / DEPTH_PERSPECTIVE - 1) * 0.35;
  return {
    x: Math.cos(a) * (30 + i % 3 * 6) * k,
    // vw
    y: Math.sin(a) * (26 + i % 2 * 6) * k,
    // vh
    z,
    tilt: i * 37 % 14 - 7
  };
};
export const wrapDepth = z => DEPTH_FAR + ((z - DEPTH_FAR) % DEPTH_LOOP + DEPTH_LOOP) % DEPTH_LOOP;
export const depthOpacity = z => Math.min(clamp01((z - DEPTH_FAR) / 800), clamp01((300 - z) / 300));
