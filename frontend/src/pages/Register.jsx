import { useState } from 'react';
import { Container, Row, Col, Button, Alert } from 'react-bootstrap';
import Form from '../components/Form';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { toast } from '../utils/toast';
import { useAuth } from '../context/useAuth.js';
import { getErrorMessage } from '../services/api';
import PasswordField from '../components/PasswordField';
import { onlyDigits } from '../utils/digits';
import { returnPath, returnReason } from '../utils/authReturn';

const PHONE_PATTERN = /^09\d{9}$/;
const FIELD_ORDER = ['username', 'email', 'password', 'password_confirm', 'first_name', 'last_name', 'phone'];

const INITIAL_FORM = {
  username: '',
  email: '',
  phone: '',
  password: '',
  password_confirm: '',
  first_name: '',
  last_name: '',
};

function validate(form) {
  const errors = {};
  if (!form.username.trim()) errors.username = ['یک نام کاربری انتخاب کن.'];
  if (!form.email.trim()) errors.email = ['ایمیلت را بنویس.'];
  if (form.password.length < 8) errors.password = ['رمز دست‌کم ۸ نویسه است.'];
  if (form.password !== form.password_confirm) errors.password_confirm = ['دو رمز با هم یکی نیستند.'];
  if (form.phone && !PHONE_PATTERN.test(form.phone)) {
    errors.phone = ['شماره‌ی موبایل ۱۱ رقم است و با ۰۹ شروع می‌شود.'];
  }
  return errors;
}

function Register() {
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [fieldErrors, setFieldErrors] = useState({});
  const [generalError, setGeneralError] = useState('');
  const [loading, setLoading] = useState(false);

  const { registerUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const reason = returnReason(location);

  const handleChange = (e) => {
    const { name } = e.target;
    // ستون phone یازده رقم لاتین است؛ رقم فارسی، فاصله و خط تیره همین‌جا یکدست می‌شوند
    const value = name === 'phone' ? onlyDigits(e.target.value).slice(0, 11) : e.target.value;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) setFieldErrors((prev) => ({ ...prev, [name]: null }));
  };

  const showErrors = (errors) => {
    setFieldErrors(errors);
    const first = FIELD_ORDER.find((name) => errors[name]);
    if (first) document.getElementById(first)?.focus();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setGeneralError('');

    const errors = validate(formData);
    if (Object.keys(errors).length > 0) {
      showErrors(errors);
      return;
    }

    setLoading(true);
    try {
      await registerUser({ ...formData, username: formData.username.trim(), email: formData.email.trim() });
      toast.success('حسابت ساخته شد. خوش آمدی!');
      navigate(returnPath(location), { replace: true });
    } catch (err) {
      const errorData = err.response?.data;
      // خطای فیلدها کنار همان فیلد؛ detail یا non_field_errors (مثلاً محدودیت تعداد تلاش) بالای فرم
      const fieldOnly = errorData && typeof errorData === 'object' && !errorData.detail && !errorData.non_field_errors;
      if (fieldOnly) {
        showErrors(errorData);
      } else {
        setGeneralError(getErrorMessage(err));
      }
    } finally {
      setLoading(false);
    }
  };

  const error = (name) => fieldErrors[name]?.[0];

  return (
    <div className="series-paper" style={{ '--series': 'var(--rb-accent)' }}>
      <Container className="auth-page">
        <title>ساخت حساب | ری‌بوک</title>
        <div className="auth-panel is-wide">
          <h1 className="auth-title">ساخت حساب</h1>
          <p className="auth-reason">
            {reason ?? 'با یک حساب هم کتاب می‌خری و هم کتاب‌هایی را که خوانده‌ای می‌فروشی.'}
          </p>

          {generalError && (
            <Alert variant="danger" role="alert">
              {generalError}
            </Alert>
          )}

          <Form onSubmit={handleSubmit} noValidate>
            <Form.Group controlId="username" className="mb-3">
              <Form.Label>نام کاربری</Form.Label>
              <Form.Control
                name="username"
                value={formData.username}
                onChange={handleChange}
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                dir="ltr"
                aria-describedby="username-help"
                isInvalid={!!error('username')}
                required
              />
              <Form.Text id="username-help">به خریداران و فروشنده‌ها نشان داده می‌شود.</Form.Text>
              <Form.Control.Feedback type="invalid">{error('username')}</Form.Control.Feedback>
            </Form.Group>

            <Form.Group controlId="email" className="mb-3">
              <Form.Label>ایمیل</Form.Label>
              <Form.Control
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                autoComplete="email"
                spellCheck={false}
                dir="ltr"
                isInvalid={!!error('email')}
                required
              />
              <Form.Control.Feedback type="invalid">{error('email')}</Form.Control.Feedback>
            </Form.Group>

            <Row className="g-3">
              <Col md={6}>
                <PasswordField
                  id="password"
                  label="رمز"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  autoComplete="new-password"
                  error={error('password')}
                  help="دست‌کم ۸ نویسه، نه فقط عدد و نه شبیه نام کاربری."
                  required
                />
              </Col>
              <Col md={6}>
                <PasswordField
                  id="password_confirm"
                  label="تکرار رمز"
                  name="password_confirm"
                  value={formData.password_confirm}
                  onChange={handleChange}
                  autoComplete="new-password"
                  error={error('password_confirm')}
                  required
                />
              </Col>
            </Row>

            <fieldset className="auth-optional">
              <legend>
                اختیاری <span className="sell-optional">(بعداً هم از «پروفایل» می‌شود کامل کرد)</span>
              </legend>
              <Row className="g-3">
                <Col md={6}>
                  <Form.Group controlId="first_name">
                    <Form.Label>نام</Form.Label>
                    <Form.Control
                      name="first_name"
                      value={formData.first_name}
                      onChange={handleChange}
                      autoComplete="given-name"
                      dir="auto"
                      isInvalid={!!error('first_name')}
                    />
                    <Form.Control.Feedback type="invalid">{error('first_name')}</Form.Control.Feedback>
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group controlId="last_name">
                    <Form.Label>نام خانوادگی</Form.Label>
                    <Form.Control
                      name="last_name"
                      value={formData.last_name}
                      onChange={handleChange}
                      autoComplete="family-name"
                      dir="auto"
                      isInvalid={!!error('last_name')}
                    />
                    <Form.Control.Feedback type="invalid">{error('last_name')}</Form.Control.Feedback>
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group controlId="phone">
                    <Form.Label>موبایل</Form.Label>
                    <Form.Control
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      autoComplete="tel"
                      inputMode="numeric"
                      dir="ltr"
                      placeholder="09123456789"
                      isInvalid={!!error('phone')}
                    />
                    <Form.Control.Feedback type="invalid">{error('phone')}</Form.Control.Feedback>
                  </Form.Group>
                </Col>
              </Row>
            </fieldset>

            <Button type="submit" variant="primary" className="w-100 mt-4" disabled={loading}>
              {loading ? 'در حال ساخت حساب…' : 'ساخت حساب'}
            </Button>
          </Form>

          <p className="auth-switch">
            حساب داری؟{' '}
            <Link to="/login" state={location.state}>
              وارد شو
            </Link>
          </p>
        </div>
      </Container>
    </div>
  );
}

export default Register;
