import { Card, Table, Badge, Button } from 'react-bootstrap';
import { FiInbox } from 'react-icons/fi';

const STATUS_MAP = {
  pending: { text: 'در انتظار پرداخت', className: 'order-status-pending' },
  paid: { text: 'پرداخت شده', className: 'order-status-paid' },
  shipped: { text: 'ارسال شده', className: 'order-status-shipped' },
  delivered: { text: 'تحویل داده شده', className: 'order-status-delivered' },
  cancelled: { text: 'لغو شده', className: 'order-status-cancelled' },
};

/**
 * @param {'purchase'|'sale'} type - نوع نمایش؛ دکمه‌ی پرداخت فقط در حالت purchase،
 *   دکمه‌ی لغو در هر دو حالت (خریدار یا فروشنده) برای سفارش در انتظار پرداخت
 * @param {number|null} busyId - شناسه‌ی سفارشی که پرداخت یا لغوش در جریان است
 */
function OrdersTable({ orders, type, onPay, onCancel, busyId, emptyMessage }) {
  if (orders.length === 0) {
    return (
      <Card className="text-center py-5 border-0 shadow-sm">
        <Card.Body>
          <FiInbox size={64} className="text-muted" aria-hidden="true" />
          <h2 className="h5 mt-3">{emptyMessage}</h2>
        </Card.Body>
      </Card>
    );
  }

  return (
    <Card className="shadow-sm border-0">
      <Table responsive hover className="mb-0 align-middle">
        <thead className="table-light">
          <tr>
            <th>شماره</th>
            <th>کتاب</th>
            {type === 'sale' && <th>خریدار</th>}
            <th>مبلغ</th>
            <th>وضعیت</th>
            <th>کد پیگیری</th>
            <th>تاریخ</th>
            <th>عملیات</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => {
            const status = STATUS_MAP[order.status] || { text: order.status, className: 'order-status-cancelled' };
            return (
              <tr key={order.id}>
                <td>#{order.id}</td>
                <td>{order.book_detail?.title}</td>
                {type === 'sale' && <td dir="auto">{order.buyer_detail?.username || '—'}</td>}
                <td>{Number(order.total_price).toLocaleString('fa-IR')} تومان</td>
                <td>
                  <Badge bg="" className={status.className}>{status.text}</Badge>
                </td>
                <td>{order.transaction?.reference_code || '-'}</td>
                <td>{new Date(order.created_at).toLocaleDateString('fa-IR')}</td>
                <td>
                  {order.status === 'pending' && (
                    <div className="d-flex gap-2">
                      {type === 'purchase' && (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => onPay(order.id)}
                          disabled={busyId !== null}
                        >
                          {busyId === order.id ? 'در حال پردازش...' : 'پرداخت'}
                        </Button>
                      )}
                      <Button
                        variant="outline-secondary"
                        size="sm"
                        onClick={() => onCancel(order.id)}
                        disabled={busyId !== null}
                      >
                        لغو سفارش
                      </Button>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </Card>
  );
}

export default OrdersTable;