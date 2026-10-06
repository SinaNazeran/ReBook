import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { Container, Row, Col, Button } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { bookAPI } from '../services/api';
import BookCard, { BookCardSkeleton } from '../components/BookCard';
import PlainCover from '../components/PlainCover';
import EmptyShelf from '../components/EmptyShelf';
import { seriesInk } from '../utils/series';
import { FiArrowLeft, FiPlusCircle } from 'react-icons/fi';
import { gsap } from 'gsap';
import { SplitText } from 'gsap/SplitText';

gsap.registerPlugin(SplitText);

// حرکت فقط برای کسی که حرکت کم نخواسته؛ با حرکت کم، هیرو بی‌انیمیشن و فوراً کامل است
const MOTION_OK = '(prefers-reduced-motion: no-preference)';
// کج‌شدن هر جلد هنگام فرود، که با فنر صاف می‌شود
const LANDING_TILT = [-8, 6, -5, 7, -6];

// محتوای هیرو پنهان شروع می‌شود و با ساعت GSAP (requestAnimationFrame) پیدا می‌شود. جایی که rAF نمی‌چرخد
// (تب پس‌زمینه، ابزار اسکرین‌شات، خزنده) تایمر انیمیشن را به آخرش می‌برد تا هیچ‌چیز پنهان نماند
const SAFETY_MS = 3000;
const withSafety = (tl) => {
  const timer = setTimeout(() => tl.progress(1), SAFETY_MS);
  tl.eventCallback('onInterrupt', () => clearTimeout(timer));
  return () => clearTimeout(timer);
};

// پنج جلد تازه روی قفسه‌ی هیرو؛ شبکه‌ی پایین از کتاب ششم ادامه می‌دهد تا هیچ کتابی دوبار دیده نشود
const SHELF_COUNT = 5;
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

  const shelfBooks = latestBooks.slice(0, SHELF_COUNT);
  const gridBooks = latestBooks.slice(SHELF_COUNT);
  const heroRef = useRef(null);

  // تیتر کلمه‌به‌کلمه پیدا می‌شود. فقط کلمه، هرگز حرف: حروف فارسی به هم چسبیده‌اند و تکه‌کردنشان اتصال را می‌شکند.
  // پیش از نقاشی پنهان می‌شود و پس از بارگذاری لاله‌زار تکه می‌شود (اندازه‌ی کلمه‌ها به فونت بسته است)
  useLayoutEffect(() => {
    // اگر افکت پیش از آماده‌شدن فونت پاک شد (جابه‌جایی صفحه، اجرای دوباره‌ی StrictMode)، کال‌بک دیر رسیده کاری نمی‌کند؛
    // وگرنه یک SplitText بی‌صاحب می‌ماند که هرگز برنمی‌گردد
    let cancelled = false;
    const mm = gsap.matchMedia();
    mm.add(
      MOTION_OK,
      (context) => {
        gsap.set(['.home-hero-title', '.home-hero-lead', '.home-hero-actions'], { autoAlpha: 0 });
        document.fonts.ready.then(() => {
          if (cancelled) return;
          // انیمیشن‌های بعد از await با context.add در همان زمینه ثبت می‌شوند تا با بازگشت پاک شوند
          context.add(() => {
            const split = SplitText.create('.home-hero-title', { type: 'words' });
            // پس از پایان، تکه‌ها به متن ساده برمی‌گردند (همان کلمه‌ها و همان پهنا، پس پرشی نیست)
            const tl = gsap
              .timeline({ defaults: { ease: 'power3.out' }, onComplete: () => split.revert() })
              .set('.home-hero-title', { autoAlpha: 1 })
              .from(split.words, { yPercent: 60, autoAlpha: 0, filter: 'blur(4px)', duration: 0.6, stagger: 0.07 })
              .to(['.home-hero-lead', '.home-hero-actions'], { autoAlpha: 1, duration: 0.4, stagger: 0.08 }, '-=0.25')
              .from(['.home-hero-lead', '.home-hero-actions'], { y: 10, duration: 0.4, stagger: 0.08, clearProps: 'transform' }, '<');
            return withSafety(tl);
          });
        });
      },
      heroRef,
    );
    return () => {
      cancelled = true;
      mm.revert();
    };
  }, []);

  // جلدها یکی‌یکی روی قفسه می‌افتند، کمی برمی‌جهند و از کجی صاف می‌شوند. پس از فرود ویژگی‌ها پاک می‌شوند
  // تا hover (بیرون‌کشیدن جلد در CSS) آزاد باشد؛ در طول فرود transition خاموش است تا با GSAP نجنگد
  const shelfReady = status === 'ready' && shelfBooks.length > 0;
  useLayoutEffect(() => {
    if (!shelfReady) return undefined;
    const mm = gsap.matchMedia();
    mm.add(
      MOTION_OK,
      () => {
        const books = gsap.utils.toArray('.shelf-book');
        const tl = gsap
          .timeline({ onComplete: () => gsap.set(books, { clearProps: 'transform,opacity,visibility,transition' }) })
          .set(books, { transition: 'none' })
          .from(books, { y: -150, autoAlpha: 0, duration: 0.75, ease: 'bounce.out', stagger: 0.09 }, 0.15)
          .from(books, { rotation: (i) => LANDING_TILT[i % LANDING_TILT.length], duration: 1.1, ease: 'elastic.out(1, 0.45)', stagger: 0.09 }, 0.15)
          .from('.hero-shelf-caption', { autoAlpha: 0, duration: 0.4 }, '-=0.5');
        return withSafety(tl);
      },
      heroRef,
    );
    return () => mm.revert();
  }, [shelfReady]);

  const retry = () => {
    setStatus('loading');
    setReloadKey((k) => k + 1);
  };

  useEffect(() => {
    let ignore = false;

    bookAPI
      .getBooks({ ordering: '-created_at', page_size: SHELF_COUNT + GRID_COUNT })
      .then((response) => {
        if (ignore) return;
        const books = response.data.results ?? response.data;
        setLatestBooks(books.slice(0, SHELF_COUNT + GRID_COUNT));
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
      <section className="home-hero" ref={heroRef}>
        <Container>
          <Row className="gy-4 align-items-end">
            <Col lg={6}>
              <h1 className="home-hero-title display-type">کتاب بعدی‌ات را پیدا&nbsp;کن، کتاب‌هایی را که خواندی بفروش.</h1>
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

            <Col lg={6}>
              {status !== 'error' && !(status === 'ready' && shelfBooks.length === 0) && (
                <figure className="hero-shelf" aria-busy={status === 'loading'}>
                  <ul className="hero-shelf-list">
                    {status === 'loading'
                      ? Array.from({ length: SHELF_COUNT }, (_, i) => (
                          <li key={i} className="shelf-book is-placeholder" aria-hidden="true" />
                        ))
                      : shelfBooks.map((book) => (
                          <li key={book.id}>
                            <Link
                              to={`/books/${book.id}`}
                              className="shelf-book"
                              style={{ '--card-ink': seriesInk(book.category_root) }}
                              aria-label={`${book.title}، ${book.author}`}
                            >
                              <span className="shelf-cover book-cover-hinge">
                                {book.cover_image ? (
                                  <img src={book.cover_image} alt="" />
                                ) : (
                                  <PlainCover
                                    title={book.title}
                                    author={book.author}
                                    rootId={book.category_root}
                                    series={book.category_name}
                                  />
                                )}
                              </span>
                              <span className="shelf-band" aria-hidden="true" />
                            </Link>
                          </li>
                        ))}
                  </ul>
                  <figcaption className="hero-shelf-caption">تازه‌ترین نسخه‌های قفسه</figcaption>
                </figure>
              )}
            </Col>
          </Row>
        </Container>
      </section>

      {shelves.length > 0 && (
        <section className="series-key" aria-labelledby="series-key-title">
          <Container>
            <h2 id="series-key-title" className="home-section-title display-type">
              مجموعه‌ها
            </h2>
            {/* مجموعه‌ها مثل عطف کتاب‌ها روی قفسه: هر دسته یک عطف تمام‌رنگ با نامش */}
            <ul className="series-spines">
              {shelves.map((cat) => (
                <li key={cat.id}>
                  <Link
                    to={`/books?category=${cat.slug}`}
                    className="spine"
                    style={{ '--series-ink': seriesInk(cat.id) }}
                  >
                    <span className="spine-title display-type">{cat.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Container>
        </section>
      )}

      {(status !== 'ready' || latestBooks.length === 0 || gridBooks.length > 0) && (
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
      )}

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
