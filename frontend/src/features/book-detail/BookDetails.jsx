import { Link } from "react-router-dom";
import ConditionMeasure from "../../components/ConditionMeasure";
import { CONDITION_NOTES } from "../../utils/condition";
const LONG_NOTES = 320;
const formatDate = value => new Date(value).toLocaleDateString('fa-IR', {
  year: 'numeric',
  month: 'long',
  day: 'numeric'
});
export function BookDetails({
  book,
  ink,
  children,
  notesOpen,
  setNotesOpen
}) {
  const notes = book.description?.trim();
  const notesAreLong = notes && notes.length > LONG_NOTES;
  return <>
            <header className="detail-head">
              {book.category && <Link to={`/books?category=${book.category.slug}`} className="detail-category" style={{
        '--series-ink': ink
      }}>
                  <span className="series-index-mark" aria-hidden="true" />
                  {book.category.name}
                </Link>}
              <h1 className="detail-title display-type">
                <bdi>{book.title}</bdi>
              </h1>
              <p className="detail-byline">
                <bdi>{book.author}</bdi>
                {book.publisher && <>
                    <span aria-hidden="true"> · </span>
                    <span className="visually-hidden">، انتشارات </span>
                    <bdi>{book.publisher}</bdi>
                  </>}
              </p>
            </header>

            <section className="detail-block" aria-labelledby="condition-title">
              <h2 id="condition-title" className="detail-label">
                وضعیت ظاهری
              </h2>
              <ConditionMeasure condition={book.condition} label={book.condition_display} className="is-large" />
              {CONDITION_NOTES[book.condition] && <p className="detail-muted">{CONDITION_NOTES[book.condition]}</p>}
            </section>

            {notes && <section className="detail-block" aria-labelledby="notes-title">
                <h2 id="notes-title" className="detail-label">
                  یادداشت فروشنده
                </h2>
                <p id="seller-notes" className={`detail-notes${notesAreLong && !notesOpen ? ' is-clamped' : ''}`} dir="auto">
                  {notes}
                </p>
                {notesAreLong && <button type="button" className="detail-more" aria-expanded={notesOpen} aria-controls="seller-notes" onClick={() => setNotesOpen(open => !open)}>
                    {notesOpen ? 'کمتر' : 'ادامه‌ی یادداشت'}
                  </button>}
              </section>}
{children}
            {/* شناسنامه، مثل صفحه‌ی شناسنامه‌ی کتاب چاپی: قاب دوخطی، سطرها با نقطه‌چین به مقدار می‌رسند */}
            <section className="colophon" aria-labelledby="colophon-title">
              <h2 id="colophon-title" className="colophon-title display-type">
                شناسنامه‌ی کتاب
              </h2>
              <span className="ornament-rule colophon-ornament" aria-hidden="true" />
              <dl className="colophon-list">
                <dt>عنوان</dt>
                <dd>
                  <bdi>{book.title}</bdi>
                </dd>
                <dt>نویسنده</dt>
                <dd>
                  <bdi>{book.author}</bdi>
                </dd>
                {book.publisher && <>
                    <dt>ناشر</dt>
                    <dd>
                      <bdi>{book.publisher}</bdi>
                    </dd>
                  </>}
                {book.isbn && <>
                    <dt>شابک</dt>
                    <dd>
                      <bdi dir="ltr">{book.isbn}</bdi>
                    </dd>
                  </>}
                {book.category && <>
                    <dt>مجموعه</dt>
                    <dd>{book.category.name}</dd>
                  </>}
                <dt>وضعیت ظاهری</dt>
                <dd>{book.condition_display}</dd>
                <dt>ثبت در ری‌بوک</dt>
                <dd>{formatDate(book.created_at)}</dd>
              </dl>
            </section>
</>;
}
