import { Container } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import BrandMark from './BrandMark';

// سال جاری به تقویم شمسی، بدون نیاز به کتابخانه‌ی جانبی
function getCurrentPersianYear() {
  return new Intl.DateTimeFormat('fa-IR-u-ca-persian', { year: 'numeric' }).format(
    new Date()
  );
}

// ایمیل، تلفن و شبکه‌های اجتماعی قبلی جانگهدار بودند (PRODUCT.md)؛ تنها کانال واقعی تماس، فرم «تماس با ما» و تیکت پشتیبانی است
function Footer() {
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

        <nav aria-label="پیوندهای پایین صفحه">
          <ul className="site-footer-links">
            <li>
              <Link to="/books">کتاب‌ها</Link>
            </li>
            <li>
              <Link to="/create-book">فروش کتاب</Link>
            </li>
            <li>
              <Link to="/support">پشتیبانی</Link>
            </li>
            <li>
              <Link to="/about">درباره‌ی ما</Link>
            </li>
            <li>
              <Link to="/contact">تماس با ما</Link>
            </li>
          </ul>
        </nav>

        <p className="site-footer-legal">© {getCurrentPersianYear()} ری‌بوک</p>
      </Container>
    </footer>
  );
}

export default Footer;
