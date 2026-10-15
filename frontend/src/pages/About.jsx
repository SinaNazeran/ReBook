import PageMetadata from '../components/PageMetadata.jsx';
import { Container } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import StepRail from '../components/StepRail';
import ConditionMeasure from '../components/ConditionMeasure';
import { SELL_STEPS, BUY_STEPS } from '../utils/steps';
import { CONDITION_LABELS, CONDITION_NOTES } from '../utils/condition';

/**
 * درباره‌ی ری‌بوک: فقط آنچه در خود محصول درست است؛ بدون آمار، آدم یا نقل‌قول ساختگی.
 * معنای درجه‌ها از همان CONDITION_NOTES صفحه‌ی کتاب و فرم فروش می‌آید تا از هم جدا نشوند.
 * هر بخش در قاب شناسنامه به مرکب یک مجموعه (--series) است.
 */
function About() {
  return (
    <div className="series-paper">
      <Container className="about-page">
        <PageMetadata title="درباره‌ی ری‌بوک | ری‌بوک" />
        <header className="sell-header">
          <h1 className="sell-title display-type">درباره‌ی ری‌بوک</h1>
          <p className="sell-lead">
            جایی برای دادن زندگی دوباره به کتاب‌هایتان: کتابی را که خوانده‌ای به خواننده‌ی بعدی برسان و کتاب بعدی‌ات را
            دست‌دوم پیدا کن.
          </p>
        </header>

        <section className="about-section" aria-labelledby="about-buy" style={{ '--series': 'var(--rb-series-2)' }}>
          <h2 id="about-buy" className="about-heading display-type">
            خرید
          </h2>
          <StepRail steps={BUY_STEPS} />
        </section>

        <section className="about-section" aria-labelledby="about-sell" style={{ '--series': 'var(--rb-series-5)' }}>
          <h2 id="about-sell" className="about-heading display-type">
            فروش
          </h2>
          <StepRail steps={SELL_STEPS} />
        </section>

        <section className="about-section" aria-labelledby="about-condition" style={{ '--series': 'var(--rb-series-6)' }}>
          <h2 id="about-condition" className="about-heading display-type">
            وضعیت ظاهری، به زبان ساده
          </h2>
          <p className="about-lead">هر فروشنده وضعیت نسخه‌اش را با یکی از این پنج درجه مشخص می‌کند.</p>
          <dl className="about-grades">
            {Object.keys(CONDITION_LABELS).map((key) => (
              <div key={key} className="about-grade">
                <dt>
                  <ConditionMeasure condition={key} label={CONDITION_LABELS[key]} />
                </dt>
                <dd>{CONDITION_NOTES[key]}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="about-section" aria-labelledby="about-trust" style={{ '--series': 'var(--rb-series-4)' }}>
          <h2 id="about-trust" className="about-heading display-type">
            چند نکته که بهتر است بدانی
          </h2>
          <ul className="about-facts">
            <li>از فروشنده فقط نام کاربری‌اش دیده می‌شود؛ ایمیل و شماره‌ی تماس هیچ‌کس نمایش داده نمی‌شود.</li>
            <li>آگهی ویرایش‌شده دوباره به صف بررسی می‌رود و تا تأیید، در فهرست دیده نمی‌شود.</li>
            <li>پرداخت فعلاً آزمایشی است: هیچ پولی جابه‌جا نمی‌شود و فقط روند خرید شبیه‌سازی می‌شود.</li>
          </ul>
        </section>

        <div className="about-cta">
          <Link to="/books" className="btn btn-primary">
            مرور کتاب‌ها
          </Link>
          <Link to="/create-book" className="btn btn-outline-primary">
            فروش کتاب
          </Link>
          <Link to="/contact" className="btn btn-link">
            تماس با ما
          </Link>
        </div>
      </Container>
    </div>
  );
}

export default About;
