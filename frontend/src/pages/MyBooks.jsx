import { formatPersianDate as formatDate } from '../utils/locale';
import { usePagedList } from '../hooks/usePagedList';
import LoadMore from '../components/LoadMore';
import { useState } from 'react';
import { Container, Button } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { toast } from '../utils/toast';
import { FiPlusCircle, FiTrash2, FiEdit2 } from 'react-icons/fi';
import { bookAPI, getErrorMessage } from '../services/api';
import Loading from '../components/Loading';
import StatusMark from '../components/StatusMark';
import CoverThumb from '../components/CoverThumb';
import EmptyShelf from '../components/EmptyShelf';
import { seriesInk } from '../utils/series';

// وضعیت آگهی از نگاه فروشنده؛ هر کدام یک جمله‌ی کوتاه درباره‌ی قدم بعد
const LISTING_STATUS = {
  pending: { tone: 'waiting', label: 'در انتظار بررسی', note: 'پس از تأیید تیم ری‌بوک در فهرست دیده می‌شود.' },
  approved: { tone: 'done', label: 'در فهرست' },
  rejected: { tone: 'closed', label: 'تأیید نشد', note: 'فقط برای تو دیده می‌شود.' },
  sold: { tone: 'sold', label: 'فروخته شد' },
};

function MyBooks() {
  const list = usePagedList(bookAPI.getMyBooks);
  const { items: books, count, loading, loadError, reload: handleRetry } = list;
  const [deletingId, setDeletingId] = useState(null);


  const handleDelete = async (book) => {
    if (!window.confirm(`آگهی «${book.title}» حذف شود؟ این کار برگشت‌پذیر نیست.`)) return;

    setDeletingId(book.id);
    try {
      await bookAPI.deleteBook(book.id);
      handleRetry();
      toast.success('آگهی حذف شد.');
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) return <Loading fullPage />;

  return (
    <div className="series-paper">
      <Container className="ledger-page">
        <title>کتاب‌های من | ری‌بوک</title>
        <header className="ledger-header">
          <h1 className="ledger-title">
            کتاب‌های من
            {!loadError && books.length > 0 && (
              <span className="list-count">{count.toLocaleString('fa-IR')} آگهی</span>
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
                <li key={book.id} className="ledger-row" style={{ '--card-ink': seriesInk(book.category_root) }}>
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
                  <span className="ledger-amount price-tag">
                    {Number(book.price).toLocaleString('fa-IR')} <span className="book-card-currency">تومان</span>
                  </span>
                  <span className="ledger-status">
                    <StatusMark tone={status.tone}>{status.label}</StatusMark>
                  </span>
                  <span className="ledger-actions">
                    {book.status !== 'sold' && (
                      <Link
                        to={`/books/${book.id}/edit`}
                        className="btn btn-outline-secondary ledger-icon-btn"
                        aria-label={`ویرایش آگهی ${book.title}`}
                        title="ویرایش آگهی"
                      >
                        <FiEdit2 aria-hidden="true" />
                      </Link>
                    )}
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
        {!loadError && <LoadMore {...list} />}
      </Container>
    </div>
  );
}

export default MyBooks;
