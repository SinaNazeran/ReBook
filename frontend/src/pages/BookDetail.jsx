import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { Container, Row, Col, Button } from 'react-bootstrap';
import { toast } from 'react-toastify';
import { FiHeart, FiShoppingCart } from 'react-icons/fi';
import { bookAPI, orderAPI, getErrorMessage } from '../services/api';
import { useAuth } from '../context/useAuth.js';
import Loading from '../components/Loading';
import PlainCover from '../components/PlainCover';
import ConditionMeasure from '../components/ConditionMeasure';
import PurchaseModal from '../components/PurchaseModal';
import NotFound from './NotFound';
import { seriesInk } from '../utils/series';
import { CONDITION_NOTES } from '../utils/condition';

// یادداشت بلندتر از این، تا وقتی خواننده نخواهد، چند خط اول را نشان می‌دهد
const LONG_NOTES = 320;

const formatDate = (value) =>
  new Date(value).toLocaleDateString('fa-IR', { year: 'numeric', month: 'long', day: 'numeric' });

function BookDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated } = useAuth();

  const [book, setBook] = useState(null);
  const [loading, setLoading] = useState(true);
  // 'not_found' برای 404، متن خطا برای بقیه (شبکه، خطای سرور)؛ آدرس صفحه عوض نمی‌شود
  const [loadError, setLoadError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [wishlisted, setWishlisted] = useState(false);
  const [showPurchase, setShowPurchase] = useState(false);
  const [boughtByMe, setBoughtByMe] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);

  useEffect(() => {
    let ignore = false;

    bookAPI
      .getBook(id)
      .then((response) => {
        if (!ignore) {
          setBook(response.data);
          setWishlisted(response.data.is_wishlisted || false);
        }
      })
      .catch((error) => {
        if (!ignore) {
          setLoadError(error.response?.status === 404 ? 'not_found' : getErrorMessage(error));
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
  }, [id, reloadKey]);

  const handleRetry = () => {
    setLoadError(null);
    setLoading(true);
    setReloadKey((key) => key + 1);
  };

  // وضعیت سفارش روی سرور عوض شده (مثلاً خریدار دیگری زودتر سفارش داده)؛ بی‌صدا تازه می‌شود
  const refreshBook = useCallback(() => {
    bookAPI
      .getBook(id)
      .then((response) => setBook(response.data))
      .catch(() => {});
  }, [id]);

  const goToLogin = () => {
    toast.info('برای ادامه وارد حساب کاربری‌ات شو.');
    navigate('/login', { state: { from: location } });
  };

  const handleWishlistToggle = async () => {
    if (!isAuthenticated) {
      goToLogin();
      return;
    }

    const prevState = wishlisted;
    setWishlisted(!prevState); // آپدیت خوش‌بینانه
    try {
      const response = await bookAPI.toggleWishlist(id);
      setWishlisted(response.data.wishlisted);
    } catch (error) {
      setWishlisted(prevState);
      toast.error(getErrorMessage(error));
    }
  };

  const handleBuy = () => {
    if (!isAuthenticated) {
      goToLogin();
      return;
    }
    setShowPurchase(true);
  };

  const handlePaid = () => {
    setBoughtByMe(true);
    setBook((prev) => ({ ...prev, status: 'sold', open_order: null }));
  };

  const handleCancelOrder = async () => {
    setCancelling(true);
    try {
      await orderAPI.cancelOrder(book.open_order.id);
      setBook((prev) => ({ ...prev, open_order: null }));
      toast.success('سفارش لغو شد.');
    } catch (error) {
      toast.error(getErrorMessage(error));
      refreshBook();
    } finally {
      setCancelling(false);
    }
  };

  if (loading) return <Loading fullPage />;
  if (loadError === 'not_found') {
    return (
      <NotFound
        title="این کتاب پیدا نشد"
        message="شاید آگهی‌اش حذف شده یا هنوز منتشر نشده است. نسخه‌های دیگر را در فهرست ببین."
      />
    );
  }
  if (loadError) {
    return (
      <Container className="py-5">
        <div className="list-state" role="alert">
          <p>کتاب بارگذاری نشد. اتصال اینترنت را بررسی کن و دوباره امتحان کن.</p>
          <Button variant="outline-secondary" onClick={handleRetry}>
            تلاش دوباره
          </Button>
        </div>
      </Container>
    );
  }
  if (!book) return null;

  const isOwner = isAuthenticated && user?.id === book.seller?.id;
  const openOrder = book.open_order;
  const canBuy = !isOwner && book.status === 'approved' && !openOrder;
  const canPay = !isOwner && book.status === 'approved' && openOrder?.is_mine;
  const showBuyBar = canBuy || canPay;

  const rootId = book.category ? book.category.parent || book.category.id : null;
  const ink = seriesInk(rootId);
  const price = Number(book.price).toLocaleString('fa-IR');
  const notes = book.description?.trim();
  const notesAreLong = notes && notes.length > LONG_NOTES;

  // آنچه در قاب خرید زیر قیمت می‌آید؛ هر حالت یک جمله‌ی روشن و حداکثر یک اقدام
  let status;
  if (isOwner) {
    status = {
      pending: <p>آگهی‌ات در صف بررسی است و پس از تأیید تیم ری‌بوک در فهرست عمومی دیده می‌شود.</p>,
      rejected: (
        <p>
          این آگهی تأیید نشد و فقط برای تو دیده می‌شود. برای پرسیدن دلیلش به{' '}
          <Link to="/support">پشتیبانی</Link> پیام بده.
        </p>
      ),
      sold: (
        <p>
          این کتاب فروخته شد. جزئیات خریدار و ارسال در <Link to="/my-orders">سفارش‌های من</Link> است.
        </p>
      ),
      approved: openOrder ? (
        <p>
          خریداری این کتاب را سفارش داده و پرداختش مانده است. اگر پرداخت نکرد، از{' '}
          <Link to="/my-orders">سفارش‌های من</Link> لغوش کن.
        </p>
      ) : (
        <p>این آگهی توست و در فهرست عمومی دیده می‌شود.</p>
      ),
    }[book.status];
  } else if (book.status === 'sold') {
    status = boughtByMe ? (
      <p>
        این کتاب را خریدی. وضعیت ارسال را در <Link to="/my-orders">سفارش‌های من</Link> دنبال کن.
      </p>
    ) : (
      <p>
        این نسخه فروخته شده است.{' '}
        {book.category && (
          <Link to={`/books?category=${book.category.slug}`}>نسخه‌های دیگر {book.category.name}</Link>
        )}
      </p>
    );
  } else if (openOrder?.is_mine) {
    status = <p>این کتاب را سفارش داده‌ای و پرداختش مانده است.</p>;
  } else if (openOrder) {
    status = (
      <p>این نسخه در انتظار پرداخت خریدار دیگری است. اگر خرید انجام نشود، دوباره قابل سفارش می‌شود.</p>
    );
  }

  const primaryAction = canBuy ? (
    <Button variant="primary" onClick={handleBuy} className="d-inline-flex align-items-center gap-2">
      <FiShoppingCart aria-hidden="true" />
      خرید
    </Button>
  ) : canPay ? (
    <Button variant="primary" onClick={() => setShowPurchase(true)}>
      پرداخت آزمایشی
    </Button>
  ) : null;

  return (
    <Container className="book-detail">
      <title>{`${book.title} | ری‌بوک`}</title>
      <Row className="g-4 g-lg-5">
        <Col lg={4}>
          <figure className="detail-cover" style={{ '--card-ink': ink }}>
            {book.cover_image ? (
              <img src={book.cover_image} alt={`جلد ${book.title}`} className="detail-cover-img" />
            ) : (
              <PlainCover title={book.title} author={book.author} rootId={rootId} className="detail-plain-cover" />
            )}
            <span className="book-card-band" aria-hidden="true" />
          </figure>
        </Col>

        <Col lg={8}>
          <header className="detail-head">
            {book.category && (
              <Link
                to={`/books?category=${book.category.slug}`}
                className="detail-category"
                style={{ '--series-ink': ink }}
              >
                <span className="series-index-mark" aria-hidden="true" />
                {book.category.name}
              </Link>
            )}
            <h1 className="detail-title">
              <bdi>{book.title}</bdi>
            </h1>
            <p className="detail-byline">
              <bdi>{book.author}</bdi>
              {book.publisher && (
                <>
                  <span aria-hidden="true"> · </span>
                  <span className="visually-hidden">، انتشارات </span>
                  <bdi>{book.publisher}</bdi>
                </>
              )}
            </p>
          </header>

          <section className="detail-block" aria-labelledby="condition-title">
            <h2 id="condition-title" className="detail-label">
              وضعیت ظاهری
            </h2>
            <ConditionMeasure condition={book.condition} label={book.condition_display} className="is-large" />
            {CONDITION_NOTES[book.condition] && <p className="detail-muted">{CONDITION_NOTES[book.condition]}</p>}
          </section>

          {notes && (
            <section className="detail-block" aria-labelledby="notes-title">
              <h2 id="notes-title" className="detail-label">
                یادداشت فروشنده
              </h2>
              <p id="seller-notes" className={`detail-notes${notesAreLong && !notesOpen ? ' is-clamped' : ''}`} dir="auto">
                {notes}
              </p>
              {notesAreLong && (
                <button
                  type="button"
                  className="detail-more"
                  aria-expanded={notesOpen}
                  aria-controls="seller-notes"
                  onClick={() => setNotesOpen((open) => !open)}
                >
                  {notesOpen ? 'کمتر' : 'ادامه‌ی یادداشت'}
                </button>
              )}
            </section>
          )}

          <section className="buy-panel" aria-label="خرید">
            <div className="buy-panel-top">
              <p className="buy-price">
                {price} <span className="book-card-currency">تومان</span>
              </p>
              <p className="buy-seller">
                فروشنده: <bdi className="latin-id">{book.seller?.username}</bdi>
              </p>
            </div>

            {status && <div className="buy-status">{status}</div>}

            <div className="buy-actions">
              {primaryAction && <span className="d-none d-lg-inline-flex">{primaryAction}</span>}
              {canPay && (
                <Button variant="outline-secondary" onClick={handleCancelOrder} disabled={cancelling}>
                  {cancelling ? 'در حال لغو...' : 'لغو سفارش'}
                </Button>
              )}
              {!isOwner && book.status === 'approved' && (
                <Button
                  variant="outline-secondary"
                  onClick={handleWishlistToggle}
                  aria-pressed={wishlisted}
                  className="d-inline-flex align-items-center gap-2"
                >
                  <FiHeart aria-hidden="true" fill={wishlisted ? 'currentColor' : 'none'} />
                  {wishlisted ? 'در علاقه‌مندی‌ها' : 'افزودن به علاقه‌مندی‌ها'}
                </Button>
              )}
            </div>

            {(book.status === 'approved' || book.status === 'sold') && (
              <p className="buy-review">این آگهی پیش از انتشار توسط تیم ری‌بوک بررسی شده است.</p>
            )}
          </section>

          <dl className="detail-facts">
            {book.publisher && (
              <>
                <dt>انتشارات</dt>
                <dd>
                  <bdi>{book.publisher}</bdi>
                </dd>
              </>
            )}
            {book.isbn && (
              <>
                <dt>شابک</dt>
                <dd>
                  <bdi dir="ltr">{book.isbn}</bdi>
                </dd>
              </>
            )}
            {book.category && (
              <>
                <dt>دسته‌بندی</dt>
                <dd>{book.category.name}</dd>
              </>
            )}
            <dt>تاریخ ثبت</dt>
            <dd>{formatDate(book.created_at)}</dd>
          </dl>
        </Col>
      </Row>

      {showBuyBar && (
        <div className="buy-bar d-lg-none">
          <p className="buy-price">
            {price} <span className="book-card-currency">تومان</span>
          </p>
          {primaryAction}
        </div>
      )}

      {showPurchase && (
        <PurchaseModal
          show
          onHide={() => setShowPurchase(false)}
          book={book}
          existingOrderId={canPay ? openOrder.id : null}
          defaultAddress={user?.address || ''}
          onPaid={handlePaid}
          onStale={refreshBook}
        />
      )}
    </Container>
  );
}

export default BookDetail;
