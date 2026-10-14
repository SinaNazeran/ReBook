import { Button } from "react-bootstrap";
import { FiTrash2, FiUpload } from "react-icons/fi";
import { MAX_IMAGE_SIZE_MB, ACCEPTED_IMAGES } from "./validation.js";
import Form from "../../components/Form";
export function BookCoverFields({
  shownCover,
  imagePreview,
  coverImage,
  removeImage,
  existingCover,
  dragging,
  error,
  setDragging,
  handleDrop,
  handleImageChange,
  formData,
  handleChange
}) {
  return <fieldset className="sell-section">
                <legend>جلد و یادداشت</legend>

                <div className="cover-field mb-4">
                  <p className="form-label" id="cover-label">
                    عکس جلد <span className="sell-optional">(اختیاری)</span>
                  </p>
                  {shownCover ? <div className="cover-picked">
                      <img src={shownCover} alt={imagePreview ? 'پیش‌نمایش جلد' : 'جلد فعلی'} />
                      <div className="cover-picked-actions">
                        <label htmlFor="cover_image" className="btn btn-outline-secondary">
                          تغییر عکس
                        </label>
                        {/* در ویرایش، برداشتن عکس تازه جلد فعلی را برمی‌گرداند؛ پاک کردن جلد فعلی هنوز ممکن نیست */}
                        {coverImage && <Button variant="outline-secondary" onClick={removeImage} className="d-inline-flex align-items-center gap-2">
                            <FiTrash2 aria-hidden="true" />
                            {existingCover ? 'برگشت به جلد فعلی' : 'حذف'}
                          </Button>}
                      </div>
                    </div> : <label htmlFor="cover_image" className={`cover-dropzone${dragging ? ' is-dragging' : ''}${error('cover_image') ? ' is-invalid' : ''}`} onDragOver={e => {
        e.preventDefault();
        setDragging(true);
      }} onDragLeave={() => setDragging(false)} onDrop={handleDrop}>
                      <FiUpload size={28} aria-hidden="true" />
                      <span>عکس روبه‌روی جلد را اینجا بکش یا برای انتخاب بزن</span>
                      <span className="cover-dropzone-hint">
                        JPG، PNG یا WebP، تا {MAX_IMAGE_SIZE_MB.toLocaleString('fa-IR')} مگابایت. بی‌عکس، جلد ساده‌ی
                        مجموعه نمایش داده می‌شود.
                      </span>
                    </label>}
                  <input id="cover_image" type="file" accept={ACCEPTED_IMAGES} onChange={handleImageChange} className="visually-hidden" aria-labelledby="cover-label" aria-describedby={error('cover_image') ? 'cover-error' : undefined} />
                  {error('cover_image') && <p id="cover-error" className="sell-error" role="alert">
                      {error('cover_image')}
                    </p>}
                </div>

                <Form.Group controlId="description">
                  <Form.Label>
                    یادداشت برای خریدار <span className="sell-optional">(اختیاری)</span>
                  </Form.Label>
                  <Form.Control as="textarea" rows={5} name="description" autoComplete="off" value={formData.description} onChange={handleChange} dir="auto" placeholder="هر چیزی که خریدار باید بداند: خط‌کشی یا یادداشت، پارگی، نوبت چاپ، ترجمه‌ی چه کسی." isInvalid={!!error('description')} />
                  <Form.Control.Feedback type="invalid">{error('description')}</Form.Control.Feedback>
                </Form.Group>
              </fieldset>;
}
