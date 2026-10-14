import { useState, useEffect } from "react";
import { notificationAPI } from "../../services/api";
const UNREAD_POLL_INTERVAL = 60000;
export function useUnreadCount(isAuthenticated) {
  const [unreadCount, setUnreadCount] = useState(0);
  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }
    let ignore = false;
    const fetchCount = () => {
      notificationAPI.getUnreadCount().then(response => {
        if (!ignore) {
          setUnreadCount(response.data.count);
        }
      }).catch(error => {
        if (!ignore) {
          console.error('خطا در دریافت اعلان‌ها:', error);
        }
      });
    };
    fetchCount();
    const intervalId = setInterval(fetchCount, UNREAD_POLL_INTERVAL);
    return () => {
      ignore = true;
      clearInterval(intervalId);
    };
  }, [isAuthenticated]);
  return isAuthenticated ? unreadCount : 0;
}
