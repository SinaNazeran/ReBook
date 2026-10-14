import { MemoryRouter } from 'react-router-dom';
import { act, cleanup, fireEvent, render, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import Cart from '../src/pages/Cart.jsx';

vi.mock('../src/context/useAuth.js', () => ({
  useAuth: () => ({ user: { address: '' }, isAuthenticated: true }),
}));
vi.mock('../src/context/useCart.js', () => ({
  useCart: () => ({
    items: [{ available: true, book: { id: 1, title: 'کتاب', author: 'نویسنده', price: 50000, status: 'approved' } }],
    total: 50000, status: 'ready', remove: vi.fn(), refresh: vi.fn(),
  }),
}));
vi.mock('../src/services/api.js', () => ({ cartAPI: { checkout: vi.fn() }, getErrorMessage: () => 'خطا' }));

let frames;
let nextFrame;
beforeEach(() => {
  frames = new Map();
  nextFrame = 0;
  vi.stubGlobal('requestAnimationFrame', vi.fn(callback => { frames.set(++nextFrame, callback); return nextFrame; }));
  vi.stubGlobal('cancelAnimationFrame', vi.fn(id => frames.delete(id)));
});
afterEach(cleanup);

function openCheckout() {
  const view = render(<MemoryRouter><Cart /></MemoryRouter>, { reactStrictMode: true });
  fireEvent.click(within(view.getByRole('complementary', { name: 'خلاصه' })).getByRole('button', { name: 'ادامه‌ی خرید' }));
  return view;
}

it('cancels queued checkout focus when the page unmounts', () => {
  const { unmount } = openCheckout();
  expect(frames.size).toBe(1);
  unmount();
  expect(frames.size).toBe(0);
  expect(cancelAnimationFrame).toHaveBeenCalled();
});

it('cancels queued focus when the user returns to the cart', () => {
  const view = openCheckout();
  fireEvent.click(view.getByRole('button', { name: 'بازگشت به سبد' }));
  expect(frames.size).toBe(0);
});

it('focuses the current checkout address when the frame runs', () => {
  const view = openCheckout();
  const address = view.getByRole('textbox', { name: 'آدرس ارسال' });
  act(() => {
    const pending = [...frames.values()];
    frames.clear();
    pending.forEach(callback => callback(0));
  });
  expect(document.activeElement).toBe(address);
});
