import { useState, useEffect } from 'react';
import { Container, Row, Col, Button } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { bookAPI } from '../services/api';
import BookCard, { BookCardSkeleton } from '../components/BookCard';
import { seriesInk } from '../utils/series';
import { FiArrowLeft, FiPlusCircle } from 'react-icons/fi';

const LATEST_BOOKS_COUNT = 8;

// مسیر فروشنده، همان‌طور که در محصول رخ می‌دهد؛ بررسی تیم فقط همین‌جا و بی‌سروصدا گفته می‌شود
const SELL_STEPS = [
  { title: 'ثبت آگهی', text: 'عنوان، عکس جلد، وضعیت و قیمت کتاب را وارد کن.' },
  { title: 'بررسی', text: 'تیم ری‌بوک آگهی را پیش از انتشار بررسی می‌کند.' },
  { title: 'فروش', text: 'وقتی کسی کتاب را سفارش داد، اعلان می‌گیری.' },
];

function Home() {
  const [latestBooks, setLatestBooks] = useState([]);
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [reloadKey, setReloadKey] = useState(0);
  const [shelves, setShelves] = useState([]);

  const retry = () => {
    setStatus('loading');
    setReloadKey((k) => k + 1);
  };

  useEffect(() => {
    let ignore = false;

    bookAPI
      .getBooks({ ordering: '-created_at', page_size: LATEST_BOOKS_COUNT })
      .then((response) => {
        if (ignore) return;
        const books = response.data.results ?? response.data;
        setLatestBooks(books.slice(0, LATEST_BOOKS_COUNT));
        setStatus('ready');
      })
      .catch(() => {
        if (!ignore) setStatus('error');
      });

    return () => {
      ignore = true;
    };
  }, [reloadKey]);

  // فهرست دسته‌ها فقط راه میان‌بر است؛ اگر نیامد، هیرو بدون آن کامل است
  useEffect(() => {
    let ignore = false;
    bookAPI
      .getCategories()
      .then((response) => {
        if (!ignore) setShelves(response.data.filter((cat) => cat.parent === null));
      })
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, []);

  return (
    <>
      <section className="home-hero">
        <Container>
          <Row className="gy-4 align-items-end">
            <Col lg={7}>
              <h1 className="home-hero-title">کتاب بعدی‌ات را پیدا کن، کتاب‌هایی را که خواندی بفروش.</h1>
              <p className="home-hero-lead">
                نسخه‌های دست دوم را با عکس جلد، وضعیت ظاهری و قیمت کنار هم ببین.
              </p>
              <div className="home-hero-actions d-flex flex-wrap gap-2">
                <Link to="/books" className="btn btn-primary btn-lg">
                  مرور کتاب‌ها
                </Link>
                <Link
                  to="/create-book"
                  className="btn btn-outline-primary btn-lg d-inline-flex align-items-center gap-2"
                >
                  <FiPlusCircle aria-hidden="true" />
                  فروش کتاب
                </Link>
              </div>
            </Col>

            <Col lg={5}>
              <nav className="series-index" aria-labelledby="series-index-title">
                <h2 id="series-index-title" className="series-index-title">
                  دسته‌ها
                </h2>
                <ul className="series-index-list">
                  {shelves.map((cat) => (
                    <li key={cat.id}>
                      <Link
                        to={`/books?category=${cat.slug}`}
                        className="series-index-link"
                        style={{ '--series-ink': seriesInk(cat.id) }}
                      >
                        <span className="series-index-mark" aria-hidden="true" />
                        {cat.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            </Col>
          </Row>
        </Container>
      </section>

      <section className="home-latest" aria-labelledby="latest-title">
        <Container>
          <div className="d-flex justify-content-between align-items-baseline gap-3 mb-3">
            <h2 id="latest-title" className="home-section-title">جدیدترین کتاب‌ها</h2>
            <Link to="/books" className="home-more-link">
              همه‌ی کتاب‌ها
              <FiArrowLeft aria-hidden="true" />
            </Link>
          </div>

          {status === 'error' ? (
            <div className="list-state" role="alert">
              <p>کتاب‌ها بارگذاری نشدند. اتصال اینترنت را بررسی کن و دوباره امتحان کن.</p>
              <Button variant="outline-secondary" onClick={retry}>
                تلاش دوباره
              </Button>
            </div>
          ) : status === 'ready' && latestBooks.length === 0 ? (
            <div className="list-state">
              <p>هنوز کتابی در قفسه نیست. اولین کتاب را تو ثبت کن.</p>
              <Link to="/create-book" className="btn btn-primary">
                فروش کتاب
              </Link>
            </div>
          ) : (
            <Row className="g-3 g-md-4" aria-busy={status === 'loading'}>
              {status === 'loading'
                ? Array.from({ length: LATEST_BOOKS_COUNT }, (_, i) => (
                    <Col key={i} xs={6} md={4} lg={3}>
                      <BookCardSkeleton />
                    </Col>
                  ))
                : latestBooks.map((book) => (
                    <Col key={book.id} xs={6} md={4} lg={3}>
                      <BookCard book={book} />
                    </Col>
                  ))}
            </Row>
          )}
          {status === 'loading' && <span className="visually-hidden" role="status">در حال بارگذاری کتاب‌ها</span>}
        </Container>
      </section>

      <section className="home-sell" aria-labelledby="sell-title">
        <Container>
          <h2 id="sell-title" className="home-section-title">کتابی داری که دیگر سراغش نمی‌روی؟</h2>
          <ol className="sell-steps">
            {SELL_STEPS.map(({ title, text }) => (
              <li key={title} className="sell-step">
                <h3 className="sell-step-title">{title}</h3>
                <p className="sell-step-text">{text}</p>
              </li>
            ))}
          </ol>
          <Link to="/create-book" className="btn btn-primary btn-lg d-inline-flex align-items-center gap-2">
            <FiPlusCircle aria-hidden="true" />
            فروش کتاب
          </Link>
        </Container>
      </section>
    </>
  );
}

export default Home;
