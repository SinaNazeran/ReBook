import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import Login from '../src/pages/Login';
import Register from '../src/pages/Register';
import Profile from '../src/pages/Profile';
import Contact from '../src/pages/Contact';
import Support from '../src/pages/Support';
import CreateBook from '../src/pages/CreateBook';
import PurchaseModal from '../src/components/PurchaseModal';
import Cart from '../src/pages/Cart';

const api = vi.hoisted(() => ({ loginUser: vi.fn(), registerUser: vi.fn(), updateUser: vi.fn(),
  sendContactMessage: vi.fn(), createTicket: vi.fn(), createBook: vi.fn(), payOrder: vi.fn(), checkout: vi.fn(),
  getCategories: vi.fn(), getMyTickets: vi.fn(), authenticated: true }));
vi.mock('../src/services/api', () => ({ bookAPI: api, orderAPI: api, cartAPI: api, notificationAPI: api,
  getErrorMessage: () => 'ارسال ناموفق بود.' }));
vi.mock('../src/context/useAuth', () => ({ useAuth: () => ({ user: { id: 1, username: 'reader', email: 'reader@example.com', address: 'آدرس معتبر' },
  isAuthenticated: api.authenticated, loading: false, loginUser: api.loginUser, registerUser: api.registerUser, updateUser: api.updateUser }) }));
vi.mock('../src/context/useCart', () => ({ useCart: () => ({ items: [{ available: true, book: { id: 5, title: 'کتاب', price: 1000 } }],
  total: 1000, status: 'ready', refresh: vi.fn() }) }));
vi.mock('../src/utils/toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const book = { id: 5, title: 'کتاب', price: 1000 };
const cases = [
  ['login', Login, 'loginUser', { username: 'reader', password: 'password123' }],
  ['register', Register, 'registerUser', { username: 'reader', email: 'reader@example.com', password: 'password123', password_confirm: 'password123' }],
  ['profile', Profile, 'updateUser', {}],
  ['contact', Contact, 'sendContactMessage', { name: 'خواننده', email: 'reader@example.com', subject: 'پرسش', message: 'متن پیام معتبر برای پشتیبانی' }],
  ['support', Support, 'createTicket', { subject: 'پرسش', message: 'پیام من' }],
  ['editor', CreateBook, 'createBook', { title: 'کتاب', author: 'نویسنده', price: '1000' }],
  ['payment', () => <PurchaseModal show onHide={() => {}} book={book} existingOrderId={1} />, 'payOrder', {}],
  ['checkout', Cart, 'checkout', {}],
];
beforeEach(() => {
  Object.values(api).forEach(value => { if (typeof value?.mockReset === 'function') value.mockReset(); });
  api.authenticated = true;
  api.getCategories.mockResolvedValue({ data: [], headers: { 'cache-control': 'no-store' } });
  api.getMyTickets.mockResolvedValue({ data: { results: [], count: 0, next: null } });
  vi.stubGlobal('scrollTo', vi.fn());
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it.each(cases)('%s sends once for repeated submit events and unlocks after failure', async (name, Page, method, fields) => {
  api.authenticated = name !== 'contact';
  let reject;
  api[method].mockImplementation(() => new Promise((_, fail) => { reject = fail; }));
  await act(async () => { render(<MemoryRouter><Page /></MemoryRouter>); });
  if (name === 'checkout') fireEvent.click(screen.getAllByRole('button', { name: 'ادامه‌ی خرید' })[0]);
  for (const [field, value] of Object.entries(fields)) {
    const input = document.querySelector(`[name="${field}"]`);
    expect(input, field).toBeTruthy();
    fireEvent.change(input, { target: { value } });
  }
  const form = document.querySelector('form');
  expect(form).toBeTruthy();
  act(() => { fireEvent.submit(form); fireEvent.submit(form); });
  expect(api[method]).toHaveBeenCalledTimes(1);
  const submit = [...document.querySelectorAll('button[type=submit]')].find(button => button.disabled);
  expect(submit).toBeTruthy();
  expect(submit.textContent).toMatch(/در حال/);
  await act(async () => { reject(new Error('offline')); });
  expect(submit.disabled).toBe(false);
  // تسویه پس از خطا به مرحله سبد برمی‌گردد.
  if (name === 'checkout') fireEvent.click(screen.getAllByRole('button', { name: 'ادامه‌ی خرید' })[0]);
  await act(async () => { fireEvent.submit(document.querySelector('form')); });
  expect(api[method]).toHaveBeenCalledTimes(2);
  await act(async () => { reject(new Error('offline')); });
});

it('does not leave an invalid form locked', async () => {
  api.loginUser.mockRejectedValue(new Error('offline'));
  render(<MemoryRouter><Login /></MemoryRouter>);
  await act(async () => { fireEvent.submit(document.querySelector('form')); });
  expect(api.loginUser).not.toHaveBeenCalled();
  fireEvent.change(document.querySelector('[name=username]'), { target: { value: 'reader' } });
  fireEvent.change(document.querySelector('[name=password]'), { target: { value: 'password123' } });
  await act(async () => { fireEvent.submit(document.querySelector('form')); });
  expect(api.loginUser).toHaveBeenCalledTimes(1);
});
