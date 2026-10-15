import { useCallback, useEffect, useRef, useState } from 'react';
import { bookAPI } from '../services/api';

// Share only a complete category tree; a failed page never becomes a cached partial tree.
let request = null;
let completeTree = null;
let expiresAt = 0;

function freshness(headers) {
  const policy = headers?.['cache-control'] ?? '';
  if (/no-store|no-cache/i.test(policy)) return 0;
  const maxAge = Number(policy.match(/(?:^|,)\s*max-age=(\d+)/i)?.[1] ?? 60);
  const age = Number(headers?.age ?? 0);
  const date = Date.parse(headers?.date ?? '');
  const apparentAge = Number.isFinite(date) ? Math.max(0, (Date.now() - date) / 1000) : 0;
  const currentAge = Math.max(apparentAge, Number.isFinite(age) ? age : 0);
  return Math.max(0, Math.min(60, maxAge) - currentAge) * 1000;
}

export function fetchCategories() {
  if (request) return request;
  if (completeTree && Date.now() < expiresAt) return Promise.resolve(completeTree);
  completeTree = null;
  request = (async () => {
    const categories = new Map();
    let freshUntil = Infinity;
    let page = 1;
    while (true) {
      const started = Date.now();
      const { data, headers } = await bookAPI.getCategories({ page, page_size: 120 });
      freshUntil = Math.min(freshUntil, started + freshness(headers));
      data.results.forEach(category => categories.set(category.id, category));
      if (!data.next) {
        completeTree = [...categories.values()];
        expiresAt = freshUntil;
        return completeTree;
      }
      const next = Number(new URL(data.next, window.location.origin).searchParams.get('page'));
      if (!Number.isSafeInteger(next) || next <= page) throw new Error('Invalid category continuation');
      page = next;
    }
  })().finally(() => {
    request = null;
  });
  return request;
}

export function useCategories() {
  const [state, setState] = useState({ categories: [], status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const busy = useRef(true);
  const retry = useCallback(() => {
    if (busy.current) return;
    busy.current = true;
    setState(current => ({ ...current, status: 'loading' }));
    setAttempt(current => current + 1);
  }, []);
  useEffect(() => {
    let ignore = false;
    busy.current = true;
    fetchCategories()
      .then(categories => {
        if (!ignore) setState({ categories, status: 'ready' });
      })
      .catch(() => {
        if (!ignore) setState(current => ({ ...current, status: 'error' }));
      })
      .finally(() => { if (!ignore) busy.current = false; });
    return () => {
      ignore = true;
    };
  }, [attempt]);
  return { ...state, retry };
}

export function useSeries() {
  const state = useCategories();
  return { ...state, series: state.categories.filter(category => category.parent === null) };
}
