let pending;

// بارگذاری ناوبری و پیش‌دریافت یک درخواست مشترک دارند؛ شکست، تلاش بعدی را قفل نمی‌کند.
export function loadBookDetail() {
  pending ??= import('../pages/BookDetail').catch(error => {
    pending = undefined;
    throw error;
  });
  return pending;
}

export function prefetchBookDetail(event) {
  const link = event.target.closest?.('a[href]');
  if (!link) return;
  const url = new URL(link.href, window.location.href);
  if (url.origin !== window.location.origin || !/^\/books\/\d+\/?$/.test(url.pathname)) return;
  // فقط کد صفحه؛ داده‌های کتاب و درخواست‌های کاربر با ناوبری عادی دریافت می‌شوند.
  return loadBookDetail().then(() => undefined).catch(() => {});
}
