import BookCard from "../../components/BookCard";
export function BookEditorPreview({
  previewBook
}) {
  return <aside className="sell-preview" aria-label="پیش‌نمایش آگهی">
              <p className="sell-preview-caption">در فهرست این‌طور دیده می‌شود</p>
              {/* inert: پیش‌نمایش فقط دیدنی است، لینک و فوکوس ندارد */}
              <div inert>
                <BookCard book={previewBook} />
              </div>
            </aside>;
}
