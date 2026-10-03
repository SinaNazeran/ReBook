import { useState } from 'react';
import { Container, Row, Col, Form, Button, Card, Alert } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../context/useAuth.js';
import { FiUser, FiMail, FiPhone, FiLock } from 'react-icons/fi';

const PHONE_PATTERN = /^09\d{9}$/;

const INITIAL_FORM = {
  username: '',
  email: '',
  phone: '',
  password: '',
  password_confirm: '',
  first_name: '',
  last_name: '',
};

function Register() {
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [fieldErrors, setFieldErrors] = useState({});
  const [generalError, setGeneralError] = useState('');
  const [loading, setLoading] = useState(false);

  const { registerUser } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // با شروع تایپ مجدد در یک فیلد، خطای قبلی همان فیلد پاک می‌شود
    if (fieldErrors[name]) {
      setFieldErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  const validateClientSide = () => {
    const errors = {};

    if (formData.password.length < 8) {
      errors.password = ['رمز عبور باید حداقل ۸ کاراکتر باشد.'];
    }

    if (formData.password !== formData.password_confirm) {
      errors.password_confirm = ['رمز عبور و تکرار آن یکسان نیستند.'];
    }

    if (formData.phone && !PHONE_PATTERN.test(formData.phone)) {
      errors.phone = ['شماره موبایل باید به‌صورت ۰۹xxxxxxxxx باشد.'];
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setGeneralError('');

    if (!validateClientSide()) return;

    setLoading(true);
    try {
      await registerUser(formData);
      toast.success('ثبت‌نام با موفقیت انجام شد! خوش آمدید.');
      navigate('/');
    } catch (err) {
      const errorData = err.response?.data;
      if (errorData && typeof errorData === 'object') {
        setFieldErrors(errorData);
      } else {
        setGeneralError('خطایی رخ داد. لطفاً دوباره تلاش کنید.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container className="py-5">
      <Row className="justify-content-center">
        <Col md={8} lg={6}>
          <Card className="shadow-sm border-0">
            <Card.Body className="p-4 p-md-5">
              <h1 className="h3 text-center mb-4">ثبت‌نام در ری‌بوک</h1>

              {generalError && (
                <Alert variant="danger" role="alert">
                  {generalError}
                </Alert>
              )}

              <Form onSubmit={handleSubmit} noValidate>
                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label htmlFor="first_name">نام</Form.Label>
                      <Form.Control
                        id="first_name"
                        type="text"
                        name="first_name"
                        value={formData.first_name}
                        onChange={handleChange}
                        placeholder="نام"
                        isInvalid={!!fieldErrors.first_name}
                      />
                      <Form.Control.Feedback type="invalid">
                        {fieldErrors.first_name?.[0]}
                      </Form.Control.Feedback>
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label htmlFor="last_name">نام خانوادگی</Form.Label>
                      <Form.Control
                        id="last_name"
                        type="text"
                        name="last_name"
                        value={formData.last_name}
                        onChange={handleChange}
                        placeholder="نام خانوادگی"
                        isInvalid={!!fieldErrors.last_name}
                      />
                      <Form.Control.Feedback type="invalid">
                        {fieldErrors.last_name?.[0]}
                      </Form.Control.Feedback>
                    </Form.Group>
                  </Col>
                </Row>

                <Form.Group className="mb-3">
                  <Form.Label htmlFor="username">نام کاربری *</Form.Label>
                  <div className="input-group has-validation">
                    <span className="input-group-text bg-white">
                      <FiUser className="text-muted" />
                    </span>
                    <Form.Control
                      id="username"
                      type="text"
                      name="username"
                      value={formData.username}
                      onChange={handleChange}
                      placeholder="نام کاربری"
                      autoComplete="username"
                      isInvalid={!!fieldErrors.username}
                      required
                    />
                    <Form.Control.Feedback type="invalid">
                      {fieldErrors.username?.[0]}
                    </Form.Control.Feedback>
                  </div>
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label htmlFor="email">ایمیل *</Form.Label>
                  <div className="input-group has-validation">
                    <span className="input-group-text bg-white">
                      <FiMail className="text-muted" />
                    </span>
                    <Form.Control
                      id="email"
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="example@email.com"
                      autoComplete="email"
                      isInvalid={!!fieldErrors.email}
                      required
                    />
                    <Form.Control.Feedback type="invalid">
                      {fieldErrors.email?.[0]}
                    </Form.Control.Feedback>
                  </div>
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label htmlFor="phone">شماره موبایل</Form.Label>
                  <div className="input-group has-validation">
                    <span className="input-group-text bg-white">
                      <FiPhone className="text-muted" />
                    </span>
                    <Form.Control
                      id="phone"
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      placeholder="۰۹۱۲۳۴۵۶۷۸۹"
                      isInvalid={!!fieldErrors.phone}
                    />
                    <Form.Control.Feedback type="invalid">
                      {fieldErrors.phone?.[0]}
                    </Form.Control.Feedback>
                  </div>
                </Form.Group>

                {/* 
                  توجه: فیلد انتخاب نقش (خریدار/فروشنده) عمداً حذف شد.
                  طبق مدل تأییدشده‌ی این پلتفرم (مشابه دیوار)، هر کاربر ثبت‌نام‌شده
                  به‌صورت پیش‌فرض هم می‌تواند بخرد هم بفروشد. بک‌اند اصلاً
                  فیلد role را در UserRegistrationSerializer نمی‌پذیرد.
                */}

                <Form.Group className="mb-3">
                  <Form.Label htmlFor="password">رمز عبور *</Form.Label>
                  <div className="input-group has-validation">
                    <span className="input-group-text bg-white">
                      <FiLock className="text-muted" />
                    </span>
                    <Form.Control
                      id="password"
                      type="password"
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      placeholder="حداقل ۸ کاراکتر"
                      autoComplete="new-password"
                      isInvalid={!!fieldErrors.password}
                      required
                    />
                    <Form.Control.Feedback type="invalid">
                      {fieldErrors.password?.[0]}
                    </Form.Control.Feedback>
                  </div>
                </Form.Group>

                <Form.Group className="mb-4">
                  <Form.Label htmlFor="password_confirm">تکرار رمز عبور *</Form.Label>
                  <div className="input-group has-validation">
                    <span className="input-group-text bg-white">
                      <FiLock className="text-muted" />
                    </span>
                    <Form.Control
                      id="password_confirm"
                      type="password"
                      name="password_confirm"
                      value={formData.password_confirm}
                      onChange={handleChange}
                      placeholder="تکرار رمز عبور"
                      autoComplete="new-password"
                      isInvalid={!!fieldErrors.password_confirm}
                      required
                    />
                    <Form.Control.Feedback type="invalid">
                      {fieldErrors.password_confirm?.[0]}
                    </Form.Control.Feedback>
                  </div>
                </Form.Group>

                <Button type="submit" className="btn-primary w-100" disabled={loading}>
                  {loading ? 'در حال ثبت‌نام...' : 'ثبت‌نام'}
                </Button>
              </Form>

              <p className="text-center mt-4 mb-0">
                قبلاً ثبت‌نام کرده‌اید؟ <Link to="/login">وارد شوید</Link>
              </p>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}

export default Register;