import { useState } from 'react';
import { Container, Button, Alert } from 'react-bootstrap';
import Form from '../components/Form';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { toast } from '../utils/toast';
import { useAuth } from '../context/useAuth.js';
import { getErrorMessage } from '../services/api';
import PasswordField from '../components/PasswordField';
import { returnPath, returnReason } from '../utils/authReturn';

function Login() {
  const [formData, setFormData] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { loginUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const reason = returnReason(location);

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.username.trim() || !formData.password) {
      setError('نام کاربری و رمز را بنویس.');
      return;
    }

    setLoading(true);
    try {
      await loginUser({ ...formData, username: formData.username.trim() });
      toast.success('خوش آمدی!');
      // به همان صفحه‌ای برمی‌گردد که کاربر را به ورود فرستاد (با پارامترهای آدرس)
      navigate(returnPath(location), { replace: true });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="series-paper" style={{ '--series': 'var(--rb-accent)' }}>
      <Container className="auth-page">
        <title>ورود | ری‌بوک</title>
        <div className="auth-panel">
          <h1 className="auth-title">ورود</h1>
          {reason && <p className="auth-reason">{reason}</p>}

          {error && (
            <Alert variant="danger" role="alert">
              {error}
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
                required
              />
            </Form.Group>

            <PasswordField
              id="password"
              label="رمز"
              name="password"
              value={formData.password}
              onChange={handleChange}
              autoComplete="current-password"
              required
            />

            <Button type="submit" variant="primary" className="w-100 mt-2" disabled={loading}>
              {loading ? 'در حال ورود…' : 'ورود'}
            </Button>
          </Form>

          {/* state هم منتقل می‌شود تا ثبت‌نام هم کاربر را به همان صفحه برگرداند */}
          <p className="auth-switch">
            حساب نداری؟{' '}
            <Link to="/register" state={location.state}>
              ثبت‌نام کن
            </Link>
          </p>
        </div>
      </Container>
    </div>
  );
}

export default Login;
