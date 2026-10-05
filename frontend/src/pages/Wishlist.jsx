import { useState, useEffect, useCallback } from 'react';
import { Container, Row, Col, Button } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { bookAPI, getErrorMessage } from '../services/api';
import BookCard from '../components/BookCard';
import Loading from '../components/Loading';

function Wishlist() {
  const [wishlist, setWishlist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let ignore = false;
    bookAPI
      .getWishlist()
      .then((response) => {
        if (!ignore) setWishlist(response.data.results ?? response.data);
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

  // خوش‌بینانه: کارت فوراً می‌رود؛ اگر درخواست نشد، سر جایش برمی‌گردد
  const handleRemove = useCallback(async (bookId) => {
    let removed;
    setWishlist((prev) => {
      removed = prev.find((item) => item.book.id === bookId);
      return prev.filter((item) => item.book.id !== bookId);
    });

    try {
      await bookAPI.toggleWishlist(bookId);
    } catch (error) {
      if (removed) setWishlist((prev) => [removed, ...prev]);
      toast.error(getErrorMessage(error));
    }
  }, []);

  if (loading) return <Loading fullPage />;

  return (
    <Container className="ledger-page">
      <title>علاقه‌مندی‌ها | ری‌بوک</title>
      <header className="ledger-header">
        <h1 className="ledger-title">
          علاقه‌مندی‌ها
          {!loadError && wishlist.length > 0 && (
            <span className="list-count">{wishlist.length.toLocaleString('fa-IR')} کتاب</span>
          )}
        </h1>
      </header>

      {loadError ? (
        <div className="list-state" role="alert">
          <p>علاقه‌مندی‌ها بارگذاری نشدند. اتصال اینترنت را بررسی کن و دوباره امتحان کن.</p>
          <Button variant="outline-secondary" onClick={handleRetry}>
            تلاش دوباره
          </Button>
        </div>
      ) : wishlist.length === 0 ? (
        <div className="list-state">
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
    </Container>
  );
}

export default Wishlist;
