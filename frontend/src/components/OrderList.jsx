import { Link } from 'react-router-dom';
import { Button } from 'react-bootstrap';
import StatusMark from './StatusMark';
import CoverThumb from './CoverThumb';

const ORDER_STATUS = {
  pending: { tone: 'waiting', label: 'در انتظار پرداخت' },
  paid: { tone: 'done', label: 'پرداخت شده' },
  shipped: { tone: 'moving', label: 'ارسال شده' },
  delivered: { tone: 'done', label: 'تحویل شده' },
  cancelled: { tone: 'closed', label: 'لغو شده' },
};

const formatDate = (value) => new Date(value).toLocaleDateString('fa-IR');

/**
 * ردیف‌های سفارش برای «خریدهای من» و «فروش‌های من».
 * @param {'purchase'|'sale'} type - پرداخت فقط برای خریدار؛ لغو برای هر دو، تا وقتی پرداخت نشده
 * @param {number|null} busyId - سفارشی که لغوش در جریان است
 */
function OrderList({ orders, type, onPay, onCancel, busyId }) {
  return (
    <ul className="ledger">
      {orders.map((order) => {
        const book = order.book_detail;
        const status = ORDER_STATUS[order.status] ?? { tone: 'closed', label: order.status_display };
        const code = order.transaction?.reference_code;

        return (
          <li key={order.id} className="ledger-row">
            <CoverThumb book={book} />
            <div className="ledger-main">
              {book ? (
                <Link to={`/books/${book.id}`} className="ledger-name">
                  <bdi>{book.title}</bdi>
                </Link>
              ) : (
                <span className="ledger-name">کتاب حذف‌شده</span>
              )}
              <span className="ledger-meta">
                سفارش #{order.id.toLocaleString('fa-IR')}
                <span aria-hidden="true"> · </span>
                <span className="visually-hidden">، </span>
                {formatDate(order.created_at)}
                {type === 'sale' && order.buyer_detail && (
                  <>
                    <span aria-hidden="true"> · </span>
                    <span className="visually-hidden">، </span>
                    خریدار: <bdi className="latin-id">{order.buyer_detail.username}</bdi>
                  </>
                )}
              </span>
              {code && (
                <span className="ledger-note">
                  کد پیگیری:{' '}
                  <bdi className="latin-id ledger-code" dir="ltr">
                    {code}
                  </bdi>
                </span>
              )}
              {order.status === 'pending' && type === 'sale' && (
                <span className="ledger-note">خریدار هنوز پرداخت نکرده؛ اگر پرداخت نکرد، لغوش کن تا کتاب آزاد شود.</span>
              )}
            </div>
            <span className="ledger-amount">
              {Number(order.total_price).toLocaleString('fa-IR')} <span className="book-card-currency">تومان</span>
            </span>
            <span className="ledger-status">
              <StatusMark tone={status.tone}>{status.label}</StatusMark>
            </span>
            <span className="ledger-actions">
              {order.status === 'pending' && (
                <>
                  {type === 'purchase' && (
                    <Button variant="primary" onClick={() => onPay(order)} disabled={busyId !== null}>
                      پرداخت آزمایشی
                    </Button>
                  )}
                  <Button variant="outline-secondary" onClick={() => onCancel(order.id)} disabled={busyId !== null}>
                    {busyId === order.id ? 'در حال لغو...' : 'لغو'}
                  </Button>
                </>
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export default OrderList;
