import { flushSync } from 'react-dom';

const DETAIL_COVER = '.detail-cover > :first-child';
const WAIT_MS = 800;

// منتظر جلد صفحه‌ی کتاب می‌ماند (صفحه lazy است و داده را می‌گیرد)؛ اگر دیر برسد، گذار فقط محو می‌شود
async function waitForDetailCover() {
  const start = performance.now();
  while (performance.now() - start < WAIT_MS) {
    const el = document.querySelector(DETAIL_COVER);
    if (el) {
      const img = el.querySelector('img');
      await Promise.race([img?.decode().catch(() => {}), new Promise((r) => setTimeout(r, 200))]);
      return el;
    }
    await new Promise((r) => requestAnimationFrame(r));
  }
  return null;
}

/**
 * جلد کارت را با View Transition به جای جلد صفحه‌ی کتاب می‌برد.
 * فقط با حرکت مجاز و در مرورگری که View Transition دارد؛
 * وگرنه false برمی‌گرداند و لینک عادی کار می‌کند. کلیک با Ctrl/Cmd/Shift یا دکمه‌ی وسط دست‌نخورده می‌ماند.
 */
export function flyToBook(event, coverEl, navigate, to) {
  if (
    !document.startViewTransition ||
    !coverEl ||
    event.button !== 0 ||
    event.metaKey || event.ctrlKey || event.shiftKey || event.altKey ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    return false;
  }

  event.preventDefault();
  coverEl.style.viewTransitionName = 'book-cover';

  const transition = document.startViewTransition(async () => {
    coverEl.style.viewTransitionName = '';
    flushSync(() => navigate(to));
    const target = await waitForDetailCover();
    if (target) target.style.viewTransitionName = 'book-cover';
  });

  transition.ready.catch(() => {}); // گذار ردشده (مثلاً تب پنهان) خطا نیست؛ ناوبری انجام شده است
  transition.finished.finally(() => {
    const target = document.querySelector(DETAIL_COVER);
    if (target) target.style.viewTransitionName = '';
  });
  return true;
}
