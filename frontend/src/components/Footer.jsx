import { formatPersianDate } from '../utils/locale';
import { Container } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { FiArrowUp } from 'react-icons/fi';
import BrandMark from './BrandMark';
import { useAuth } from '../context/useAuth.js';
import { useSeries } from '../utils/categories';
import { seriesInk } from '../utils/series';

// سال جاری به تقویم شمسی، بدون نیاز به کتابخانه‌ی جانبی
function getCurrentPersianYear() {
  return formatPersianDate(new Date(), 'year');
}

// بازگشت به بالا: اسکرول نرم (اگر کاربر حرکت کم نخواسته) و فوکوس روی محتوای اصلی، تا صفحه‌کلید هم از بالا ادامه دهد
function scrollToTop() {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
  document.getElementById('main')?.focus({ preventScroll: true });
}

/**
 * فوتر: برند | مجموعه‌ها | خرید و فروش | ری‌بوک، و زیرش سطر حقوقی.
 * تنها راه‌های واقعی تماس: «تماس با ما» برای مهمان و «پشتیبانی» برای کاربر واردشده (پاسخ‌ها همان‌جاست).
 */
function Footer() {
  const { isAuthenticated } = useAuth();
  const series = useSeries();

  return (
    <footer className="site-footer mt-5">
      {/* کلید مجموعه‌ها، مثل نوار رنگ‌های پشت جلد کتاب جیبی: هشت مرکب کنار هم */}
      <div className="series-rule" aria-hidden="true">
        {Array.from({ length: 8 }, (_, i) => (
          <span key={i} style={{ backgroundColor: `var(--rb-series-${i + 1})` }} />
        ))}
      </div>
      <Container className="site-footer-inner">
        <div className="site-footer-brand">
          <Link to="/" className="site-footer-name" translate="no">
            <BrandMark />
            ری‌بوک
          </Link>
          <p className="mb-0">جایی برای دادن زندگی دوباره به کتاب‌هایتان.</p>
        </div>

        {series.length > 0 && (
          <nav className="site-footer-col site-footer-series-col" aria-labelledby="footer-series">
            <h2 id="footer-series" className="site-footer-heading">
              مجموعه‌ها
            </h2>
            <ul className="site-footer-series">
              {series.map((category) => (
                <li key={category.id}>
                  <Link to={`/books?category=${category.slug}`} style={{ '--series-ink': seriesInk(category.id) }}>
                    <span className="series-index-mark" aria-hidden="true" />
                    <span className="series-link-label">{category.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}

        <nav className="site-footer-col" aria-labelledby="footer-trade">
          <h2 id="footer-trade" className="site-footer-heading">
            خرید و فروش
          </h2>
          <ul className="site-footer-links">
            <li>
              <Link to="/books">کتاب‌ها</Link>
            </li>
            <li>
              <Link to="/cart">سبد خرید</Link>
            </li>
            <li>
              <Link to="/create-book">فروش کتاب</Link>
            </li>
            {isAuthenticated && (
              <li>
                <Link to="/my-orders">معاملات من</Link>
              </li>
            )}
          </ul>
        </nav>

        <nav className="site-footer-col" aria-labelledby="footer-rebook">
          <h2 id="footer-rebook" className="site-footer-heading">
            ری‌بوک
          </h2>
          <ul className="site-footer-links">
            <li>
              <Link to="/about">درباره‌ی ما</Link>
            </li>
            <li>
              {isAuthenticated ? <Link to="/support">پشتیبانی</Link> : <Link to="/contact">تماس با ما</Link>}
            </li>
          </ul>
        </nav>

        <div className="site-footer-bottom">
          <p className="mb-0">© {getCurrentPersianYear()} ری‌بوک</p>
          <button type="button" className="site-footer-top" onClick={scrollToTop}>
            بازگشت به بالا
            <FiArrowUp aria-hidden="true" />
          </button>
        </div>
      </Container>
    </footer>
  );
}

export default Footer;
