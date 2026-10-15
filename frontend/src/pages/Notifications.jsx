import PageMetadata from '../components/PageMetadata.jsx';
import { useSubmissionGuard } from '../hooks/useSubmissionGuard';
import { formatPersianDate as formatDate } from '../utils/locale';
import { useUnreadCount } from '../components/navigation/useUnreadCount';
import UnreadStatus from '../components/navigation/UnreadStatus';
import { useAuth } from '../context/useAuth';
import { usePagedList } from '../hooks/usePagedList';
import LoadMore from '../components/LoadMore';
import { useState } from 'react';
import { Container, Button } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { toast } from '../utils/toast';
import { FiShoppingBag, FiCreditCard, FiCheckSquare, FiXCircle, FiInfo } from 'react-icons/fi';
import { notificationAPI, getErrorMessage } from '../services/api';
import Loading from '../components/Loading';
import EmptyShelf from '../components/EmptyShelf';

// نوع اعلان با شکل آیکن شناخته می‌شود؛ رنگ‌ها خنثی می‌مانند تا «خوانده‌نشده» تنها نشانه‌ی پررنگ باشد
const TYPE_ICON = {
  order: FiShoppingBag,
  payment: FiCreditCard,
  book_approved: FiCheckSquare,
  book_rejected: FiXCircle,
  system: FiInfo,
};

// پیوندهای زیر اعلانی که به یک کتاب اشاره دارد
const bookLinks = ({ notification_type: type, book }) => {
  if (!book) return [];
  if (type === 'book_approved') return [{ to: `/books/${book}`, label: 'دیدن آگهی' }];
  if (type === 'book_rejected')
    return [
      { to: `/books/${book}/edit`, label: 'ویرایش آگهی' },
      { to: '/support', label: 'پشتیبانی' },
    ];
  return [];
};

function Notifications() {
  const { run, pending } = useSubmissionGuard();
  const reading = pending.size > 0;
  const [readVersion, setReadVersion] = useState(0);
  const { user } = useAuth();
  const unreadState = useUnreadCount(user?.id, readVersion);
  const unreadCount = unreadState.count;
  const list = usePagedList(notificationAPI.getNotifications);
  const { items: notifications, setItems: setNotifications, loading, loadError, reload: handleRetry } = list;


  const setRead = (id, isRead) =>
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: isRead } : n)));

  const handleMarkRead = async (notification) => {
    return run(async () => {
      if (notification.is_read) return;
      setRead(notification.id, true); // خوش‌بینانه
      try {
        await notificationAPI.markAsRead(notification.id);
        setReadVersion(version => version + 1);
      } catch (error) {
        setRead(notification.id, false);
        toast.error(getErrorMessage(error));
      }
    });
  };

  const handleMarkAllRead = async () => {
    return run(async () => {
      const previous = notifications;
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      try {
        await notificationAPI.markAllAsRead();
        setReadVersion(version => version + 1);
        await list.refresh();
      } catch (error) {
        setNotifications(previous);
        toast.error(getErrorMessage(error));
      }
    });
  };

  if (loading) return <Loading fullPage heading="اعلان‌ها" />;


  return (
    <div className="series-paper">
      <Container className="ledger-page notifications-page">
        <PageMetadata title="اعلان‌ها | ری‌بوک" />
        <header className="ledger-header">
          <h1 className="ledger-title">
            اعلان‌ها
            {unreadCount > 0 && <span className="list-count">{unreadCount.toLocaleString('fa-IR')} خوانده‌نشده</span>}
          </h1>
          {unreadCount > 0 && (
            <Button variant="outline-secondary" onClick={handleMarkAllRead} disabled={reading} aria-busy={reading}>
              همه خوانده شد
            </Button>
          )}
        </header>
        {reading && <p role="status">در حال ثبت وضعیت اعلان‌ها…</p>}
        <UnreadStatus state={unreadState} />

        {loadError ? (
          <div className="list-state" role="alert">
            <p>اعلان‌ها بارگذاری نشدند. اتصال اینترنت را بررسی کن و دوباره امتحان کن.</p>
            <Button variant="outline-secondary" onClick={handleRetry}>
              تلاش دوباره
            </Button>
          </div>
        ) : notifications.length === 0 ? (
          <div className="list-state">
            <EmptyShelf />
            <p>
              هنوز اعلانی نداری. وقتی کسی کتابت را سفارش بدهد یا پرداختی انجام شود، همین‌جا خبرت می‌کنیم.
            </p>
            <Link to="/create-book" className="btn btn-outline-secondary">
              فروش کتاب
            </Link>
          </div>
        ) : (
          <ul className="notice-list">
            {notifications.map((notification) => {
              const Icon = TYPE_ICON[notification.notification_type] ?? FiInfo;
              const unread = !notification.is_read;
              const links = bookLinks(notification);
              return (
                <li key={notification.id} className={unread ? 'is-unread' : undefined}>
                  <button
                    type="button"
                    className={`notice${unread ? ' is-unread' : ''}`}
                    onClick={() => handleMarkRead(notification)}
                    disabled={reading}
                    aria-busy={reading}
                    aria-disabled={!unread || reading}
                  >
                    <span className="notice-icon" aria-hidden="true">
                      <Icon />
                    </span>
                    <span className="notice-body">
                      <span className="notice-title">
                        {notification.title}
                        {unread && <span className="visually-hidden">، خوانده‌نشده</span>}
                      </span>
                      <span className="notice-message">{notification.message}</span>
                    </span>
                    <span className="notice-date">{formatDate(notification.created_at, 'long')}</span>
                    {unread && <span className="notice-dot" aria-hidden="true" />}
                  </button>
                  {links.length > 0 && (
                    <p className="notice-links">
                      {links.map((link) => (
                        <Link key={link.to} to={link.to} onClick={() => handleMarkRead(notification)}>
                          {link.label}
                        </Link>
                      ))}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {!loadError && <LoadMore {...list} />}
      </Container>
    </div>
  );
}

export default Notifications;
