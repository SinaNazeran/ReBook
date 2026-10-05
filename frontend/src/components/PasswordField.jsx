import { useState } from 'react';
import { InputGroup, Button } from 'react-bootstrap';
import Form from './Form';

/** فیلد رمز با دکمه‌ی نمایش؛ روی موبایل تایپ رمز بی‌دیدن خطاساز است */
function PasswordField({ id, label, error, help, ...inputProps }) {
  const [visible, setVisible] = useState(false);
  const helpId = help ? `${id}-help` : undefined;

  return (
    <Form.Group controlId={id} className="mb-3">
      <Form.Label>{label}</Form.Label>
      <InputGroup hasValidation>
        <Form.Control
          type={visible ? 'text' : 'password'}
          dir="ltr"
          aria-describedby={helpId}
          isInvalid={!!error}
          {...inputProps}
        />
        <Button
          variant="outline-secondary"
          onClick={() => setVisible((v) => !v)}
          aria-pressed={visible}
          aria-label={visible ? 'پنهان کردن رمز' : 'نمایش رمز'}
        >
          {visible ? 'پنهان' : 'نمایش'}
        </Button>
        <Form.Control.Feedback type="invalid">{error}</Form.Control.Feedback>
      </InputGroup>
      {help && <Form.Text id={helpId}>{help}</Form.Text>}
    </Form.Group>
  );
}

export default PasswordField;
