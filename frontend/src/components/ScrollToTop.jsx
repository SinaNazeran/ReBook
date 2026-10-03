import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * با هر تغییر مسیر، صفحه را به بالا اسکرول می‌کند.
 * چیزی رندر نمی‌کند؛ فقط یک side effect است.
 */
function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [pathname]);

  return null;
}

export default ScrollToTop;