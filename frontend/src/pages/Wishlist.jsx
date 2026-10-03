import { useState, useEffect, useCallback } from 'react';
import { Container, Row, Col, Card } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { bookAPI, getErrorMessage } from '../services/api';
import BookCard from '../components/BookCard';
import Loading from '../components/Loading';
import { FiHeart } from 'react-icons/fi';

function Wishlist() {
  const [wishlist, setWishlist] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWishlist = async () => {
      try {
        const response = await bookAPI.getWishlist();
        setWishlist(response.data.results ?? response.data);
      } catch (error) {
        toast.error(getErrorMessage(error));
      } finally {
        setLoading(false);
      }
    };
    fetchWishlist();
  }, []);

  const handleRemoveFromWishlist = useCallback(async (bookId) => {
    // بروزرسانی خوش‌بینانه: کارت فوراً از لیست حذف می‌شود
    const previousWishlist = wishlist;
    setWishlist((prev) => prev.filter((item) => item.book.id !== bookId));

    try {
      await bookAPI.toggleWishlist(bookId);
      toast.success('از علاقه‌مندی‌ها حذف شد.');
    } catch (error) {
      // در صورت شکست درخواست، لیست به حالت قبل بازمی‌گردد
      setWishlist(previousWishlist);
      toast.error(getErrorMessage(error));
    }
  }, [wishlist]);

  if (loading) return <Loading fullPage />;

  return (
    <Container className="py-5">
      <h1 className="h3 mb-4 d-flex align-items-center gap-2">
        <FiHeart />
        علاقه‌مندی‌ها
      </h1>

      {wishlist.length === 0 ? (
        <Card className="text-center py-5 border-0 shadow-sm">
          <Card.Body>
            <FiHeart size={64} className="text-muted" aria-hidden="true" />
            <h2 className="h5 mt-3">لیست علاقه‌مندی شما خالی است</h2>
            <p className="text-muted">
              کتاب‌های موردعلاقه‌تان را نشان کنید تا اینجا نمایش داده شوند.
            </p>
            <Link to="/books" className="btn btn-primary mt-2">
              مشاهده کتاب‌ها
            </Link>
          </Card.Body>
        </Card>
      ) : (
        <Row className="g-4">
          {wishlist.map((item) => (
            <Col key={item.id} xs={12} sm={6} md={4} lg={3}>
              <BookCard
                book={item.book}
                isWishlisted={true}
                onToggleWishlist={handleRemoveFromWishlist}
              />
            </Col>
          ))}
        </Row>
      )}
    </Container>
  );
}

export default Wishlist;