import { useEffect, useState } from 'react';
import { Container, Row, Col, Form, Button, Card, Alert, InputGroup } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { bookAPI, getErrorMessage } from '../services/api';
import {
  FiBookOpen,
  FiUser,
  FiHash,
  FiDollarSign,
  FiTag,
  FiFileText,
  FiInfo,
  FiUpload,
} from 'react-icons/fi';

const INITIAL_FORM = {
  title: '',
  author: '',
  publisher: '',
  isbn: '',
  description: '',
  price: '',
  condition: 'good',
  category: '',
};

const MAX_IMAGE_SIZE_MB = 5;

function normalizeServerErrors(errorData) {
  const nextFieldErrors = {};
  let nextGeneralError = '';

  if (!errorData) {
    return {
      nextFieldErrors,
      nextGeneralError: 'خطایی رخ داد. لطفاً دوباره تلاش کنید.',
    };
  }

  if (typeof errorData === 'string') {
    return { nextFieldErrors, nextGeneralError: errorData };
  }

  if (Array.isArray(errorData)) {
    return {
      nextFieldErrors,
      nextGeneralError:
        errorData[0] || 'خطایی رخ داد. لطفاً دوباره تلاش کنید.',
    };
  }

  Object.entries(errorData).forEach(([key, value]) => {
    const message = Array.isArray(value) ? value[0] : String(value);

    if (key === 'detail' || key === 'non_field_errors') {
      if (!nextGeneralError) nextGeneralError = message;
    } else {
      nextFieldErrors[key] = Array.isArray(value) ? value : [message];
    }
  });

  if (!nextGeneralError && Object.keys(nextFieldErrors).length === 0) {
    nextGeneralError = 'خطایی رخ داد. لطفاً دوباره تلاش کنید.';
  }

  return { nextFieldErrors, nextGeneralError };
}

function CreateBook() {
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [coverImage, setCoverImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [categories, setCategories] = useState([]);
  const [fieldErrors, setFieldErrors] = useState({});
  const [generalError, setGeneralError] = useState('');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await bookAPI.getCategories();
        setCategories(response.data.results ?? response.data);
      } catch (error) {
        toast.error(getErrorMessage(error));
      }
    };

    fetchCategories();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    if (fieldErrors[name]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];

    if (!file) {
      setCoverImage(null);
      setImagePreview(null);
      return;
    }

    if (!file.type.startsWith('image/')) {
      toast.warning('لطفاً فقط فایل تصویری انتخاب کنید.');
      e.target.value = '';
      return;
    }

    if (file.size > MAX_IMAGE_SIZE_MB * 1024 * 1024) {
      toast.warning(`حجم تصویر نباید بیشتر از ${MAX_IMAGE_SIZE_MB} مگابایت باشد.`);
      e.target.value = '';
      return;
    }

    setCoverImage(file);

    // ساخت پیش‌نمایش تصویر برای بازخورد فوری به کاربر
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result);
    reader.readAsDataURL(file);

    if (fieldErrors.cover_image) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next.cover_image;
        return next;
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setGeneralError('');
    setFieldErrors({});
    setLoading(true);

    try {
      const data = new FormData();

      Object.entries(formData).forEach(([key, value]) => {
        if (value !== '') {
          data.append(key, value);
        }
      });

      if (coverImage) {
        data.append('cover_image', coverImage);
      }

      await bookAPI.createBook(data);

      toast.success('کتاب با موفقیت ثبت شد و پس از تأیید نمایش داده می‌شود.');
      navigate('/my-books', { replace: true });
    } catch (err) {
      const errorData = err.response?.data;

      if (errorData && typeof errorData === 'object' && !Array.isArray(errorData)) {
        const { nextFieldErrors, nextGeneralError } = normalizeServerErrors(errorData);
        setFieldErrors(nextFieldErrors);

        if (nextGeneralError) {
          setGeneralError(nextGeneralError);
        } else if (Object.keys(nextFieldErrors).length === 0) {
          setGeneralError(getErrorMessage(err));
        }
      } else {
        setGeneralError(getErrorMessage(err));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container className="py-5">
      <Row className="justify-content-center">
        <Col lg={8} xl={7}>
          <Card className="shadow-sm border-0">
            <Card.Body className="p-4 p-md-5">
              <div className="d-flex align-items-center gap-2 mb-4">
                <FiBookOpen size={28} className="text-primary" aria-hidden="true" />
                <h1 className="h3 mb-0">ثبت کتاب جدید</h1>
              </div>

              <p className="text-muted mb-4">
                اطلاعات کتاب را وارد کنید. پس از ثبت، آگهی برای بررسی ارسال می‌شود.
              </p>

              {generalError && (
                <Alert variant="danger" role="alert" className="mb-4">
                  {generalError}
                </Alert>
              )}

              <Alert variant="info" role="status" className="d-flex align-items-start gap-2 mb-4">
                <FiInfo className="mt-1 flex-shrink-0" aria-hidden="true" />
                <div>
                  کتاب شما پس از ثبت توسط مدیر سایت بررسی و تأیید خواهد شد.
                </div>
              </Alert>

              <Form onSubmit={handleSubmit} noValidate>
                {/* تصویر جلد کتاب — اولین فیلد، به‌صورت Dropzone قابل‌کلیک */}
                <Form.Group className="mb-4">
                  <Form.Label
                    htmlFor="cover_image"
                    className="w-100 d-block text-center image-upload-dropzone mb-0"
                  >
                    {imagePreview ? (
                      <img
                        src={imagePreview}
                        alt="پیش‌نمایش جلد کتاب"
                        className="img-fluid rounded"
                        style={{ maxHeight: 220 }}
                      />
                    ) : (
                      <>
                        <FiUpload size={36} className="text-muted mb-2" aria-hidden="true" />
                        <p className="text-muted small mb-0">
                          تصویر جلد کتاب را بکشید یا برای انتخاب کلیک کنید
                        </p>
                        <p className="text-muted small mb-0">
                          حداکثر حجم: {MAX_IMAGE_SIZE_MB} مگابایت
                        </p>
                      </>
                    )}
                    <Form.Control
                      id="cover_image"
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="d-none"
                      isInvalid={!!fieldErrors.cover_image}
                    />
                  </Form.Label>

                  {fieldErrors.cover_image ? (
                    <div className="text-danger small mt-2">
                      {fieldErrors.cover_image[0]}
                    </div>
                  ) : (
                    <Form.Text className="text-muted">
                      این فیلد اختیاری است. فرمت‌های تصویری رایج پشتیبانی می‌شوند.
                    </Form.Text>
                  )}
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label htmlFor="title">عنوان کتاب *</Form.Label>
                  <InputGroup className="has-validation">
                    <span className="input-group-text bg-white">
                      <FiBookOpen className="text-muted" />
                    </span>
                    <Form.Control
                      id="title"
                      type="text"
                      name="title"
                      value={formData.title}
                      onChange={handleChange}
                      placeholder="عنوان کتاب"
                      autoFocus
                      required
                      isInvalid={!!fieldErrors.title}
                    />
                    <Form.Control.Feedback type="invalid">
                      {fieldErrors.title?.[0]}
                    </Form.Control.Feedback>
                  </InputGroup>
                </Form.Group>

                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label htmlFor="author">نویسنده *</Form.Label>
                      <InputGroup className="has-validation">
                        <span className="input-group-text bg-white">
                          <FiUser className="text-muted" />
                        </span>
                        <Form.Control
                          id="author"
                          type="text"
                          name="author"
                          value={formData.author}
                          onChange={handleChange}
                          placeholder="نام نویسنده"
                          required
                          isInvalid={!!fieldErrors.author}
                        />
                        <Form.Control.Feedback type="invalid">
                          {fieldErrors.author?.[0]}
                        </Form.Control.Feedback>
                      </InputGroup>
                    </Form.Group>
                  </Col>

                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label htmlFor="publisher">انتشارات</Form.Label>
                      <Form.Control
                        id="publisher"
                        type="text"
                        name="publisher"
                        value={formData.publisher}
                        onChange={handleChange}
                        placeholder="نام انتشارات"
                        isInvalid={!!fieldErrors.publisher}
                      />
                      <Form.Control.Feedback type="invalid">
                        {fieldErrors.publisher?.[0]}
                      </Form.Control.Feedback>
                    </Form.Group>
                  </Col>
                </Row>

                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label htmlFor="isbn">شابک (ISBN)</Form.Label>
                      <InputGroup className="has-validation">
                        <span className="input-group-text bg-white">
                          <FiHash className="text-muted" />
                        </span>
                        <Form.Control
                          id="isbn"
                          type="text"
                          name="isbn"
                          value={formData.isbn}
                          onChange={handleChange}
                          placeholder="شابک کتاب"
                          isInvalid={!!fieldErrors.isbn}
                        />
                        <Form.Control.Feedback type="invalid">
                          {fieldErrors.isbn?.[0]}
                        </Form.Control.Feedback>
                      </InputGroup>
                    </Form.Group>
                  </Col>

                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label htmlFor="category">دسته‌بندی</Form.Label>
                      <InputGroup className="has-validation">
                        <span className="input-group-text bg-white">
                          <FiTag className="text-muted" />
                        </span>
                        <Form.Select
                          id="category"
                          name="category"
                          value={formData.category}
                          onChange={handleChange}
                          isInvalid={!!fieldErrors.category}
                        >
                          <option value="">انتخاب کنید</option>
                          {categories.map((cat) => (
                            <option key={cat.id} value={cat.id}>
                              {cat.name}
                            </option>
                          ))}
                        </Form.Select>
                        <Form.Control.Feedback type="invalid">
                          {fieldErrors.category?.[0]}
                        </Form.Control.Feedback>
                      </InputGroup>
                    </Form.Group>
                  </Col>
                </Row>

                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label htmlFor="price">قیمت (تومان) *</Form.Label>
                      <InputGroup className="has-validation">
                        <span className="input-group-text bg-white">
                          <FiDollarSign className="text-muted" />
                        </span>
                        <Form.Control
                          id="price"
                          type="number"
                          name="price"
                          value={formData.price}
                          onChange={handleChange}
                          placeholder="مثلاً 150000"
                          min="0"
                          step="1000"
                          inputMode="numeric"
                          required
                          isInvalid={!!fieldErrors.price}
                        />
                        <Form.Control.Feedback type="invalid">
                          {fieldErrors.price?.[0]}
                        </Form.Control.Feedback>
                      </InputGroup>
                    </Form.Group>
                  </Col>

                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label htmlFor="condition">وضعیت ظاهری *</Form.Label>
                      <Form.Select
                        id="condition"
                        name="condition"
                        value={formData.condition}
                        onChange={handleChange}
                        isInvalid={!!fieldErrors.condition}
                      >
                        <option value="new">نو</option>
                        <option value="like_new">در حد نو</option>
                        <option value="good">خوب</option>
                        <option value="fair">قابل قبول</option>
                        <option value="poor">فرسوده</option>
                      </Form.Select>
                      <Form.Control.Feedback type="invalid">
                        {fieldErrors.condition?.[0]}
                      </Form.Control.Feedback>
                    </Form.Group>
                  </Col>
                </Row>

                <Form.Group className="mb-4">
                  <Form.Label htmlFor="description" className="d-flex align-items-center gap-2">
                    <FiFileText className="text-muted" />
                    توضیحات
                  </Form.Label>
                  <Form.Control
                    id="description"
                    as="textarea"
                    rows={5}
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    placeholder="توضیحات، وضعیت فیزیکی، نکات مهم و..."
                    isInvalid={!!fieldErrors.description}
                  />
                  <Form.Control.Feedback type="invalid">
                    {fieldErrors.description?.[0]}
                  </Form.Control.Feedback>
                </Form.Group>

                <Button type="submit" variant="primary" className="w-100" disabled={loading}>
                  {loading ? 'در حال ثبت...' : 'ثبت کتاب'}
                </Button>
              </Form>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}

export default CreateBook;