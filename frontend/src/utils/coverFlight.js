import { flushSync } from 'react-dom';

const DETAIL_COVER = '.detail-cover > :first-child';
const WAIT_MS = 800;

// منتظر جلد صفحه‌ی کتاب می‌ماند (صفحه lazy است و داده را می‌گیرد)؛ اگر دیر برسد، گذار فقط محو می‌شود.
// نه با requestAnimationFrame: در callback گذار، Chrome رندر صفحه را نگه می‌دارد و rAF اجرا نمی‌شود؛
// حلقه‌ی rAF تا مهلت ۴ ثانیه‌ای مرورگر گیر می‌کرد و صفحه همان‌قدر یخ می‌زد. MutationObserver و setTimeout اجرا می‌شوند.
function appeared(selector, ms) {
  const found = document.querySelector(selector);
  if (found) return Promise.resolve(found);
  return new Promise((resolve) => {
    const observer = new MutationObserver(() => {
      const el = document.querySelector(selector);
      if (el) done(el);
    });
    const timer = setTimeout(() => done(null), ms);
    function done(el) {
      observer.disconnect();
      clearTimeout(timer);
      resolve(el);
    }
    observer.observe(document.body, { childList: true, subtree: true });
  });
}

async function waitForDetailCover() {
  const el = await appeared(DETAIL_COVER, WAIT_MS);
  const img = el?.querySelector('img');
  if (img) await Promise.race([img.decode().catch(() => {}), new Promise((r) => setTimeout(r, 200))]);
  return el;
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
