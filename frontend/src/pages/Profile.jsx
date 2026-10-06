import { useState } from 'react';
import { Container, Row, Col, Button, Alert } from 'react-bootstrap';
import Form from '../components/Form';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FiUser, FiCamera } from 'react-icons/fi';
import { useAuth } from '../context/useAuth.js';
import { getErrorMessage } from '../services/api';
import { onlyDigits } from '../utils/digits';

// باید با سقف سرور (UserProfileSerializer.validate_avatar) یکی باشد
const MAX_AVATAR_MB = 3;
const ACCEPTED_IMAGES = 'image/jpeg,image/png,image/webp';

function Profile() {
  const { user, updateUser } = useAuth();

  const [formData, setFormData] = useState({
    first_name: user?.first_name || '',
    last_name: user?.last_name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    address: user?.address || '',
  });
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(user?.avatar || null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [generalError, setGeneralError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name } = e.target;
    // ستون phone یازده رقم لاتین است؛ رقم فارسی، فاصله و خط تیره همین‌جا یکدست می‌شوند
    const value = name === 'phone' ? onlyDigits(e.target.value).slice(0, 11) : e.target.value;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) setFieldErrors((prev) => ({ ...prev, [name]: null }));
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!ACCEPTED_IMAGES.split(',').includes(file.type)) {
      setFieldErrors((prev) => ({ ...prev, avatar: ['فقط تصویر JPG، PNG یا WebP.'] }));
      return;
    }
    if (file.size > MAX_AVATAR_MB * 1024 * 1024) {
      setFieldErrors((prev) => ({
        ...prev,
        avatar: [`حجم تصویر بیشتر از ${MAX_AVATAR_MB.toLocaleString('fa-IR')} مگابایت است.`],
      }));
      return;
    }

    setFieldErrors((prev) => ({ ...prev, avatar: null }));
    setAvatarFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setAvatarPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setGeneralError('');

    if (formData.phone && !/^09\d{9}$/.test(formData.phone)) {
      setFieldErrors({ phone: ['شماره‌ی موبایل ۱۱ رقم است و با ۰۹ شروع می‌شود.'] });
      document.getElementById('phone')?.focus();
      return;
    }

    setFieldErrors({});
    setLoading(true);
    try {
      const data = new FormData();
      Object.entries(formData).forEach(([key, value]) => data.append(key, value.trim()));
      if (avatarFile) data.append('avatar', avatarFile);

      await updateUser(data);
      setAvatarFile(null);
      toast.success('تغییرات ذخیره شد.');
    } catch (error) {
      const errorData = error.response?.data;
      if (errorData && typeof errorData === 'object' && !errorData.detail) {
        setFieldErrors(errorData);
        const first = ['first_name', 'last_name', 'email', 'phone', 'address'].find((key) => errorData[key]);
        if (first) document.getElementById(first)?.focus();
      } else {
        setGeneralError(getErrorMessage(error));
      }
    } finally {
      setLoading(false);
    }
  };

  const joinDate = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('fa-IR', { year: 'numeric', month: 'long' })
    : null;

  const error = (name) => fieldErrors[name]?.[0];

  return (
    <div className="series-paper">
      <Container className="ledger-page">
        <title>پروفایل | ری‌بوک</title>
        <header className="ledger-header">
          <h1 className="ledger-title">پروفایل</h1>
        </header>

        <Row className="g-4 g-lg-5">
          <Col lg={4}>
            <aside className="profile-card" aria-label="حساب کاربری">
              <div className="profile-avatar-field">
                <label htmlFor="avatar-input" className="profile-avatar" title="تغییر تصویر">
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="" />
                  ) : (
                    <FiUser size={40} aria-hidden="true" />
                  )}
                  <span className="profile-avatar-badge" aria-hidden="true">
                    <FiCamera />
                  </span>
                  <span className="visually-hidden">تغییر تصویر پروفایل</span>
                </label>
                <input
                  id="avatar-input"
                  type="file"
                  accept={ACCEPTED_IMAGES}
                  onChange={handleAvatarChange}
                  className="visually-hidden"
                />
              </div>
              {error('avatar') && (
                <p className="sell-error text-center" role="alert">
                  {error('avatar')}
                </p>
              )}
              {avatarFile && <p className="ledger-note text-center mb-0">تصویر تازه با «ذخیره» ثبت می‌شود.</p>}

              <p className="profile-username">
                <bdi translate="no" className="latin-id">{user?.username}</bdi>
              </p>
              {joinDate && <p className="ledger-note text-center mb-3">عضو از {joinDate}</p>}

              <nav className="profile-links" aria-label="بخش‌های حساب">
                <Link to="/my-books">کتاب‌های من</Link>
                <Link to="/my-orders">معاملات من</Link>
                <Link to="/wishlist">علاقه‌مندی‌ها</Link>
                <Link to="/support">پشتیبانی</Link>
              </nav>
            </aside>
          </Col>

          <Col lg={8}>
            {generalError && (
              <Alert variant="danger" role="alert">
                {generalError}
              </Alert>
            )}

            <Form onSubmit={handleSubmit} noValidate>
              <fieldset className="sell-section">
                <legend>نام و راه تماس</legend>
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
                    <Form.Group controlId="email">
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
                      />
                      <Form.Control.Feedback type="invalid">{error('email')}</Form.Control.Feedback>
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

              <fieldset className="sell-section">
                <legend>آدرس ارسال</legend>
                <Form.Group controlId="address">
                  <Form.Label className="visually-hidden">آدرس ارسال</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={3}
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    autoComplete="street-address"
                    placeholder="استان، شهر، خیابان، پلاک، کد پستی"
                    aria-describedby="address-help"
                    isInvalid={!!error('address')}
                  />
                  <Form.Text id="address-help">هنگام خرید، این آدرس از پیش در فرم ارسال نوشته می‌شود.</Form.Text>
                  <Form.Control.Feedback type="invalid">{error('address')}</Form.Control.Feedback>
                </Form.Group>
              </fieldset>

              <div className="sell-submit">
                <Button type="submit" variant="primary" disabled={loading}>
                  {loading ? 'در حال ذخیره…' : 'ذخیره'}
                </Button>
              </div>
            </Form>
          </Col>
        </Row>
      </Container>
    </div>
  );
}

export default Profile;
