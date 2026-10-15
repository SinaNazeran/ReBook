import { webcrypto } from 'node:crypto';
import { useContext, useEffect } from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import AuthContext, { AuthProvider } from '../src/context/AuthContext.jsx';
import { durableMutation, setMutationActor } from '../src/services/mutations';

const api = vi.hoisted(() => ({ getCsrfToken: vi.fn(), getProfile: vi.fn(),
  login: vi.fn(), logout: vi.fn(), register: vi.fn(), updateProfile: vi.fn() }));
vi.mock('../src/services/api', () => ({ authAPI: api }));
let auth;
function Probe() {
  const value = useContext(AuthContext);
  useEffect(() => { auth = value; }, [value]);
  return null;
}
beforeEach(() => {
  Object.values(api).forEach(mock => mock.mockReset());
  vi.stubGlobal('crypto', webcrypto);
  sessionStorage.clear();
  setMutationActor(undefined);
  api.getCsrfToken.mockResolvedValue({});
  api.getProfile.mockResolvedValue({ data: { id: 1 } });
});
afterEach(cleanup);

it('cancels a delayed profile update after logout without restoring its account', async () => {
  await act(async () => { render(<AuthProvider><Probe /></AuthProvider>); });
  let finish;
  api.updateProfile.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  api.logout.mockResolvedValue({ data: {} });
  let update;
  act(() => { update = auth.updateUser({}).catch(error => error); });
  await act(async () => { await auth.logoutUser(); });
  expect(auth.user).toBeNull();
  let result;
  await act(async () => { finish({ data: { id: 1 } }); result = await update; });
  expect(result).toMatchObject({ code: 'ERR_CANCELED' });
  expect(auth.user).toBeNull();
});

it('ignores bootstrap profile restoration superseded by login', async () => {
  let finish;
  api.getProfile.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  api.login.mockResolvedValue({ data: { user: { id: 2 } } });
  await act(async () => { render(<AuthProvider><Probe /></AuthProvider>); });
  await act(async () => { await auth.loginUser({}); });
  expect(auth.user.id).toBe(2);
  await act(async () => { finish({ data: { id: 1 } }); });
  expect(auth.user.id).toBe(2);
  expect(auth.loading).toBe(false);
});

it('preserves the credential error when its 401 event invalidates the auth generation', async () => {
  await act(async () => { render(<AuthProvider><Probe /></AuthProvider>); });
  const error = { response: { status: 401, data: { detail: 'اطلاعات ورود نادرست است.' } } };
  api.login.mockImplementation(async () => {
    window.dispatchEvent(new CustomEvent('auth:unauthorized'));
    throw error;
  });
  let result;
  await act(async () => { result = await auth.loginUser({}).catch(value => value); });
  expect(result).toBe(error);
  expect(auth.user).toBeNull();
});

it.each([
  ['loginUser', 'login', { data: { user: { id: 2 } } }],
  ['registerUser', 'register', { data: { user: { id: 2 } } }],
  ['logoutUser', 'logout', { data: {} }],
])('restores the actor and blocks unsent mutations during %s', async (method, apiName, result) => {
  await act(async () => { render(<AuthProvider><Probe /></AuthProvider>); });
  const send = vi.fn().mockResolvedValue('receipt');
  expect(await durableMutation('pay', {}, send)).toBe('receipt');
  let finish;
  api[apiName].mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  let login;
  act(() => { login = auth[method]({}); });
  await expect(durableMutation('pay', {}, send)).rejects.toMatchObject({ code: 'ERR_CANCELED' });
  await act(async () => { finish(result); await login; });
  expect(await durableMutation('pay', {}, send)).toBe('receipt');
  expect(send).toHaveBeenCalledTimes(2);
});

it('invalidates in-flight account receipts on unauthorized and provider unmount', async () => {
  let view;
  await act(async () => { view = render(<AuthProvider><Probe /></AuthProvider>); });
  let finish;
  const send = vi.fn(() => new Promise(resolve => { finish = resolve; }));
  const request = durableMutation('pay', {}, send).catch(error => error);
  await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(1));
  act(() => { window.dispatchEvent(new CustomEvent('auth:unauthorized')); });
  finish('private receipt');
  expect(await request).toMatchObject({ code: 'ERR_CANCELED' });
  view.unmount();
  await expect(durableMutation('pay', {}, send)).rejects.toMatchObject({ code: 'ERR_CANCELED' });
});
