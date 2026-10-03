import { useState, useEffect } from 'react';
import { Container, Row, Col } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { bookAPI, getErrorMessage } from '../services/api';
import { useAuth } from '../context/useAuth.js';
import BookCard from '../components/BookCard';
import Loading from '../components/Loading';
import { FiSearch, FiTag, FiShield, FiBookOpen, FiPlusCircle } from 'react-icons/fi';

const LATEST_BOOKS_COUNT = 8;

const FEATURES = [
  {
    icon: FiSearch,
    title: 'جستجوی آسان',
    text: 'کتاب مورد نظرتان را بر اساس نام، نویسنده یا موضوع جستجو کنید.',
  },
  {
    icon: FiTag,
    title: 'قیمت مناسب',
    text: 'کتاب‌های دست دوم با کیفیت خوب و قیمت‌های بسیار مناسب.',
  },
  {
    icon: FiShield,
    title: 'خرید امن',
    text: 'تمامی کتاب‌ها قبل از نمایش توسط تیم ما بررسی می‌شوند.',
  },
];

function Home() {
  const { isAuthenticated } = useAuth();
  const [latestBooks, setLatestBooks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ignore = false;

    bookAPI
      .getBooks({
        ordering: '-created_at',
        page_size: LATEST_BOOKS_COUNT,
      })
      .then((response) => {
        if (!ignore) {
          const books = response.data.results ?? response.data;
          setLatestBooks(books.slice(0, LATEST_BOOKS_COUNT));
        }
      })
      .catch((error) => {
        if (!ignore) {
          toast.error(getErrorMessage(error));
          setLatestBooks([]);
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
  }, []);

  return (
    <>
      {/* بخش هیرو */}
      <section className="hero-section text-center">
        <Container>
          <div className="d-flex align-items-center justify-content-center gap-2 mb-3">
            <FiBookOpen size={40} aria-hidden="true" />
            <h1 className="display-4 fw-bold mb-0">ری‌بوک</h1>
          </div>
          <p className="lead mb-4">بزرگ‌ترین پلتفرم خرید و فروش کتاب‌های دست دوم</p>
          <p className="mb-4">
            کتاب‌هایت را بفروش، کتاب‌های مورد نیازت را با قیمت مناسب پیدا کن!
          </p>

          <div className="d-flex flex-wrap justify-content-center gap-3">
            <Link to="/books" className="btn btn-light btn-lg">
              مشاهده کتاب‌ها
            </Link>

            {isAuthenticated ? (
              <Link
                to="/create-book"
                className="btn btn-outline-light btn-lg d-inline-flex align-items-center gap-2"
              >
                <FiPlusCircle />
                ثبت کتاب جدید
              </Link>
            ) : (
              <Link to="/register" className="btn btn-outline-light btn-lg">
                شروع کنید
              </Link>
            )}
          </div>
        </Container>
      </section>

      {/* ویژگی‌ها */}
      <section className="py-5">
        <Container>
          <h2 className="text-center mb-5">چرا ری‌بوک؟</h2>
          <Row className="text-center g-4">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <Col md={4} key={title}>
                <div className="p-4">
                  <Icon size={48} className="text-primary" aria-hidden="true" />
                  <h3 className="h4 mt-3">{title}</h3>
                  <p className="text-muted">{text}</p>
                </div>
              </Col>
            ))}
          </Row>
        </Container>
      </section>

      {/* جدیدترین کتاب‌ها */}
      <section className="py-5 bg-section-alt">
        <Container>
          <div className="d-flex justify-content-between align-items-center mb-4">
            <h2 className="mb-0">جدیدترین کتاب‌ها</h2>
            <Link to="/books" className="btn btn-outline-primary">
              مشاهده همه
            </Link>
          </div>

          {loading ? (
            <Loading />
          ) : latestBooks.length > 0 ? (
            <Row className="g-4">
              {latestBooks.map((book) => (
                <Col key={book.id} xs={12} sm={6} md={4} lg={3}>
                  <BookCard book={book} />
                </Col>
              ))}
            </Row>
          ) : (
            <p className="text-center text-muted">هنوز کتابی ثبت نشده است.</p>
          )}
        </Container>
      </section>
    </>
  );
}

export default Home;