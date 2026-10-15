import { gsap } from "gsap";
import { SplitText } from "gsap/SplitText";
import { depthSlot, DEPTH_TRAVEL, DEPTH_DRIFT, wrapDepth, DEPTH_PERSPECTIVE, depthOpacity } from "./depthGeometry.js";
import { ScrollTrigger } from "gsap/ScrollTrigger";
const navHeight = () => document.querySelector('.site-navbar')?.offsetHeight ?? 0;
gsap.registerPlugin(SplitText, ScrollTrigger);
const MOTION_OK = '(prefers-reduced-motion: no-preference)';
const withSafety = tl => {
  const timer = setTimeout(() => tl.progress(1), SAFETY_MS);
  tl.eventCallback('onInterrupt', () => clearTimeout(timer));
  return () => clearTimeout(timer);
};
const FINE_POINTER = '(hover: hover) and (pointer: fine)';
const clamp01 = gsap.utils.clamp(0, 1);
const SAFETY_MS = 3000;
export function startHeroText(heroRef) {
    // اگر افکت پیش از آماده‌شدن فونت پاک شد (جابه‌جایی صفحه، اجرای دوباره‌ی StrictMode)، کال‌بک دیر رسیده کاری نمی‌کند؛
    // وگرنه یک SplitText بی‌صاحب می‌ماند که هرگز برنمی‌گردد
    let cancelled = false;
    const mm = gsap.matchMedia();
    mm.add(MOTION_OK, context => {
      let active = true;
      document.fonts.ready.then(() => {
        if (cancelled || !active) return;
        // انیمیشن‌های بعد از await با context.add در همان زمینه ثبت می‌شوند تا با بازگشت پاک شوند
        context.add(() => {
          gsap.set(['.home-hero-title', '.home-hero-lead', '.home-hero-actions'], {
            autoAlpha: 0
          });
          const split = SplitText.create('.home-hero-title', {
            type: 'words'
          });
          // پس از پایان، تکه‌ها به متن ساده برمی‌گردند (همان کلمه‌ها و همان پهنا، پس پرشی نیست)
          const tl = gsap.timeline({
            defaults: {
              ease: 'power3.out'
            },
            onComplete: () => split.revert()
          }).set('.home-hero-title', {
            autoAlpha: 1
          }).from(split.words, {
            yPercent: 60,
            autoAlpha: 0,
            filter: 'blur(4px)',
            duration: 0.6,
            stagger: 0.07
          }, 0.3).to(['.home-hero-lead', '.home-hero-actions'], {
            autoAlpha: 1,
            duration: 0.4,
            stagger: 0.08
          }, '-=0.25').from(['.home-hero-lead', '.home-hero-actions'], {
            y: 10,
            duration: 0.4,
            stagger: 0.08,
            clearProps: 'transform'
          }, '<');
          return withSafety(tl);
        });
      });
      return () => { active = false; };
    }, heroRef);
    return () => {
      cancelled = true;
      mm.revert();
    };
}
export function startHeroDepth(heroRef) {
    let cancelled = false;
    const mm = gsap.matchMedia();
    mm.add({
      motion: MOTION_OK,
      finePointer: FINE_POINTER
    }, context => {
      if (!context.conditions.motion) return undefined;
      let active = true;
      const hero = heroRef.current;
      const stage = hero.querySelector('.hero-stage');
      const runway = hero.querySelector('.hero-runway');
      const world = hero.querySelector('.depth-world');
      const copy = hero.querySelector('.depth-copy');
      const items = gsap.utils.toArray('.depth-item', hero);
      // تغییرهای مستقیم DOM هم با پایان افکت به حالت ایستا برمی‌گردند.
      const savedStyles = [world, copy, ...items].map(el => [el, el.getAttribute('style')]);
      const slots = items.map(el => ({
        el,
        ...depthSlot(Number(el.dataset.i), items.length),
        seed: Math.random() * 10,
        focus: 0
      }));
      const state = {
        p: 0,
        intro: 1
      };
      // دوربین با فنرِ میرای بحرانی به پیشرفت اسکرول می‌رسد، نه با scrub عددی: scrub روی هر رویداد اسکرول
      // یک توئین تازه با ease-out می‌سازد، پس سرعت با هر ضربه‌ی چرخ موس بالا می‌پرد و دوباره می‌افتد (حرکت تپنده).
      // فنر سرعت پیوسته دارد، پس پرواز روان شتاب می‌گیرد و روان می‌ایستد
      const cam = {
        x: 0,
        v: 0
      };
      const SPRING = 7; // ω؛ حدود ۰٫۶ ثانیه تا رسیدن

      // تا تیتر پیداست، جلدی که پشت متن می‌افتد کم‌رنگ می‌شود تا متن روی جلد رنگی نیفتد. مرکز دید (perspective-origin)
      // و قاب متن یک بار و با هر تغییر اندازه اندازه گرفته می‌شوند؛ جای جلد روی صفحه با همان ضرب پرسپکتیو حساب می‌شود
      const depth = hero.querySelector('.hero-depth');
      let view = {
        cx: 0,
        cy: 0
      };
      let text = {
        cx: 0,
        cy: 0,
        hw: 1,
        hh: 1
      };
      const measure = () => {
        const d = depth.getBoundingClientRect();
        const prev = copy.style.transform;
        copy.style.transform = 'none';
        const r = copy.getBoundingClientRect();
        copy.style.transform = prev;
        view = {
          cx: d.left + d.width / 2,
          cy: d.top + d.height / 2
        };
        text = {
          cx: r.left + r.width / 2,
          cy: r.top + r.height / 2,
          hw: r.width / 2,
          hh: r.height / 2
        };
      };
      measure();
      window.addEventListener('resize', measure);
      const look = {
        x: 0,
        y: 0
      };
      const cleanups = [];
      const render = (time, deltaMs) => {
        const dt = Math.min(deltaMs, 50) / 1000;
        cam.v += ((state.p - cam.x) * SPRING * SPRING - cam.v * 2 * SPRING) * dt;
        cam.x += cam.v * dt;
        const vw = window.innerWidth / 100;
        const vh = window.innerHeight / 100;
        const c = clamp01(cam.x / 0.3); // ۰: تیتر کامل، ۱: تیتر گذشته
        const travel = cam.x * DEPTH_TRAVEL - state.intro * 1800 + time * DEPTH_DRIFT;
        slots.forEach(s => {
          // جلدی که با Tab فوکوس شده آرام جلوی دوربین می‌آید و همان‌جا می‌ماند
          const flying = wrapDepth(s.z + travel);
          s.focus += ((s.el === document.activeElement ? 1 : 0) - s.focus) * 0.12;
          const z = flying + (-250 - flying) * s.focus;
          const t = time + s.seed;
          const x = s.x * vw;
          const y = s.y * vh + Math.sin(t * 0.7) * 10;
          const f = DEPTH_PERSPECTIVE / Math.max(1, DEPTH_PERSPECTIVE - z);
          const dx = Math.abs(view.cx + (x + look.x) * f - text.cx) / text.hw;
          const dy = Math.abs(view.cy + (y + look.y) * f - text.cy) / text.hh;
          const behindText = clamp01((1.25 - Math.max(dx, dy)) / 0.35) * (1 - c);
          const o = depthOpacity(z) * (1 - behindText * 0.85);
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
      const run = on => {
        if (on === running) return;
        running = on;
        if (on) gsap.ticker.add(render);else gsap.ticker.remove(render);
      };
      const visibility = ScrollTrigger.create({
        trigger: hero,
        start: 'top bottom',
        end: 'bottom top',
        onToggle: self => run(self.isActive),
        onRefresh: self => run(self.isActive)
      });
      run(visibility.isActive);
      cleanups.push(() => run(false));
      cleanups.push(() => window.removeEventListener('resize', measure));
      cleanups.push(withSafety(gsap.timeline().to(state, {
        intro: 0,
        duration: 1.8,
        ease: 'power3.out'
      })));

      // نسبت «بالاآمدن برگه» به «باند»: پرواز در [0, 1] و بالاآمدن بخش بعد پس از آن
      const liftRatio = stage.offsetHeight / Math.max(1, runway.offsetHeight);
      gsap.timeline({
        scrollTrigger: {
          trigger: stage,
          start: () => `top ${navHeight()}px`,
          end: () => `+=${runway.offsetHeight + stage.offsetHeight}`,
          pin: true,
          pinSpacing: false,
          scrub: true,
          invalidateOnRefresh: true
        }
      }).to(state, {
        p: 1,
        ease: 'none',
        duration: 1
      }, 0).to(state, {
        p: 1 + 0.35 * liftRatio,
        ease: 'none',
        duration: liftRatio
      }, 1);

      // نگاه به اطراف: دوربین آرام دنبال نشانگر می‌رود
      if (context.conditions.finePointer) {
        const onMove = e => {
          gsap.to(look, {
            x: -(e.clientX / window.innerWidth - 0.5) * 160,
            y: -(e.clientY / window.innerHeight - 0.5) * 90,
            duration: 1.1,
            ease: 'power3',
            overwrite: true
          });
        };
        hero.addEventListener('pointermove', onMove);
        cleanups.push(() => hero.removeEventListener('pointermove', onMove));
      }

      // لاله‌زار ارتفاع تیتر و در نتیجه طول پین را عوض می‌کند
      document.fonts.ready.then(() => {
        if (!cancelled && active) ScrollTrigger.refresh();
      });
      return () => {
        active = false;
        cleanups.forEach(fn => fn());
        gsap.killTweensOf(look);
        savedStyles.forEach(([el, style]) => {
          if (style === null) el.removeAttribute('style');
          else el.setAttribute('style', style);
        });
      };
    }, heroRef);
    return () => {
      cancelled = true;
      mm.revert();
    };
}
