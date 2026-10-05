import { seriesInk } from '../utils/series';
import BrandMark from './BrandMark';

/**
 * جلد تایپوگرافیک برای کتاب بی‌عکس، به سبک کتاب جیبی: نام مجموعه بالا، عنوان و نویسنده پایین،
 * و سطر ناشر زیر خط مویی. در کارت و صفحه‌ی جزئیات یکی است تا یک کتاب همه‌جا یک جلد داشته باشد.
 * @param {number|null} rootId - شناسه‌ی دسته‌بندی سطح اول (مرکب جلد)
 * @param {string} [series] - نام دسته‌ی کتاب، بالای جلد
 */
function PlainCover({ title, author, rootId, series, className = '' }) {
  return (
    <div className={`plain-cover ${className}`} style={{ '--cover-ink': seriesInk(rootId) }}>
      {series && <span className="plain-cover-series">{series}</span>}
      <span className="plain-cover-title" dir="auto">{title}</span>
      {author && <span className="plain-cover-author" dir="auto">{author}</span>}
      <span className="plain-cover-imprint" translate="no">
        <BrandMark mono />
        ری‌بوک
      </span>
    </div>
  );
}

export default PlainCover;
