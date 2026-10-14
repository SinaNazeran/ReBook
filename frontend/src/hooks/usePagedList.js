import { useEffect, useRef, useState, useCallback } from 'react';
import { getErrorMessage } from '../services/api';

// Always request through the domain API; never send credentials to a next-link host.
export function nextPage(data) {
  if (!data.next) return null;
  const value = Number(new URL(data.next, window.location.origin).searchParams.get('page'));
  if (!Number.isSafeInteger(value) || value < 1) throw new Error('Invalid continuation');
  return value;
}

export function usePagedList(fetcher) {
  const [items, setItems] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState('');
  const [retryAction, setRetryAction] = useState('more');
  const [continuation, setContinuation] = useState(null);
  const [resetKey, setResetKey] = useState(0);
  const epoch = useRef(0);
  const busy = useRef(false);
  const lastPage = useRef(0);

  useEffect(() => {
    const generation = epoch;
    const version = ++epoch.current;
    busy.current = true;
    fetcher({ page: 1, page_size: 12 }).then(({ data }) => {
      const next = nextPage(data);
      if (version !== epoch.current) return;
      setItems(data.results);
      setCount(data.count);
      setContinuation(next);
      lastPage.current = 1;
    }).catch(() => {
      if (version === epoch.current) setLoadError(true);
    }).finally(() => {
      if (version !== epoch.current) return;
      busy.current = false;
      setLoading(false);
    });
    return () => { generation.current++; };
  }, [fetcher, resetKey]);

  const reload = useCallback(() => {
    epoch.current++;
    busy.current = false;
    lastPage.current = 0;
    setLoading(true);
    setLoadError(false);
    setLoadingMore(false);
    setMoreError('');
    setContinuation(null);
    setResetKey(key => key + 1);
  }, []);

  const loadMore = async () => {
    if (busy.current || continuation === null) return;
    busy.current = true;
    const version = epoch.current;
    setLoadingMore(true);
    setMoreError('');
    setRetryAction('more');
    try {
      const { data } = await fetcher({ page: continuation, page_size: 12 });
      const next = nextPage(data);
      if (version !== epoch.current) return;
      setItems(previous => {
        const rows = new Map(previous.map(row => [row.id, row]));
        data.results.forEach(row => rows.set(row.id, row));
        return [...rows.values()];
      });
      setCount(data.count);
      setContinuation(next);
      lastPage.current = continuation;
    } catch (error) {
      if (version === epoch.current) setMoreError(getErrorMessage(error));
    } finally {
      if (version === epoch.current) {
        busy.current = false;
        setLoadingMore(false);
      }
    }
  };

  // Order status changes keep the already loaded range, using bounded requests.
  const refresh = async () => {
    const pages = Math.max(lastPage.current, 1);
    const version = ++epoch.current;
    busy.current = true;
    setLoadingMore(true);
    setMoreError('');
    setRetryAction('refresh');
    try {
      const rows = new Map();
      let data;
      let page = 1;
      for (; page <= pages; page++) {
        ({ data } = await fetcher({ page, page_size: 12 }));
        if (version !== epoch.current) return;
        data.results.forEach(row => rows.set(row.id, row));
        if (!data.next || page === pages) break;
      }
      const next = nextPage(data);
      setItems([...rows.values()]);
      setLoadError(false);
      setCount(data.count);
      setContinuation(next);
      lastPage.current = page;
    } catch (error) {
      if (version === epoch.current) {
        setMoreError(getErrorMessage(error));
        if (lastPage.current === 0) setLoadError(true);
      }
    } finally {
      if (version === epoch.current) {
        busy.current = false;
        setLoading(false);
        setLoadingMore(false);
      }
    }
  };

  return { items, setItems, count, loading, loadError, reload, refresh,
    loadingMore, moreError, hasMore: continuation !== null, loadMore,
    retry: retryAction === 'refresh' ? refresh : loadMore };
}
