import { useEffect, useLayoutEffect, useState } from 'react';

const MOTION_OK = '(prefers-reduced-motion: no-preference)';

export function useHeroMotion(heroRef, ready) {
  const [motion, setMotion] = useState(null);

  useLayoutEffect(() => {
    const setNav = () => {
      const height = document.querySelector('.site-navbar')?.offsetHeight ?? 0;
      document.documentElement.style.setProperty('--rb-nav-h', `${height}px`);
    };
    setNav();
    window.addEventListener('resize', setNav);
    return () => window.removeEventListener('resize', setNav);
  }, []);

  useEffect(() => {
    const preference = window.matchMedia(MOTION_OK);
    let cancelled = false;
    let generation = 0;
    const load = () => {
      const request = ++generation;
      import('./heroMotion.js').then(runtime => {
        if (!cancelled && request === generation && preference.matches) setMotion(runtime);
      }).catch(() => {
        // حرکت اختیاری است؛ خطای دانلود نباید محتوای قابل استفاده را پنهان کند.
      });
    };
    const onChange = () => {
      if (preference.matches) load();
      else { generation++; setMotion(null); }
    };
    if (preference.matches) load();
    preference.addEventListener('change', onChange);
    return () => {
      cancelled = true;
      preference.removeEventListener('change', onChange);
    };
  }, []);

  useLayoutEffect(() => motion?.startHeroText(heroRef), [heroRef, motion]);
  useLayoutEffect(() => {
    if (ready) return motion?.startHeroDepth(heroRef);
  }, [heroRef, ready, motion]);
}
