import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Container, Row, Col, Button, Alert } from 'react-bootstrap';
import Form from '../components/Form';
import Loading from '../components/Loading';
import { notificationAPI, getErrorMessage } from '../services/api';
import { useAuth } from '../context/useAuth.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_MESSAGE = 10;
const FIELD_ORDER = ['name', 'email', 'subject', 'message'];
const EMPTY_FORM = { name: '', email: '', subject: '', message: '' };

// همان قواعد سرور (ContactMessageSerializer)، تا خطای تایپی پیش از ارسال دیده شود و سهمیه‌ی ارسال را نخورد
function validate(data, isGuest) {
  const errors = {};
  if (isGuest) {
    if (!data.name.trim()) errors.name = 'نامت را بنویس تا بدانیم با چه کسی حرف می‌زنیم.';
    if (!EMAIL_PATTERN.test(data.email.trim())) errors.email = 'یک ایمیل درست بنویس، مثل name@example.com.';
  }
  if (!data.subject.trim()) errors.subject = 'موضوع را در یک خط بنویس.';
  if (data.message.trim().length < MIN_MESSAGE) errors.message = 'پیامت را کمی کامل‌تر بنویس (دست‌کم ۱۰ حرف).';
  return errors;
}

/**
 * تماس با ما. مهمان: پیام در پنل مدیریت خوانده می‌شود (ContactMessage).
 * کاربر واردشده: پیام تیکت پشتیبانی می‌شود و پاسخ در «پشتیبانی» می‌آید.
 * تلفن یا ایمیل عمومی نداریم و ساختگی هم نشان داده نمی‌شود (PRODUCT.md).
 */
function Contact() {
  const { isAuthenticated, loading } = useAuth();
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(null); // null | 'ticket' | 'message'
  // فرم جایش را به پیام «ثبت شد» می‌دهد؛ فوکوس به سرتیتر همان پیام می‌رود تا گم نشود
  const sentHeadingRef = useRef(null);
  useEffect(() => {
    if (sent) sentHeadingRef.current?.focus();
  }, [sent]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setFieldErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const isGuest = !isAuthenticated;
    const errors = validate(formData, isGuest);
    const firstError = FIELD_ORDER.find((name) => errors[name]);
    if (firstError) {
      setFieldErrors(errors);
      document.getElementById(`contact-${firstError}`)?.focus();
      return;
    }

    setSubmitting(true);
    setError('');
    const payload = { subject: formData.subject.trim(), message: formData.message.trim() };
    try {
      if (isGuest) {
        await notificationAPI.sendContactMessage({ ...payload, name: formData.name.trim(), email: formData.email.trim() });
        setSent('message');
      } else {
        await notificationAPI.createTicket(payload);
        setSent('ticket');
      }
      setFormData(EMPTY_FORM);
    } catch (err) {
      const data = err.response?.data;
      const serverErrors =
        data && typeof data === 'object'
          ? Object.fromEntries(FIELD_ORDER.filter((name) => data[name]).map((name) => [name, data[name][0]]))
          : {};
      if (Object.keys(serverErrors).length) {
        setFieldErrors(serverErrors);
      } else {
        setError(getErrorMessage(err));
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Loading fullPage />;

  const field = (name, label, props = {}) => (
    <Form.Group controlId={`contact-${name}`} className="mb-3">
      <Form.Label>{label}</Form.Label>
      <Form.Control
        name={name}
        value={formData[name]}
        onChange={handleChange}
        required
        aria-required="true"
        isInvalid={Boolean(fieldErrors[name])}
        disabled={submitting}
        {...props}
      />
      <Form.Control.Feedback type="invalid">{fieldErrors[name]}</Form.Control.Feedback>
    </Form.Group>
  );

  return (
    <div className="series-paper">
      <Container className="ledger-page">
        <title>تماس با ما | ری‌بوک</title>
        <header className="ledger-header">
          <div>
            <h1 className="ledger-title">تماس با ما</h1>
            <p className="sell-lead mt-2 mb-0">
              {isAuthenticated
                ? 'پیامت به‌صورت تیکت پشتیبانی ثبت می‌شود و پاسخ تیم ری‌بوک در صفحه‌ی «پشتیبانی» می‌آید.'
                : 'سؤال، پیشنهاد یا مشکلی داری؟ بنویس؛ تیم ری‌بوک پیام‌ها را می‌خواند.'}
            </p>
          </div>
        </header>

        <Row className="g-4 g-lg-5">
          <Col lg={7}>
            {sent ? (
              <div className="support-form" role="status">
                <h2 className="support-heading" tabIndex={-1} ref={sentHeadingRef}>
                  پیامت ثبت شد
                </h2>
                {sent === 'ticket' ? (
                  <p>
                    پاسخ تیم ری‌بوک در <Link to="/support">پشتیبانی</Link> می‌آید.
                  </p>
                ) : (
                  <p>تیم ری‌بوک آن را می‌خواند. اگر پاسخی لازم باشد، به همین ایمیل فرستاده می‌شود.</p>
                )}
                <Button variant="outline-secondary" onClick={() => setSent(null)}>
                  پیام دیگر
                </Button>
              </div>
            ) : (
              <Form onSubmit={handleSubmit} noValidate className="support-form" aria-labelledby="contact-form-title">
                <h2 id="contact-form-title" className="support-heading">
                  پیام تازه
                </h2>
                {!isAuthenticated && (
                  <>
                    {field('name', 'نام', { autoComplete: 'name', maxLength: 100 })}
                    {field('email', 'ایمیل', {
                      type: 'email',
                      dir: 'ltr',
                      className: 'latin-id',
                      autoComplete: 'email',
                      spellCheck: false,
                      maxLength: 254,
                    })}
                  </>
                )}
                {field('subject', 'موضوع', { autoComplete: 'off', maxLength: 200 })}
                {field('message', 'پیام', {
                  as: 'textarea',
                  rows: 6,
                  autoComplete: 'off',
                  maxLength: 5000,
                  placeholder: 'اگر درباره‌ی سفارش است، شماره‌ی سفارش یا نام کتاب را هم بنویس.',
                })}
                {error && (
                  <Alert variant="danger" role="alert">
                    {error}
                  </Alert>
                )}
                <Button type="submit" variant="primary" disabled={submitting}>
                  {submitting ? 'در حال ارسال…' : 'ارسال پیام'}
                </Button>
              </Form>
            )}
          </Col>
          <Col lg={5}>
            <aside className="contact-aside" aria-labelledby="contact-aside-title">
              <h2 id="contact-aside-title" className="support-heading">
                پیش از نوشتن
              </h2>
              <ul className="about-facts">
                <li>
                  برای مشکل سفارش یا پرداخت،{' '}
                  {isAuthenticated ? <Link to="/support">پشتیبانی</Link> : 'پس از ورود، صفحه‌ی پشتیبانی'} بهترین راه است:
                  پاسخ همان‌جا کنار تیکت‌هایت می‌آید.
                </li>
                <li>شماره‌ی سفارش یا نام کتاب را بنویس تا زودتر پیدایش کنیم.</li>
                <li>ری‌بوک فعلاً تلفن و ایمیل عمومی ندارد؛ همین فرم راه رسیدن به تیم است.</li>
              </ul>
            </aside>
          </Col>
        </Row>
      </Container>
    </div>
  );
}

export default Contact;
