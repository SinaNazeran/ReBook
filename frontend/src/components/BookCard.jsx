import React from 'react';
import { Card } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { FiHeart } from 'react-icons/fi';
import PlainCover from './PlainCover';
import ConditionMeasure from './ConditionMeasure';
import { seriesInk } from '../utils/series';

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
 */
function BookCard({ book, isWishlisted = false, onToggleWishlist }) {
  const handleWishlistClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onToggleWishlist?.(book.id);
  };

  const price = formatPrice(book.price);

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
          <ConditionMeasure condition={book.condition} label={book.condition_display} />

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
