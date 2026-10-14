import PlainCover from "./PlainCover";
import { useRef } from "react";
import { useHeroMotion } from "./home-hero/useHeroMotion.js";
import { depthSlot, depthOpacity } from "./home-hero/depthGeometry.js";
import { Link } from "react-router-dom";
import { seriesInk } from "../utils/series";
import { Container } from "react-bootstrap";
import { FiPlusCircle } from "react-icons/fi";
function CoverArt({
  book
}) {
  return book.cover_image ? <img src={book.cover_image} alt="" /> : <PlainCover title={book.title} author={book.author} rootId={book.category_root} series={book.category_name} />;
}
function HomeHero({
  status,
  books
}) {
  const heroRef = useRef(null);
  const ready = status === 'ready' && books.length > 0;

  // هیرو تمام‌صفحه است منهای نوار ناوبری چسبان (که روی گوشی بلندتر است)
  useHeroMotion(heroRef, ready);
  return <section className="home-hero" ref={heroRef}>
      <div className="hero-stage">
        {status !== 'error' && books.length > 0 && <div className="hero-depth" role="group" aria-label="تازه‌ترین نسخه‌های قفسه">
            <div className="depth-world">
              {books.map((book, i) => {
            const s = depthSlot(i, books.length);
            return <Link key={book.id} to={`/books/${book.id}`} className="depth-item shelf-book" data-i={i} style={{
              '--card-ink': seriesInk(book.category_root),
              '--x': s.x,
              '--y': s.y,
              '--z': s.z,
              '--tilt': `${s.tilt}deg`,
              '--o': depthOpacity(s.z)
            }} aria-label={`${book.title}، ${book.author}`}>
                    <span className="shelf-cover book-cover-hinge">
                      <CoverArt book={book} />
                    </span>
                    <span className="shelf-band" aria-hidden="true" />
                  </Link>;
          })}
            </div>
          </div>}

        <Container className="hero-inner">
          <div className="depth-copy">
            <h1 className="home-hero-title display-type">کتاب بعدی‌ات را پیدا&nbsp;کن، کتاب‌هایی را که خواندی بفروش.</h1>
            <p className="home-hero-lead">نسخه‌های دست دوم را با عکس جلد، وضعیت ظاهری و قیمت کنار هم ببین.</p>
            <div className="home-hero-actions d-flex flex-wrap justify-content-center gap-2">
              <Link to="/books" className="btn btn-primary btn-lg">
                مرور کتاب‌ها
              </Link>
              <Link to="/create-book" className="btn btn-outline-primary btn-lg d-inline-flex align-items-center gap-2">
                <FiPlusCircle aria-hidden="true" />
                فروش کتاب
              </Link>
            </div>
          </div>
        </Container>
      </div>
      <div className="hero-runway" aria-hidden="true" />
    </section>;
}
export default HomeHero;
