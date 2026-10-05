import { Link } from 'react-router-dom';
import PlainCover from '../components/PlainCover';

/**
 * صفحه‌ی ۴۰۴؛ صفحه‌ی کتاب هم برای کتاب ناموجود همین را با متن خودش نشان می‌دهد.
 * جلدِ ساده‌ی خاکستری یعنی جای خالی یک کتاب در قفسه.
 */
function NotFound({
  title = 'این صفحه پیدا نشد',
  message = 'نشانی‌ای که باز کردی در ری‌بوک وجود ندارد؛ شاید اشتباه نوشته شده یا صفحه حذف شده است.',
}) {
  return (
    <div className="container not-found">
      <div className="not-found-cover" aria-hidden="true">
        <PlainCover title="۴۰۴" author="ری‌بوک" rootId={null} />
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
  );
}

export default NotFound;
