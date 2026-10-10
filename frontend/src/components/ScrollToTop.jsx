import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * با هر تغییر مسیر، صفحه را به بالا اسکرول می‌کند و فوکوس را به محتوای اصلی (main#main) می‌برد.
 * بی این، پس از کلیک یا Enter روی یک لینک، فوکوس روی body می‌ماند: صفحه‌خوان از تغییر صفحه خبردار نمی‌شد
 * و Tab بعدی از بالای سند شروع می‌شد. بارگذاری اول دست نمی‌خورد (Tab اول همان لینک پرش است)،
 * و تغییر فقط query (فیلترهای /books) هم صفحه‌ی تازه نیست. صفحه‌هایی که بعد از بارگذاری خودشان فوکوس می‌دهند
 * (سبد، «نمایش بیشتر»، خطای فرم) پس از این اجرا می‌شوند و جایش را می‌گیرند.
 * چیزی رندر نمی‌کند؛ فقط یک side effect است.
 */
function ScrollToTop() {
  const { pathname } = useLocation();
  // مسیر قبلی، نه پرچم «رندر اول»: StrictMode در توسعه effect را دو بار اجرا می‌کند و پرچم را خرج می‌کرد
  const previous = useRef(pathname);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    if (previous.current === pathname) return;
    previous.current = pathname;
    document.getElementById('main')?.focus({ preventScroll: true });
  }, [pathname]);

  return null;
}

export default ScrollToTop;
