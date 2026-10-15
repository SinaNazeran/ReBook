import PageMetadata from '../components/PageMetadata.jsx';
import { useSubmissionGuard } from '../hooks/useSubmissionGuard';
import { useLocation, Link } from "react-router-dom";
import { useAuth } from "../context/useAuth.js";
import { useCart } from "../context/useCart.js";
import { useState, useRef, useEffect } from "react";
import { toast } from "../utils/toast";
import { getErrorMessage, cartAPI } from "../services/api";
import { Container, Button, Row, Col, Alert } from "react-bootstrap";
import Receipt from "../components/Receipt";
import Loading from "../components/Loading";
import EmptyShelf from "../components/EmptyShelf";
import { CartList } from "../features/cart/CartList.jsx";
import Form from "../components/Form";
const toman = value => Number(value).toLocaleString('fa-IR');
function Cart() {
  const { run } = useSubmissionGuard();
  const location = useLocation();
  const {
    user,
    isAuthenticated,
    authError
  } = useAuth();
  const {
    items,
    total,
    status,
    remove,
    refresh
  } = useCart();
  const [step, setStep] = useState('cart'); // cart | checkout
  const [address, setAddress] = useState('');
  const [addressError, setAddressError] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [removingId, setRemovingId] = useState(null);
  // رسید از کتاب‌هایی ساخته می‌شود که پیش از تازه شدن سبد خریده شدند
  const [receipt, setReceipt] = useState(null);
  // مرحله که عوض می‌شود فرم از صفحه می‌رود؛ فوکوس به سرتیتر رسید یا پیام خطا می‌رود تا گم نشود
  const receiptHeadingRef = useRef(null);
  const errorRef = useRef(null);
  useEffect(() => {
    if (receipt) receiptHeadingRef.current?.focus();
  }, [receipt]);
  // پس از 401 سبد دوباره بارگذاری می‌شود و پیام خطا تازه برمی‌گردد؛ پس با آماده شدن سبد هم دوباره فوکوس می‌گیرد
  useEffect(() => {
    if (error && status === 'ready') errorRef.current?.focus();
  }, [error, status]);
  useEffect(() => {
    if (step !== 'checkout' || receipt || status !== 'ready') return;
    const frame = requestAnimationFrame(() => document.getElementById('shipping-address')?.focus());
    return () => cancelAnimationFrame(frame);
  }, [step, receipt, status]);
  const available = items.filter(item => item.available);
  const unavailable = items.filter(item => !item.available);
  const handleRemove = async bookId => {
    setRemovingId(bookId);
    try {
      await remove(bookId);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setRemovingId(null);
    }
  };
  const goToCheckout = () => {
    setAddress(current => current || user?.address || '');
    setError('');
    setStep('checkout');
  };
  const handleCheckout = async e => {
    e.preventDefault();
    return run(async () => {
      if (!address.trim()) {
        setAddressError('آدرس ارسال را بنویس تا فروشنده‌ها بدانند کتاب‌ها را کجا بفرستند.');
        document.getElementById('shipping-address')?.focus();
        return;
      }
      setBusy(true);
      setError('');
      const books = available.map(item => item.book);
      try {
        const response = await cartAPI.checkout({
          // قیمت هر کتاب همان که خریدار دید؛ سرور هر کدام را جدا می‌سنجد
          books: books.map(book => ({
            id: book.id,
            price: book.price
          })),
          shipping_address: address.trim()
        });
        setReceipt({
          books,
          code: response.data.reference_code
        });
        refresh();
      } catch (err) {
        const data = err.response?.data;
        if (data?.shipping_address) {
          setAddressError(data.shipping_address[0]);
        } else if (err.response?.status === 401) {
          // نشست تمام شده؛ سبد حساب سر جایش است و پس از ورود دوباره دیده می‌شود
          setError('نشستت تمام شده است. دوباره وارد شو؛ سبدت سر جایش است و می‌توانی پرداخت را تمام کنی.');
          setStep('cart');
        } else {
          // سبد روی سرور عوض شده (یا session تمام شده)؛ سبد تازه دیده و دوباره تأیید می‌شود
          setError(getErrorMessage(err));
          setStep('cart');
          refresh();
        }
      } finally {
        setBusy(false);
      }
    });
  };
  if (authError) return <h1 className="visually-hidden">سبد خرید؛ وضعیت ورود بررسی نشد</h1>;
  if (receipt) {
    return <div className="series-paper">
        <Container className="ledger-page">
          <PageMetadata title="رسید خرید | ری‌بوک" />
          <section className="purchase-receipt cart-receipt" aria-labelledby="receipt-title">
            <h1 id="receipt-title" className="ledger-title" tabIndex={-1} ref={receiptHeadingRef}>
              پرداخت آزمایشی انجام شد
            </h1>
            <Receipt books={receipt.books} trackingCode={receipt.code} note="سفارش‌ها به نام تو ثبت شد و هر فروشنده خبردار شد. هر کتاب را فروشنده‌ی خودش جدا می‌فرستد؛ وضعیت ارسال را در «معاملات من» دنبال کن." />
            <div className="d-flex flex-wrap gap-2 mt-4">
              <Link to="/my-orders" className="btn btn-primary">
                معاملات من
              </Link>
              <Link to="/books" className="btn btn-outline-secondary">
                مرور کتاب‌ها
              </Link>
            </div>
          </section>
        </Container>
      </div>;
  }
  if (status === 'loading') return <Loading fullPage heading="سبد خرید" />;
  let body;
  if (status === 'error') {
    body = <div className="list-state" role="alert">
        <p>سبد بارگذاری نشد. اتصال اینترنت را بررسی کن و دوباره امتحان کن.</p>
        <Button variant="outline-secondary" onClick={refresh}>
          تلاش دوباره
        </Button>
      </div>;
  } else if (!items.length) {
    body = <div className="list-state">
        <EmptyShelf />
        <p>سبدت خالی است.</p>
        {!isAuthenticated && <p>
            اگر پیش‌تر در حسابت کتابی به سبد اضافه کرده‌ای،{' '}
            <Link to="/login" state={{
          from: location
        }}>
              وارد شو
            </Link>{' '}
            تا ببینی‌اش.
          </p>}
        <Link to="/books" className="btn btn-primary">
          مرور کتاب‌ها
        </Link>
      </div>;
  } else {
    // اقدام اصلی هم در خلاصه است و هم در نوار چسبان موبایل (خلاصه آنجا زیر همه‌ی ردیف‌ها می‌افتد)
    const primaryAction = className => {
      if (step === 'checkout') {
        return <Button type="submit" form="checkout-form" variant="primary" className={className} disabled={busy}>
            {busy ? 'در حال پرداخت آزمایشی…' : `پرداخت آزمایشی ${toman(total)} تومان`}
          </Button>;
      }
      if (!available.length) {
        return <Button variant="primary" className={className} disabled>
            ادامه‌ی خرید
          </Button>;
      }
      if (isAuthenticated) {
        return <Button variant="primary" className={className} onClick={goToCheckout}>
            ادامه‌ی خرید
          </Button>;
      }
      return <Link to="/login" state={{
        from: location
      }} className={`btn btn-primary ${className}`}>
          برای پرداخت وارد شو
        </Link>;
    };
    body = <Row className="g-4 g-lg-5">
        <Col lg={8}>
          {step === 'cart' ? <>
              {available.length > 0 && <CartList items={available} onRemove={handleRemove} removingId={removingId} />}
              {unavailable.length > 0 && <section className="cart-unavailable" aria-labelledby="unavailable-title">
                  <h2 id="unavailable-title" className="support-heading">
                    دیگر قابل خرید نیست
                  </h2>
                  <CartList items={unavailable} onRemove={handleRemove} removingId={removingId} />
                </section>}
            </> : <Form id="checkout-form" onSubmit={handleCheckout} noValidate className="support-form">
              <Form.Group controlId="shipping-address" className="mb-3">
                <Form.Label>آدرس ارسال</Form.Label>
                <Form.Control as="textarea" name="shipping_address" autoComplete="street-address" rows={3} value={address} isInvalid={Boolean(addressError)} onChange={e => {
              setAddress(e.target.value);
              setAddressError('');
            }} placeholder="استان، شهر، خیابان، پلاک، کد پستی" required disabled={busy} />
                <Form.Control.Feedback type="invalid">{addressError}</Form.Control.Feedback>
              </Form.Group>
              <p className="purchase-note mb-0">
                پرداخت در ری‌بوک فعلاً آزمایشی است: هیچ پولی جابه‌جا نمی‌شود و فقط روند خرید شبیه‌سازی می‌شود.
              </p>
            </Form>}
        </Col>
        <Col lg={4}>
          <aside className="cart-summary" aria-labelledby="summary-title">
            <h2 id="summary-title" className="support-heading">
              خلاصه
            </h2>
            <dl className="purchase-summary">
              <dt>کتاب‌ها</dt>
              <dd>{available.length.toLocaleString('fa-IR')}</dd>
              <dt>مبلغ کل</dt>
              <dd className="purchase-price">
                {toman(total)} <span className="book-card-currency">تومان</span>
              </dd>
            </dl>
            <p className="cart-summary-note">هر کتاب را فروشنده‌ی خودش جداگانه می‌فرستد.</p>
            {primaryAction('w-100')}
            {step === 'checkout' && <Button variant="link" className="w-100 mt-2" onClick={() => setStep('cart')} disabled={busy}>
                بازگشت به سبد
              </Button>}
          </aside>
        </Col>
        <div className="buy-bar d-lg-none">
          <p className="buy-price">
            {toman(total)} <span className="book-card-currency">تومان</span>
          </p>
          {primaryAction('')}
        </div>
      </Row>;
  }
  return <div className="series-paper">
      <Container className="ledger-page">
        <PageMetadata title="سبد خرید | ری‌بوک" />
        <header className="ledger-header">
          <h1 className="ledger-title">{step === 'checkout' ? 'پرداخت' : 'سبد خرید'}</h1>
        </header>
        {error && <Alert variant="danger" role="alert" tabIndex={-1} ref={errorRef}>
            {error}
          </Alert>}
        {body}
      </Container>
    </div>;
}
export default Cart;
