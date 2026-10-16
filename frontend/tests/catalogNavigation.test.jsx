import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { CatalogResults } from '../src/features/catalog/CatalogResults.jsx';
import { useCatalogBooks } from '../src/features/catalog/useCatalogBooks.js';

const api = vi.hoisted(() => ({ getBooks: vi.fn() }));
vi.mock('../src/services/api', () => ({ bookAPI: api, getErrorMessage: () => 'offline' }));
vi.mock('../src/context/useAuth.js', () => ({ useAuth: () => ({ user: null }) }));
vi.mock('../src/utils/toast', () => ({ toast: { error: vi.fn() } }));

vi.mock('../src/components/BookCard', () => ({
  default: () => <article>کتاب آزمایشی</article>, BookCardSkeleton: () => null,
}));
afterEach(() => { cleanup(); vi.resetAllMocks(); });

const setup = loadingMore => {
  const handleLoadMore = vi.fn();
  render(<MemoryRouter><CatalogResults books={[{ id: 5 }]} chips={[]}
    displayedWishlistIds={new Set()} pendingWishlistIds={new Set()}
    hasMore loadingMore={loadingMore} handleLoadMore={handleLoadMore}
    nextPageHref="/books?category=fiction&search=novel&page=3" /></MemoryRouter>);
  return { link: screen.getByRole('link', { name: loadingMore ? 'در حال بارگذاری…' : 'نمایش بیشتر' }), handleLoadMore };
};

it('exposes the next catalog URL while enhancing an ordinary click with append loading', () => {
  const { link, handleLoadMore } = setup(false);
  expect(link.getAttribute('href')).toBe('/books?category=fiction&search=novel&page=3');
  fireEvent.click(link);
  expect(handleLoadMore).toHaveBeenCalledTimes(1);
});

it('preserves modified clicks and blocks duplicate ordinary loads while busy', () => {
  let { link, handleLoadMore } = setup(false);
  for (const key of ['ctrlKey', 'metaKey', 'shiftKey', 'altKey']) {
    let prevented;
    // پس از handler برنامه، پیمایش واقعی سند را فقط در محیط jsdom متوقف می‌کنیم.
    document.addEventListener('click', event => {
      prevented = event.defaultPrevented;
      event.preventDefault();
    }, { once: true });
    fireEvent.click(link, { [key]: true });
    expect(prevented).toBe(false);
  }
  expect(handleLoadMore).not.toHaveBeenCalled();
  cleanup();
  ({ link, handleLoadMore } = setup(true));
  expect(link.getAttribute('aria-disabled')).toBe('true');
  fireEvent.click(link);
  expect(handleLoadMore).not.toHaveBeenCalled();
});

it('keeps continuation aligned with loaded pages and retries a failed append at the same URL', async () => {
  api.getBooks.mockResolvedValueOnce({ data: { results: [{ id: 5 }], next: '?page=3', count: 36 } })
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce({ data: { results: [{ id: 5 }, { id: 6 }], next: null, count: 36 } });
  const setSearchParams = vi.fn();
  const setLoading = vi.fn();
  const setLoadError = vi.fn();
  const view = renderHook(({ page }) => useCatalogBooks('category=fiction&search=novel', page,
    setSearchParams, setLoading, setLoadError), { initialProps: { page: 2 } });
  await waitFor(() => expect(view.result.current.nextPage).toBe(3));
  act(() => view.result.current.handleLoadMore());
  const next = setSearchParams.mock.calls[0][0](new URLSearchParams('category=fiction&search=novel&page=2'));
  expect(next.toString()).toBe('category=fiction&search=novel&page=3');
  view.rerender({ page: 3 });
  await waitFor(() => expect(view.result.current.loadingMore).toBe(false));
  expect(view.result.current.books.map(book => book.id)).toEqual([5]);
  expect(view.result.current.nextPage).toBe(3);
  act(() => view.result.current.handleLoadMore());
  await waitFor(() => expect(api.getBooks).toHaveBeenCalledTimes(3));
  await waitFor(() => expect(view.result.current.nextPage).toBe(4));
  expect(view.result.current.books.map(book => book.id)).toEqual([5, 6]);
  expect(api.getBooks.mock.calls[2][0]).toEqual({ category: 'fiction', search: 'novel', page: 3 });
});
