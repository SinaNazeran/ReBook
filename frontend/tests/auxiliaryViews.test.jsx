import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import BookList from '../src/pages/BookList';
import Home from '../src/pages/Home';
import CreateBook from '../src/pages/CreateBook';
import Notifications from '../src/pages/Notifications';
import RouteMetadata from '../src/components/RouteMetadata.jsx';

const api = vi.hoisted(() => ({ getCategories: vi.fn(), getBooks: vi.fn(), getBook: vi.fn(),
  getNotifications: vi.fn(), getUnreadCount: vi.fn(), updateBook: vi.fn() }));
vi.mock('../src/services/api', () => ({ bookAPI: api, notificationAPI: api, getErrorMessage: () => 'ارتباط برقرار نشد.' }));
vi.mock('../src/context/useAuth', () => ({ useAuth: () => ({ user: { id: 1 }, isAuthenticated: true }) }));
vi.mock('../src/context/useCart', () => ({ useCart: () => ({ inCart: () => false }) }));
vi.mock('../src/components/BookCard', () => ({
  default: ({ book }) => <p>{book.title}</p>, BookCardSkeleton: () => <span>loading book</span>,
}));
vi.mock('../src/components/HomeHero', () => ({ default: () => <h1>ری‌بوک</h1> }));
vi.mock('../src/utils/toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const page = results => ({ data: { results, count: results.length, next: null }, headers: { 'cache-control': 'no-store' } });
beforeEach(() => {
  vi.stubGlobal('matchMedia', vi.fn(query => ({ matches: false, media: query,
    addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  Object.values(api).forEach(mock => mock.mockReset());
  api.getCategories.mockRejectedValue(new Error('offline'));
  api.getBooks.mockResolvedValue(page([{ id: 1, title: 'کتاب موجود' }]));
});
afterEach(() => { cleanup(); vi.unstubAllEnvs(); });

it('clears the catalog canonical after a request failure and restores it after retry', async () => {
  vi.stubEnv('VITE_SITE_URL', 'https://frontend.verification-only.example');
  api.getBooks.mockRejectedValueOnce(new Error('offline'));
  render(<MemoryRouter initialEntries={['/books?page=2&category=fiction&utm_source=mail']}>
    <RouteMetadata /><BookList />
  </MemoryRouter>);
  await screen.findByText('کتاب‌ها بارگذاری نشدند. اتصال اینترنت را بررسی کن و دوباره امتحان کن.');
  expect(document.head.querySelector('link[rel="canonical"]')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'تلاش دوباره' }));
  await screen.findByText('کتاب موجود');
  expect(document.head.querySelector('link[rel="canonical"]').href)
    .toBe('https://frontend.verification-only.example/books?category=fiction&page=2');
});

it('keeps catalog results usable when categories fail and distinguishes empty retry success', async () => {
  render(<MemoryRouter><BookList /></MemoryRouter>);
  await screen.findByText('کتاب موجود');
  expect(await screen.findByText('دسته‌بندی‌ها بارگذاری نشدند.')).toBeTruthy();
  expect(screen.queryByText('هنوز دسته‌بندی‌ها ثبت نشده‌اند.')).toBeNull();
  api.getCategories.mockResolvedValueOnce(page([]));
  fireEvent.click(screen.getByRole('button', { name: 'تلاش دوباره برای دریافت دسته‌بندی‌ها' }));
  await screen.findByText('هنوز دسته‌بندی‌ها ثبت نشده‌اند.');
  expect(screen.getByText('کتاب موجود')).toBeTruthy();
});

it('keeps home books visible while a failed collection shortcut is retried', async () => {
  render(<MemoryRouter><Home /></MemoryRouter>);
  await screen.findByText('مجموعه‌ها بارگذاری نشدند.');
  api.getCategories.mockResolvedValueOnce(page([{ id: 7, name: 'ادبیات', slug: 'fiction', parent: null }]));
  fireEvent.click(screen.getByRole('button', { name: 'تلاش دوباره برای دریافت مجموعه‌ها' }));
  expect(await screen.findByRole('link', { name: 'ادبیات' })).toBeTruthy();
  expect(screen.getByText('کتاب موجود')).toBeTruthy();
});

it('preserves an edited book and its saved category while category loading recovers', async () => {
  api.getBook.mockResolvedValue({ data: { id: 5, title: 'عنوان فعلی', author: 'نویسنده', price: 1000,
    condition: 'good', seller: { id: 1 }, status: 'approved', category: { id: 7 } } });
  render(<MemoryRouter initialEntries={['/books/5/edit']}><Routes>
    <Route path="/books/:id/edit" element={<CreateBook />} />
  </Routes></MemoryRouter>);
  await screen.findByDisplayValue('عنوان فعلی');
  const category = screen.getByRole('combobox', { name: /دسته‌بندی/ });
  expect(category.value).toBe('7');
  expect(category.disabled).toBe(true);
  fireEvent.change(screen.getByLabelText('عنوان'), { target: { value: 'عنوان ویرایش‌شده' } });
  api.getCategories.mockResolvedValueOnce(page([{ id: 7, parent: null, name: 'ادبیات' }]));
  fireEvent.click(screen.getByRole('button', { name: 'تلاش دوباره برای دریافت دسته‌بندی‌ها' }));
  await waitFor(() => expect(category.disabled).toBe(false));
  expect(category.value).toBe('7');
  expect(screen.getByDisplayValue('عنوان ویرایش‌شده')).toBeTruthy();
  expect(api.updateBook).not.toHaveBeenCalled();
});

it('shows an unavailable unread total without hiding the notification list', async () => {
  api.getUnreadCount.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ data: { count: 0 } });
  api.getNotifications.mockResolvedValue(page([{ id: 1, title: 'اعلان موجود', message: 'پیام', is_read: true, created_at: '2026-10-15' }]));
  render(<MemoryRouter><Notifications /></MemoryRouter>);
  expect(await screen.findByText('شمار اعلان‌ها در دسترس نیست.')).toBeTruthy();
  expect(screen.getByText('اعلان موجود')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'دریافت دوباره شمار اعلان‌ها' }));
  await waitFor(() => expect(screen.queryByText('شمار اعلان‌ها در دسترس نیست.')).toBeNull());
  expect(screen.getByText('اعلان موجود')).toBeTruthy();
});
