import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useBookActions } from '../src/features/book-detail/useBookActions';
import { useCatalogWishlist } from '../src/features/catalog/useCatalogWishlist';
import Notifications from '../src/pages/Notifications';
import BookCard from '../src/components/BookCard';
import Wishlist from '../src/pages/Wishlist';

const api = vi.hoisted(() => ({ toggleWishlist: vi.fn(), getWishlist: vi.fn(), getNotifications: vi.fn(), getUnreadCount: vi.fn(), markAsRead: vi.fn(), markAllAsRead: vi.fn() }));
vi.mock('../src/services/api', () => ({ bookAPI: api, notificationAPI: api, getErrorMessage: () => 'ناموفق' }));
vi.mock('../src/context/useAuth', () => ({ useAuth: () => ({ user: { id: 1 }, isAuthenticated: true }) }));
vi.mock('../src/utils/toast', () => ({ toast: { error: vi.fn(), info: vi.fn() } }));
beforeEach(() => { Object.values(api).forEach(mock => mock.mockReset()); });
afterEach(cleanup);
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const books = [{ id: 5, title: 'اول', price: 1000 }, { id: 6, title: 'دوم', price: 1000 }];

it('blocks repeated detail wishlist toggles and unlocks on failure', async () => {
  const request = deferred();
  api.toggleWishlist.mockReturnValue(request.promise);
  const { result } = renderHook(() => useBookActions({ isAuthenticated: true, id: 5, wishlisted: false, setWishlisted: vi.fn() }));
  act(() => { result.current.handleWishlistToggle(); result.current.handleWishlistToggle(); });
  expect(api.toggleWishlist).toHaveBeenCalledTimes(1);
  expect(result.current.wishlistBusy).toBe(true);
  await act(async () => { request.reject(new Error('offline')); });
  expect(result.current.wishlistBusy).toBe(false);
  api.toggleWishlist.mockResolvedValue({ data: { wishlisted: true } });
  await act(async () => { result.current.handleWishlistToggle(); });
  expect(api.toggleWishlist).toHaveBeenCalledTimes(2);
});

it('shows per-book feedback while allowing another catalog book to proceed', async () => {
  const request = deferred();
  api.toggleWishlist.mockReturnValue(request.promise);
  function Catalog() {
    const state = useCatalogWishlist(books);
    return books.map(book => <BookCard key={book.id} book={book} onToggleWishlist={state.handleToggleWishlist}
      isWishlisted={state.displayedWishlistIds.has(book.id)} wishlistBusy={state.pendingWishlistIds?.has(book.id)} />);
  }
  render(<MemoryRouter><Catalog /></MemoryRouter>);
  const buttons = screen.getAllByRole('button', { name: 'افزودن به علاقه‌مندی‌ها' });
  fireEvent.click(buttons[0]);
  expect(buttons[0].disabled).toBe(true);
  expect(buttons[0].getAttribute('aria-busy')).toBe('true');
  expect(buttons[1].disabled).toBe(false);
  fireEvent.click(buttons[0]); fireEvent.click(buttons[1]);
  expect(api.toggleWishlist).toHaveBeenCalledTimes(2);
  await act(async () => { request.resolve({ data: { wishlisted: true } }); });
  expect(buttons[0].disabled).toBe(false);
});

it('serializes individual and bulk notification reads, shows feedback, and releases on failure', async () => {
  const request = deferred();
  api.getUnreadCount.mockResolvedValue({ data: { count: 2 } });
  api.getNotifications.mockResolvedValue({ data: { results: [
    { id: 1, title: 'اول', message: 'پیام', is_read: false },
    { id: 2, title: 'دوم', message: 'پیام', is_read: false },
  ], count: 2, next: null } });
  api.markAsRead.mockReturnValue(request.promise);
  api.markAllAsRead.mockResolvedValue({});
  await act(async () => { render(<MemoryRouter><Notifications /></MemoryRouter>); });
  const one = screen.getByRole('button', { name: /اول/ });
  const all = screen.getByRole('button', { name: 'همه خوانده شد' });
  act(() => { fireEvent.click(one); fireEvent.click(one); fireEvent.click(all); });
  expect(api.markAsRead).toHaveBeenCalledTimes(1);
  expect(api.markAllAsRead).not.toHaveBeenCalled();
  expect(all.disabled).toBe(true);
  expect(screen.getByText('در حال ثبت وضعیت اعلان‌ها…')).toBeTruthy();
  await act(async () => { request.reject(new Error('offline')); });
  expect(all.disabled).toBe(false);
  await act(async () => { fireEvent.click(all); });
  expect(api.markAllAsRead).toHaveBeenCalledTimes(1);
});

it('blocks repeated optimistic removals but permits a different wishlist book', async () => {
  const request = deferred();
  api.getWishlist.mockResolvedValue({ data: { results: books.map(book => ({ id: book.id, book })), count: 2, next: null } });
  api.toggleWishlist.mockReturnValue(request.promise);
  await act(async () => { render(<MemoryRouter><Wishlist /></MemoryRouter>); });
  const buttons = screen.getAllByRole('button', { name: 'حذف از علاقه‌مندی‌ها' });
  act(() => { fireEvent.click(buttons[0]); fireEvent.click(buttons[0]); fireEvent.click(buttons[1]); });
  expect(api.toggleWishlist).toHaveBeenCalledTimes(2);
  expect(screen.getByText('در حال ثبت علاقه‌مندی…')).toBeTruthy();
  await act(async () => { request.reject(new Error('offline')); });
  expect(screen.getAllByRole('button', { name: 'حذف از علاقه‌مندی‌ها' })).toHaveLength(2);
});
