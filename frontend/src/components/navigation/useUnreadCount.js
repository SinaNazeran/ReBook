import { useCallback, useEffect, useRef, useState } from 'react';
import { notificationAPI } from '../../services/api';
const UNREAD_POLL_INTERVAL = 60000;

export function useUnreadCount(userId, refreshKey = 0) {
  const [state, setState] = useState({ userId: null, count: null, status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  if (state.userId !== userId) {
    setState({ userId, refreshKey, attempt, count: null, status: 'loading' });
  }
  const busy = useRef(false);
  const retry = useCallback(() => {
    if (busy.current) return;
    busy.current = true;
    setAttempt(value => value + 1);
  }, []);
  useEffect(() => {
    if (userId == null) { busy.current = false; return; }
    let active = true;
    let pending = false;
    const controller = new AbortController();
    const fetchCount = () => {
      if (pending) return;
      pending = true;
      busy.current = true;
      Promise.resolve().then(() => {
        if (!active) return;
        setState(current => ({ userId, refreshKey, attempt,
          count: current.userId === userId ? current.count : null,
          status: current.userId === userId && current.count !== null ? 'refreshing' : 'loading' }));
        return notificationAPI.getUnreadCount({ signal: controller.signal });
      }).then(response => {
        if (active) setState({ userId, refreshKey, attempt, count: response.data.count, status: 'ready' });
      }).catch(() => {
        if (active) setState(current => ({ ...current,
          status: current.count === null ? 'error' : 'stale' }));
      }).finally(() => {
        pending = false;
        if (active) busy.current = false;
      });
    };
    fetchCount();
    const interval = setInterval(fetchCount, UNREAD_POLL_INTERVAL);
    return () => { active = false; controller.abort(); clearInterval(interval); };
  }, [userId, refreshKey, attempt]);
  if (userId == null) return { count: null, status: 'idle', retry };
  if (state.userId !== userId) return { count: null, status: 'loading', retry };
  if (state.refreshKey !== refreshKey || state.attempt !== attempt) {
    return { count: state.count, status: state.count === null ? 'loading' : 'refreshing', retry };
  }
  return { count: state.count, status: state.status, retry };
}
