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
const DEPTH_FAR = -2600;
const DEPTH_LOOP = 2900; // جلدی که از دوربین گذشت به ته فضا برمی‌گردد، پس فضا هیچ‌وقت خالی نمی‌شود
const DEPTH_TRAVEL = 3500; // مسافت دوربین در طول باند اسکرول
const DEPTH_DRIFT = 40; // px در ثانیه: حتی بی‌اسکرول، قفسه آرام به‌سمت بیننده می‌آید
const depthSlot = (i, n) => {
  const a = i * 2.39996 + 0.6;
  const z = DEPTH_NEAR - (i * (DEPTH_NEAR - DEPTH_FAR)) / Math.max(1, n - 1);
  const k = 1 + ((DEPTH_PERSPECTIVE - z) / DEPTH_PERSPECTIVE - 1) * 0.35;
  return {
    x: Math.cos(a) * (30 + (i % 3) * 6) * k, // vw
    y: Math.sin(a) * (26 + (i % 2) * 6) * k, // vh
    z,
    a,
    tilt: ((i * 37) % 14) - 7,
  };
};
const wrapDepth = (z) => DEPTH_FAR + ((((z - DEPTH_FAR) % DEPTH_LOOP) + DEPTH_LOOP) % DEPTH_LOOP);
// جلد فقط در لبه‌ی ته فضا (۴۵۰px آخر) از مه کاغذ پیدا می‌شود تا هنگام برگشتن از ته فضا نپرد، و پیش از رسیدن به دوربین
// ناپدید می‌شود؛ بقیه‌ی راه کاملاً مات است، چون جلد نیمه‌شفاف کدر و بی‌کیفیت دیده می‌شود
const depthOpacity = (z) => Math.min(clamp01((z - DEPTH_FAR) / 450), clamp01((300 - z) / 300));

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

  // پرواز: یک موتور کوچک هر فریم جای همه‌ی جلدها و تیتر را از پیشرفت اسکرول (از راه فنر)، ورود، رانش آرام،
  // شناوری و نگاه نشانگر حساب می‌کند. پیشرفت خام اسکرول از تایم‌لاینی می‌آید که صحنه را پین کرده است
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
        // دوربین با فنرِ میرای بحرانی به پیشرفت اسکرول می‌رسد، نه با scrub عددی: scrub روی هر رویداد اسکرول
        // یک توئین تازه با ease-out می‌سازد، پس سرعت با هر ضربه‌ی چرخ موس بالا می‌پرد و دوباره می‌افتد (حرکت تپنده).
        // فنر سرعت پیوسته دارد، پس پرواز روان شتاب می‌گیرد و روان می‌ایستد
        const cam = { x: 0, v: 0 };
        const SPRING = 7; // ω؛ حدود ۰٫۶ ثانیه تا رسیدن

        // حریم تیتر: تا تیتر پیداست، جلدی که روی صفحه پشت متن می‌افتد کم‌رنگ نمی‌شود (جلد کدر بی‌کیفیت دیده می‌شود)،
        // بلکه کاملاً مات تا لبه‌ی قاب متن کنار می‌رود و با گذشتن تیتر به مسیر خودش برمی‌گردد. مرکز دید
        // (perspective-origin)، قاب متن و اندازه‌ی جلد یک بار و با هر تغییر اندازه اندازه گرفته می‌شوند
        const depth = hero.querySelector('.hero-depth');
        const CLEAR_PAD = 16; // px فاصله‌ی جلد تا متن
        let view = { cx: 0, cy: 0 };
        let text = { cx: 0, cy: 0, hw: 1, hh: 1 };
        let cover = { hw: 0, hh: 0 };
        const measure = () => {
          const d = depth.getBoundingClientRect();
          const prev = copy.style.transform;
          copy.style.transform = 'none';
          const r = copy.getBoundingClientRect();
          copy.style.transform = prev;
          view = { cx: d.left + d.width / 2, cy: d.top + d.height / 2 };
          text = { cx: r.left + r.width / 2, cy: r.top + r.height / 2, hw: r.width / 2 + CLEAR_PAD, hh: r.height / 2 + CLEAR_PAD };
          cover = { hw: items[0].offsetWidth / 2, hh: items[0].offsetHeight / 2 };
        };
        measure();
        window.addEventListener('resize', measure);
        const look = { x: 0, y: 0 };
        const cleanups = [];

        const render = (time, deltaMs) => {
          const dt = Math.min(deltaMs, 50) / 1000;
          cam.v += ((state.p - cam.x) * SPRING * SPRING - cam.v * 2 * SPRING) * dt;
          cam.x += cam.v * dt;
          const vw = window.innerWidth / 100;
          const vh = window.innerHeight / 100;
          const c = clamp01(cam.x / 0.3); // ۰: تیتر کامل، ۱: تیتر گذشته
          const travel = cam.x * DEPTH_TRAVEL - state.intro * 1800 + time * DEPTH_DRIFT;
          slots.forEach((s) => {
            // جلدی که با Tab فوکوس شده آرام جلوی دوربین می‌آید و همان‌جا می‌ماند
            const flying = wrapDepth(s.z + travel);
            s.focus += ((s.el === document.activeElement ? 1 : 0) - s.focus) * 0.12;
            const z = flying + (-250 - flying) * s.focus;
            const t = time + s.seed;
            let x = s.x * vw;
            let y = s.y * vh + Math.sin(t * 0.7) * 10;
            // حریم تا وقتی متن خواناست کامل می‌ماند و فقط در آخرین بخش محو شدن تیتر (شفافیت کمتر از ~۰٫۴۵) رها می‌شود؛
            // حریم هم‌پای بزرگ شدن تیتر بزرگ می‌شود
            const hold = 1 - gsap.parseEase('power1.inOut')(clamp01((c - 0.75) / 0.25));
            if (hold > 0) {
              const grow = 1 + 0.6 * c * c;
              // جای جلد روی صفحه نسبت به مرکز متن؛ اگر قابِ جلد با حریم متن هم‌پوشانی دارد، در همان راستا تا لبه‌ی حریم
              // رانده می‌شود. k=۱ یعنی درست روی لبه؛ رانش پیوسته است
              const f = DEPTH_PERSPECTIVE / Math.max(1, DEPTH_PERSPECTIVE - z);
              let ox = view.cx + (x + look.x) * f - text.cx;
              let oy = view.cy + (y + look.y) * f - text.cy;
              if (Math.hypot(ox, oy) < 1) {
                ox = Math.cos(s.a);
                oy = Math.sin(s.a);
              }
              const k = Math.max(Math.abs(ox) / (text.hw * grow + cover.hw * f), Math.abs(oy) / (text.hh * grow + cover.hh * f));
              if (k < 1) {
                const push = (1 / Math.max(k, 0.02) - 1) * hold;
                x += (ox * push) / f;
                y += (oy * push) / f;
              }
            }
            const o = depthOpacity(z);
            s.el.style.opacity = o;
            s.el.style.pointerEvents = o < 0.2 ? 'none' : '';
            s.el.style.transform = `translate3d(${x}px, ${y}px, ${z}px) rotateY(${Math.sin(t * 0.35) * 12}deg) rotate(${s.tilt}deg)`;
          });
          // نگاه به اطراف: دوربین کمی به پهلو می‌رود (جابه‌جایی جهان، نه چرخش): جلد نزدیک بیشتر و جلد دور کمتر
          // جابه‌جا می‌شود، که عمق را درست نشان می‌دهد. چرخش حول نقطه‌ی جلوی دوربین برعکس بود و جلدهای دور را می‌لغزاند
          world.style.transform = `translate3d(${look.x}px, ${look.y}px, 0)`;
          // تیتر با همان فنر از کنار دوربین می‌گذرد: بزرگ و محو، بی‌تاری (تاری حروف فارسی را لک می‌کرد)
          copy.style.opacity = 1 - c * c;
          copy.style.transform = `scale(${1 + 0.6 * c * c})`;
          copy.style.visibility = c >= 1 ? 'hidden' : '';
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
        cleanups.push(() => window.removeEventListener('resize', measure));
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
              scrub: true,
              invalidateOnRefresh: true,
            },
          })
          .to(state, { p: 1, ease: 'none', duration: 1 }, 0)
          .to(state, { p: 1 + 0.35 * liftRatio, ease: 'none', duration: liftRatio }, 1);

        // نگاه به اطراف: دوربین آرام دنبال نشانگر می‌رود
        if (context.conditions.finePointer) {
          const onMove = (e) => {
            gsap.to(look, {
              x: -(e.clientX / window.innerWidth - 0.5) * 160,
              y: -(e.clientY / window.innerHeight - 0.5) * 90,
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
