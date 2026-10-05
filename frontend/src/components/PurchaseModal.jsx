import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Modal, Button, Alert } from 'react-bootstrap';
import Form from './Form';
import { FiCopy, FiCheck } from 'react-icons/fi';
import { orderAPI, getErrorMessage } from '../services/api';

/**
 * خرید یک‌مرحله‌ای: خلاصه → آدرس → ثبت سفارش و پرداخت آزمایشی → رسید با کد پیگیری.
 * پرداخت شبیه‌سازی است (FakePaymentView) و متن دکمه و یادداشت همین را صریح می‌گویند.
 *
 * @param {object} book - کتاب صفحه‌ی جزئیات
 * @param {number|null} existingOrderId - سفارش باز خود کاربر؛ اگر باشد فقط پرداخت می‌شود
 * @param {string} defaultAddress - آدرس پروفایل برای پیش‌پر کردن
 * @param {() => void} onPaid - پس از پرداخت موفق (صفحه کتاب را فروخته‌شده نشان می‌دهد)
 * @param {() => void} onStale - وقتی وضعیت سفارش روی سرور با صفحه فرق کرده و باید تازه شود
 */
function PurchaseModal({ show, onHide, book, existingOrderId = null, defaultAddress = '', onPaid, onStale }) {
  const [address, setAddress] = useState(defaultAddress);
  const [addressError, setAddressError] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [trackingCode, setTrackingCode] = useState('');
  const [copied, setCopied] = useState(false);

  const price = Number(book.price).toLocaleString('fa-IR');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!existingOrderId && !address.trim()) {
      setAddressError('آدرس ارسال را بنویس تا فروشنده بداند کتاب را کجا بفرستد.');
      return;
    }

    setBusy(true);
    setError('');

    let orderId = existingOrderId;
    if (!orderId) {
      try {
        const response = await orderAPI.createOrder({ book: book.id, shipping_address: address.trim() });
        orderId = response.data.id;
      } catch (err) {
        setError(getErrorMessage(err));
        setBusy(false);
        onStale?.();
        return;
      }
    }

    try {
      const response = await orderAPI.payOrder(orderId);
      setTrackingCode(response.data.reference_code);
      onPaid?.();
    } catch (err) {
      if (existingOrderId) {
        setError(getErrorMessage(err));
      } else {
        // سفارشی که همین حالا ساخته شد و پرداخت نشد نباید نسخه را برای دیگران قفل کند
        try {
          await orderAPI.cancelOrder(orderId);
          setError(`پرداخت انجام نشد و سفارش لغو شد؛ می‌توانی دوباره امتحان کنی. (${getErrorMessage(err)})`);
        } catch {
          setError('پرداخت انجام نشد. سفارش در «سفارش‌های من» در انتظار پرداخت مانده است.');
          onStale?.();
        }
      }
    } finally {
      setBusy(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(trackingCode);
      setCopied(true);
    } catch {
      // کلیپ‌بورد در دسترس نیست (مثلاً http بدون localhost)؛ کد روی صفحه انتخاب‌شدنی است
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
            <p>
              «<bdi>{book.title}</bdi>» به نام تو ثبت شد و فروشنده خبردار شد. وضعیت ارسال را در «سفارش‌های من»
              دنبال کن.
            </p>
            <div className="receipt-code">
              <span className="receipt-code-label">کد پیگیری</span>
              <bdi className="receipt-code-value latin-id" dir="ltr">
                {trackingCode}
              </bdi>
              <Button
                variant="outline-secondary"
                size="sm"
                className="d-inline-flex align-items-center gap-1"
                onClick={handleCopy}
              >
                {copied ? <FiCheck aria-hidden="true" /> : <FiCopy aria-hidden="true" />}
                {copied ? 'کپی شد' : 'کپی'}
              </Button>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Link to="/my-orders" className="btn btn-outline-secondary">
              سفارش‌های من
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
              {existingOrderId ? 'پرداخت سفارش' : 'خرید کتاب'}
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

            {!existingOrderId && (
              <Form.Group controlId="shipping-address" className="mb-3">
                <Form.Label>آدرس ارسال</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={3}
                  value={address}
                  isInvalid={Boolean(addressError)}
                  onChange={(e) => {
                    setAddress(e.target.value);
                    setAddressError('');
                  }}
                  placeholder="استان، شهر، خیابان، پلاک، کد پستی"
                  required
                  disabled={busy}
                />
                <Form.Control.Feedback type="invalid">{addressError}</Form.Control.Feedback>
              </Form.Group>
            )}

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
              {busy
                ? 'در حال پرداخت آزمایشی...'
                : existingOrderId
                  ? 'پرداخت آزمایشی'
                  : 'ثبت سفارش و پرداخت آزمایشی'}
            </Button>
          </Modal.Footer>
        </Form>
      )}
    </Modal>
  );
}

export default PurchaseModal;
