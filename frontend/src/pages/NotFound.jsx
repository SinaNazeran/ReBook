import { Link } from 'react-router-dom';
import { FiBookOpen, FiHome } from 'react-icons/fi';

function NotFound() {
  return (
    <div className="container text-center py-5">
      <FiBookOpen size={56} className="mb-3" style={{ color: 'var(--rb-primary)' }} />
      <h2 className="mb-2">این صفحه پیدا نشد</h2>
      <p className="text-muted mb-4">
        صفحه‌ای که دنبال آن بودید حذف شده یا هرگز وجود نداشته است.
      </p>
      <Link to="/" className="btn btn-primary">
        <FiHome className="me-2" />
        بازگشت به صفحه اصلی
      </Link>
    </div>
  );
}

export default NotFound;