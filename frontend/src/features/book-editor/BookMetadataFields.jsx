import Form from "../../components/Form";
import { Row, Col } from "react-bootstrap";
export function BookMetadataFields({
  formData,
  handleChange,
  error,
  roots,
  categories
}) {
  return <fieldset className="sell-section">
                <legend>کتاب</legend>

                <Form.Group controlId="title" className="mb-3">
                  <Form.Label>عنوان</Form.Label>
                  <Form.Control name="title" autoComplete="off" value={formData.title} onChange={handleChange} maxLength={200} dir="auto" required aria-required="true" isInvalid={!!error('title')} />
                  <Form.Control.Feedback type="invalid">{error('title')}</Form.Control.Feedback>
                </Form.Group>

                <Row className="g-3">
                  <Col md={6}>
                    <Form.Group controlId="author">
                      <Form.Label>نویسنده</Form.Label>
                      <Form.Control name="author" autoComplete="off" value={formData.author} onChange={handleChange} maxLength={200} dir="auto" required aria-required="true" isInvalid={!!error('author')} />
                      <Form.Control.Feedback type="invalid">{error('author')}</Form.Control.Feedback>
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group controlId="publisher">
                      <Form.Label>
                        انتشارات <span className="sell-optional">(اختیاری)</span>
                      </Form.Label>
                      <Form.Control name="publisher" autoComplete="off" value={formData.publisher} onChange={handleChange} maxLength={200} dir="auto" isInvalid={!!error('publisher')} />
                      <Form.Control.Feedback type="invalid">{error('publisher')}</Form.Control.Feedback>
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group controlId="isbn">
                      <Form.Label>
                        شابک <span className="sell-optional">(اختیاری)</span>
                      </Form.Label>
                      <Form.Control name="isbn" value={formData.isbn} onChange={handleChange} maxLength={17} dir="ltr" inputMode="numeric" autoComplete="off" placeholder="978-964-…" aria-describedby="isbn-help" isInvalid={!!error('isbn')} />
                      <Form.Text id="isbn-help">پشت جلد، بالای بارکد.</Form.Text>
                      <Form.Control.Feedback type="invalid">{error('isbn')}</Form.Control.Feedback>
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group controlId="category">
                      <Form.Label>
                        دسته‌بندی <span className="sell-optional">(اختیاری)</span>
                      </Form.Label>
                      <Form.Select name="category" value={formData.category} onChange={handleChange} aria-describedby="category-help" isInvalid={!!error('category')}>
                        <option value="">بدون دسته‌بندی</option>
                        {roots.map(root => <optgroup key={root.id} label={root.name}>
                            <option value={root.id}>{root.name}</option>
                            {categories.filter(cat => cat.parent === root.id).map(cat => <option key={cat.id} value={cat.id}>
                                  {cat.name}
                                </option>)}
                          </optgroup>)}
                      </Form.Select>
                      <Form.Text id="category-help">خریداران کتاب را از زبانه‌ی همین دسته پیدا می‌کنند.</Form.Text>
                      <Form.Control.Feedback type="invalid">{error('category')}</Form.Control.Feedback>
                    </Form.Group>
                  </Col>
                </Row>
              </fieldset>;
}
