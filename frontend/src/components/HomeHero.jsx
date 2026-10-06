import { useLayoutEffect, useRef } from 'react';
import { Container } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { gsap } from 'gsap';
import { SplitText } from 'gsap/SplitText';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { FiPlusCircle } from 'react-icons/fi';
import PlainCover from './PlainCover';
import { seriesInk } from '../utils/series';

gsap.registerPlugin(SplitText, ScrollTrigger);

// حرکت فقط برای کسی که حرکت کم نخواسته؛ با حرکت کم، هیرو حالت ایستای خودش را دارد (همان markup و CSS)
const MOTION_OK = '(prefers-reduced-motion: no-preference)';
const FINE_POINTER = '(hover: hover) and (pointer: fine)';

// محتوای هیرو پنهان شروع می‌شود و با ساعت GSAP (requestAnimationFrame) پیدا می‌شود. جایی که rAF نمی‌چرخد
// (تب پس‌زمینه، ابزار اسکرین‌شات، خزنده) تایمر انیمیشن را به آخرش می‌برد تا هیچ‌چیز پنهان نماند
const SAFETY_MS = 3000;
const withSafety = (tl) => {
  const timer = setTimeout(() => tl.progress(1), SAFETY_MS);
  tl.eventCallback('onInterrupt', () => clearTimeout(timer));
  return () => clearTimeout(timer);
};

const navHeight = () => document.querySelector('.site-navbar')?.offsetHeight ?? 0;
const clamp01 = gsap.utils.clamp(0, 1);

// هر جلد جایی در عمق، روی بیضی‌ای دور تیتر (زاویه‌ی طلایی تا پخش شوند). جای جهان کمی با عمق بزرگ می‌شود تا
// جلدهای دور پشت تیتر جمع نشوند؛ با جلو رفتن دوربین از نزدیک مرکز می‌آیند و بزرگ‌شده از کنار می‌گذرند
const DEPTH_PERSPECTIVE = 900; // همان perspective در App.css
const DEPTH_NEAR = -150;
const DEPTH_FAR = -3300;
const DEPTH_LOOP = 3600; // جلدی که از دوربین گذشت به ته فضا برمی‌گردد، پس فضا هیچ‌وقت خالی نمی‌شود
const DEPTH_TRAVEL = 3500; // مسافت دوربین در طول باند اسکرول
const DEPTH_DRIFT = 40; // px در ثانیه: حتی بی‌اسکرول، قفسه آرام به‌سمت بیننده می‌آید
const depthSlot = (i, n) => {
  const a = i * 2.39996 + 0.6;
  const z = DEPTH_NEAR - (i * (DEPTH_NEAR - DEPTH_FAR)) / Math.max(1, n - 1);
  const k = 1 + ((DEPTH_PERSPECTIVE - z) / DEPTH_PERSPECTIVE - 1) * 0.35;
  return {
    x: Math.cos(a) * (37 + (i % 3) * 5) * k, // vw
    y: Math.sin(a) * (30 + (i % 2) * 7) * k, // vh
    z,
    tilt: ((i * 37) % 14) - 7,
  };
};
const wrapDepth = (z) => DEPTH_FAR + ((((z - DEPTH_FAR) % DEPTH_LOOP) + DEPTH_LOOP) % DEPTH_LOOP);
// جلدهای خیلی دور در مه کاغذ محو می‌شوند و جلدی که از کنار دوربین می‌گذرد پیش از رسیدن به آن ناپدید می‌شود
const depthOpacity = (z) => Math.min(clamp01((z - DEPTH_FAR) / 800), clamp01((300 - z) / 300));

function CoverArt({ book }) {
  return book.cover_image ? (
    <img src={book.cover_image} alt="" />
  ) : (
    <PlainCover title={book.title} author={book.author} rootId={book.category_root} series={book.category_name} />
  );
}

// «پرواز در قفسه»: تازه‌ترین جلدها در فضای سه‌بعدی معلق‌اند و اسکرول دوربین را از میانشان جلو می‌برد.
// صحنه پین می‌شود و روی «باند» (فضای اسکرول زیرش، طولش در CSS) می‌ماند؛ در پایان باند، بخش بعدی
// مثل برگه رویش بالا می‌آید (pinSpacing خاموش است)
function HomeHero({ status, books }) {
  const heroRef = useRef(null);
  const ready = status === 'ready' && books.length > 0;

  // هیرو تمام‌صفحه است منهای نوار ناوبری چسبان (که روی گوشی بلندتر است)
  useLayoutEffect(() => {
    const setNav = () => document.documentElement.style.setProperty('--rb-nav-h', `${navHeight()}px`);
    setNav();
    window.addEventListener('resize', setNav);
    return () => window.removeEventListener('resize', setNav);
  }, []);

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
              .from(split.words, { yPercent: 60, autoAlpha: 0, filter: 'blur(4px)', duration: 0.6, stagger: 0.07 }, 0.3)
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

  // پرواز: یک موتور کوچک هر فریم جای همه‌ی جلدها را از پیشرفت اسکرول، ورود، رانش آرام، شناوری و نگاه نشانگر
  // حساب می‌کند. پیشرفت اسکرول از یک تایم‌لاین اسکراب‌شده می‌آید که صحنه را پین کرده است
  useLayoutEffect(() => {
    if (!ready) return undefined;
    let cancelled = false;
    const mm = gsap.matchMedia();
    mm.add(
      { motion: MOTION_OK, finePointer: FINE_POINTER },
      (context) => {
        if (!context.conditions.motion) return undefined;
        const hero = heroRef.current;
        const stage = hero.querySelector('.hero-stage');
        const runway = hero.querySelector('.hero-runway');
        const world = hero.querySelector('.depth-world');
        const copy = hero.querySelector('.depth-copy');
        const items = gsap.utils.toArray('.depth-item', hero);
        const slots = items.map((el) => ({ el, ...depthSlot(Number(el.dataset.i), items.length), seed: Math.random() * 10, focus: 0 }));
        const state = { p: 0, intro: 1 };
        const look = { rx: 0, ry: 0 };
        const cleanups = [];

        const render = (time) => {
          const vw = window.innerWidth / 100;
          const vh = window.innerHeight / 100;
          const travel = state.p * DEPTH_TRAVEL - state.intro * 1800 + time * DEPTH_DRIFT;
          slots.forEach((s) => {
            // جلدی که با Tab فوکوس شده آرام جلوی دوربین می‌آید و همان‌جا می‌ماند
            const flying = wrapDepth(s.z + travel);
            s.focus += ((s.el === document.activeElement ? 1 : 0) - s.focus) * 0.12;
            const z = flying + (-250 - flying) * s.focus;
            const t = time + s.seed;
            const o = depthOpacity(z);
            s.el.style.opacity = o;
            s.el.style.pointerEvents = o < 0.2 ? 'none' : '';
            s.el.style.transform = `translate3d(${s.x * vw}px, ${s.y * vh + Math.sin(t * 0.7) * 10}px, ${z}px) rotateY(${Math.sin(t * 0.35) * 12}deg) rotate(${s.tilt}deg)`;
          });
          world.style.transform = `rotateX(${look.rx}deg) rotateY(${look.ry}deg)`;
        };
        // موتور فقط وقتی هیرو در دید است می‌چرخد
        let running = false;
        const run = (on) => {
          if (on === running) return;
          running = on;
          if (on) gsap.ticker.add(render);
          else gsap.ticker.remove(render);
        };
        run(true);
        ScrollTrigger.create({ trigger: hero, start: 'top bottom', end: 'bottom top', onToggle: (self) => run(self.isActive) });
        cleanups.push(() => run(false));
        cleanups.push(withSafety(gsap.timeline().to(state, { intro: 0, duration: 1.8, ease: 'power3.out' })));

        // نسبت «بالاآمدن برگه» به «باند»: پرواز در [0, 1] و بالاآمدن بخش بعد پس از آن
        const liftRatio = stage.offsetHeight / Math.max(1, runway.offsetHeight);
        gsap
          .timeline({
            scrollTrigger: {
              trigger: stage,
              start: () => `top ${navHeight()}px`,
              end: () => `+=${runway.offsetHeight + stage.offsetHeight}`,
              pin: true,
              pinSpacing: false,
              scrub: 1,
              invalidateOnRefresh: true,
            },
          })
          .to(state, { p: 1, ease: 'none', duration: 1 }, 0)
          .to(copy, { scale: 1.7, autoAlpha: 0, filter: 'blur(8px)', ease: 'power1.in', duration: 0.3 }, 0)
          .to(state, { p: 1 + 0.35 * liftRatio, ease: 'none', duration: liftRatio }, 1);

        // نگاه به اطراف: کل فضا آرام به‌سمت نشانگر می‌چرخد
        if (context.conditions.finePointer) {
          const onMove = (e) => {
            gsap.to(look, {
              ry: (e.clientX / window.innerWidth - 0.5) * 10,
              rx: -(e.clientY / window.innerHeight - 0.5) * 8,
              duration: 1.1,
              ease: 'power3',
              overwrite: true,
            });
          };
          hero.addEventListener('pointermove', onMove);
          cleanups.push(() => hero.removeEventListener('pointermove', onMove));
        }

        // لاله‌زار ارتفاع تیتر و در نتیجه طول پین را عوض می‌کند
        document.fonts.ready.then(() => {
          if (!cancelled) ScrollTrigger.refresh();
        });

        return () => cleanups.forEach((fn) => fn());
      },
      heroRef,
    );
    return () => {
      cancelled = true;
      mm.revert();
    };
  }, [ready]);

  return (
    <section className="home-hero" ref={heroRef}>
      <div className="hero-stage">
        {status !== 'error' && books.length > 0 && (
          <div className="hero-depth" role="group" aria-label="تازه‌ترین نسخه‌های قفسه">
            <div className="depth-world">
              {books.map((book, i) => {
                const s = depthSlot(i, books.length);
                return (
                  <Link
                    key={book.id}
                    to={`/books/${book.id}`}
                    className="depth-item shelf-book"
                    data-i={i}
                    style={{
                      '--card-ink': seriesInk(book.category_root),
                      '--x': s.x,
                      '--y': s.y,
                      '--z': s.z,
                      '--tilt': `${s.tilt}deg`,
                      '--o': depthOpacity(s.z),
                    }}
                    aria-label={`${book.title}، ${book.author}`}
                  >
                    <span className="shelf-cover book-cover-hinge">
                      <CoverArt book={book} />
                    </span>
                    <span className="shelf-band" aria-hidden="true" />
                  </Link>
                );
              })}
            </div>
          </div>
        )}

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
    </section>
  );
}

export default HomeHero;
