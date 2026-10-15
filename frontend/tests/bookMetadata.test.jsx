import { cleanup, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import BookDetail from '../src/pages/BookDetail.jsx';
import ErrorBoundary from '../src/components/ErrorBoundary.jsx';
import PageMetadata from '../src/components/PageMetadata.jsx';

const state = vi.hoisted(() => ({ detail: {} }));
vi.mock('../src/features/book-detail/useBookDetail.js', () => ({ useBookDetail: () => state.detail }));
vi.mock('../src/features/book-detail/useBookActions.js', () => ({ useBookActions: () => ({}) }));
vi.mock('../src/features/book-detail/BookDetails.jsx', () => ({ BookDetails: ({ book }) => <h1>{book.title}</h1> }));
vi.mock('../src/features/book-detail/BookPurchasePanel.jsx', () => ({ BookPurchasePanel: () => null }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it('replaces book metadata during loading, failure, not-found, and successful recovery', () => {
  state.detail = { loading: true };
  const view = render(<MemoryRouter><BookDetail /></MemoryRouter>);
  const refresh = () => view.rerender(<MemoryRouter><BookDetail /></MemoryRouter>);
  expect(document.title).toBe('بارگذاری کتاب | ری‌بوک');
  state.detail = { book: { id: 1, title: 'الف', author: 'نویسنده', price: 1000, status: 'sold' } };
  refresh();
  expect(document.title).toBe('الف | ری‌بوک');
  expect(document.head.querySelector('meta[name="description"]').content).toContain('فروخته شده');
  state.detail = { loading: true };
  refresh();
  expect(document.title).toBe('بارگذاری کتاب | ری‌بوک');
  state.detail = { loadError: 'offline' };
  refresh();
  expect(document.title).toBe('خطا در بارگذاری کتاب | ری‌بوک');
  state.detail = { loadError: 'not_found' };
  refresh();
  expect(document.title).toBe('این کتاب پیدا نشد | ری‌بوک');
  state.detail = { book: { id: 2, title: 'ب', price: 1000, status: 'sold' } };
  refresh();
  expect(document.title).toBe('ب | ری‌بوک');
  expect(document.head.querySelectorAll('title')).toHaveLength(1);
  expect(document.head.querySelectorAll('meta[name="description"]')).toHaveLength(1);
});

it('replaces crashed-page metadata and recovers when the boundary resets', () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  function Page({ crash }) {
    if (crash) throw new Error('private detail');
    return <PageMetadata title="healthy" description="healthy description" />;
  }
  const view = render(<ErrorBoundary resetKey="a"><Page /></ErrorBoundary>);
  expect(document.title).toBe('healthy');
  view.rerender(<ErrorBoundary resetKey="a"><Page crash /></ErrorBoundary>);
  expect(document.title).toBe('مشکلی پیش آمد | ری‌بوک');
  expect(document.head.textContent).not.toContain('private detail');
  view.rerender(<ErrorBoundary resetKey="b"><Page /></ErrorBoundary>);
  expect(document.title).toBe('healthy');
});
