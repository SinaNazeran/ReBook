import { useState, useEffect, useCallback } from 'react';
import { Container, Row, Col, Form, Card } from 'react-bootstrap';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { bookAPI, getErrorMessage } from '../services/api';
import { useAuth } from '../context/useAuth.js';
import BookCard from '../components/BookCard';
import Loading from '../components/Loading';
import { FiSearch, FiInbox, FiX } from 'react-icons/fi';

const CONDITION_OPTIONS = [
  { value: '', label: 'همه وضعیت‌ها' },
  { value: 'new', label: 'نو' },
  { value: 'like_new', label: 'در حد نو' },
  { value: 'good', label: 'خوب' },
  { value: 'fair', label: 'قابل قبول' },
  { value: 'poor', label: 'فرسوده' },
];

const ORDERING_OPTIONS = [
  { value: '-created_at', label: 'جدیدترین' },
  { value: 'price', label: 'ارزان‌ترین' },
  { value: '-price', label: 'گران‌ترین' },
];

const EMPTY_SET = new Set();

function BookList() {
  const { isAuthenticated } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [books, setBooks] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [wishlistIds, setWishlistIds] = useState(new Set());

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedCondition, setSelectedCondition] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [ordering, setOrdering] = useState('-created_at');

  const paramsKey = searchParams.toString();
  const [prevParamsKey, setPrevParamsKey] = useState(paramsKey);
  if (paramsKey !== prevParamsKey) {
    setPrevParamsKey(paramsKey);
    setLoading(true); // ✅ به‌جای افکت، در حین رندر تنظیم می‌شود
    setSearch(searchParams.get('search') || '');
    setSelectedCategory(searchParams.get('category') || '');
    setSelectedCondition(searchParams.get('condition') || '');
    setMinPrice(searchParams.get('min_price') || '');
    setMaxPrice(searchParams.get('max_price') || '');
    setOrdering(searchParams.get('ordering') || '-created_at');
  }

  // دسته‌بندی‌ها — فقط یک‌بار
  useEffect(() => {
    let ignore = false;

    bookAPI
      .getCategories()
      .then((response) => {
        if (!ignore) {
          setCategories(response.data.results ?? response.data);
        }
      })
      .catch((error) => {
        if (!ignore) {
          toast.error(getErrorMessage(error));
        }
      });

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    let ignore = false;

    const params = Object.fromEntries(searchParams);

    bookAPI
      .getBooks(params)
      .then((response) => {
        if (!ignore) {
          setBooks(response.data.results ?? response.data);
        }
      })
      .catch((error) => {
        if (!ignore) {
          toast.error(getErrorMessage(error));
          setBooks([]);
        }
      })
      .finally(() => {
        if (!ignore) {
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [searchParams]);

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
    setWishlistIds((prev) => {
      const next = new Set(prev);
      if (next.has(bookId)) {
        next.delete(bookId);
      } else {
        next.add(bookId);
      }
      return next;
    });

    try {
      await bookAPI.toggleWishlist(bookId);
    } catch (error) {
      setWishlistIds((prev) => {
        const next = new Set(prev);
        if (next.has(bookId)) {
          next.delete(bookId);
        } else {
          next.add(bookId);
        }
        return next;
      });
      toast.error(getErrorMessage(error));
    }
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();

    if (minPrice && maxPrice && Number(minPrice) > Number(maxPrice)) {
      toast.warning('حداقل قیمت نمی‌تواند بیشتر از حداکثر قیمت باشد.');
      return;
    }

    const params = {};
    if (search.trim()) params.search = search.trim();
    if (selectedCategory) params.category = selectedCategory;
    if (selectedCondition) params.condition = selectedCondition;
    if (minPrice) params.min_price = minPrice;
    if (maxPrice) params.max_price = maxPrice;
    if (ordering) params.ordering = ordering;

    setSearchParams(params);
  };

  const handleReset = () => {
    setSearchParams({});
  };

  const hasActiveFilters = Array.from(searchParams.keys()).length > 0;

  return (
    <Container className="py-4">
      <h1 className="h3 mb-4">لیست کتاب‌ها</h1>

      <Card className="shadow-sm mb-4">
        <Card.Body>
          <Form onSubmit={handleSubmit}>
            <Row className="g-3">
              <Col md={12}>
                <Form.Label htmlFor="book-search" className="visually-hidden">
                  جستجو بر اساس عنوان یا نویسنده
                </Form.Label>
                <div className="input-group">
                  <span className="input-group-text bg-white">
                    <FiSearch />
                  </span>
                  <Form.Control
                    id="book-search"
                    type="text"
                    placeholder="جستجو بر اساس عنوان یا نویسنده..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </Col>

              <Col md={3}>
                <Form.Label htmlFor="filter-category" className="visually-hidden">
                  دسته‌بندی
                </Form.Label>
                <Form.Select
                  id="filter-category"
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                >
                  <option value="">همه دسته‌بندی‌ها</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.slug}>
                      {cat.name}
                    </option>
                  ))}
                </Form.Select>
              </Col>

              <Col md={3}>
                <Form.Label htmlFor="filter-condition" className="visually-hidden">
                  وضعیت کتاب
                </Form.Label>
                <Form.Select
                  id="filter-condition"
                  value={selectedCondition}
                  onChange={(e) => setSelectedCondition(e.target.value)}
                >
                  {CONDITION_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </Form.Select>
              </Col>

              <Col md={2}>
                <Form.Label htmlFor="min-price" className="visually-hidden">
                  حداقل قیمت
                </Form.Label>
                <Form.Control
                  id="min-price"
                  type="number"
                  min="0"
                  placeholder="حداقل قیمت"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                />
              </Col>
              <Col md={2}>
                <Form.Label htmlFor="max-price" className="visually-hidden">
                  حداکثر قیمت
                </Form.Label>
                <Form.Control
                  id="max-price"
                  type="number"
                  min="0"
                  placeholder="حداکثر قیمت"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                />
              </Col>

              <Col md={2}>
                <Form.Label htmlFor="ordering" className="visually-hidden">
                  مرتب‌سازی
                </Form.Label>
                <Form.Select
                  id="ordering"
                  value={ordering}
                  onChange={(e) => setOrdering(e.target.value)}
                >
                  {ORDERING_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </Form.Select>
              </Col>
            </Row>

            <div className="mt-3 d-flex gap-2">
              <button type="submit" className="btn btn-primary" disabled={loading}>
                اعمال فیلتر
              </button>
              {hasActiveFilters && (
                <button
                  type="button"
                  className="btn btn-outline-secondary d-inline-flex align-items-center gap-1"
                  onClick={handleReset}
                >
                  <FiX />
                  حذف فیلترها
                </button>
              )}
            </div>
          </Form>
        </Card.Body>
      </Card>

      {loading ? (
        <Loading />
      ) : books.length > 0 ? (
        <Row className="g-4">
          {books.map((book) => (
            <Col key={book.id} xs={12} sm={6} md={4} lg={3}>
              <BookCard
                book={book}
                isWishlisted={displayedWishlistIds.has(book.id)}
                onToggleWishlist={isAuthenticated ? handleToggleWishlist : undefined}
              />
            </Col>
          ))}
        </Row>
      ) : (
        <div className="text-center py-5">
          <FiInbox size={64} className="text-muted" aria-hidden="true" />
          <h2 className="h4 mt-3">کتابی یافت نشد</h2>
          <p className="text-muted">فیلترهای خود را تغییر دهید.</p>
        </div>
      )}
    </Container>
  );
}

export default BookList;