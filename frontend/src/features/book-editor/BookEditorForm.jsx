import Form from "../../components/Form";
import { BookMetadataFields } from "./BookMetadataFields.jsx";
import { BookSaleFields } from "./BookSaleFields.jsx";
import { BookCoverFields } from "./BookCoverFields.jsx";
import { Button } from "react-bootstrap";
export function BookEditorForm({
  handleSubmit,
  formData,
  handleChange,
  error,
  roots,
  categories,
  shownCover,
  imagePreview,
  coverImage,
  removeImage,
  existingCover,
  dragging,
  setDragging,
  handleDrop,
  handleImageChange,
  loading,
  editing
}) {
  return <Form onSubmit={handleSubmit} noValidate>
              <BookMetadataFields formData={formData} handleChange={handleChange} error={error} roots={roots} categories={categories} />

<BookSaleFields error={error} formData={formData} handleChange={handleChange} />

              <BookCoverFields shownCover={shownCover} imagePreview={imagePreview} coverImage={coverImage} removeImage={removeImage} existingCover={existingCover} dragging={dragging} error={error} setDragging={setDragging} handleDrop={handleDrop} handleImageChange={handleImageChange} formData={formData} handleChange={handleChange} />

              <div className="sell-submit">
                <Button type="submit" variant="primary" size="lg" disabled={loading}>
                  {editing ? loading ? 'در حال ذخیره…' : 'ذخیره و ارسال برای بررسی' : loading ? 'در حال ثبت…' : 'ثبت آگهی برای بررسی'}
                </Button>
              </div>
            </Form>;
}
