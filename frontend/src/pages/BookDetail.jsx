import { useState } from "react";
import { useBookDetail } from "../features/book-detail/useBookDetail.js";
import { useBookActions } from "../features/book-detail/useBookActions.js";
import Loading from "../components/Loading";
import NotFound from "./NotFound";
import { Container, Button, Row, Col } from "react-bootstrap";
import { seriesInk } from "../utils/series";
import { Link } from "react-router-dom";
import { FiShoppingCart } from "react-icons/fi";
import PlainCover from "../components/PlainCover";
import { BookDetails } from "../features/book-detail/BookDetails.jsx";
import { BookPurchasePanel } from "../features/book-detail/BookPurchasePanel.jsx";
import PurchaseModal from "../components/PurchaseModal";
function BookDetail() {
  const detail = useBookDetail();
  const [notesOpen, setNotesOpen] = useState(false);
  const {
    user,
    isAuthenticated,
    book,
    loading,
    loadError,
    wishlisted,
    payingOrderId,
    setPayingOrderId,
    boughtByMe,
    cancelling,
    cartBusy,
    cartUnavailable,
    cartMessage,
    isInCart,
    handleRetry,
    refreshBook
  } = detail;
  const {
    wishlistBusy,
    handleWishlistToggle,
    handleAddToCart,
    handleRemoveFromCart,
    handlePaid,
    handleCancelOrder
  } = useBookActions(detail);
  if (loading) return <Loading fullPage />;
  if (loadError === 'not_found') {
    return <NotFound title="این کتاب پیدا نشد" message="شاید آگهی‌اش حذف شده یا هنوز منتشر نشده است. نسخه‌های دیگر را در فهرست ببین." />;
  }
  if (loadError) {
    return <Container className="py-5">
        <div className="list-state" role="alert">
          <p>کتاب بارگذاری نشد. اتصال اینترنت را بررسی کن و دوباره امتحان کن.</p>
          <Button variant="outline-secondary" onClick={handleRetry}>
            تلاش دوباره
          </Button>
        </div>
      </Container>;
  }
  if (!book) return null;
  const isOwner = isAuthenticated && user?.id === book.seller?.id;
  const openOrder = book.open_order;
  const canBuy = !isOwner && book.status === 'approved' && !openOrder;
  const canPay = !isOwner && book.status === 'approved' && openOrder?.is_mine;
  const showBuyBar = canBuy || canPay;
  // فروشنده آگهی‌اش را ویرایش می‌کند، جز فروخته‌شده یا وقتی خریداری سفارش داده و پرداختش مانده (سرور هم رد می‌کند)
  const canEdit = isOwner && book.status !== 'sold' && !openOrder;
  const rootId = book.category ? book.category.parent || book.category.id : null;
  const ink = seriesInk(rootId);
  const price = Number(book.price).toLocaleString('fa-IR');

  // آنچه در قاب خرید زیر قیمت می‌آید؛ هر حالت یک جمله‌ی روشن و حداکثر یک اقدام
  let status;
  if (isOwner) {
    status = {
      pending: <p>آگهی‌ات در صف بررسی است و پس از تأیید تیم ری‌بوک در فهرست عمومی دیده می‌شود.</p>,
      rejected: <p>
          این آگهی تأیید نشد و فقط برای تو دیده می‌شود. ویرایشش کن و دوباره برای بررسی بفرست؛ دلیلش را از{' '}
          <Link to="/support">پشتیبانی</Link> بپرس.
        </p>,
      sold: <p>
          این کتاب فروخته شد. جزئیات خریدار و ارسال در <Link to="/my-orders?tab=sales">معاملات من</Link> است.
        </p>,
      approved: openOrder ? <p>
          خریداری این کتاب را سفارش داده و پرداختش مانده است. اگر پرداخت نکرد، از{' '}
          <Link to="/my-orders?tab=sales">معاملات من</Link> لغوش کن.
        </p> : <p>این آگهی توست و در فهرست عمومی دیده می‌شود.</p>
    }[book.status];
  } else if (book.status === 'sold') {
    status = boughtByMe ? <p>
        این کتاب را خریدی. وضعیت ارسال را در <Link to="/my-orders">معاملات من</Link> دنبال کن.
      </p> : <p>
        این نسخه فروخته شده است.{' '}
        {book.category && <Link to={`/books?category=${book.category.slug}`}>نسخه‌های دیگر {book.category.name}</Link>}
      </p>;
  } else if (openOrder?.is_mine) {
    status = <p>این کتاب را سفارش داده‌ای و پرداختش مانده است.</p>;
  } else if (openOrder) {
    status = <p>این نسخه در انتظار پرداخت خریدار دیگری است. اگر خرید انجام نشود، دوباره قابل سفارش می‌شود.</p>;
  }
  const primaryAction = canBuy ? isInCart ? <Link to="/cart" className="btn btn-primary buy-cart-link d-inline-flex align-items-center gap-2">
        <FiShoppingCart aria-hidden="true" />
        در سبد است · مشاهده‌ی سبد
      </Link> : <Button variant="primary" onClick={handleAddToCart} disabled={cartBusy || cartUnavailable} className="d-inline-flex align-items-center gap-2">
        <FiShoppingCart aria-hidden="true" />
        {cartUnavailable ? 'ابتدا وضعیت ورود را بررسی کن' : cartBusy ? 'در حال افزودن…' : 'افزودن به سبد'}
      </Button> : canPay ? <Button variant="primary" onClick={() => setPayingOrderId(openOrder.id)}>
      پرداخت آزمایشی
    </Button> : null;
  return <div className="series-paper" style={{
    '--series': ink
  }}>
      <Container className="book-detail">
        <title>{`${book.title} | ری‌بوک`}</title>
        <Row className="g-4 g-lg-5">
          <Col lg={4}>
            <figure className={`detail-cover${book.cover_width ? ' is-sized' : ''}`} style={{
            '--card-ink': ink,
            ...(book.cover_width && {
              '--cover-w': book.cover_width,
              '--cover-ratio': book.cover_width / book.cover_height
            })
          }}>
              {book.cover_image ? <div className="book-cover-hinge">
                  <img src={book.cover_image} alt={`جلد ${book.title}`} className="detail-cover-img" width={book.cover_width ?? undefined} height={book.cover_height ?? undefined} fetchPriority="high" />
                </div> : <PlainCover title={book.title} author={book.author} rootId={rootId} className="detail-plain-cover" />}
              <div className="book-card-band">
                {book.category && <span className="book-card-series">{book.category.name}</span>}
              </div>
            </figure>
          </Col>

          <Col lg={8}>
<BookDetails book={book} ink={ink} notesOpen={notesOpen} setNotesOpen={setNotesOpen}>
<BookPurchasePanel price={price} book={book} status={status} primaryAction={primaryAction} canEdit={canEdit} canPay={canPay} handleCancelOrder={handleCancelOrder} cancelling={cancelling} isInCart={isInCart} handleRemoveFromCart={handleRemoveFromCart} cartBusy={cartBusy || cartUnavailable} isOwner={isOwner} handleWishlistToggle={handleWishlistToggle} wishlisted={wishlisted} wishlistBusy={wishlistBusy} cartMessage={cartMessage} />
</BookDetails>
          </Col>
        </Row>

        {showBuyBar && <div className="buy-bar d-lg-none">
            <p className="buy-price">
              {price} <span className="book-card-currency">تومان</span>
            </p>
            {primaryAction}
          </div>}

        {payingOrderId !== null && <PurchaseModal show onHide={() => setPayingOrderId(null)} book={book} existingOrderId={payingOrderId} onPaid={handlePaid} onStale={refreshBook} />}
      </Container>
    </div>;
}
export default BookDetail;
