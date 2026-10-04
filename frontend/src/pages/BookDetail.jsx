import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Container, Row, Col, Card, Badge, Alert, Modal, Form, Button } from 'react-bootstrap';
import { bookAPI, orderAPI, getErrorMessage } from '../services/api';
import { useAuth } from '../context/useAuth.js';
import Loading from '../components/Loading';
import { toast } from 'react-toastify';
import { FiHeart, FiShoppingCart, FiUser, FiBookOpen } from 'react-icons/fi';

const CONDITION_CLASS_MAP = {
  new: 'badge-condition-new',
  like_new: 'badge-condition-like-new',
  good: 'badge-condition-good',
  fair: 'badge-condition-fair',
  poor: 'badge-condition-poor',
};

function BookDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated } = useAuth();

  const [book, setBook] = useState(null);
  const [loading, setLoading] = useState(true);
  const [wishlisted, setWishlisted] = useState(false);

  // مودال خرید
  const [showModal, setShowModal] = useState(false);
  const [shippingAddress, setShippingAddress] = useState('');
  const [orderLoading, setOrderLoading] = useState(false);

  useEffect(() => {
    let ignore = false;

    bookAPI
      .getBook(id)
      .then((response) => {
        if (!ignore) {
          setBook(response.data);
          setWishlisted(response.data.is_wishlisted || false);
        }
      })
      .catch((error) => {
        if (!ignore) {
          toast.error(getErrorMessage(error));
          navigate('/books');
        }
      })
      .finally(() => {
        if (!ignore) {
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [id, navigate]);

  const handleWishlistToggle = async () => {
    if (!isAuthenticated) {
      toast.warning('لطفاً ابتدا وارد شوید.');
      navigate('/login', { state: { from: location } });
      return;
    }

    const prevState = wishlisted;
    setWishlisted(!prevState); // آپدیت خوش‌بینانه

    try {
      const response = await bookAPI.toggleWishlist(id);
      setWishlisted(response.data.wishlisted);
      toast.success(response.data.message);
    } catch (error) {
      setWishlisted(prevState); // برگشت در صورت خطا
      toast.error(getErrorMessage(error));
    }
  };

  const handleOpenModal = () => {
    if (!isAuthenticated) {
      toast.warning('لطفاً ابتدا وارد شوید.');
      navigate('/login', { state: { from: location } });
      return;
    }
    setShippingAddress(user?.address || '');
    setShowModal(true);
  };

  const handleOrder = async (e) => {
    e.preventDefault();

    if (!shippingAddress.trim()) {
      toast.warning('لطفاً آدرس ارسال را وارد کنید.');
      return;
    }

    setOrderLoading(true);
    try {
      await orderAPI.createOrder({
        book: book.id,
        shipping_address: shippingAddress,
      });
      toast.success('سفارش با موفقیت ثبت شد!');
      setShowModal(false);
      navigate('/my-orders');
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setOrderLoading(false);
    }
  };

  if (loading) return <Loading fullPage />;
  if (!book) return null;

  const isOwner = isAuthenticated && user?.id === book.seller?.id;

  return (
    <Container className="py-4">
      <Row className="g-4">
        {/* تصویر کتاب */}
        <Col md={4}>
          <Card className="shadow-sm">
            {book.cover_image ? (
              <Card.Img src={book.cover_image} alt={book.title} className="book-detail-img" />
            ) : (
              <div className="book-detail-placeholder d-flex align-items-center justify-content-center">
                <FiBookOpen size={80} className="text-muted" />
              </div>
            )}
          </Card>
        </Col>

        {/* اطلاعات کتاب */}
        <Col md={8}>
          <Card className="shadow-sm">
            <Card.Body>
              <h1 className="h2">{book.title}</h1>

              <p className="text-muted mb-2">
                <strong>نویسنده:</strong> {book.author}
              </p>

              {book.publisher && (
                <p className="text-muted mb-2">
                  <strong>انتشارات:</strong> {book.publisher}
                </p>
              )}

              {book.isbn && (
                <p className="text-muted mb-2">
                  <strong>شابک:</strong> {book.isbn}
                </p>
              )}

              {book.category && (
                <p className="text-muted mb-2">
                  <strong>دسته‌بندی:</strong> {book.category.name}
                </p>
              )}

              <p className="mb-2">
                <strong>وضعیت ظاهری: </strong>
                <Badge className={CONDITION_CLASS_MAP[book.condition] || 'badge-condition-poor'}>
                  {book.condition_display}
                </Badge>
              </p>

              <p className="mb-2">
                <strong>وضعیت آگهی: </strong>
                <Badge className={book.status === 'approved' ? 'status-approved' : 'status-pending'}>
                  {book.status_display}
                </Badge>
              </p>

              <hr />

              {/* قیمت */}
              <h2 className="text-primary mb-3">
                {Number(book.price).toLocaleString('fa-IR')} تومان
              </h2>

              {/* اطلاعات فروشنده */}
              <Card className="bg-section-alt mb-3">
                <Card.Body>
                  <h3 className="h5 d-flex align-items-center gap-2">
                    <FiUser aria-hidden="true" />
                    اطلاعات فروشنده
                  </h3>
                  <p className="mb-0">نام: {book.seller?.username}</p>
                </Card.Body>
              </Card>

              {/* دکمه‌ها */}
              <div className="d-flex flex-wrap gap-2">
                {isOwner ? (
                  <Alert variant="info" className="w-100 mb-0">
                    این کتاب توسط شما ثبت شده است.
                  </Alert>
                ) : book.status === 'approved' ? (
                  <>
                    <Button variant="primary" onClick={handleOpenModal}>
                      <FiShoppingCart className="ms-2" />
                      خرید کتاب
                    </Button>

                    <Button
                      variant={wishlisted ? 'danger' : 'outline-danger'}
                      onClick={handleWishlistToggle}
                    >
                      <FiHeart className="ms-2" fill={wishlisted ? 'currentColor' : 'none'} />
                      {wishlisted ? 'حذف از علاقه‌مندی' : 'افزودن به علاقه‌مندی'}
                    </Button>
                  </>
                ) : book.status === 'sold' ? (
                  <Alert variant="warning" className="w-100 mb-0">
                    این کتاب فروخته شده است.
                  </Alert>
                ) : (
                  <Alert variant="secondary" className="w-100 mb-0">
                    این کتاب هنوز در انتظار تأیید مدیر است.
                  </Alert>
                )}
              </div>

              {/* توضیحات */}
              {book.description && (
                <div className="mt-4">
                  <h3 className="h5">توضیحات</h3>
                  <p style={{ whiteSpace: 'pre-line' }}>{book.description}</p>
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* مودال خرید */}
      <Modal show={showModal} onHide={() => setShowModal(false)} centered>
        <Form onSubmit={handleOrder}>
          <Modal.Header closeButton>
            <Modal.Title>ثبت سفارش</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <p><strong>کتاب:</strong> {book.title}</p>
            <p><strong>مبلغ:</strong> {Number(book.price).toLocaleString('fa-IR')} تومان</p>

            <Form.Group className="mt-3">
              <Form.Label>آدرس ارسال *</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={shippingAddress}
                onChange={(e) => setShippingAddress(e.target.value)}
                placeholder="آدرس کامل خود را وارد کنید..."
                required
              />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowModal(false)}>
              انصراف
            </Button>
            <Button variant="primary" type="submit" disabled={orderLoading}>
              {orderLoading ? 'در حال ثبت...' : 'ثبت سفارش'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </Container>
  );
}

export default BookDetail;