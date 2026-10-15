import { catalogDescription } from '../utils/metadata.js';
import PageMetadata from '../components/PageMetadata.jsx';
import { ORDERING_OPTIONS } from "../features/catalog/useCatalogFilters.js";
import { useState } from "react";
import { useCatalogFilters } from "../features/catalog/useCatalogFilters.js";
import { useCatalogBooks } from "../features/catalog/useCatalogBooks.js";
import { useCatalogWishlist } from "../features/catalog/useCatalogWishlist.js";
import { seriesInk } from "../utils/series";
import { Container, Form } from "react-bootstrap";
import { CatalogCategories } from "../features/catalog/CatalogCategories.jsx";
import { CatalogFilters } from "../features/catalog/CatalogFilters.jsx";
import { Link } from "react-router-dom";
import { FiX } from "react-icons/fi";
import { CatalogResults } from "../features/catalog/CatalogResults.jsx";
import CategoryState from '../components/CategoryState';
function BookList() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const {
    categoryState,
    setSearchParams,
    search,
    setSearch,
    selectedCondition,
    setSelectedCondition,
    minPrice,
    setMinPrice,
    maxPrice,
    setMaxPrice,
    priceError,
    setPriceError,
    showFilters,
    setShowFilters,
    paramsKey,
    page,
    activeSlug,
    ordering,
    handleSubmit,
    handleOrderingChange,
    rootCategories,
    activeCategory,
    activeRoot,
    subCategories,
    categoryHref,
    chips,
    sheetFilterCount,
    clearChips,
    withParams,
    title,
    titleInk
  } = useCatalogFilters(setLoading, setLoadError);
  const {
    books,
    count,
    hasMore,
    loadingMore,
    gridRef,
    handleRetry,
    handleLoadMore
  } = useCatalogBooks(paramsKey, page, setSearchParams, setLoading, setLoadError);
  const {
    isAuthenticated,
    displayedWishlistIds,
    pendingWishlistIds,
    handleToggleWishlist
  } = useCatalogWishlist(books);
  return <div className="series-paper" style={{
    '--series': activeRoot ? seriesInk(activeRoot.id) : undefined
  }}>
      <Container className="book-list-page">
        <PageMetadata title={`${title} | ری‌بوک`} description={catalogDescription(activeCategory, chips)} />
<CatalogCategories rootCategories={rootCategories} categoryHref={categoryHref} activeSlug={activeSlug} activeRoot={activeRoot} subCategories={subCategories} activeCategory={activeCategory} />
        <CategoryState state={categoryState} />

        {/* سرصفحه‌ی مجموعه: مرکب دسته‌ی فعال نوار پهن بالای سرصفحه می‌شود */}
        <header className="list-header" style={{
        '--series-ink': titleInk
      }}>
          <div>
            <h1 className="list-title display-type">
              {title}
              {!loading && !loadError && <span className="list-count">
                  <span className="list-count-number">{count.toLocaleString('fa-IR')}</span> کتاب
                </span>}
            </h1>
            <p className="list-note">همه‌ی آگهی‌ها پیش از انتشار بررسی می‌شوند.</p>
          </div>

          <Form.Group controlId="ordering" className="list-sort">
            <Form.Label>مرتب‌سازی</Form.Label>
            <Form.Select value={ordering} onChange={handleOrderingChange}>
              {ORDERING_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>)}
            </Form.Select>
          </Form.Group>
        </header>

        {/* همیشه در DOM تا تغییر تعداد نتیجه با فیلترها خوانده شود */}
        <p className="visually-hidden" role="status">
          {loading ? 'در حال بارگذاری کتاب‌ها' : loadError ? '' : `${count.toLocaleString('fa-IR')} کتاب`}
        </p>

        <CatalogFilters handleSubmit={handleSubmit} search={search} setSearch={setSearch} setShowFilters={setShowFilters} showFilters={showFilters} sheetFilterCount={sheetFilterCount} selectedCondition={selectedCondition} setSelectedCondition={setSelectedCondition} minPrice={minPrice} priceError={priceError} setMinPrice={setMinPrice} setPriceError={setPriceError} maxPrice={maxPrice} setMaxPrice={setMaxPrice} />

        {chips.length > 0 && <div className="list-chips" aria-label="فیلترهای فعال">
            {chips.map(chip => <Link key={chip.key} to={{
          search: withParams({
            [chip.key]: ''
          }).toString()
        }} className="list-chip" aria-label={`حذف فیلتر ${chip.label}`}>
                <span dir="auto">{chip.label}</span>
                <FiX aria-hidden="true" />
              </Link>)}
            {chips.length > 1 && <button type="button" className="list-chips-clear" onClick={clearChips}>
                حذف همه
              </button>}
          </div>}

<CatalogResults loadError={loadError} handleRetry={handleRetry} loading={loading} books={books} chips={chips} clearChips={clearChips} activeCategory={activeCategory} gridRef={gridRef} displayedWishlistIds={displayedWishlistIds} pendingWishlistIds={pendingWishlistIds} isAuthenticated={isAuthenticated} handleToggleWishlist={handleToggleWishlist} hasMore={hasMore} handleLoadMore={handleLoadMore} loadingMore={loadingMore} />
      </Container>
    </div>;
}
export default BookList;
