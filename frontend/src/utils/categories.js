import { useEffect, useState } from 'react';
import { bookAPI } from '../services/api';

// Share only a complete category tree; a failed page never becomes a cached partial tree.
let request = null;

export function fetchCategories() {
  request ??= (async () => {
    const categories = new Map();
    let page = 1;
    while (true) {
      const { data } = await bookAPI.getCategories({ page, page_size: 120 });
      data.results.forEach(category => categories.set(category.id, category));
      if (!data.next) return [...categories.values()];
      const next = Number(new URL(data.next, window.location.origin).searchParams.get('page'));
      if (!Number.isSafeInteger(next) || next <= page) throw new Error('Invalid category continuation');
      page = next;
    }
  })().catch(error => {
    request = null;
    throw error;
  });
  return request;
}

/** دسته‌های سطح اول (مجموعه‌ها)؛ اگر نرسید، فهرست خالی می‌ماند و پیوندهای مجموعه دیده نمی‌شوند */
export function useSeries() {
  const [series, setSeries] = useState([]);
  useEffect(() => {
    let ignore = false;
    fetchCategories()
      .then((list) => {
        if (!ignore) setSeries(list.filter((category) => category.parent === null));
      })
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, []);
  return series;
}
