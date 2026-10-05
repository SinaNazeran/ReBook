import { useState, useEffect } from 'react';
import { Container, Button } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FiPlusCircle, FiTrash2 } from 'react-icons/fi';
import { bookAPI, getErrorMessage } from '../services/api';
import Loading from '../components/Loading';
import StatusMark from '../components/StatusMark';
import CoverThumb from '../components/CoverThumb';
import EmptyShelf from '../components/EmptyShelf';

// وضعیت آگهی از نگاه فروشنده؛ هر کدام یک جمله‌ی کوتاه درباره‌ی قدم بعد
const LISTING_STATUS = {
  pending: { tone: 'waiting', label: 'در انتظار بررسی', note: 'پس از تأیید تیم ری‌بوک در فهرست دیده می‌شود.' },
  approved: { tone: 'done', label: 'در فهرست' },
  rejected: { tone: 'closed', label: 'تأیید نشد', note: 'فقط برای تو دیده می‌شود.' },
  sold: { tone: 'sold', label: 'فروخته شد' },
};

const formatDate = (value) => new Date(value).toLocaleDateString('fa-IR');

function MyBooks() {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    let ignore = false;
    bookAPI
      .getMyBooks()
      .then((response) => {
        if (!ignore) setBooks(response.data.results ?? response.data);
      })
      .catch(() => {
        if (!ignore) setLoadError(true);
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [reloadKey]);

  const handleRetry = () => {
    setLoadError(false);
    setLoading(true);
    setReloadKey((key) => key + 1);
  };

  const handleDelete = async (book) => {
    if (!window.confirm(`آگهی «${book.title}» حذف شود؟ این کار برگشت‌پذیر نیست.`)) return;

    setDeletingId(book.id);
    try {
      await bookAPI.deleteBook(book.id);
      setBooks((prev) => prev.filter((b) => b.id !== book.id));
      toast.success('آگهی حذف شد.');
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) return <Loading fullPage />;

  return (
    <Container className="ledger-page">
      <title>کتاب‌های من | ری‌بوک</title>
      <header className="ledger-header">
        <h1 className="ledger-title">
          کتاب‌های من
          {!loadError && books.length > 0 && (
            <span className="list-count">{books.length.toLocaleString('fa-IR')} آگهی</span>
          )}
        </h1>
        <Link to="/create-book" className="btn btn-primary d-inline-flex align-items-center gap-2">
          <FiPlusCircle aria-hidden="true" />
          فروش کتاب
        </Link>
      </header>

      {loadError ? (
        <div className="list-state" role="alert">
          <p>آگهی‌هایت بارگذاری نشدند. اتصال اینترنت را بررسی کن و دوباره امتحان کن.</p>
          <Button variant="outline-secondary" onClick={handleRetry}>
            تلاش دوباره
          </Button>
        </div>
      ) : books.length === 0 ? (
        <div className="list-state">
          <EmptyShelf />
          <p>هنوز کتابی برای فروش نگذاشته‌ای. کتابی که خوانده‌ای و دیگر سراغش نمی‌روی، اینجا خریدار پیدا می‌کند.</p>
          <Link to="/create-book" className="btn btn-primary">
            فروش کتاب
          </Link>
        </div>
      ) : (
        <ul className="ledger">
          {books.map((book) => {
            const status = LISTING_STATUS[book.status] ?? { tone: 'closed', label: book.status_display };
            return (
              <li key={book.id} className="ledger-row">
                <CoverThumb book={book} />
                <div className="ledger-main">
                  <Link to={`/books/${book.id}`} className="ledger-name">
                    <bdi>{book.title}</bdi>
                  </Link>
                  <span className="ledger-meta">
                    <bdi>{book.author}</bdi>
                    <span aria-hidden="true"> · </span>
                    <span className="visually-hidden">، ثبت در </span>
                    {formatDate(book.created_at)}
                  </span>
                  {status.note && (
                    <span className="ledger-note">
                      {status.note}
                      {book.status === 'rejected' && (
                        <>
                          {' '}
                          دلیلش را از <Link to="/support">پشتیبانی</Link> بپرس.
                        </>
                      )}
                    </span>
                  )}
                </div>
                <span className="ledger-amount">
                  {Number(book.price).toLocaleString('fa-IR')} <span className="book-card-currency">تومان</span>
                </span>
                <span className="ledger-status">
                  <StatusMark tone={status.tone}>{status.label}</StatusMark>
                </span>
                <span className="ledger-actions">
                  {book.status !== 'sold' && (
                    <Button
                      variant="outline-secondary"
                      className="ledger-icon-btn"
                      onClick={() => handleDelete(book)}
                      disabled={deletingId === book.id}
                      aria-label={`حذف آگهی ${book.title}`}
                      title="حذف آگهی"
                    >
                      <FiTrash2 aria-hidden="true" />
                    </Button>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Container>
  );
}

export default MyBooks;
