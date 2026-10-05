import { Spinner } from 'react-bootstrap';

/**
 * @param {boolean} fullPage - آیا لودینگ باید کل ارتفاع صفحه را بگیرد (مثلاً هنگام تعویض Route)
 * @param {string} message - متن نمایشی کنار اسپینر
 */
function Loading({ fullPage = false, message = 'در حال بارگذاری…' }) {
  return (
    <div
      className={`loading-container${fullPage ? ' loading-fullpage' : ''}`}
      role="status"
      aria-live="polite"
    >
      <Spinner animation="border" variant="primary" />
      <span className="ms-2">{message}</span>
    </div>
  );
}

export default Loading;