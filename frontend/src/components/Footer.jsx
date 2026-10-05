import { Container } from 'react-bootstrap';
import { Link } from 'react-router-dom';

// سال جاری به تقویم شمسی، بدون نیاز به کتابخانه‌ی جانبی
function getCurrentPersianYear() {
  return new Intl.DateTimeFormat('fa-IR-u-ca-persian', { year: 'numeric' }).format(
    new Date()
  );
}

// ایمیل، تلفن و شبکه‌های اجتماعی قبلی جانگهدار بودند (PRODUCT.md)؛ تنها کانال واقعی تماس، تیکت پشتیبانی است
function Footer() {
  return (
    <footer className="site-footer mt-5">
      <Container className="site-footer-inner">
        <div className="site-footer-brand">
          <Link to="/" className="site-footer-name">
            <span className="brand-mark" aria-hidden="true" />
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
          </ul>
        </nav>

        <p className="site-footer-legal">© {getCurrentPersianYear()} ری‌بوک</p>
      </Container>
    </footer>
  );
}

export default Footer;
