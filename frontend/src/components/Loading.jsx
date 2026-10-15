import { Spinner } from 'react-bootstrap';

/**
 * @param {boolean} fullPage - آیا لودینگ باید کل ارتفاع صفحه را بگیرد (مثلاً هنگام تعویض Route)
 * @param {string} message - متن نمایشی کنار اسپینر
 * @param {string} heading - عنوان صفحه در حالت بارگذاری کامل؛ بارگذاری درون‌صفحه‌ای عنوان ندارد.
 */
function Loading({ fullPage = false, message = 'در حال بارگذاری…', heading = 'در حال بارگذاری صفحه' }) {
  return (
    <div
      className={`loading-container${fullPage ? ' loading-fullpage' : ''}`}
      role="status"
      aria-live="polite"
    >
      {fullPage && <h1 className="visually-hidden">{heading}</h1>}
      <Spinner animation="border" variant="primary" />
      <span className="ms-2">{message}</span>
    </div>
  );
}

export default Loading;
