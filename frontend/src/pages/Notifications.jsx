import { useState, useEffect } from 'react';
import { Container, Card, ListGroup, Badge, Button } from 'react-bootstrap';
import { toast } from 'react-toastify';
import { notificationAPI, getErrorMessage } from '../services/api';
import Loading from '../components/Loading';
import {
  FiBell,
  FiCheckCircle,
  FiShoppingBag,
  FiCreditCard,
  FiCheckSquare,
  FiXCircle,
  FiInfo,
} from 'react-icons/fi';

// نگاشت نوع اعلان به آیکون و رنگ اختصاصی — جایگزین ایموجی‌های قبلی
const TYPE_CONFIG = {
  order: { icon: FiShoppingBag, color: 'var(--rb-info)' },
  payment: { icon: FiCreditCard, color: 'var(--rb-ink)' },
  book_approved: { icon: FiCheckSquare, color: 'var(--rb-success)' },
  book_rejected: { icon: FiXCircle, color: 'var(--rb-danger)' },
  system: { icon: FiInfo, color: 'var(--rb-ink-muted)' },
};

function getTypeConfig(type) {
  return TYPE_CONFIG[type] || TYPE_CONFIG.system;
}

function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const response = await notificationAPI.getNotifications();
        setNotifications(response.data.results ?? response.data);
      } catch (error) {
        toast.error(getErrorMessage(error));
      } finally {
        setLoading(false);
      }
    };
    fetchNotifications();
  }, []);

  const handleMarkRead = async (id) => {
    // اگر از قبل خوانده شده، نیازی به درخواست مجدد نیست
    const target = notifications.find((n) => n.id === id);
    if (!target || target.is_read) return;

    // به‌روزرسانی خوش‌بینانه
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );

    try {
      await notificationAPI.markAsRead(id);
      // TODO: در صورت وجود فیلد مقصد (مثلاً notification.link) در پاسخ API،
      // اینجا می‌توان با useNavigate کاربر را به صفحه‌ی مرتبط هدایت کرد.
    } catch (error) {
      // بازگردانی در صورت شکست درخواست
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: false } : n))
      );
      toast.error(getErrorMessage(error));
    }
  };

  const handleKeyDown = (e, id) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleMarkRead(id);
    }
  };

  const handleMarkAllRead = async () => {
    const previous = notifications;
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));

    try {
      await notificationAPI.markAllAsRead();
      toast.success('همه اعلان‌ها خوانده شدند.');
    } catch (error) {
      setNotifications(previous);
      toast.error(getErrorMessage(error));
    }
  };

  if (loading) return <Loading fullPage />;

  const hasUnread = notifications.some((n) => !n.is_read);

  return (
    <Container className="py-5">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="h3 mb-0 d-flex align-items-center gap-2">
          <FiBell />
          اعلان‌ها
        </h1>
        {hasUnread && (
          <Button
            variant="outline-primary"
            onClick={handleMarkAllRead}
            className="d-inline-flex align-items-center gap-2"
          >
            <FiCheckCircle />
            خواندن همه
          </Button>
        )}
      </div>

      {notifications.length === 0 ? (
        <Card className="text-center py-5 border-0 shadow-sm">
          <Card.Body>
            <FiBell size={64} className="text-muted" aria-hidden="true" />
            <h2 className="h5 mt-3">اعلانی وجود ندارد</h2>
          </Card.Body>
        </Card>
      ) : (
        <Card className="shadow-sm border-0">
          <ListGroup variant="flush">
            {notifications.map((notification) => {
              const { icon: Icon, color } = getTypeConfig(notification.notification_type);
              return (
                <ListGroup.Item
                  key={notification.id}
                  className={`notification-item d-flex gap-3 align-items-start ${
                    !notification.is_read ? 'unread' : ''
                  }`}
                  style={{ cursor: notification.is_read ? 'default' : 'pointer' }}
                  onClick={() => handleMarkRead(notification.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => handleKeyDown(e, notification.id)}
                  aria-label={`${notification.title}${!notification.is_read ? '، خوانده‌نشده' : ''}`}
                >
                  <div
                    className="notification-icon-wrapper"
                    style={{ backgroundColor: `${color}1A` /* شفافیت ملایم رنگ */ }}
                    aria-hidden="true"
                  >
                    <Icon size={18} style={{ color }} />
                  </div>

                  <div className="flex-grow-1">
                    <div className="d-flex align-items-center gap-2">
                      <strong>{notification.title}</strong>
                      {!notification.is_read && (
                        <Badge bg="primary" pill>
                          جدید
                        </Badge>
                      )}
                    </div>
                    <p className="text-muted mb-0 mt-1">{notification.message}</p>
                  </div>

                  <small className="text-muted text-nowrap">
                    {new Date(notification.created_at).toLocaleDateString('fa-IR')}
                  </small>
                </ListGroup.Item>
              );
            })}
          </ListGroup>
        </Card>
      )}
    </Container>
  );
}

export default Notifications;