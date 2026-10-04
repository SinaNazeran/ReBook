import { useState } from 'react';
import { Container, Row, Col, Form, Button, Card, Alert } from 'react-bootstrap';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../context/useAuth.js';
import { getErrorMessage } from '../services/api';
import { FiUser, FiLock } from 'react-icons/fi';

function Login() {
  const [formData, setFormData] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { loginUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await loginUser(formData);
      toast.success('خوش آمدید!');

      // اگر کاربر از صفحه‌ی دیگری (ProtectedRoute، صفحه‌ی کتاب، دکمه‌ی ورود نوار بالا) به اینجا آمده،
      // او را به همان صفحه (همراه با پارامترهای آدرس) برمی‌گردانیم؛ در غیر این صورت به صفحه‌ی اصلی.
      const from = location.state?.from;
      const redirectTo = from ? `${from.pathname}${from.search ?? ''}` : '/';
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container className="py-5">
      <Row className="justify-content-center">
        <Col md={6} lg={5}>
          <Card className="shadow-sm border-0">
            <Card.Body className="p-4 p-md-5">
              <h1 className="h3 text-center mb-4">ورود به حساب</h1>

              {error && (
                <Alert variant="danger" role="alert">
                  {error}
                </Alert>
              )}

              <Form onSubmit={handleSubmit} noValidate>
                <Form.Group className="mb-3">
                  <Form.Label htmlFor="username">نام کاربری</Form.Label>
                  <div className="input-group">
                    <span className="input-group-text bg-white">
                      <FiUser className="text-muted" />
                    </span>
                    <Form.Control
                      id="username"
                      type="text"
                      name="username"
                      value={formData.username}
                      onChange={handleChange}
                      placeholder="نام کاربری خود را وارد کنید"
                      autoComplete="username"
                      autoFocus
                      required
                    />
                  </div>
                </Form.Group>

                <Form.Group className="mb-4">
                  <Form.Label htmlFor="password">رمز عبور</Form.Label>
                  <div className="input-group">
                    <span className="input-group-text bg-white">
                      <FiLock className="text-muted" />
                    </span>
                    <Form.Control
                      id="password"
                      type="password"
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      placeholder="رمز عبور خود را وارد کنید"
                      autoComplete="current-password"
                      required
                    />
                  </div>
                </Form.Group>

                <Button type="submit" className="btn-primary w-100" disabled={loading}>
                  {loading ? 'در حال ورود...' : 'ورود'}
                </Button>
              </Form>

              <p className="text-center mt-4 mb-0">
                حساب ندارید؟ <Link to="/register">ثبت‌نام کنید</Link>
              </p>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}

export default Login;