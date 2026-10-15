import { useSubmissionGuard } from '../hooks/useSubmissionGuard';
import { usePagedList } from '../hooks/usePagedList';
import LoadMore from '../components/LoadMore';
import { useRef } from 'react';
import { Container, Row, Col, Button } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { toast } from '../utils/toast';
import { bookAPI, getErrorMessage } from '../services/api';
import BookCard from '../components/BookCard';
import Loading from '../components/Loading';
import EmptyShelf from '../components/EmptyShelf';

function Wishlist() {
  const { run, pending } = useSubmissionGuard();
  const list = usePagedList(bookAPI.getWishlist);
  const { items: wishlist, setItems: setWishlist, count, loading, loadError } = list;
  const revision = useRef(0);
  const handleRetry = () => { revision.current++; list.reload(); };


  // خوش‌بینانه: کارت فوراً می‌رود؛ اگر درخواست نشد، سر جایش برمی‌گردد
  const handleRemove = async (bookId) => {
    return run(async () => {
      const version = revision.current;
      const index = wishlist.findIndex(item => item.book.id === bookId);
      const removed = wishlist[index];
      setWishlist(prev => prev.filter(item => item.book.id !== bookId));
      try {
        await bookAPI.toggleWishlist(bookId);
        handleRetry();
      } catch (error) {
        if (version === revision.current && removed) setWishlist(current => {
          if (current.some(item => item.id === removed.id)) return current;
          const restored = [...current];
          restored.splice(Math.min(index, restored.length), 0, removed);
          return restored;
        });
        toast.error(getErrorMessage(error));
      }
    }, bookId);
  };

  if (loading) return <Loading fullPage />;

  return (
    <div className="series-paper">
      <Container className="ledger-page">
        <title>علاقه‌مندی‌ها | ری‌بوک</title>
        <header className="ledger-header">
          <h1 className="ledger-title">
            علاقه‌مندی‌ها
            {!loadError && wishlist.length > 0 && (
              <span className="list-count">{count.toLocaleString('fa-IR')} کتاب</span>
            )}
          </h1>
        </header>

        {pending.size > 0 && <p role="status">در حال ثبت علاقه‌مندی…</p>}
        {loadError ? (
          <div className="list-state" role="alert">
            <p>علاقه‌مندی‌ها بارگذاری نشدند. اتصال اینترنت را بررسی کن و دوباره امتحان کن.</p>
            <Button variant="outline-secondary" onClick={handleRetry}>
              تلاش دوباره
            </Button>
          </div>
        ) : wishlist.length === 0 ? (
          <div className="list-state">
            <EmptyShelf />
            <p>
              هنوز کتابی را نشان نکرده‌ای. روی قلبِ گوشه‌ی جلد هر کتاب بزن تا اینجا بماند و بعداً سراغش بیایی.
            </p>
            <Link to="/books" className="btn btn-primary">
              مرور کتاب‌ها
            </Link>
          </div>
        ) : (
          <>
            <h2 className="visually-hidden">کتاب‌های نشان‌شده</h2>
            <Row className="g-3 g-md-4">
              {wishlist.map((item) => (
                <Col key={item.id} xs={6} md={4} lg={3}>
                  <BookCard book={item.book} isWishlisted onToggleWishlist={handleRemove} />
                </Col>
              ))}
            </Row>
          </>
        )}
        {!loadError && <LoadMore {...list} />}
      </Container>
    </div>
  );
}

export default Wishlist;
