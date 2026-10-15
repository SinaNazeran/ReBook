import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import Wishlist from '../src/pages/Wishlist';
import Notifications from '../src/pages/Notifications';
import MyOrders from '../src/pages/MyOrders';
import { fetchCategories, useSeries } from '../src/utils/categories';
import { useCatalogWishlist } from '../src/features/catalog/useCatalogWishlist';
import { usePagedList } from '../src/hooks/usePagedList';
import LoadMore from '../src/components/LoadMore';

const api = vi.hoisted(() => ({
  getWishlist: vi.fn(), getCategories: vi.fn(), toggleWishlist: vi.fn(),
  getNotifications: vi.fn(), getUnreadCount: vi.fn(), markAllAsRead: vi.fn(), markAsRead: vi.fn(),
  getMyOrders: vi.fn(), getMySales: vi.fn(),
}));
vi.mock('../src/services/api', () => ({ bookAPI: api, notificationAPI: api, orderAPI: api, getErrorMessage: () => 'request failed' }));
vi.mock('../src/context/useAuth.js', () => ({ useAuth: () => ({ isAuthenticated: true, user: { id: 7 } }) }));
vi.mock('../src/utils/toast', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('../src/components/BookCard', () => ({ default: ({ book, onToggleWishlist }) =>
  <button onClick={() => onToggleWishlist(book.id)}>{book.title}</button> }));
vi.mock('../src/components/OrderList', () => ({ default: ({ orders }) =>
  <div>{orders.map(order => <p key={order.id}>{order.title}</p>)}</div> }));
vi.mock('../src/components/PurchaseModal', () => ({ default: () => null }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
const item = (id) => ({ id, book: { id, title: `book ${id}` } });
const page = (results, next = null, count = results.length) => ({ data: { results, next, count } });

describe('personal list continuation', () => {
  it('keeps loaded rows on failure, retries the same page and deduplicates results', async () => {
    api.getWishlist.mockResolvedValueOnce(page([item(1)], '/api/books/wishlist/?page=2', 3))
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(page([item(1), item(2)], null, 3));
    render(<MemoryRouter><Wishlist /></MemoryRouter>);
    await screen.findByText('book 1');
    fireEvent.click(screen.getByRole('button', { name: 'نمایش بیشتر' }));
    await screen.findByText('request failed');
    expect(screen.getByText('book 1')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'تلاش دوباره' }));
    await screen.findByText('book 2');
    expect(screen.getAllByText('book 1')).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'نمایش بیشتر' })).toBeNull();
    expect(api.getWishlist.mock.calls.slice(1).map(([params]) => params.page)).toEqual([2, 2]);
  });

  it('resets pagination after removal so shifted records are still reachable', async () => {
    api.getWishlist.mockResolvedValueOnce(page([item(1)], '/api/books/wishlist/?page=2', 2))
      .mockResolvedValueOnce(page([item(2)]));
    api.toggleWishlist.mockResolvedValue({ data: { wishlisted: false } });
    render(<MemoryRouter><Wishlist /></MemoryRouter>);
    fireEvent.click(await screen.findByText('book 1'));
    await screen.findByText('book 2');
    expect(screen.queryByText('book 1')).toBeNull();
    expect(api.getWishlist.mock.calls[1][0].page).toBe(1);
  });

  it('does not discard appended rows when an earlier optimistic removal fails', async () => {
    let failRemoval;
    api.getWishlist.mockResolvedValueOnce(page([item(1), item(2)], '?page=2', 3))
      .mockResolvedValueOnce(page([item(3)], null, 3));
    api.toggleWishlist.mockImplementation(() => new Promise((resolve, reject) => { failRemoval = reject; }));
    render(<MemoryRouter><Wishlist /></MemoryRouter>);
    fireEvent.click(await screen.findByText('book 1'));
    fireEvent.click(screen.getByRole('button', { name: 'نمایش بیشتر' }));
    await screen.findByText('book 3');
    await act(async () => { failRemoval(new Error('offline')); });
    await screen.findByText('book 1');
    expect(screen.getByText('book 3')).toBeTruthy();
  });
});

it('keeps purchases accessible when loading the sales tab fails', async () => {
  api.getMyOrders.mockResolvedValue(page([{ id: 1, title: 'purchase record' }]));
  api.getMySales.mockRejectedValue(new Error('offline'));
  render(<MemoryRouter><MyOrders /></MemoryRouter>);
  await screen.findByText('purchase record');
  fireEvent.click(screen.getByRole('tab', { name: 'فروش‌های من' }));
  await screen.findByRole('button', { name: 'تلاش دوباره' });
  api.getMySales.mockResolvedValue(page([{ id: 2, title: 'sale record' }]));
  fireEvent.click(screen.getByRole('button', { name: 'تلاش دوباره' }));
  await screen.findByText('sale record');
  expect(api.getMyOrders).toHaveBeenCalledTimes(1);
});

it('loads late category pages before publishing navigation categories', async () => {
  let resolveSecond;
  api.getCategories.mockResolvedValueOnce(page([{ id: 1, parent: null }], '/api/books/categories/?page=2', 2))
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce(page([{ id: 1, parent: null }], '/api/books/categories/?page=2', 2))
    .mockImplementationOnce(() => new Promise(resolve => { resolveSecond = resolve; }));
  await expect(fetchCategories()).rejects.toThrow('offline');
  const { result } = renderHook(() => useSeries());
  await waitFor(() => expect(api.getCategories).toHaveBeenCalledTimes(4));
  expect(result.current.series).toEqual([]);
  expect(result.current.status).toBe('loading');
  await act(async () => resolveSecond(page([{ id: 121, parent: null }])));
  expect(result.current.series.map(category => category.id)).toEqual([1, 121]);
  expect(api.getCategories.mock.calls.map(([params]) => params)).toEqual([
    { page: 1, page_size: 120 }, { page: 2, page_size: 120 },
    { page: 1, page_size: 120 }, { page: 2, page_size: 120 },
  ]);
});

it('blocks duplicate continuation clicks and ignores an old response after a reset', async () => {
  let finish;
  const fetcher = vi.fn().mockResolvedValueOnce(page([{ id: 1 }], '?page=2', 2))
    .mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }))
    .mockResolvedValueOnce(page([{ id: 3 }]));
  const { result } = renderHook(() => usePagedList(fetcher));
  await waitFor(() => expect(result.current.loading).toBe(false));
  let pending;
  act(() => { pending = result.current.loadMore(); result.current.loadMore(); });
  expect(fetcher).toHaveBeenCalledTimes(2);
  act(() => result.current.reload());
  await waitFor(() => expect(result.current.items[0].id).toBe(3));
  await act(async () => { finish(page([{ id: 2 }])); await pending; });
  expect(result.current.items.map(row => row.id)).toEqual([3]);
});

it('uses catalog membership for late wishlist entries and trusts the toggle response', async () => {
  api.getWishlist.mockResolvedValue(page([]));
  api.toggleWishlist.mockResolvedValue({ data: { wishlisted: true } });
  const books = [{ id: 135, is_wishlisted: true }];
  const { result } = renderHook(() => useCatalogWishlist(books));
  expect(result.current.displayedWishlistIds.has(135)).toBe(true);
  await act(async () => result.current.handleToggleWishlist(135));
  expect(result.current.displayedWishlistIds.has(135)).toBe(true);
  expect(api.getWishlist).not.toHaveBeenCalled();
});

it('shows global unread totals and allows marking unseen notifications as read', async () => {
  api.getNotifications.mockResolvedValue(page([
    { id: 1, title: 'read notice', message: 'm', is_read: true, created_at: '2026-10-14' },
  ], '/api/notifications/?page=2', 135));
  api.getUnreadCount.mockResolvedValueOnce({ data: { count: 123 } })
    .mockResolvedValue({ data: { count: 0 } });
  api.markAllAsRead.mockResolvedValue({ data: {} });
  render(<MemoryRouter><Notifications /></MemoryRouter>);
  await screen.findByText('۱۲۳ خوانده‌نشده');
  fireEvent.click(screen.getByRole('button', { name: 'همه خوانده شد' }));
  await waitFor(() => expect(screen.queryByText('۱۲۳ خوانده‌نشده')).toBeNull());
  expect(api.markAllAsRead).toHaveBeenCalledTimes(1);
  expect(api.getUnreadCount).toHaveBeenCalledTimes(2);
});

it('retries a failed refresh of the loaded range instead of advancing to another page', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(page([{ id: 1, status: 'pending' }], '?page=2', 2))
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce(page([{ id: 1, status: 'paid' }], '?page=2', 2));
  const { result } = renderHook(() => usePagedList(fetcher));
  await waitFor(() => expect(result.current.loading).toBe(false));
  await act(async () => result.current.refresh());
  render(<LoadMore {...result.current} />);
  fireEvent.click(screen.getByRole('button', { name: 'تلاش دوباره' }));
  await waitFor(() => expect(result.current.items[0].status).toBe('paid'));
  expect(fetcher.mock.calls.map(([params]) => params.page)).toEqual([1, 1, 1]);
});

it('does not continue a multi-page refresh after unmount', async () => {
  let finish;
  const fetcher = vi.fn().mockResolvedValueOnce(page([{ id: 1 }], '?page=2', 2))
    .mockResolvedValueOnce(page([{ id: 2 }], null, 2))
    .mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }))
    .mockResolvedValue(page([{ id: 2 }]));
  const { result, unmount } = renderHook(() => usePagedList(fetcher));
  await waitFor(() => expect(result.current.loading).toBe(false));
  await act(async () => result.current.loadMore());
  let refresh;
  act(() => { refresh = result.current.refresh(); });
  unmount();
  await act(async () => { finish(page([{ id: 1 }], '?page=2', 2)); await refresh; });
  expect(fetcher).toHaveBeenCalledTimes(3);
});

it('refreshes the loaded range with bounded requests and retains separate list state', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(page([{ id: 1, status: 'pending' }], '?page=2', 2))
    .mockResolvedValueOnce(page([{ id: 2, status: 'pending' }], null, 2))
    .mockResolvedValueOnce(page([{ id: 1, status: 'paid' }], '?page=2', 2))
    .mockResolvedValueOnce(page([{ id: 2, status: 'cancelled' }], null, 2));
  const other = vi.fn().mockResolvedValue(page([{ id: 5 }], '?page=2', 3));
  const { result } = renderHook(() => ({ purchases: usePagedList(fetcher), sales: usePagedList(other) }));
  await waitFor(() => expect(result.current.purchases.loading || result.current.sales.loading).toBe(false));
  await act(async () => result.current.purchases.loadMore());
  await act(async () => result.current.purchases.refresh());
  expect(result.current.purchases.items.map(row => row.status)).toEqual(['paid', 'cancelled']);
  expect(result.current.sales.items.map(row => row.id)).toEqual([5]);
  expect(result.current.sales.hasMore).toBe(true);
  expect(other).toHaveBeenCalledTimes(1);
  expect(fetcher.mock.calls.map(([params]) => params)).toEqual([
    { page: 1, page_size: 12 }, { page: 2, page_size: 12 },
    { page: 1, page_size: 12 }, { page: 2, page_size: 12 },
  ]);
});

it('finishes loading when a mutation refresh supersedes a pending initial request', async () => {
  let finishInitial;
  const fetcher = vi.fn().mockImplementationOnce(() => new Promise(resolve => { finishInitial = resolve; }))
    .mockResolvedValueOnce(page([{ id: 2 }]));
  const { result } = renderHook(() => usePagedList(fetcher));
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
  await act(async () => result.current.refresh());
  expect(result.current.loading).toBe(false);
  expect(result.current.items.map(row => row.id)).toEqual([2]);
  await act(async () => { finishInitial(page([{ id: 1 }])); });
  expect(result.current.items.map(row => row.id)).toEqual([2]);
});

it('recovers an initial load error when a subsequent mutation refresh succeeds', async () => {
  const fetcher = vi.fn().mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce(page([{ id: 2 }]));
  const { result } = renderHook(() => usePagedList(fetcher));
  await waitFor(() => expect(result.current.loadError).toBe(true));
  await act(async () => result.current.refresh());
  expect(result.current.loadError).toBe(false);
  expect(result.current.items.map(row => row.id)).toEqual([2]);
});
