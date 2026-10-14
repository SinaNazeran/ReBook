import { Button } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import Loading from './Loading';
import OrderList from './OrderList';
import EmptyShelf from './EmptyShelf';
import LoadMore from './LoadMore';

export default function OrderCollection({ list, type, onPay, onCancel, busyId }) {
  if (list.loading) return <Loading />;
  if (list.loadError) return <div className="list-state" role="alert">
    <p>سفارش‌ها بارگذاری نشدند. اتصال اینترنت را بررسی کن و دوباره امتحان کن.</p>
    <Button variant="outline-secondary" onClick={list.reload}>تلاش دوباره</Button>
  </div>;
  return <>
    {list.items.length ? <OrderList orders={list.items} type={type}
      onPay={onPay} onCancel={onCancel} busyId={busyId} /> : <div className="list-state">
      <EmptyShelf />
      <p>{type === 'purchase' ? 'هنوز کتابی نخریده‌ای.' : 'هنوز کسی از تو کتابی نخریده. آگهی‌هایت در «کتاب‌های من» است.'}</p>
      <Link to={type === 'purchase' ? '/books' : '/my-books'} className="btn btn-outline-secondary">
        {type === 'purchase' ? 'مرور کتاب‌ها' : 'کتاب‌های من'}
      </Link>
    </div>}
    <LoadMore {...list} />
  </>;
}
