import { Link } from 'react-router-dom';
import PlainCover from '../components/PlainCover';

// کتاب گم‌شده جلد رنگی مجموعه‌ی ۶ (مرکب گل‌سرخی) را دارد؛ کاغذ صفحه هم همان مجموعه است (App.css)
const LOST_BOOK_SERIES = 5;

// عطف‌های قفسه، از سمت شروع؛ null جای خالی کتاب گم‌شده است
const SHELF = [
  { series: 1, height: '86%' },
  { series: 3, height: '94%' },
  null,
  { series: 2, height: '80%' },
  { series: 8, height: '90%' },
  { series: 4, height: '84%' },
  { series: 7, height: '92%' },
];

/**
 * صفحه‌ی ۴۰۴؛ صفحه‌ی کتاب هم برای کتاب ناموجود همین را با متن خودش نشان می‌دهد.
 * کتاب گم‌شده جای خالی‌اش را در قفسه دارد و خودش کنار قفسه کج افتاده است.
 */
function NotFound({
  title = 'این صفحه پیدا نشد',
  message = 'نشانی‌ای که باز کردی در ری‌بوک وجود ندارد؛ شاید اشتباه نوشته شده یا صفحه حذف شده است.',
}) {
  return (
    <div className="series-paper" style={{ '--series': 'var(--rb-series-6)' }}>
      <div className="container not-found">
        <title>{`${title} | ری‌بوک`}</title>
        {/* صحنه: قفسه‌ای با یک جای خالی، و کتاب گم‌شده که از قفسه افتاده و به آن تکیه داده است */}
        <div className="lost-scene" aria-hidden="true">
          <div className="lost-book">
            <PlainCover title="۴۰۴" rootId={LOST_BOOK_SERIES} />
          </div>
          <div className="lost-shelf">
            {SHELF.map((spine, i) =>
              spine ? (
                <span
                  key={i}
                  className="lost-spine"
                  style={{ '--series-ink': `var(--rb-series-${spine.series})`, height: spine.height }}
                />
              ) : (
                <span key={i} className="lost-gap" />
              )
            )}
          </div>
        </div>
        <div className="not-found-body">
          <h1 className="not-found-title">{title}</h1>
          <p className="not-found-text">{message}</p>
          <div className="d-flex flex-wrap gap-2">
            <Link to="/books" className="btn btn-primary">
              مرور کتاب‌ها
            </Link>
            <Link to="/" className="btn btn-outline-secondary">
              صفحه‌ی اصلی
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default NotFound;
