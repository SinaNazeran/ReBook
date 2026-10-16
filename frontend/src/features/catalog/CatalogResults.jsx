import { Button, Row, Col } from "react-bootstrap";
import EmptyShelf from "../../components/EmptyShelf";
import { Link } from "react-router-dom";
import { FiPlusCircle } from "react-icons/fi";
import BookCard, { BookCardSkeleton } from "../../components/BookCard";
export function CatalogResults({
  loadError,
  handleRetry,
  loading,
  books,
  chips,
  clearChips,
  activeCategory,
  gridRef,
  displayedWishlistIds,
  pendingWishlistIds,
  isAuthenticated,
  handleToggleWishlist,
  hasMore,
  handleLoadMore,
  nextPageHref,
  loadingMore
}) {
  return <>
        {loadError ? <div className="list-state" role="alert">
            <p>کتاب‌ها بارگذاری نشدند. اتصال اینترنت را بررسی کن و دوباره امتحان کن.</p>
            <Button variant="outline-secondary" onClick={handleRetry}>
              تلاش دوباره
            </Button>
          </div> : !loading && books.length === 0 ? <div className="list-state">
            <EmptyShelf />
            {chips.length > 0 ? <>
                <p>با این فیلترها کتابی پیدا نشد.</p>
                <Button variant="outline-secondary" onClick={clearChips}>
                  حذف فیلترها
                </Button>
              </> : <>
                <p>
                  {activeCategory ? `در «${activeCategory.name}» هنوز کتابی نیست.` : 'هنوز کتابی در قفسه نیست.'}{' '}
                  کتابی داری که دیگر سراغش نمی‌روی؟
                </p>
                <Link to="/create-book" className="btn btn-primary d-inline-flex align-items-center gap-2">
                  <FiPlusCircle aria-hidden="true" />
                  فروش کتاب
                </Link>
              </>}
          </div> : <>
            {/* عنوان کارت‌ها h3 است؛ این h2 سلسله‌مراتب را کامل می‌کند و پرشی برای صفحه‌خوان به نتیجه‌هاست */}
            <h2 className="visually-hidden">نتیجه‌ها</h2>
            <Row ref={gridRef} className="g-3 g-md-4" aria-busy={loading}>
              {loading ? Array.from({
          length: 8
        }, (_, i) => <Col key={i} xs={6} md={4} lg={3}>
                      <BookCardSkeleton />
                    </Col>) : books.map(book => <Col key={book.id} xs={6} md={4} lg={3}>
                      <BookCard book={book} isWishlisted={displayedWishlistIds.has(book.id)} wishlistBusy={pendingWishlistIds.has(book.id)} onToggleWishlist={isAuthenticated ? handleToggleWishlist : undefined} />
                    </Col>)}
            </Row>
            {!loading && hasMore && <div className="catalog-continuation">
                {/* لینک واقعی برای مرورگر و خزنده؛ کلیک ساده رفتار افزودن و فوکوس قبلی را نگه می‌دارد. */}
                <Link to={nextPageHref} className={`btn btn-outline-primary${loadingMore ? ' disabled' : ''}`} aria-disabled={loadingMore || undefined} onClick={event => {
                  if (loadingMore) { event.preventDefault(); return; }
                  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                  event.preventDefault();
                  handleLoadMore();
                }}>
                  {loadingMore ? 'در حال بارگذاری…' : 'نمایش بیشتر'}
                </Link>
              </div>}
          </>}
</>;
}
