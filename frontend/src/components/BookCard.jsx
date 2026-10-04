import React from 'react';
import { Card, Badge } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { FiBookOpen, FiHeart } from 'react-icons/fi';

const CONDITION_CLASS_MAP = {
  new: 'badge-condition-new',
  like_new: 'badge-condition-like-new',
  good: 'badge-condition-good',
  fair: 'badge-condition-fair',
  poor: 'badge-condition-poor',
};

// نگاشت وضعیت آگهی (نه وضعیت فیزیکی کتاب) — از کلاس‌های .status-* موجود در App.css استفاده می‌کند
const STATUS_CLASS_MAP = {
  pending: 'status-pending',
  approved: 'status-approved',
  rejected: 'status-rejected',
  sold: 'status-sold',
};

function getConditionClass(condition) {
  return CONDITION_CLASS_MAP[condition] || 'badge-condition-poor';
}

function formatPrice(price) {
  const numericPrice = Number(price);
  if (price == null || Number.isNaN(numericPrice)) {
    return 'قیمت نامشخص';
  }
  return `${numericPrice.toLocaleString('fa-IR')} تومان`;
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

  return (
    <Card className="book-card h-100 shadow-sm position-relative">
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

      <Link to={`/books/${book.id}`} tabIndex={-1} aria-hidden="true" className="text-decoration-none">
        {book.cover_image ? (
          <Card.Img
            variant="top"
            src={book.cover_image}
            alt={book.title}
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="card-img-top d-flex align-items-center justify-content-center bg-light">
            <FiBookOpen size={56} className="text-muted" />
          </div>
        )}
      </Link>

      <Card.Body className="d-flex flex-column">
        <Card.Title className="text-dark">
          <Link to={`/books/${book.id}`} className="text-decoration-none text-dark">
            {book.title}
          </Link>
        </Card.Title>

        <Card.Text className="text-muted mb-1">نویسنده: {book.author}</Card.Text>

        {book.category_name && (
          <Card.Text className="text-muted mb-2">
            <small>دسته‌بندی: {book.category_name}</small>
          </Card.Text>
        )}

        <div className="mt-auto d-flex justify-content-between align-items-center">
          <span className="fw-bold text-primary fs-6">{formatPrice(book.price)}</span>

          {book.condition_display && (
            <Badge bg="" className={getConditionClass(book.condition)}>{book.condition_display}</Badge>
          )}
        </div>
      </Card.Body>
    </Card>
  );
}

export default React.memo(BookCard);