import { Container, Row, Col } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { FiBookOpen, FiMail, FiPhone } from 'react-icons/fi';
import { FaInstagram, FaTelegramPlane } from 'react-icons/fa';

// سال جاری به تقویم شمسی، بدون نیاز به کتابخانه‌ی جانبی
function getCurrentPersianYear() {
  return new Intl.DateTimeFormat('fa-IR-u-ca-persian', { year: 'numeric' }).format(
    new Date()
  );
}

function Footer() {
  const currentYear = getCurrentPersianYear();

  return (
    <footer className="site-footer py-5 mt-5">
      <Container>
        <Row className="g-4">
          <Col md={4}>
            <div className="d-flex align-items-center gap-2 mb-3">
              <FiBookOpen size={24} />
              <h2 className="h5 mb-0">ری‌بوک</h2>
            </div>
            <p className="text-muted-footer mb-0">
              پلتفرم خرید و فروش کتاب‌های دست دوم — جایی برای دادن زندگی دوباره به
              کتاب‌هایتان.
            </p>
          </Col>

          <Col md={4}>
            <h2 className="h6 mb-3">دسترسی سریع</h2>
            <ul className="list-unstyled d-flex flex-column gap-2 mb-0">
              <li>
                <Link to="/">خانه</Link>
              </li>
              <li>
                <Link to="/books">کتاب‌ها</Link>
              </li>
              <li>
                <Link to="/support">پشتیبانی</Link>
              </li>
            </ul>
          </Col>

          <Col md={4}>
            <h2 className="h6 mb-3">ارتباط با ما</h2>
            <ul className="list-unstyled d-flex flex-column gap-2 mb-3">
              <li className="d-flex align-items-center gap-2">
                <FiMail size={16} />
                <a href="mailto:info@rebook.ir">info@rebook.ir</a>
              </li>
              <li className="d-flex align-items-center gap-2">
                <FiPhone size={16} />
                <a href="tel:+982112345678">۰۲۱-۱۲۳۴۵۶۷۸</a>
              </li>
            </ul>

            <div className="d-flex gap-2">
              <a
                href="https://instagram.com/rebook"
                target="_blank"
                rel="noopener noreferrer"
                className="footer-social-icon"
                aria-label="صفحه اینستاگرام ری‌بوک"
              >
                <FaInstagram size={18} />
              </a>
              <a
                href="https://t.me/rebook"
                target="_blank"
                rel="noopener noreferrer"
                className="footer-social-icon"
                aria-label="کانال تلگرام ری‌بوک"
              >
                <FaTelegramPlane size={18} />
              </a>
            </div>
          </Col>
        </Row>

        <hr className="border-light border-opacity-25 my-4" />

        <p className="text-center text-muted-footer mb-0 small">
          © {currentYear} ری‌بوک — تمامی حقوق محفوظ است.
        </p>
      </Container>
    </footer>
  );
}

export default Footer;