import { useState, useRef, useEffect } from "react";
import { bookAPI, getErrorMessage } from "../../services/api";
import { toast } from "../../utils/toast";
const MAX_PAGES_AT_ONCE = 10;
const PAGE_SIZE = 12;
export function useCatalogBooks(paramsKey, page, setSearchParams, setLoading, setLoadError) {
  const [books, setBooks] = useState([]);
  const [count, setCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const loadedRef = useRef({
    key: null,
    pages: 0
  });
  useEffect(() => {
    let ignore = false;
    const filters = Object.fromEntries(new URLSearchParams(paramsKey));
    const loaded = loadedRef.current;
    const appending = loaded.key === paramsKey && page === loaded.pages + 1;
    // بارگذاری تازه (مثلاً لینک مستقیم به ?page=3): همهٔ صفحه‌ها تا page در یک درخواست
    const pages = appending ? page : Math.min(page, MAX_PAGES_AT_ONCE);
    const params = appending ? {
      ...filters,
      page
    } : pages > 1 ? {
      ...filters,
      page_size: pages * PAGE_SIZE
    } : filters;
    bookAPI.getBooks(params).then(response => {
      if (ignore) return;
      const fetched = response.data.results ?? response.data;
      if (appending) {
        // اگر در این فاصله کتاب تازه‌ای ثبت شده باشد، مرز صفحه جابه‌جا می‌شود و تکرار پیش می‌آید
        setBooks(prev => {
          const ids = new Set(prev.map(book => book.id));
          return [...prev, ...fetched.filter(book => !ids.has(book.id))];
        });
      } else {
        setBooks(fetched);
      }
      setCount(response.data.count ?? fetched.length);
      setHasMore(Boolean(response.data.next));
      loadedRef.current = {
        key: paramsKey,
        pages
      };
    }).catch(error => {
      if (ignore) return;
      if (appending) {
        // خطای «نمایش بیشتر» گذراست؛ فهرست فعلی سر جایش می‌ماند
        toast.error(getErrorMessage(error));
      } else {
        setBooks([]);
        setHasMore(false);
        setLoadError(true);
      }
    }).finally(() => {
      if (!ignore) {
        setLoading(false);
        setLoadingMore(false);
      }
    });
    return () => {
      ignore = true;
    };
  }, [paramsKey, page, reloadKey, setLoading, setLoadError]);
  const gridRef = useRef(null);
  const focusFromRef = useRef(null);
  useEffect(() => {
    if (focusFromRef.current === null || loadingMore) return;
    gridRef.current?.querySelectorAll('.book-card .stretched-link')[focusFromRef.current]?.focus();
    focusFromRef.current = null;
  }, [books, loadingMore]);
  const handleRetry = () => {
    setLoading(true);
    setLoadError(false);
    setReloadKey(key => key + 1);
  };
  const handleLoadMore = () => {
    if (loadingMore) return;
    focusFromRef.current = books.length;
    setLoadingMore(true);
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('page', loadedRef.current.pages + 1);
      return next;
    }, {
      replace: true
    });
  };
  return {
    books,
    count,
    hasMore,
    loadingMore,
    gridRef,
    handleRetry,
    handleLoadMore
  };
}
