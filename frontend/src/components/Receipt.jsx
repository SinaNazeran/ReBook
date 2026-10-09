import { useState } from 'react';
import { Button } from 'react-bootstrap';
import { FiCopy, FiCheck } from 'react-icons/fi';
import { seriesInk } from '../utils/series';

/**
 * رسید خرید: برچسب «اکس‌لیبریس» که داخل جلد کتاب می‌چسبانند، و کد پیگیری.
 * یک کتاب: مرکب مجموعه‌ی همان کتاب؛ چند کتاب: مرکب برند. والد باید .purchase-receipt باشد (حرکت مهر در depth.css).
 * @param {Array<{id: number, title: string, author?: string, category_root?: number}>} books
 */
function Receipt({ books, trackingCode, note }) {
  const [copied, setCopied] = useState(false);
  const single = books.length === 1 ? books[0] : null;
  const ink = single ? seriesInk(single.category_root) : 'var(--rb-brand)';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(trackingCode);
      setCopied(true);
    } catch {
      // کلیپ‌بورد در دسترس نیست (مثلاً http بدون localhost)؛ کد روی صفحه انتخاب‌شدنی است
    }
  };

  return (
    <>
      <div className="bookplate" style={{ '--series': ink }}>
        <p className="bookplate-title display-type">از کتابخانه‌ی تو</p>
        <span className="ornament-rule" aria-hidden="true" />
        {single ? (
          <>
            <p className="bookplate-book display-type">
              <bdi>{single.title}</bdi>
            </p>
            {single.author && (
              <p className="bookplate-author">
                <bdi>{single.author}</bdi>
              </p>
            )}
          </>
        ) : (
          <ul className="bookplate-list">
            {books.map((book) => (
              <li key={book.id} className="bookplate-book display-type">
                <bdi>{book.title}</bdi>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="bookplate-note">{note}</p>
      <div className="receipt-code">
        <span className="receipt-code-label">کد پیگیری</span>
        <bdi translate="no" className="receipt-code-value latin-id" dir="ltr">
          {trackingCode}
        </bdi>
        <Button variant="outline-secondary" size="sm" className="d-inline-flex align-items-center gap-1" onClick={handleCopy}>
          {copied ? <FiCheck aria-hidden="true" /> : <FiCopy aria-hidden="true" />}
          {copied ? 'کپی شد' : 'کپی'}
        </Button>
      </div>
    </>
  );
}

export default Receipt;
