import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Modal, Button, Alert } from 'react-bootstrap';
import Form from './Form';
import Receipt from './Receipt';
import { orderAPI, getErrorMessage } from '../services/api';

/**
 * پرداخت آزمایشی سفارشی که در انتظار پرداخت مانده (صفحه‌ی کتاب و «معاملات من»). سفارش تازه از راه سبد خرید ثبت می‌شود.
 * پرداخت شبیه‌سازی است (FakePaymentView) و متن دکمه و یادداشت همین را صریح می‌گویند.
 *
 * @param {object} book - کتاب سفارش
 * @param {number} existingOrderId - سفارش باز خود کاربر
 * @param {() => void} onPaid - پس از پرداخت موفق (صفحه کتاب را فروخته‌شده نشان می‌دهد)
 * @param {() => void} onStale - پس از پرداخت ناموفق (سفارش شاید لغو یا پرداخت شده باشد؛ صفحه وضعیت تازه را می‌گیرد)
 */
function PurchaseModal({ show, onHide, book, existingOrderId, onPaid, onStale }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [trackingCode, setTrackingCode] = useState('');
  // جزئیات کتاب دسته را شیء می‌دهد، فهرست سفارش‌ها category_root را
  const seriesRoot = book.category_root ?? (book.category ? book.category.parent || book.category.id : null);

  const price = Number(book.price).toLocaleString('fa-IR');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await orderAPI.payOrder(existingOrderId);
      setTrackingCode(response.data.reference_code);
      onPaid?.();
    } catch (err) {
      setError(getErrorMessage(err));
      onStale?.();
    } finally {
      setBusy(false);
    }
  };

  // بستن در حین پرداخت مجاز نیست تا کاربر از نتیجه بی‌خبر نماند
  const handleHide = () => {
    if (!busy) onHide();
  };

  return (
    <Modal show={show} onHide={handleHide} centered className="purchase-modal" aria-labelledby="purchase-title">
      {trackingCode ? (
        <div className="purchase-receipt">
          <Modal.Header closeButton closeLabel="بستن">
            <Modal.Title id="purchase-title" as="h2" className="h5">
              پرداخت آزمایشی انجام شد
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Receipt
              books={[{ ...book, category_root: seriesRoot }]}
              trackingCode={trackingCode}
              note="به نام تو ثبت شد و فروشنده خبردار شد. وضعیت ارسال را در «معاملات من» دنبال کن."
            />
          </Modal.Body>
          <Modal.Footer>
            <Link to="/my-orders" className="btn btn-outline-secondary">
              معاملات من
            </Link>
            <Button variant="primary" onClick={onHide}>
              بستن
            </Button>
          </Modal.Footer>
        </div>
      ) : (
        <Form onSubmit={handleSubmit} noValidate>
          <Modal.Header closeButton={!busy} closeLabel="بستن">
            <Modal.Title id="purchase-title" as="h2" className="h5">
              پرداخت سفارش
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <dl className="purchase-summary">
              <dt>کتاب</dt>
              <dd>
                <bdi>{book.title}</bdi>
              </dd>
              <dt>مبلغ</dt>
              <dd className="purchase-price">
                {price} <span className="book-card-currency">تومان</span>
              </dd>
            </dl>

            <p className="purchase-note">
              پرداخت در ری‌بوک فعلاً آزمایشی است: هیچ پولی جابه‌جا نمی‌شود و فقط روند خرید شبیه‌سازی می‌شود.
            </p>

            {error && (
              <Alert variant="danger" className="mb-0" role="alert">
                {error}
              </Alert>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="outline-secondary" onClick={handleHide} disabled={busy}>
              انصراف
            </Button>
            <Button variant="primary" type="submit" disabled={busy}>
              {busy ? 'در حال پرداخت آزمایشی…' : 'پرداخت آزمایشی'}
            </Button>
          </Modal.Footer>
        </Form>
      )}
    </Modal>
  );
}

export default PurchaseModal;
