import { useContext, useEffect } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import AuthContext, { AuthProvider } from '../src/context/AuthContext';
import ProtectedRoute from '../src/components/ProtectedRoute';
import SessionStatus from '../src/components/SessionStatus';
import CartContext, { CartProvider } from '../src/context/CartContext';
import { durableMutation, setMutationActor } from '../src/services/mutations';

const api = vi.hoisted(() => ({ getCsrfToken: vi.fn(), getProfile: vi.fn(), login: vi.fn(), getCart: vi.fn(), addToCart: vi.fn() }));
vi.mock('../src/services/api', () => ({ authAPI: api, cartAPI: api }));
let auth;
let cartState;
function Probe() {
  const value = useContext(AuthContext);
  useEffect(() => { auth = value; }, [value]);
  return <SessionStatus />;
}
function mount() {
  return render(<AuthProvider><Probe /><MemoryRouter initialEntries={['/private']}>
    <Routes>
      <Route path="/private" element={<ProtectedRoute><p>private content</p></ProtectedRoute>} />
      <Route path="/login" element={<p>login route</p>} />
    </Routes>
  </MemoryRouter></AuthProvider>);
}
beforeEach(() => {
  Object.values(api).forEach(mock => mock.mockReset());
  api.getCsrfToken.mockResolvedValue({});
  api.getProfile.mockResolvedValue({ data: { id: 1 } });
  api.getCart.mockResolvedValue({ data: { items: [], count: 0, total: 0 } });
  setMutationActor(undefined);
});
afterEach(cleanup);

it.each([undefined, 500, 403])('keeps a failed session check unresolved for status %s and recovers', async status => {
  const failure = status ? { response: { status } } : new Error('offline');
  api.getProfile.mockRejectedValueOnce(failure);
  await act(async () => { mount(); });
  expect(auth.authError).toBeTruthy();
  expect(auth.loading).toBe(false);
  expect(screen.queryByText('login route')).toBeNull();
  expect(screen.queryByText('private content')).toBeNull();
  const send = vi.fn();
  await expect(durableMutation('pay', {}, send)).rejects.toMatchObject({ code: 'ERR_CANCELED' });
  expect(send).not.toHaveBeenCalled();
  expect(screen.getByRole('alert')).toBeTruthy();
  await act(async () => { fireEvent.click(screen.getByText('بررسی دوباره وضعیت ورود')); });
  expect(auth.authError).toBeNull();
  expect(auth.user.id).toBe(1);
  expect(screen.getByText('private content')).toBeTruthy();
  expect(api.getCsrfToken).toHaveBeenCalledTimes(2);
});

it('exposes CSRF bootstrap failure and retries the complete sequence', async () => {
  api.getCsrfToken.mockRejectedValueOnce(new Error('offline'));
  await act(async () => { mount(); });
  expect(auth.authError).toBeTruthy();
  expect(api.getProfile).not.toHaveBeenCalled();
  await act(async () => { auth.retrySession(); });
  expect(auth.user.id).toBe(1);
});

it('treats a genuine 401 as anonymous and redirects to login', async () => {
  api.getProfile.mockRejectedValueOnce({ response: { status: 401 } });
  await act(async () => { mount(); });
  expect(auth.authError).toBeNull();
  expect(screen.getByText('login route')).toBeTruthy();
});

it('does not restore a delayed session after an unauthorized event', async () => {
  let finish;
  api.getProfile.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  await act(async () => { mount(); });
  act(() => { window.dispatchEvent(new CustomEvent('auth:unauthorized')); });
  await act(async () => { finish({ data: { id: 9 } }); });
  expect(auth.user).toBeNull();
  expect(auth.authError).toBeNull();
  expect(screen.getByText('login route')).toBeTruthy();
});

it('ignores an old session failure after login confirms a newer account', async () => {
  let fail;
  api.getProfile.mockImplementation(() => new Promise((resolve, reject) => { fail = reject; }));
  api.login.mockResolvedValue({ data: { user: { id: 2 } } });
  await act(async () => { mount(); });
  await act(async () => { await auth.loginUser({}); });
  await act(async () => { fail(new Error('late failure')); });
  expect(auth.user.id).toBe(2);
  expect(auth.authError).toBeNull();
});

function CartProbe() {
  const cart = useContext(CartContext);
  useEffect(() => { cartState = cart; }, [cart]);
  return <span>{cart.status}</span>;
}
it('does not fetch a guest cart while session identity is unresolved', async () => {
  api.getProfile.mockRejectedValueOnce(new Error('offline'));
  await act(async () => { render(<AuthProvider><CartProvider><Probe /><CartProbe /></CartProvider></AuthProvider>); });
  expect(api.getCart).not.toHaveBeenCalled();
  await expect(cartState.add(5)).rejects.toMatchObject({ code: 'ERR_SESSION_UNAVAILABLE' });
  expect(api.addToCart).not.toHaveBeenCalled();
  await act(async () => { fireEvent.click(screen.getByText('بررسی دوباره وضعیت ورود')); });
  expect(api.getCart).toHaveBeenCalledTimes(1);
  expect(screen.getByText('ready')).toBeTruthy();
});
