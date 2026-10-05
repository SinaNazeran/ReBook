import { useState } from 'react';
import { Container, Row, Col, Form, Button, Card } from 'react-bootstrap';
import { toast } from 'react-toastify';
import { useAuth } from '../context/useAuth.js';
import { getErrorMessage } from '../services/api';
import { FiUser, FiCamera } from 'react-icons/fi';

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
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) {
      setFieldErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.warning('لطفاً فقط فایل تصویری انتخاب کنید.');
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      toast.warning('اندازه تصویر نباید بیشتر از ۳ مگابایت باشد.');
      return;
    }

    setAvatarFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setAvatarPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFieldErrors({});
    setLoading(true);

    try {
      const data = new FormData();
      Object.entries(formData).forEach(([key, value]) => {
        data.append(key, value ?? '');
      });
      if (avatarFile) {
        data.append('avatar', avatarFile);
      }

      await updateUser(data);
      toast.success('پروفایل با موفقیت بروزرسانی شد.');
    } catch (error) {
      const errorData = error.response?.data;
      if (errorData && typeof errorData === 'object') {
        setFieldErrors(errorData);
      } else {
        toast.error(getErrorMessage(error));
      }
    } finally {
      setLoading(false);
    }
  };

  const joinDate = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('fa-IR')
    : 'نامشخص';

  return (
    <Container className="py-5">
      <Row className="justify-content-center">
        <Col md={8} lg={7}>
          <Card className="shadow-sm border-0">
            <Card.Body className="p-4 p-md-5">
              <h1 className="h3 text-center mb-4">پروفایل من</h1>

              {/* آواتار */}
              <Form.Label htmlFor="avatar-input" className="avatar-upload-wrapper mb-3">
                {avatarPreview ? (
                  <img src={avatarPreview} alt="تصویر پروفایل" />
                ) : (
                  <FiUser size={48} className="text-muted" />
                )}
                <div className="avatar-upload-overlay">
                  <FiCamera size={22} />
                </div>
              </Form.Label>
              <Form.Control
                id="avatar-input"
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="d-none"
              />

              {/* اطلاعات ثابت */}
              <div className="profile-meta-box mb-4 text-center">
                <div className="mb-1">
                  <strong>نام کاربری:</strong> <bdi className="latin-id">{user?.username}</bdi>
                </div>
                <div>
                  <strong>تاریخ عضویت:</strong> {joinDate}
                </div>
              </div>

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
                        isInvalid={!!fieldErrors.last_name}
                      />
                      <Form.Control.Feedback type="invalid">
                        {fieldErrors.last_name?.[0]}
                      </Form.Control.Feedback>
                    </Form.Group>
                  </Col>
                </Row>

                <Form.Group className="mb-3">
                  <Form.Label htmlFor="email">ایمیل</Form.Label>
                  <Form.Control
                    id="email"
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    isInvalid={!!fieldErrors.email}
                  />
                  <Form.Control.Feedback type="invalid">
                    {fieldErrors.email?.[0]}
                  </Form.Control.Feedback>
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label htmlFor="phone">شماره موبایل</Form.Label>
                  <Form.Control
                    id="phone"
                    type="text"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="۰۹۱۲۳۴۵۶۷۸۹"
                    isInvalid={!!fieldErrors.phone}
                  />
                  <Form.Control.Feedback type="invalid">
                    {fieldErrors.phone?.[0]}
                  </Form.Control.Feedback>
                </Form.Group>

                <Form.Group className="mb-4">
                  <Form.Label htmlFor="address">آدرس</Form.Label>
                  <Form.Control
                    id="address"
                    as="textarea"
                    rows={3}
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    isInvalid={!!fieldErrors.address}
                  />
                  <Form.Control.Feedback type="invalid">
                    {fieldErrors.address?.[0]}
                  </Form.Control.Feedback>
                </Form.Group>

                <Button type="submit" className="btn-primary w-100" disabled={loading}>
                  {loading ? 'در حال بروزرسانی...' : 'ذخیره تغییرات'}
                </Button>
              </Form>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}

export default Profile;