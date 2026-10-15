import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import Loading from '../src/components/Loading.jsx';
import ProtectedRoute from '../src/components/ProtectedRoute.jsx';
import SessionStatus from '../src/components/SessionStatus.jsx';
import Cart from '../src/pages/Cart.jsx';
import Support from '../src/pages/Support.jsx';
import BookCard from '../src/components/BookCard.jsx';
import { BookEditorPreview } from '../src/features/book-editor/BookEditorPreview.jsx';

const state = vi.hoisted(() => ({ auth: {}, cart: {}, list: {} }));
vi.mock('../src/context/useAuth.js', () => ({ useAuth: () => state.auth }));
vi.mock('../src/context/useCart.js', () => ({ useCart: () => state.cart }));
vi.mock('../src/hooks/usePagedList', () => ({ usePagedList: () => state.list }));

beforeEach(() => {
  state.auth = { loading: false, isAuthenticated: true, user: { id: 1 }, retrySession: vi.fn() };
  state.cart = { items: [], total: 0, status: 'ready' };
  state.list = { items: [], count: 0, loading: false, loadError: false };
});
afterEach(cleanup);

function expectOneH1(container, text) {
  const headings = container.querySelectorAll('h1');
  expect(headings).toHaveLength(1);
  if (text) expect(headings[0].textContent).toContain(text);
}

it('gives full-page loading a heading while inline loading leaves page ownership alone', () => {
  const view = render(<Loading />);
  expect(view.container.querySelector('h1')).toBeNull();
  view.rerender(<Loading fullPage heading="کتاب‌های من" />);
  expectOneH1(view.container, 'کتاب‌های من');
  expect(screen.getByRole('status').textContent).toContain('در حال بارگذاری');
  view.rerender(<Loading fullPage />);
  expectOneH1(view.container, 'بارگذاری');
});

it('keeps exactly one heading through protected session loading, failure, and recovery', () => {
  state.auth = { ...state.auth, loading: true };
  const tree = () => <MemoryRouter><SessionStatus /><ProtectedRoute><h1>پروفایل</h1></ProtectedRoute></MemoryRouter>;
  const view = render(tree());
  expectOneH1(view.container);
  state.auth = { ...state.auth, loading: false, authError: 'ارتباط برقرار نشد' };
  view.rerender(tree());
  expectOneH1(view.container);
  expect(screen.getAllByRole('button', { name: 'بررسی دوباره وضعیت ورود' })).toHaveLength(1);
  state.auth = { ...state.auth, authError: null };
  view.rerender(tree());
  expectOneH1(view.container, 'پروفایل');
});

it('does not introduce a second H1 when a public page remains usable during session failure', () => {
  state.auth.authError = 'ارتباط برقرار نشد';
  const view = render(<><SessionStatus /><h1>صفحه اصلی</h1></>);
  expectOneH1(view.container, 'صفحه اصلی');
});

it('keeps a cart H1 during session failure, cart loading, and recovery', () => {
  state.auth.authError = 'ارتباط برقرار نشد';
  const tree = () => <MemoryRouter><SessionStatus /><Cart /></MemoryRouter>;
  const view = render(tree());
  expectOneH1(view.container);
  state.auth.authError = null;
  state.cart.status = 'loading';
  view.rerender(tree());
  expectOneH1(view.container, 'سبد خرید');
  state.cart.status = 'ready';
  view.rerender(tree());
  expectOneH1(view.container, 'سبد خرید');
});

it('uses H2 for an editor preview and retains H3 under a catalog section', () => {
  const book = { id: 5, title: 'عنوان آزمایشی', author: 'نویسنده', price: 1000 };
  const view = render(<MemoryRouter><h1>فروش کتاب</h1><BookEditorPreview previewBook={book} /></MemoryRouter>);
  expect([...view.container.querySelectorAll('h1,h2,h3')].map(node => node.tagName)).toEqual(['H1', 'H2']);
  expect(view.container.querySelector('[inert]')).toBeTruthy();
  view.rerender(<MemoryRouter><h1>کتاب‌ها</h1><h2>نتیجه‌ها</h2><BookCard book={book} /></MemoryRouter>);
  expect([...view.container.querySelectorAll('h1,h2,h3')].map(node => node.tagName)).toEqual(['H1', 'H2', 'H3']);
});

it('nests ticket headings below the support section and preserves its accordion control', () => {
  state.list.items = [{ id: 1, subject: 'موضوع پیام', message: 'متن پیام', status: 'open', created_at: '2026-10-16' }];
  const view = render(<MemoryRouter><Support /></MemoryRouter>);
  expectOneH1(view.container, 'پشتیبانی');
  const ticket = screen.getByRole('button', { name: /موضوع پیام/ });
  expect(ticket.closest('.accordion-header').tagName).toBe('H3');
  expect(ticket.getAttribute('aria-expanded')).toBe('false');
});
