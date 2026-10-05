import { seriesInk } from '../utils/series';

/**
 * جلد تایپوگرافیک برای کتاب بی‌عکس، به سبک کتاب جیبی: عنوان و نویسنده روی مرکب مجموعه‌ی کتاب.
 * در کارت و صفحه‌ی جزئیات یکی است تا یک کتاب همه‌جا یک جلد داشته باشد.
 * @param {number|null} rootId - شناسه‌ی دسته‌بندی سطح اول
 */
function PlainCover({ title, author, rootId, className = '' }) {
  return (
    <div className={`plain-cover ${className}`} style={{ '--cover-ink': seriesInk(rootId) }}>
      <span className="plain-cover-title" dir="auto">{title}</span>
      {author && <span className="plain-cover-author" dir="auto">{author}</span>}
    </div>
  );
}

export default PlainCover;
