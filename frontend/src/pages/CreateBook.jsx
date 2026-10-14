import { EDIT_LEADS } from "../features/book-editor/validation.js";
import { useBookEditor } from "../features/book-editor/useBookEditor.js";
import Loading from "../components/Loading";
import NotFound from "./NotFound";
import { Container, Button, Alert, Row, Col } from "react-bootstrap";
import { Link, useParams } from "react-router-dom";
import { seriesInk } from "../utils/series";
import { BookEditorForm } from "../features/book-editor/BookEditorForm.jsx";
import { BookEditorPreview } from "../features/book-editor/BookEditorPreview.jsx";
function CreateBook() {
  const {
    editing,
    listing,
    setListing,
    setReloadKey,
    generalError,
    handleSubmit,
    categories,
    formData,
    handleChange,
    error,
    roots,
    previewBook,
    shownCover,
    imagePreview,
    coverImage,
    removeImage,
    existingCover,
    dragging,
    setDragging,
    handleDrop,
    handleImageChange,
    loading
  } = useBookEditor();
  if (listing.state === 'loading') return <Loading fullPage />;
  if (listing.state === 'not_found') {
    return <NotFound title="این آگهی پیدا نشد" message="شاید حذف شده یا آگهی تو نیست. آگهی‌هایت را در «کتاب‌های من» ببین." />;
  }
  if (listing.state !== 'ready') {
    // آگهی هست اما الان ویرایش‌شدنی نیست؛ همان حالت پیام صفحه‌های دیگر
    return <div className="series-paper">
        <Container className="sell-page">
          <title>ویرایش آگهی | ری‌بوک</title>
          <header className="sell-header">
            <h1 className="sell-title">ویرایش آگهی</h1>
          </header>
          <div className="list-state" role={listing.state === 'error' ? 'alert' : undefined}>
            {listing.state === 'ordered' && <>
                <p>
                  خریداری این کتاب را سفارش داده و پرداختش مانده است؛ اگر لازم است تغییرش بدهی، اول سفارش را لغو کن.
                </p>
                <Link to="/my-orders?tab=sales" className="btn btn-primary">
                  معاملات من
                </Link>
              </>}
            {listing.state === 'sold' && <>
                <p>این کتاب فروخته شده و دیگر ویرایش نمی‌شود. جزئیات فروش در «معاملات من» است.</p>
                <Link to="/my-orders?tab=sales" className="btn btn-outline-secondary">
                  معاملات من
                </Link>
              </>}
            {listing.state === 'error' && <>
                <p>{listing.message}</p>
                <Button variant="outline-secondary" onClick={() => {
              setListing({
                state: 'loading'
              });
              setReloadKey(key => key + 1);
            }}>
                  تلاش دوباره
                </Button>
              </>}
          </div>
        </Container>
      </div>;
  }
  return <div className="series-paper" style={{
    '--series': previewBook.category_root != null ? seriesInk(previewBook.category_root) : undefined
  }}>
      {/* کاغذ صفحه همان مجموعه‌ای است که فروشنده انتخاب می‌کند، هم‌رنگ کارت پیش‌نمایش */}
      <Container className="sell-page">
        <title>{editing ? 'ویرایش آگهی | ری‌بوک' : 'فروش کتاب | ری‌بوک'}</title>
        <header className="sell-header">
          <h1 className="sell-title">{editing ? 'ویرایش آگهی' : 'فروش کتاب'}</h1>
          <p className="sell-lead">
            {editing ? EDIT_LEADS[listing.status] : 'مشخصات نسخه‌ای را که داری بنویس. پیش از انتشار، تیم ری‌بوک آگهی را بررسی می‌کند و نتیجه را در «کتاب‌های من» می‌بینی.'}
          </p>
        </header>

        {generalError && <Alert variant="danger" role="alert">
            {generalError}
          </Alert>}

        <Row className="g-4 g-lg-5">
          <Col lg={8}>
            <BookEditorForm handleSubmit={handleSubmit} formData={formData} handleChange={handleChange} error={error} roots={roots} categories={categories} shownCover={shownCover} imagePreview={imagePreview} coverImage={coverImage} removeImage={removeImage} existingCover={existingCover} dragging={dragging} setDragging={setDragging} handleDrop={handleDrop} handleImageChange={handleImageChange} loading={loading} editing={editing} />
          </Col>

          <Col lg={4} className="d-none d-lg-block">
            <BookEditorPreview previewBook={previewBook} />
          </Col>
        </Row>
      </Container>
    </div>;
}
function CreateBookPage() {
  const {
    id
  } = useParams();
  return <CreateBook key={id ?? 'new'} />;
}
export default CreateBookPage;
