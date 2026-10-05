import React from 'react';
import { Card, Badge } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { FiHeart } from 'react-icons/fi';
import PlainCover from './PlainCover';
import { seriesInk } from '../utils/series';

// درجه‌ی وضعیت ظاهری روی مقیاس پنج‌تایی: طول بخش پرشده خودِ درجه است، بدون اتکا به رنگ
const CONDITION_STEPS = {
  new: 5,
  like_new: 4,
  good: 3,
  fair: 2,
  poor: 1,
};

// نگاشت وضعیت آگهی (نه وضعیت فیزیکی کتاب) — از کلاس‌های .status-* موجود در App.css استفاده می‌کند
const STATUS_CLASS_MAP = {
  pending: 'status-pending',
  approved: 'status-approved',
  rejected: 'status-rejected',
  sold: 'status-sold',
};

function formatPrice(price) {
  const numericPrice = Number(price);
  if (price == null || Number.isNaN(numericPrice)) {
    return null;
  }
  return numericPrice.toLocaleString('fa-IR');
}

/**
 * @param {object} book - شیء کتاب دریافتی از API
 * @param {boolean} [isWishlisted] - آیا این کتاب در علاقه‌مندی‌های کاربر است
 * @param {(bookId: number|string) => void} [onToggleWishlist] - در صورت پاس‌دادن،
 *   دکمه‌ی قلب روی کارت نمایش داده می‌شود.
 * @param {boolean} [showStatus] - نمایش badge وضعیت آگهی (در انتظار تأیید/فروخته‌شده و...)
 *   فقط باید در صفحاتی مثل «کتاب‌های من» فعال شود، نه در لیست عمومی.
 */
function BookCard({ book, isWishlisted = false, onToggleWishlist, showStatus = false }) {
  const handleWishlistClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onToggleWishlist?.(book.id);
  };

  const price = formatPrice(book.price);
  const conditionSteps = CONDITION_STEPS[book.condition];

  return (
    <Card className="book-card h-100" style={{ '--card-ink': seriesInk(book.category_root) }}>
      {onToggleWishlist && (
        <button
          type="button"
          onClick={handleWishlistClick}
          className="wishlist-toggle-btn"
          aria-label={isWishlisted ? 'حذف از علاقه‌مندی‌ها' : 'افزودن به علاقه‌مندی‌ها'}
          aria-pressed={isWishlisted}
        >
          <FiHeart
            className={isWishlisted ? 'text-danger' : 'text-muted'}
            fill={isWishlisted ? 'currentColor' : 'none'}
          />
        </button>
      )}

      {/* نشان وضعیت آگهی — فقط وقتی صراحتاً درخواست شده باشد (مثلاً در MyBooks) */}
      {showStatus && book.status && (
        <Badge
          bg=""
          className={`position-absolute top-0 end-0 m-2 ${STATUS_CLASS_MAP[book.status] || 'status-sold'}`}
          style={{ zIndex: 2 }}
        >
          {book.status_display || book.status}
        </Badge>
      )}

      {/* کل کارت با stretched-link عنوان کلیک‌پذیر است؛ جلد لینک جداگانه ندارد */}
      <div className="book-card-cover">
        {book.cover_image ? (
          <Card.Img
            variant="top"
            src={book.cover_image}
            alt=""
            loading="lazy"
            decoding="async"
          />
        ) : (
          <PlainCover
            title={book.title}
            author={book.author}
            rootId={book.category_root}
            className="card-img-top"
          />
        )}
      </div>

      {/* نوار مجموعه: تنها نشانه‌ی رنگی کارت جز جلد */}
      <div className="book-card-band" aria-hidden="true" />

      <Card.Body className="book-card-body">
        <Card.Title as="h3" className="book-card-title">
          <Link to={`/books/${book.id}`} className="stretched-link" dir="auto">
            {book.title}
          </Link>
        </Card.Title>

        <p className="book-card-meta">
          <span className="book-card-author" dir="auto">{book.author}</span>
          {book.category_name && <span className="book-card-category">{book.category_name}</span>}
        </p>

        <div className="book-card-facts">
          {conditionSteps && (
            <span className="condition-measure">
              <span className="condition-steps" aria-hidden="true">
                {[1, 2, 3, 4, 5].map((step) => (
                  <span key={step} className={step <= conditionSteps ? 'is-filled' : undefined} />
                ))}
              </span>
              <span className="condition-label">{book.condition_display}</span>
            </span>
          )}

          <span className="book-card-price">
            {price ? (
              <>
                {price} <span className="book-card-currency">تومان</span>
              </>
            ) : (
              'قیمت نامشخص'
            )}
          </span>
        </div>
      </Card.Body>
    </Card>
  );
}

// جای کارت در حال بارگذاری: همان قاب جلد ۳:۴ و نوار، تا با رسیدن داده چیزی جابه‌جا نشود
export function BookCardSkeleton() {
  return (
    <div className="book-card-skeleton" aria-hidden="true">
      <span className="book-card-skeleton-cover" />
      <span className="book-card-skeleton-line" />
      <span className="book-card-skeleton-line is-short" />
    </div>
  );
}

export default React.memo(BookCard);
