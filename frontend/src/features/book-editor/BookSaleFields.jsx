import { CONDITION_LABELS, CONDITION_NOTES } from "../../utils/condition";
import ConditionMeasure from "../../components/ConditionMeasure";
import Form from "../../components/Form";
import { InputGroup } from "react-bootstrap";
export function BookSaleFields({
  error,
  formData,
  handleChange
}) {
  return <>
              <fieldset className="sell-section" aria-describedby={error('condition') ? 'condition-error' : undefined}>
                <legend>وضعیت این نسخه</legend>
                <div className="condition-options">
                  {Object.entries(CONDITION_LABELS).map(([value, label]) => <label key={value} className="condition-option" htmlFor={`condition-${value}`}>
                      <input id={`condition-${value}`} type="radio" name="condition" value={value} checked={formData.condition === value} onChange={handleChange} className="form-check-input" />
                      <span className="condition-option-body">
                        <ConditionMeasure condition={value} label={label} />
                        <span className="condition-option-note">{CONDITION_NOTES[value]}</span>
                      </span>
                    </label>)}
                </div>
                {error('condition') && <p id="condition-error" className="sell-error">
                    {error('condition')}
                  </p>}
              </fieldset>

              <fieldset className="sell-section">
                <legend>قیمت</legend>
                <Form.Group controlId="price" className="sell-price">
                  <Form.Label className="visually-hidden">قیمت به تومان</Form.Label>
                  <InputGroup hasValidation>
                    <Form.Control name="price" value={formData.price} onChange={handleChange} inputMode="numeric" autoComplete="off" required aria-required="true" aria-describedby="price-echo" isInvalid={!!error('price')} />
                    <InputGroup.Text>تومان</InputGroup.Text>
                    <Form.Control.Feedback type="invalid">{error('price')}</Form.Control.Feedback>
                  </InputGroup>
                  <Form.Text id="price-echo" aria-live="polite">
                    {formData.price ? `${Number(formData.price).toLocaleString('fa-IR')} تومان` : 'فقط عدد؛ مثلاً ۸۵۰۰۰'}
                  </Form.Text>
                </Form.Group>
              </fieldset>
</>;
}
