import { useEffect, useState } from 'react';
import { Container, Row, Col, Button, Alert, InputGroup } from 'react-bootstrap';
import Form from '../components/Form';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { toast } from '../utils/toast';
import { FiUpload, FiTrash2 } from 'react-icons/fi';
import { bookAPI, getErrorMessage } from '../services/api';
import BookCard from '../components/BookCard';
import ConditionMeasure from '../components/ConditionMeasure';
import { CONDITION_LABELS, CONDITION_NOTES } from '../utils/condition';
import { onlyDigits, toLatinDigits } from '../utils/digits';
import { seriesInk } from '../utils/series';
import { useAuth } from '../context/useAuth.js';
import Loading from '../components/Loading';
import NotFound from './NotFound';

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

// باید با سقف سرور (BookCreateSerializer.validate_cover_image) یکی باشد
const MAX_IMAGE_SIZE_MB = 5;
const ACCEPTED_IMAGES = 'image/jpeg,image/png,image/webp';
// ترتیب فیلدها برای بردن فوکوس به اولین خطا
const FIELD_ORDER = ['title', 'author', 'publisher', 'isbn', 'category', 'condition', 'price', 'cover_image', 'description'];

function normalizeServerErrors(errorData) {
  const nextFieldErrors = {};
  let nextGeneralError = '';

  if (!errorData) {
    return { nextFieldErrors, nextGeneralError: 'مشکلی پیش آمد. دوباره امتحان کن.' };
  }
  if (typeof errorData === 'string') {
    return { nextFieldErrors, nextGeneralError: errorData };
  }
  if (Array.isArray(errorData)) {
    return { nextFieldErrors, nextGeneralError: errorData[0] || 'مشکلی پیش آمد. دوباره امتحان کن.' };
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
    nextGeneralError = 'مشکلی پیش آمد. دوباره امتحان کن.';
  }
  return { nextFieldErrors, nextGeneralError };
}

// پیش‌درآمد ویرایش به وضعیت آگهی: فروشنده بداند ذخیره چه می‌کند
const EDIT_LEADS = {
  approved: 'پس از ذخیره، آگهی تا تأیید دوباره‌ی تیم ری‌بوک از فهرست عمومی بیرون می‌رود.',
  rejected: 'این آگهی تأیید نشد. ویرایشش کن و دوباره برای بررسی بفرست.',
  pending: 'آگهی هنوز در صف بررسی است؛ تیم ری‌بوک نسخه‌ی ویرایش‌شده را بررسی می‌کند.',
};

// شابک ۱۰ یا ۱۳ کاراکتری، بی خط تیره و فاصله (ستون isbn در مدل ۱۳ کاراکتر است)
const normalizeIsbn = (value) => toLatinDigits(value).replace(/[\s-]/g, '').toUpperCase();

function validate(form) {
  const errors = {};
  if (!form.title.trim()) errors.title = ['عنوان کتاب را بنویس.'];
  if (!form.author.trim()) errors.author = ['نام نویسنده را بنویس.'];
  if (!form.price) errors.price = ['قیمت را به تومان بنویس.'];
  else if (Number(form.price) <= 0) errors.price = ['قیمت باید بیشتر از صفر باشد.'];
  const isbn = normalizeIsbn(form.isbn);
  if (isbn && !/^(\d{9}[\dX]|\d{13})$/.test(isbn)) {
    errors.isbn = ['شابک ۱۰ یا ۱۳ رقم است؛ خط تیره‌ها مهم نیستند.'];
  }
  return errors;
}

/**
 * فروش کتاب (/create-book) و ویرایش آگهی (/books/:id/edit) یک فرم‌اند.
 * ویرایش: فقط آگهی خودت، نه فروخته‌شده، نه وقتی خریداری سفارش داده و پرداختش مانده (سرور هم همین را رد می‌کند).
 */
function CreateBook() {
  const { id } = useParams();
  const editing = id != null;
  const { user } = useAuth();
  const [formData, setFormData] = useState(INITIAL_FORM);
  // مقدار اولیه برای «تغییری داده‌ای؟»: فرم خالی، یا همان کتاب در ویرایش
  const [baseline, setBaseline] = useState(INITIAL_FORM);
  const [existingCover, setExistingCover] = useState(null);
  const [listing, setListing] = useState(editing ? { state: 'loading' } : { state: 'ready' });
  const [reloadKey, setReloadKey] = useState(0);
  const [coverImage, setCoverImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [categories, setCategories] = useState([]);
  const [fieldErrors, setFieldErrors] = useState({});
  const [generalError, setGeneralError] = useState('');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    let ignore = false;
    bookAPI
      .getCategories()
      .then((response) => {
        if (!ignore) setCategories(response.data.results ?? response.data);
      })
      .catch(() => {
        // بدون دسته‌بندی هم می‌شود ثبت کرد؛ فقط فهرست خالی می‌ماند
      });
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (!editing) return undefined;
    let ignore = false;
    bookAPI
      .getBook(id)
      .then(({ data: book }) => {
        if (ignore) return;
        // آگهی دیگران مثل آگهی‌ای است که نیست
        if (book.seller?.id !== user?.id) {
          setListing({ state: 'not_found' });
        } else if (book.status === 'sold') {
          setListing({ state: 'sold' });
        } else if (book.open_order) {
          setListing({ state: 'ordered' });
        } else {
          const values = {
            title: book.title,
            author: book.author,
            publisher: book.publisher || '',
            isbn: book.isbn || '',
            description: book.description || '',
            price: String(book.price),
            condition: book.condition,
            category: book.category ? String(book.category.id) : '',
          };
          setFormData(values);
          setBaseline(values);
          setExistingCover(book.cover_image);
          setListing({ state: 'ready', status: book.status });
        }
      })
      .catch((err) => {
        if (ignore) return;
        setListing(
          err.response?.status === 404 ? { state: 'not_found' } : { state: 'error', message: getErrorMessage(err) }
        );
      });
    return () => {
      ignore = true;
    };
  }, [editing, id, user?.id, reloadKey]);

  // بستن یا رفرش تب با فرم نیمه‌پر، آگهی را بی‌هشدار پاک می‌کرد
  // ponytail: فقط beforeunload؛ رفتن با لینک‌های داخل برنامه هشدار نمی‌دهد (useBlocker به data router نیاز دارد)
  const isDirty = coverImage !== null || Object.keys(INITIAL_FORM).some((key) => formData[key] !== baseline[key]);
  useEffect(() => {
    if (!isDirty || loading) return undefined;
    const warn = (event) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [isDirty, loading]);

  const clearFieldError = (name) => {
    if (fieldErrors[name]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const handleChange = (e) => {
    const { name } = e.target;
    const value = name === 'price' ? onlyDigits(e.target.value) : e.target.value;
    setFormData((prev) => ({ ...prev, [name]: value }));
    clearFieldError(name);
  };

  const setCoverError = (message) => setFieldErrors((prev) => ({ ...prev, cover_image: [message] }));

  const pickImage = (file) => {
    if (!file) return;
    if (!ACCEPTED_IMAGES.split(',').includes(file.type)) {
      setCoverError('فقط تصویر JPG، PNG یا WebP.');
      return;
    }
    if (file.size > MAX_IMAGE_SIZE_MB * 1024 * 1024) {
      setCoverError(`حجم تصویر بیشتر از ${MAX_IMAGE_SIZE_MB.toLocaleString('fa-IR')} مگابایت است؛ تصویر کوچک‌تری انتخاب کن.`);
      return;
    }

    setCoverImage(file);
    clearFieldError('cover_image');
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleImageChange = (e) => {
    pickImage(e.target.files?.[0]);
    e.target.value = ''; // انتخاب دوباره‌ی همان فایل هم change بدهد
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    pickImage(e.dataTransfer.files?.[0]);
  };

  const removeImage = () => {
    setCoverImage(null);
    setImagePreview(null);
  };

  const focusFirstError = (errors) => {
    const first = FIELD_ORDER.find((name) => errors[name]);
    document.getElementById(first === 'condition' ? 'condition-good' : first)?.focus();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setGeneralError('');

    const errors = validate(formData);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      focusFirstError(errors);
      return;
    }

    setFieldErrors({});
    setLoading(true);

    try {
      const data = new FormData();
      const payload = { ...formData, isbn: normalizeIsbn(formData.isbn) };
      // در ویرایش، فیلد خالی هم فرستاده می‌شود تا مقدار قبلی (مثلاً انتشارات) پاک شود
      Object.entries(payload).forEach(([key, value]) => {
        if (value !== '' || editing) data.append(key, typeof value === 'string' ? value.trim() : value);
      });
      // جلد فقط اگر عکس تازه‌ای انتخاب شده باشد؛ وگرنه جلد فعلی می‌ماند
      if (coverImage) data.append('cover_image', coverImage);

      if (editing) {
        await bookAPI.updateBook(id, data);
        toast.success('تغییرات ذخیره شد و آگهی برای بررسی رفت.');
      } else {
        await bookAPI.createBook(data);
        toast.success('آگهی ثبت شد و پس از بررسی در فهرست دیده می‌شود.');
      }
      navigate('/my-books', { replace: true });
    } catch (err) {
      const errorData = err.response?.data;
      if (errorData && typeof errorData === 'object' && !Array.isArray(errorData)) {
        const { nextFieldErrors, nextGeneralError } = normalizeServerErrors(errorData);
        setFieldErrors(nextFieldErrors);
        if (nextGeneralError) setGeneralError(nextGeneralError);
        focusFirstError(nextFieldErrors);
      } else {
        setGeneralError(getErrorMessage(err));
      }
      if (!errorData || Object.keys(errorData).some((key) => key === 'detail' || key === 'non_field_errors')) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } finally {
      setLoading(false);
    }
  };

  // دسته‌ها گروه‌بندی‌شده زیر دسته‌ی سطح اول، مثل زبانه‌های فهرست
  const roots = categories.filter((cat) => cat.parent === null);
  const selectedCategory = categories.find((cat) => String(cat.id) === String(formData.category));

  // پیش‌نمایش همان کارتی است که خریدار در فهرست می‌بیند
  const previewBook = {
    id: 'preview',
    title: formData.title.trim() || 'عنوان کتاب',
    author: formData.author.trim() || 'نویسنده',
    cover_image: imagePreview || existingCover,
    category_root: selectedCategory ? selectedCategory.parent || selectedCategory.id : null,
    category_name: selectedCategory?.name,
    condition: formData.condition,
    condition_display: CONDITION_LABELS[formData.condition],
    price: formData.price || null,
  };

  const error = (name) => fieldErrors[name]?.[0];
  const shownCover = imagePreview || existingCover;

  if (listing.state === 'loading') return <Loading fullPage />;
  if (listing.state === 'not_found') {
    return (
      <NotFound
        title="این آگهی پیدا نشد"
        message="شاید حذف شده یا آگهی تو نیست. آگهی‌هایت را در «کتاب‌های من» ببین."
      />
    );
  }
  if (listing.state !== 'ready') {
    // آگهی هست اما الان ویرایش‌شدنی نیست؛ همان حالت پیام صفحه‌های دیگر
    return (
      <div className="series-paper">
        <Container className="sell-page">
          <title>ویرایش آگهی | ری‌بوک</title>
          <header className="sell-header">
            <h1 className="sell-title">ویرایش آگهی</h1>
          </header>
          <div className="list-state" role={listing.state === 'error' ? 'alert' : undefined}>
            {listing.state === 'ordered' && (
              <>
                <p>
                  خریداری این کتاب را سفارش داده و پرداختش مانده است؛ اگر لازم است تغییرش بدهی، اول سفارش را لغو کن.
                </p>
                <Link to="/my-orders?tab=sales" className="btn btn-primary">
                  معاملات من
                </Link>
              </>
            )}
            {listing.state === 'sold' && (
              <>
                <p>این کتاب فروخته شده و دیگر ویرایش نمی‌شود. جزئیات فروش در «معاملات من» است.</p>
                <Link to="/my-orders?tab=sales" className="btn btn-outline-secondary">
                  معاملات من
                </Link>
              </>
            )}
            {listing.state === 'error' && (
              <>
                <p>{listing.message}</p>
                <Button
                  variant="outline-secondary"
                  onClick={() => {
                    setListing({ state: 'loading' });
                    setReloadKey((key) => key + 1);
                  }}
                >
                  تلاش دوباره
                </Button>
              </>
            )}
          </div>
        </Container>
      </div>
    );
  }

  return (
    <div className="series-paper" style={{ '--series': previewBook.category_root != null ? seriesInk(previewBook.category_root) : undefined }}>
      {/* کاغذ صفحه همان مجموعه‌ای است که فروشنده انتخاب می‌کند، هم‌رنگ کارت پیش‌نمایش */}
      <Container className="sell-page">
        <title>{editing ? 'ویرایش آگهی | ری‌بوک' : 'فروش کتاب | ری‌بوک'}</title>
        <header className="sell-header">
          <h1 className="sell-title">{editing ? 'ویرایش آگهی' : 'فروش کتاب'}</h1>
          <p className="sell-lead">
            {editing
              ? EDIT_LEADS[listing.status]
              : 'مشخصات نسخه‌ای را که داری بنویس. پیش از انتشار، تیم ری‌بوک آگهی را بررسی می‌کند و نتیجه را در «کتاب‌های من» می‌بینی.'}
          </p>
        </header>

        {generalError && (
          <Alert variant="danger" role="alert">
            {generalError}
          </Alert>
        )}

        <Row className="g-4 g-lg-5">
          <Col lg={8}>
            <Form onSubmit={handleSubmit} noValidate>
              <fieldset className="sell-section">
                <legend>کتاب</legend>

                <Form.Group controlId="title" className="mb-3">
                  <Form.Label>عنوان</Form.Label>
                  <Form.Control
                    name="title"
                    autoComplete="off"
                    value={formData.title}
                    onChange={handleChange}
                    maxLength={200}
                    dir="auto"
                    required
                    aria-required="true"
                    isInvalid={!!error('title')}
                  />
                  <Form.Control.Feedback type="invalid">{error('title')}</Form.Control.Feedback>
                </Form.Group>

                <Row className="g-3">
                  <Col md={6}>
                    <Form.Group controlId="author">
                      <Form.Label>نویسنده</Form.Label>
                      <Form.Control
                        name="author"
                        autoComplete="off"
                        value={formData.author}
                        onChange={handleChange}
                        maxLength={200}
                        dir="auto"
                        required
                        aria-required="true"
                        isInvalid={!!error('author')}
                      />
                      <Form.Control.Feedback type="invalid">{error('author')}</Form.Control.Feedback>
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group controlId="publisher">
                      <Form.Label>
                        انتشارات <span className="sell-optional">(اختیاری)</span>
                      </Form.Label>
                      <Form.Control
                        name="publisher"
                        autoComplete="off"
                        value={formData.publisher}
                        onChange={handleChange}
                        maxLength={200}
                        dir="auto"
                        isInvalid={!!error('publisher')}
                      />
                      <Form.Control.Feedback type="invalid">{error('publisher')}</Form.Control.Feedback>
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group controlId="isbn">
                      <Form.Label>
                        شابک <span className="sell-optional">(اختیاری)</span>
                      </Form.Label>
                      <Form.Control
                        name="isbn"
                        value={formData.isbn}
                        onChange={handleChange}
                        maxLength={17}
                        dir="ltr"
                        inputMode="numeric"
                        autoComplete="off"
                        placeholder="978-964-…"
                        aria-describedby="isbn-help"
                        isInvalid={!!error('isbn')}
                      />
                      <Form.Text id="isbn-help">پشت جلد، بالای بارکد.</Form.Text>
                      <Form.Control.Feedback type="invalid">{error('isbn')}</Form.Control.Feedback>
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group controlId="category">
                      <Form.Label>
                        دسته‌بندی <span className="sell-optional">(اختیاری)</span>
                      </Form.Label>
                      <Form.Select
                        name="category"
                        value={formData.category}
                        onChange={handleChange}
                        aria-describedby="category-help"
                        isInvalid={!!error('category')}
                      >
                        <option value="">بدون دسته‌بندی</option>
                        {roots.map((root) => (
                          <optgroup key={root.id} label={root.name}>
                            <option value={root.id}>{root.name}</option>
                            {categories
                              .filter((cat) => cat.parent === root.id)
                              .map((cat) => (
                                <option key={cat.id} value={cat.id}>
                                  {cat.name}
                                </option>
                              ))}
                          </optgroup>
                        ))}
                      </Form.Select>
                      <Form.Text id="category-help">خریداران کتاب را از زبانه‌ی همین دسته پیدا می‌کنند.</Form.Text>
                      <Form.Control.Feedback type="invalid">{error('category')}</Form.Control.Feedback>
                    </Form.Group>
                  </Col>
                </Row>
              </fieldset>

              <fieldset className="sell-section" aria-describedby={error('condition') ? 'condition-error' : undefined}>
                <legend>وضعیت این نسخه</legend>
                <div className="condition-options">
                  {Object.entries(CONDITION_LABELS).map(([value, label]) => (
                    <label key={value} className="condition-option" htmlFor={`condition-${value}`}>
                      <input
                        id={`condition-${value}`}
                        type="radio"
                        name="condition"
                        value={value}
                        checked={formData.condition === value}
                        onChange={handleChange}
                        className="form-check-input"
                      />
                      <span className="condition-option-body">
                        <ConditionMeasure condition={value} label={label} />
                        <span className="condition-option-note">{CONDITION_NOTES[value]}</span>
                      </span>
                    </label>
                  ))}
                </div>
                {error('condition') && (
                  <p id="condition-error" className="sell-error">
                    {error('condition')}
                  </p>
                )}
              </fieldset>

              <fieldset className="sell-section">
                <legend>قیمت</legend>
                <Form.Group controlId="price" className="sell-price">
                  <Form.Label className="visually-hidden">قیمت به تومان</Form.Label>
                  <InputGroup hasValidation>
                    <Form.Control
                      name="price"
                      value={formData.price}
                      onChange={handleChange}
                      inputMode="numeric"
                      autoComplete="off"
                      required
                      aria-required="true"
                      aria-describedby="price-echo"
                      isInvalid={!!error('price')}
                    />
                    <InputGroup.Text>تومان</InputGroup.Text>
                    <Form.Control.Feedback type="invalid">{error('price')}</Form.Control.Feedback>
                  </InputGroup>
                  <Form.Text id="price-echo" aria-live="polite">
                    {formData.price
                      ? `${Number(formData.price).toLocaleString('fa-IR')} تومان`
                      : 'فقط عدد؛ مثلاً ۸۵۰۰۰'}
                  </Form.Text>
                </Form.Group>
              </fieldset>

              <fieldset className="sell-section">
                <legend>جلد و یادداشت</legend>

                <div className="cover-field mb-4">
                  <p className="form-label" id="cover-label">
                    عکس جلد <span className="sell-optional">(اختیاری)</span>
                  </p>
                  {shownCover ? (
                    <div className="cover-picked">
                      <img src={shownCover} alt={imagePreview ? 'پیش‌نمایش جلد' : 'جلد فعلی'} />
                      <div className="cover-picked-actions">
                        <label htmlFor="cover_image" className="btn btn-outline-secondary">
                          تغییر عکس
                        </label>
                        {/* در ویرایش، برداشتن عکس تازه جلد فعلی را برمی‌گرداند؛ پاک کردن جلد فعلی هنوز ممکن نیست */}
                        {coverImage && (
                          <Button
                            variant="outline-secondary"
                            onClick={removeImage}
                            className="d-inline-flex align-items-center gap-2"
                          >
                            <FiTrash2 aria-hidden="true" />
                            {existingCover ? 'برگشت به جلد فعلی' : 'حذف'}
                          </Button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <label
                      htmlFor="cover_image"
                      className={`cover-dropzone${dragging ? ' is-dragging' : ''}${error('cover_image') ? ' is-invalid' : ''}`}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragging(true);
                      }}
                      onDragLeave={() => setDragging(false)}
                      onDrop={handleDrop}
                    >
                      <FiUpload size={28} aria-hidden="true" />
                      <span>عکس روبه‌روی جلد را اینجا بکش یا برای انتخاب بزن</span>
                      <span className="cover-dropzone-hint">
                        JPG، PNG یا WebP، تا {MAX_IMAGE_SIZE_MB.toLocaleString('fa-IR')} مگابایت. بی‌عکس، جلد ساده‌ی
                        مجموعه نمایش داده می‌شود.
                      </span>
                    </label>
                  )}
                  <input
                    id="cover_image"
                    type="file"
                    accept={ACCEPTED_IMAGES}
                    onChange={handleImageChange}
                    className="visually-hidden"
                    aria-labelledby="cover-label"
                    aria-describedby={error('cover_image') ? 'cover-error' : undefined}
                  />
                  {error('cover_image') && (
                    <p id="cover-error" className="sell-error" role="alert">
                      {error('cover_image')}
                    </p>
                  )}
                </div>

                <Form.Group controlId="description">
                  <Form.Label>
                    یادداشت برای خریدار <span className="sell-optional">(اختیاری)</span>
                  </Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={5}
                    name="description"
                    autoComplete="off"
                    value={formData.description}
                    onChange={handleChange}
                    dir="auto"
                    placeholder="هر چیزی که خریدار باید بداند: خط‌کشی یا یادداشت، پارگی، نوبت چاپ، ترجمه‌ی چه کسی."
                    isInvalid={!!error('description')}
                  />
                  <Form.Control.Feedback type="invalid">{error('description')}</Form.Control.Feedback>
                </Form.Group>
              </fieldset>

              <div className="sell-submit">
                <Button type="submit" variant="primary" size="lg" disabled={loading}>
                  {editing
                    ? loading
                      ? 'در حال ذخیره…'
                      : 'ذخیره و ارسال برای بررسی'
                    : loading
                      ? 'در حال ثبت…'
                      : 'ثبت آگهی برای بررسی'}
                </Button>
              </div>
            </Form>
          </Col>

          <Col lg={4} className="d-none d-lg-block">
            <aside className="sell-preview" aria-label="پیش‌نمایش آگهی">
              <p className="sell-preview-caption">در فهرست این‌طور دیده می‌شود</p>
              {/* inert: پیش‌نمایش فقط دیدنی است، لینک و فوکوس ندارد */}
              <div inert>
                <BookCard book={previewBook} />
              </div>
            </aside>
          </Col>
        </Row>
      </Container>
    </div>
  );
}

// صفحه‌ی فروش و ویرایش هر کتاب نمونه‌ی جدای فرم‌اند: Router همان کامپوننت را میان دو مسیر نگه می‌دارد
// و بی key، رفتن از ویرایش به «فروش کتاب» فرم پرشده‌ی قبلی را نشان می‌داد
function CreateBookPage() {
  const { id } = useParams();
  return <CreateBook key={id ?? 'new'} />;
}

export default CreateBookPage;
