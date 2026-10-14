import { CONDITION_OPTIONS } from "./useCatalogFilters.js";
import { Form, InputGroup, Button, Offcanvas } from "react-bootstrap";
import { FiSearch, FiSliders } from "react-icons/fi";
import { onlyDigits } from "../../utils/digits";
const FILTER_FORM_ID = 'book-filters';
export function CatalogFilters({
  handleSubmit,
  search,
  setSearch,
  setShowFilters,
  showFilters,
  sheetFilterCount,
  selectedCondition,
  setSelectedCondition,
  minPrice,
  priceError,
  setMinPrice,
  setPriceError,
  maxPrice,
  setMaxPrice
}) {
  return <div className="list-toolbar">
          <Form id={FILTER_FORM_ID} onSubmit={handleSubmit} role="search" className="list-search">
            <Form.Label htmlFor="book-search">جستجو</Form.Label>
            <InputGroup>
              <Form.Control id="book-search" type="search" name="search" placeholder="عنوان یا نویسنده…" value={search} onChange={e => setSearch(e.target.value)} />
              <Button type="submit" variant="outline-secondary" aria-label="جستجو">
                <FiSearch aria-hidden="true" />
              </Button>
            </InputGroup>
          </Form>

          <Button variant="outline-secondary" className="list-filters-toggle d-lg-none d-inline-flex align-items-center gap-2" onClick={() => setShowFilters(true)} aria-controls="list-filters" aria-expanded={showFilters}>
            <FiSliders aria-hidden="true" />
            فیلترها
            {sheetFilterCount > 0 && <span className="list-filters-count">{sheetFilterCount.toLocaleString('fa-IR')}</span>}
          </Button>

          <Offcanvas id="list-filters" show={showFilters} onHide={() => setShowFilters(false)} responsive="lg" placement="bottom" className="list-filters" aria-labelledby="list-filters-title">
            <Offcanvas.Header closeButton closeLabel="بستن" className="d-lg-none">
              <Offcanvas.Title id="list-filters-title" as="h2" className="h5">
                فیلترها
              </Offcanvas.Title>
            </Offcanvas.Header>
            <Offcanvas.Body className="list-filters-body">
              <Form.Group controlId="filter-condition" className="list-field-condition">
                <Form.Label>وضعیت ظاهری</Form.Label>
                <Form.Select form={FILTER_FORM_ID} value={selectedCondition} onChange={e => setSelectedCondition(e.target.value)}>
                  {CONDITION_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>)}
                </Form.Select>
              </Form.Group>

              <fieldset className="list-field-price">
                <legend className="form-label">قیمت</legend>
                <div className="list-price-inputs">
                  <InputGroup hasValidation>
                    <Form.Control form={FILTER_FORM_ID} inputMode="numeric" autoComplete="off" placeholder="از" aria-label="حداقل قیمت" value={minPrice} isInvalid={Boolean(priceError)} aria-invalid={Boolean(priceError) || undefined} aria-describedby={priceError ? 'price-error' : undefined} onChange={e => {
                setMinPrice(onlyDigits(e.target.value));
                setPriceError('');
              }} />
                    <InputGroup.Text>تومان</InputGroup.Text>
                  </InputGroup>
                  <InputGroup>
                    <Form.Control form={FILTER_FORM_ID} inputMode="numeric" autoComplete="off" placeholder="تا" aria-label="حداکثر قیمت" value={maxPrice} isInvalid={Boolean(priceError)} aria-invalid={Boolean(priceError) || undefined} aria-describedby={priceError ? 'price-error' : undefined} onChange={e => {
                setMaxPrice(onlyDigits(e.target.value));
                setPriceError('');
              }} />
                    <InputGroup.Text>تومان</InputGroup.Text>
                  </InputGroup>
                </div>
                {priceError && <p id="price-error" className="list-field-error" role="alert">
                    {priceError}
                  </p>}
              </fieldset>

              <Button type="submit" form={FILTER_FORM_ID} className="list-apply">
                اعمال
              </Button>
            </Offcanvas.Body>
          </Offcanvas>
        </div>;
}
