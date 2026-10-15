import { useContext, useEffect } from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import CartContext, { CartProvider } from '../src/context/CartContext.jsx';

const state = vi.hoisted(() => ({ auth: { user: { id: 1 }, loading: false }, api: {
  getCart: vi.fn(), addToCart: vi.fn(), removeFromCart: vi.fn(),
} }));
vi.mock('../src/context/useAuth.js', () => ({ useAuth: () => state.auth }));
vi.mock('../src/services/api', () => ({ cartAPI: state.api }));
let cart;
function Probe() {
  const value = useContext(CartContext);
  useEffect(() => { cart = value; }, [value]);
  return <output>{value.count}</output>;
}
function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}
const response = count => ({ data: { items: [], count, total: 0 } });
beforeEach(() => {
  state.auth = { user: { id: 1 }, loading: false };
  Object.values(state.api).forEach(mock => mock.mockReset());
});
afterEach(cleanup);

it('does not replace a mutation result with an older initial cart response', async () => {
  const initial = deferred();
  state.api.getCart.mockReturnValue(initial.promise);
  state.api.addToCart.mockResolvedValue(response(1));
  render(<CartProvider><Probe /></CartProvider>);
  await act(async () => { await cart.add(7); });
  expect(screen.getByRole('status').textContent).toBe('1');
  await act(async () => { initial.resolve(response(0)); });
  expect(screen.getByRole('status').textContent).toBe('1');
});

it('sends add then remove in intent order even when remove would finish faster', async () => {
  state.api.getCart.mockResolvedValue(response(0));
  const addition = deferred();
  state.api.addToCart.mockReturnValue(addition.promise);
  state.api.removeFromCart.mockResolvedValue(response(0));
  await act(async () => { render(<CartProvider><Probe /></CartProvider>); });
  let pending, removal;
  await act(async () => { pending = cart.add(7); removal = cart.remove(7); });
  expect(state.api.removeFromCart).not.toHaveBeenCalled();
  await act(async () => { addition.resolve(response(1)); await pending; await removal; });
  expect(screen.getByRole('status').textContent).toBe('0');
});

it('retains both additions when concurrent server processing could reverse them', async () => {
  state.api.getCart.mockResolvedValue(response(0));
  const first = deferred();
  state.api.addToCart.mockImplementation(id => id === 7 ? first.promise : Promise.resolve(response(2)));
  await act(async () => { render(<CartProvider><Probe /></CartProvider>); });
  let one, two;
  await act(async () => { one = cart.add(7); two = cart.add(8); });
  expect(state.api.addToCart.mock.calls.map(call => call[0])).toEqual([7]);
  await act(async () => { first.resolve(response(1)); await one; await two; });
  expect(state.api.addToCart.mock.calls.map(call => call[0])).toEqual([7, 8]);
  expect(screen.getByRole('status').textContent).toBe('2');
});

it('publishes mutation success when refresh was requested while it was pending', async () => {
  state.api.getCart.mockResolvedValueOnce(response(0)).mockResolvedValue(response(1));
  const addition = deferred();
  state.api.addToCart.mockReturnValue(addition.promise);
  await act(async () => { render(<CartProvider><Probe /></CartProvider>); });
  let pending;
  await act(async () => { pending = cart.add(7); cart.refresh(); });
  await act(async () => { addition.resolve(response(1)); await pending; });
  expect(screen.getByRole('status').textContent).toBe('1');
});

it('refreshes independent checkout changes after a delayed removal drains', async () => {
  state.api.getCart.mockResolvedValueOnce(response(2)).mockResolvedValue(response(0));
  const removal = deferred();
  state.api.removeFromCart.mockReturnValue(removal.promise);
  await act(async () => { render(<CartProvider><Probe /></CartProvider>); });
  let pending;
  await act(async () => { pending = cart.remove(7); });
  // پرداخت مستقل، سبد سرور را خالی کرده؛ پاسخ حذف هنوز وضعیت پیش از پرداخت را دارد.
  act(() => { cart.refresh(); });
  expect(state.api.getCart).toHaveBeenCalledTimes(1);
  await act(async () => { removal.resolve(response(1)); await pending; });
  expect(state.api.getCart).toHaveBeenCalledTimes(2);
  expect(screen.getByRole('status').textContent).toBe('0');
});

it('does not expose a previous account mutation response after switching account', async () => {
  state.api.getCart.mockResolvedValue(response(0));
  const addition = deferred();
  state.api.addToCart.mockReturnValue(addition.promise);
  let view;
  await act(async () => { view = render(<CartProvider><Probe /></CartProvider>); });
  let pending;
  act(() => { pending = cart.add(7); });
  state.auth = { user: { id: 2 }, loading: false };
  await act(async () => { view.rerender(<CartProvider><Probe /></CartProvider>); });
  await act(async () => { addition.resolve(response(1)); await pending; });
  expect(screen.getByRole('status').textContent).toBe('0');
});

it('does not carry a deferred refresh into a new account when the old queue drains', async () => {
  state.api.getCart.mockResolvedValue(response(0));
  const addition = deferred();
  state.api.addToCart.mockReturnValue(addition.promise);
  let view, pending;
  await act(async () => { view = render(<CartProvider><Probe /></CartProvider>); });
  await act(async () => { pending = cart.add(7); cart.refresh(); });
  state.auth = { user: { id: 2 }, loading: false };
  await act(async () => { view.rerender(<CartProvider><Probe /></CartProvider>); });
  expect(state.api.getCart).toHaveBeenCalledTimes(2);
  await act(async () => { addition.resolve(response(1)); await pending; });
  expect(state.api.getCart).toHaveBeenCalledTimes(2);
  expect(screen.getByRole('status').textContent).toBe('0');
});

it('cancels queued work and stale callbacks when account changes', async () => {
  state.api.getCart.mockResolvedValue(response(0));
  const addition = deferred();
  state.api.addToCart.mockReturnValue(addition.promise);
  state.api.removeFromCart.mockResolvedValue(response(0));
  let view;
  await act(async () => { view = render(<CartProvider><Probe /></CartProvider>); });
  const staleAdd = cart.add;
  let one, two;
  await act(async () => { one = cart.add(7); two = cart.remove(7); });
  state.auth = { user: { id: 2 }, loading: false };
  await act(async () => { view.rerender(<CartProvider><Probe /></CartProvider>); });
  let stale;
  act(() => { stale = staleAdd(9).catch(error => error); });
  expect(state.api.addToCart.mock.calls.map(call => call[0])).toEqual([7]);
  await act(async () => { expect(await stale).toMatchObject({ code: 'ERR_SESSION_UNAVAILABLE' }); });
  await act(async () => { addition.resolve(response(1)); await one; await two; });
  expect(state.api.removeFromCart).not.toHaveBeenCalled();
  expect(state.api.addToCart.mock.calls.map(call => call[0])).toEqual([7]);
  expect(screen.getByRole('status').textContent).toBe('0');
});

it('does not send queued operations after unmount', async () => {
  state.api.getCart.mockResolvedValue(response(0));
  const addition = deferred();
  state.api.addToCart.mockReturnValue(addition.promise);
  state.api.removeFromCart.mockResolvedValue(response(0));
  let view, one, two;
  await act(async () => { view = render(<CartProvider><Probe /></CartProvider>); });
  await act(async () => { one = cart.add(7); two = cart.remove(7); });
  view.unmount();
  await act(async () => { addition.resolve(response(1)); await one; await two; });
  expect(state.api.removeFromCart).not.toHaveBeenCalled();
});
