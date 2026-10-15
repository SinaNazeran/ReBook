import { Link } from "react-router-dom";
import { FiEdit2, FiHeart } from "react-icons/fi";
import { Button } from "react-bootstrap";
export function BookPurchasePanel({
  price,
  book,
  status,
  primaryAction,
  canEdit,
  canPay,
  handleCancelOrder,
  cancelling,
  isInCart,
  handleRemoveFromCart,
  cartBusy,
  isOwner,
  handleWishlistToggle,
  wishlisted,
  wishlistBusy,
  cartMessage
}) {
  return <section className="buy-panel" aria-label="خرید">
              <div className="buy-panel-top">
                <p className="buy-price">
                  <span className="price-tag">
                    {price} <span className="book-card-currency">تومان</span>
                  </span>
                </p>
                <p className="buy-seller">
                  فروشنده: <bdi translate="no" className="latin-id">{book.seller?.username}</bdi>
                </p>
              </div>

              {status && <div className="buy-status">{status}</div>}

              <div className="buy-actions">
                {primaryAction && <span className="d-none d-lg-inline-flex">{primaryAction}</span>}
                {canEdit && <Link to={`/books/${book.id}/edit`} className="btn btn-outline-primary d-inline-flex align-items-center gap-2">
                    <FiEdit2 aria-hidden="true" />
                    ویرایش آگهی
                  </Link>}
                {canPay && <Button variant="outline-secondary" onClick={handleCancelOrder} disabled={cancelling}>
                    {cancelling ? 'در حال لغو…' : 'لغو سفارش'}
                  </Button>}
                {isInCart && <Button variant="link" className="buy-cart-remove" onClick={handleRemoveFromCart} disabled={cartBusy}>
                    حذف از سبد
                  </Button>}
                {!isOwner && book.status === 'approved' && <Button variant="outline-secondary" onClick={handleWishlistToggle} disabled={wishlistBusy} aria-busy={wishlistBusy} aria-pressed={wishlisted} className="d-inline-flex align-items-center gap-2">
                    <FiHeart aria-hidden="true" fill={wishlisted ? 'currentColor' : 'none'} />
                    {wishlistBusy ? 'در حال ثبت…' : wishlisted ? 'در علاقه‌مندی‌ها' : 'افزودن به علاقه‌مندی‌ها'}
                  </Button>}
              </div>
              <p className="visually-hidden" role="status">
                {cartMessage}
              </p>

              {(book.status === 'approved' || book.status === 'sold') && <p className="buy-review">این آگهی پیش از انتشار توسط تیم ری‌بوک بررسی شده است.</p>}
            </section>;
}
