import { useContext } from 'react';
import { Form as BSForm } from 'react-bootstrap';
import FormContext from 'react-bootstrap/FormContext';

/**
 * همان Form در react-bootstrap، با یک تفاوت: isInvalid فقط کلاس قرمز is-invalid را می‌گذارد،
 * پس صفحه‌خوان نمی‌فهمید فیلد خطا دارد. اینجا aria-invalid گذاشته می‌شود و متن Feedback
 * (با شناسه‌ی `<controlId>-error`) به aria-describedby فیلد اضافه می‌شود.
 * فقط برای فیلدهای داخل Form.Group با controlId کار می‌کند؛ خطای سفارشی (مثل قیمت در BookList) دستی وصل می‌شود.
 */
function withInvalidState(Field) {
  function Wrapped({ isInvalid, id, 'aria-describedby': describedBy, ...props }) {
    const { controlId } = useContext(FormContext);
    const errorId = isInvalid && (id || controlId) ? `${id || controlId}-error` : null;
    return (
      <Field
        id={id}
        isInvalid={isInvalid}
        aria-invalid={isInvalid || undefined}
        aria-describedby={[errorId, describedBy].filter(Boolean).join(' ') || undefined}
        {...props}
      />
    );
  }
  return Wrapped;
}

function Feedback(props) {
  const { controlId } = useContext(FormContext);
  return <BSForm.Control.Feedback id={controlId ? `${controlId}-error` : undefined} {...props} />;
}

const Control = Object.assign(withInvalidState(BSForm.Control), { Feedback });
const Select = withInvalidState(BSForm.Select);

function Form(props) {
  return <BSForm {...props} />;
}

Object.assign(Form, { Group: BSForm.Group, Label: BSForm.Label, Text: BSForm.Text, Check: BSForm.Check, Control, Select });

export default Form;
