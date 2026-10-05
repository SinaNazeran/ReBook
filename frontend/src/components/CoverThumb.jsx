import { seriesInk } from '../utils/series';

/** جلد کوچک ردیف‌های «کتاب‌های من» و «معاملات من»؛ بی‌عکس، رنگ مجموعه‌ی کتاب */
function CoverThumb({ book }) {
  if (book?.cover_image) {
    return <img src={book.cover_image} alt="" className="cover-thumb" loading="lazy" />;
  }
  return <span className="cover-thumb" style={{ background: seriesInk(book?.category_root) }} aria-hidden="true" />;
}

export default CoverThumb;
