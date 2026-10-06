import { useState, useEffect } from 'react';
import { Container, Button } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
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

const formatDate = (value) =>
  new Date(value).toLocaleDateString('fa-IR', { month: 'long', day: 'numeric', year: 'numeric' });

function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let ignore = false;
    notificationAPI
      .getNotifications()
      .then((response) => {
        if (!ignore) setNotifications(response.data.results ?? response.data);
      })
      .catch(() => {
        if (!ignore) setLoadError(true);
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [reloadKey]);

  const handleRetry = () => {
    setLoadError(false);
    setLoading(true);
    setReloadKey((key) => key + 1);
  };

  const setRead = (id, isRead) =>
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: isRead } : n)));

  const handleMarkRead = async (notification) => {
    if (notification.is_read) return;
    setRead(notification.id, true); // خوش‌بینانه
    try {
      await notificationAPI.markAsRead(notification.id);
    } catch (error) {
      setRead(notification.id, false);
      toast.error(getErrorMessage(error));
    }
  };

  const handleMarkAllRead = async () => {
    const previous = notifications;
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    try {
      await notificationAPI.markAllAsRead();
    } catch (error) {
      setNotifications(previous);
      toast.error(getErrorMessage(error));
    }
  };

  if (loading) return <Loading fullPage />;

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="series-paper">
      <Container className="ledger-page notifications-page">
        <title>اعلان‌ها | ری‌بوک</title>
        <header className="ledger-header">
          <h1 className="ledger-title">
            اعلان‌ها
            {unreadCount > 0 && <span className="list-count">{unreadCount.toLocaleString('fa-IR')} خوانده‌نشده</span>}
          </h1>
          {unreadCount > 0 && (
            <Button variant="outline-secondary" onClick={handleMarkAllRead}>
              همه خوانده شد
            </Button>
          )}
        </header>

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
              return (
                <li key={notification.id}>
                  <button
                    type="button"
                    className={`notice${unread ? ' is-unread' : ''}`}
                    onClick={() => handleMarkRead(notification)}
                    aria-disabled={!unread}
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
                    <span className="notice-date">{formatDate(notification.created_at)}</span>
                    {unread && <span className="notice-dot" aria-hidden="true" />}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Container>
    </div>
  );
}

export default Notifications;
