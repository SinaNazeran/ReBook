import { useState, useEffect, useCallback, useRef } from 'react';
import { Container, Row, Col, Form, Button, InputGroup, Offcanvas } from 'react-bootstrap';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { bookAPI, getErrorMessage } from '../services/api';
import { useAuth } from '../context/useAuth.js';
import BookCard, { BookCardSkeleton } from '../components/BookCard';
import { seriesInk } from '../utils/series';
import { onlyDigits } from '../utils/digits';
import { FiSearch, FiSliders, FiX, FiPlusCircle } from 'react-icons/fi';

const CONDITION_OPTIONS = [
  { value: '', label: 'همه وضعیت‌ها' },
  { value: 'new', label: 'نو' },
  { value: 'like_new', label: 'در حد نو' },
  { value: 'good', label: 'خوب' },
  { value: 'fair', label: 'قابل قبول' },
  { value: 'poor', label: 'فرسوده' },
];

const DEFAULT_ORDERING = '-created_at';
const ORDERING_OPTIONS = [
  { value: DEFAULT_ORDERING, label: 'جدیدترین' },
  { value: 'price', label: 'ارزان‌ترین' },
  { value: '-price', label: 'گران‌ترین' },
];

const EMPTY_SET = new Set();

// باید با PAGE_SIZE و max_page_size بک‌اند (config/pagination.py) یکی باشد
const PAGE_SIZE = 12;
const MAX_PAGES_AT_ONCE = 10;

// همه‌ی فیلدهای فرم فیلتر (حتی وقتی در Offcanvas موبایل به body منتقل شده‌اند) با این شناسه به یک فرم وصل‌اند
const FILTER_FORM_ID = 'book-filters';

const formatToman = (value) => `${Number(value).toLocaleString('fa-IR')} تومان`;

function BookList() {
  const { isAuthenticated } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [books, setBooks] = useState([]);
  const [count, setCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [wishlistIds, setWishlistIds] = useState(new Set());
  const [showFilters, setShowFilters] = useState(false);

  const [search, setSearch] = useState('');
  const [selectedCondition, setSelectedCondition] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [priceError, setPriceError] = useState('');

  // page جدا از فیلترهاست: «نمایش بیشتر» فقط page را عوض می‌کند و نباید فهرست را از نو بارگذاری کند
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const filterParams = new URLSearchParams(searchParams);
  filterParams.delete('page');
  const paramsKey = filterParams.toString();
  // null تا در اولین رندر هم فرم از URL پر شود (لینک مستقیم یا رفرش با فیلتر)
  const [prevParamsKey, setPrevParamsKey] = useState(null);
  if (paramsKey !== prevParamsKey) {
    setPrevParamsKey(paramsKey);
    setLoading(true); // به‌جای افکت، در حین رندر تنظیم می‌شود
    setLoadError(false);
    setSearch(searchParams.get('search') || '');
    setSelectedCondition(searchParams.get('condition') || '');
    setMinPrice(searchParams.get('min_price') || '');
    setMaxPrice(searchParams.get('max_price') || '');
    setPriceError('');
  }

  const activeSlug = searchParams.get('category') || '';
  const ordering = searchParams.get('ordering') || DEFAULT_ORDERING;

  // دسته‌بندی‌ها فقط یک‌بار؛ اگر نیامد، زبانه‌ها نمایش داده نمی‌شوند و فهرست کامل کار می‌کند
  useEffect(() => {
    let ignore = false;
    bookAPI
      .getCategories()
      .then((response) => {
        if (!ignore) setCategories(response.data.results ?? response.data);
      })
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, []);

  // چند صفحه برای همین فیلترها بارگذاری شده؛ برای تشخیص «نمایش بیشتر» از بارگذاری تازه
  const loadedRef = useRef({ key: null, pages: 0 });

  useEffect(() => {
    let ignore = false;

    const filters = Object.fromEntries(new URLSearchParams(paramsKey));
    const loaded = loadedRef.current;
    const appending = loaded.key === paramsKey && page === loaded.pages + 1;
    // بارگذاری تازه (مثلاً لینک مستقیم به ?page=3): همهٔ صفحه‌ها تا page در یک درخواست
    const pages = appending ? page : Math.min(page, MAX_PAGES_AT_ONCE);
    const params = appending
      ? { ...filters, page }
      : pages > 1
        ? { ...filters, page_size: pages * PAGE_SIZE }
        : filters;

    bookAPI
      .getBooks(params)
      .then((response) => {
        if (ignore) return;
        const fetched = response.data.results ?? response.data;
        if (appending) {
          // اگر در این فاصله کتاب تازه‌ای ثبت شده باشد، مرز صفحه جابه‌جا می‌شود و تکرار پیش می‌آید
          setBooks((prev) => {
            const ids = new Set(prev.map((book) => book.id));
            return [...prev, ...fetched.filter((book) => !ids.has(book.id))];
          });
        } else {
          setBooks(fetched);
        }
        setCount(response.data.count ?? fetched.length);
        setHasMore(Boolean(response.data.next));
        loadedRef.current = { key: paramsKey, pages };
      })
      .catch((error) => {
        if (ignore) return;
        if (appending) {
          // خطای «نمایش بیشتر» گذراست؛ فهرست فعلی سر جایش می‌ماند
          toast.error(getErrorMessage(error));
        } else {
          setBooks([]);
          setHasMore(false);
          setLoadError(true);
        }
      })
      .finally(() => {
        if (!ignore) {
          setLoading(false);
          setLoadingMore(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [paramsKey, page, reloadKey]);

  // پس از «نمایش بیشتر» فوکوس به اولین کتاب تازه می‌رود؛ وگرنه کاربر صفحه‌کلید با پنهان‌شدن دکمه در صفحه‌ی آخر گم می‌شود
  const gridRef = useRef(null);
  const focusFromRef = useRef(null);
  useEffect(() => {
    if (focusFromRef.current === null || loadingMore) return;
    gridRef.current?.querySelectorAll('.book-card .stretched-link')[focusFromRef.current]?.focus();
    focusFromRef.current = null;
  }, [books, loadingMore]);

  const handleRetry = () => {
    setLoading(true);
    setLoadError(false);
    setReloadKey((key) => key + 1);
  };

  const handleLoadMore = () => {
    if (loadingMore) return;
    focusFromRef.current = books.length;
    setLoadingMore(true);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('page', loadedRef.current.pages + 1);
        return next;
      },
      { replace: true },
    );
  };

  // واکشی علاقه‌مندی‌ها
  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    let ignore = false;

    bookAPI
      .getWishlist()
      .then((response) => {
        const list = response.data.results ?? response.data;
        if (!ignore) {
          setWishlistIds(new Set(list.map((item) => item.book.id)));
        }
      })
      .catch(() => {
        // خطای پس‌زمینه
      });

    return () => {
      ignore = true;
    };
  }, [isAuthenticated]);

  const displayedWishlistIds = isAuthenticated ? wishlistIds : EMPTY_SET;

  const handleToggleWishlist = useCallback(async (bookId) => {
    const flip = (prev) => {
      const next = new Set(prev);
      if (next.has(bookId)) {
        next.delete(bookId);
      } else {
        next.add(bookId);
      }
      return next;
    };

    setWishlistIds(flip);
    try {
      await bookAPI.toggleWishlist(bookId);
    } catch (error) {
      setWishlistIds(flip);
      toast.error(getErrorMessage(error));
    }
  }, []);

  // هر تغییر فیلتر از صفحه‌ی اول شروع می‌شود؛ مقدار خالی پارامتر را حذف می‌کند
  const withParams = (changes) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(changes).forEach(([key, value]) => {
      if (value) next.set(key, value);
      else next.delete(key);
    });
    next.delete('page');
    return next;
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (minPrice && maxPrice && Number(minPrice) > Number(maxPrice)) {
      setPriceError('حداقل قیمت نمی‌تواند بیشتر از حداکثر قیمت باشد.');
      setShowFilters(true);
      return;
    }

    setSearchParams(
      withParams({
        search: search.trim(),
        condition: selectedCondition,
        min_price: minPrice,
        max_price: maxPrice,
      }),
    );
    setShowFilters(false);
  };

  const handleOrderingChange = (e) => {
    const value = e.target.value;
    setSearchParams(withParams({ ordering: value === DEFAULT_ORDERING ? '' : value }));
  };

  // زبانه‌ها: دسته‌های سطح اول؛ زیرشاخه‌های دسته‌ی فعال در ردیف دوم
  const rootCategories = categories.filter((cat) => cat.parent === null);
  const activeCategory = categories.find((cat) => cat.slug === activeSlug);
  const activeRoot = activeCategory?.parent
    ? categories.find((cat) => cat.id === activeCategory.parent)
    : activeCategory;
  const subCategories = activeRoot ? categories.filter((cat) => cat.parent === activeRoot.id) : [];
  const categoryHref = (slug) => ({ search: withParams({ category: slug }).toString() });

  const conditionLabel = CONDITION_OPTIONS.find((opt) => opt.value === searchParams.get('condition'))?.label;
  const chips = [
    searchParams.get('search') && { key: 'search', label: `«${searchParams.get('search')}»` },
    conditionLabel && { key: 'condition', label: `وضعیت: ${conditionLabel}` },
    searchParams.get('min_price') && { key: 'min_price', label: `از ${formatToman(searchParams.get('min_price'))}` },
    searchParams.get('max_price') && { key: 'max_price', label: `تا ${formatToman(searchParams.get('max_price'))}` },
  ].filter(Boolean);
  const sheetFilterCount = chips.filter((chip) => chip.key !== 'search').length;

  const clearChips = () =>
    setSearchParams(withParams({ search: '', condition: '', min_price: '', max_price: '' }));

  // اگر دسته‌ها نیامده باشند یا slug ناشناخته باشد، عنوان نباید «همه» بگوید
  const title = activeCategory?.name ?? (activeSlug ? 'کتاب‌ها' : 'همه‌ی کتاب‌ها');
  const titleInk = activeRoot ? seriesInk(activeRoot.id) : 'var(--rb-ink)';

  return (
    <Container className="book-list-page">
      <title>{`${title} | ری‌بوک`}</title>
      {rootCategories.length > 0 && (
        <nav className="series-tabs" aria-label="دسته‌ها">
          <ul className="series-tabs-list">
            <li>
              <Link
                to={categoryHref('')}
                className="series-tab"
                aria-current={!activeSlug ? 'page' : undefined}
                style={{ '--series-ink': 'var(--rb-ink)' }}
              >
                همه
              </Link>
            </li>
            {rootCategories.map((cat) => (
              <li key={cat.id}>
                <Link
                  to={categoryHref(cat.slug)}
                  className="series-tab"
                  aria-current={activeRoot?.id === cat.id ? 'page' : undefined}
                  style={{ '--series-ink': seriesInk(cat.id) }}
                >
                  <span className="series-index-mark" aria-hidden="true" />
                  {cat.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}

      {subCategories.length > 0 && (
        <nav className="sub-tabs" aria-label={`زیرشاخه‌های ${activeRoot.name}`}>
          <Link
            to={categoryHref(activeRoot.slug)}
            className="sub-tab"
            aria-current={activeCategory.id === activeRoot.id ? 'page' : undefined}
          >
            همه‌ی {activeRoot.name}
          </Link>
          {subCategories.map((cat) => (
            <Link
              key={cat.id}
              to={categoryHref(cat.slug)}
              className="sub-tab"
              aria-current={activeCategory.id === cat.id ? 'page' : undefined}
            >
              {cat.name}
            </Link>
          ))}
        </nav>
      )}

      <header className="list-header">
        <div>
          <h1 className="list-title" style={{ '--series-ink': titleInk }}>
            <span className="list-title-mark" aria-hidden="true" />
            {title}
            {!loading && !loadError && (
              <span className="list-count">{count.toLocaleString('fa-IR')} کتاب</span>
            )}
          </h1>
          <p className="list-note">همه‌ی آگهی‌ها پیش از انتشار بررسی می‌شوند.</p>
        </div>

        <Form.Group controlId="ordering" className="list-sort">
          <Form.Label>مرتب‌سازی</Form.Label>
          <Form.Select value={ordering} onChange={handleOrderingChange}>
            {ORDERING_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Form.Select>
        </Form.Group>
      </header>

      {/* همیشه در DOM تا تغییر تعداد نتیجه با فیلترها خوانده شود */}
      <p className="visually-hidden" role="status">
        {loading ? 'در حال بارگذاری کتاب‌ها' : loadError ? '' : `${count.toLocaleString('fa-IR')} کتاب`}
      </p>

      <div className="list-toolbar">
        <Form id={FILTER_FORM_ID} onSubmit={handleSubmit} role="search" className="list-search">
          <Form.Label htmlFor="book-search">جستجو</Form.Label>
          <InputGroup>
            <Form.Control
              id="book-search"
              type="search"
              placeholder="عنوان یا نویسنده"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Button type="submit" variant="outline-secondary" aria-label="جستجو">
              <FiSearch aria-hidden="true" />
            </Button>
          </InputGroup>
        </Form>

        <Button
          variant="outline-secondary"
          className="list-filters-toggle d-lg-none d-inline-flex align-items-center gap-2"
          onClick={() => setShowFilters(true)}
          aria-controls="list-filters"
        >
          <FiSliders aria-hidden="true" />
          فیلترها
          {sheetFilterCount > 0 && <span className="list-filters-count">{sheetFilterCount.toLocaleString('fa-IR')}</span>}
        </Button>

        <Offcanvas
          id="list-filters"
          show={showFilters}
          onHide={() => setShowFilters(false)}
          responsive="lg"
          placement="bottom"
          className="list-filters"
          aria-labelledby="list-filters-title"
        >
          <Offcanvas.Header closeButton closeLabel="بستن" className="d-lg-none">
            <Offcanvas.Title id="list-filters-title" as="h2" className="h5">
              فیلترها
            </Offcanvas.Title>
          </Offcanvas.Header>
          <Offcanvas.Body className="list-filters-body">
            <Form.Group controlId="filter-condition" className="list-field-condition">
              <Form.Label>وضعیت ظاهری</Form.Label>
              <Form.Select
                form={FILTER_FORM_ID}
                value={selectedCondition}
                onChange={(e) => setSelectedCondition(e.target.value)}
              >
                {CONDITION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>

            <fieldset className="list-field-price">
              <legend className="form-label">قیمت</legend>
              <div className="list-price-inputs">
                <InputGroup hasValidation>
                  <Form.Control
                    form={FILTER_FORM_ID}
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="از"
                    aria-label="حداقل قیمت"
                    value={minPrice}
                    isInvalid={Boolean(priceError)}
                    onChange={(e) => {
                      setMinPrice(onlyDigits(e.target.value));
                      setPriceError('');
                    }}
                  />
                  <InputGroup.Text>تومان</InputGroup.Text>
                </InputGroup>
                <InputGroup>
                  <Form.Control
                    form={FILTER_FORM_ID}
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="تا"
                    aria-label="حداکثر قیمت"
                    value={maxPrice}
                    isInvalid={Boolean(priceError)}
                    aria-describedby={priceError ? 'price-error' : undefined}
                    onChange={(e) => {
                      setMaxPrice(onlyDigits(e.target.value));
                      setPriceError('');
                    }}
                  />
                  <InputGroup.Text>تومان</InputGroup.Text>
                </InputGroup>
              </div>
              {priceError && (
                <p id="price-error" className="list-field-error" role="alert">
                  {priceError}
                </p>
              )}
            </fieldset>

            <Button type="submit" form={FILTER_FORM_ID} className="list-apply">
              اعمال
            </Button>
          </Offcanvas.Body>
        </Offcanvas>
      </div>

      {chips.length > 0 && (
        <div className="list-chips" aria-label="فیلترهای فعال">
          {chips.map((chip) => (
            <Link
              key={chip.key}
              to={{ search: withParams({ [chip.key]: '' }).toString() }}
              className="list-chip"
              aria-label={`حذف فیلتر ${chip.label}`}
            >
              <span dir="auto">{chip.label}</span>
              <FiX aria-hidden="true" />
            </Link>
          ))}
          {chips.length > 1 && (
            <button type="button" className="list-chips-clear" onClick={clearChips}>
              حذف همه
            </button>
          )}
        </div>
      )}

      {loadError ? (
        <div className="list-state" role="alert">
          <p>کتاب‌ها بارگذاری نشدند. اتصال اینترنت را بررسی کن و دوباره امتحان کن.</p>
          <Button variant="outline-secondary" onClick={handleRetry}>
            تلاش دوباره
          </Button>
        </div>
      ) : !loading && books.length === 0 ? (
        <div className="list-state">
          {chips.length > 0 ? (
            <>
              <p>با این فیلترها کتابی پیدا نشد.</p>
              <Button variant="outline-secondary" onClick={clearChips}>
                حذف فیلترها
              </Button>
            </>
          ) : (
            <>
              <p>
                {activeCategory ? `در «${activeCategory.name}» هنوز کتابی نیست.` : 'هنوز کتابی در قفسه نیست.'}{' '}
                کتابی داری که دیگر سراغش نمی‌روی؟
              </p>
              <Link to="/create-book" className="btn btn-primary d-inline-flex align-items-center gap-2">
                <FiPlusCircle aria-hidden="true" />
                فروش کتاب
              </Link>
            </>
          )}
        </div>
      ) : (
        <>
          <Row ref={gridRef} className="g-3 g-md-4" aria-busy={loading}>
            {loading
              ? Array.from({ length: 8 }, (_, i) => (
                  <Col key={i} xs={6} md={4} lg={3}>
                    <BookCardSkeleton />
                  </Col>
                ))
              : books.map((book) => (
                  <Col key={book.id} xs={6} md={4} lg={3}>
                    <BookCard
                      book={book}
                      isWishlisted={displayedWishlistIds.has(book.id)}
                      onToggleWishlist={isAuthenticated ? handleToggleWishlist : undefined}
                    />
                  </Col>
                ))}
          </Row>
          {!loading && hasMore && (
            <div className="text-center mt-4">
              {/* aria-disabled به‌جای disabled: دکمه‌ی غیرفعال فوکوس را به body می‌اندازد */}
              <Button
                variant="outline-primary"
                onClick={handleLoadMore}
                className={loadingMore ? 'disabled' : undefined}
                aria-disabled={loadingMore || undefined}
              >
                {loadingMore ? 'در حال بارگذاری...' : 'نمایش بیشتر'}
              </Button>
            </div>
          )}
        </>
      )}
    </Container>
  );
}

export default BookList;
