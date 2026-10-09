import { useState, useEffect } from 'react';
import { Container, Row, Col, Button } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { bookAPI } from '../services/api';
import BookCard, { BookCardSkeleton } from '../components/BookCard';
import EmptyShelf from '../components/EmptyShelf';
import HomeHero from '../components/HomeHero';
import { seriesInk } from '../utils/series';
import { FiArrowLeft, FiPlusCircle } from 'react-icons/fi';

// هیرو تازه‌ترین ۱۳ جلد را در فضا می‌گرداند (بیشتر شلوغ می‌شود، کمتر خالی)؛ «در قفسه» هشت تای اول را مرتب نشان می‌دهد
const HERO_COUNT = 13;
const GRID_COUNT = 8;

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

  const gridBooks = latestBooks.slice(0, GRID_COUNT);

  const retry = () => {
    setStatus('loading');
    setReloadKey((k) => k + 1);
  };

  useEffect(() => {
    let ignore = false;

    bookAPI
      .getBooks({ ordering: '-created_at', page_size: HERO_COUNT })
      .then((response) => {
        if (ignore) return;
        const books = response.data.results ?? response.data;
        setLatestBooks(books.slice(0, HERO_COUNT));
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
      <HomeHero status={status} books={latestBooks} />

      {shelves.length > 0 && (
        <section className="series-key" aria-labelledby="series-key-title">
          <Container>
            <h2 id="series-key-title" className="home-section-title display-type">
              مجموعه‌ها
            </h2>
            {/* مجموعه‌ها مثل کتاب‌های کلاسیک روی قفسه: هر دسته یک عطف چرمی به رنگ مجموعه با برچسب طلاکوب */}
            <ul className="series-spines">
              {shelves.map((cat) => (
                <li key={cat.id}>
                  <Link
                    to={`/books?category=${cat.slug}`}
                    className="spine"
                    style={{ '--series-ink': seriesInk(cat.id) }}
                  >
                    <span className="spine-label">
                      <span className="spine-title display-type">{cat.name}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Container>
        </section>
      )}

      <section className="home-latest" aria-labelledby="latest-title">
        <Container>
          <div className="d-flex justify-content-between align-items-baseline gap-3 mb-3">
            <h2 id="latest-title" className="home-section-title display-type">در قفسه</h2>
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
              <EmptyShelf />
              <p>هنوز کتابی در قفسه نیست. اولین کتاب را تو ثبت کن.</p>
              <Link to="/create-book" className="btn btn-primary">
                فروش کتاب
              </Link>
            </div>
          ) : (
            <Row className="g-3 g-md-4" aria-busy={status === 'loading'}>
              {status === 'loading'
                ? Array.from({ length: GRID_COUNT }, (_, i) => (
                    <Col key={i} xs={6} md={4} lg={3}>
                      <BookCardSkeleton />
                    </Col>
                  ))
                : gridBooks.map((book) => (
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
          <span className="ornament-rule home-ornament" aria-hidden="true" />
          <h2 id="sell-title" className="home-section-title display-type">کتابی داری که دیگر سراغش نمی‌روی؟</h2>
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
