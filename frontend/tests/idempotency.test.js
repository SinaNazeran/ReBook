import { webcrypto } from 'node:crypto';
import { beforeEach, expect, it, vi } from 'vitest';

const client = vi.hoisted(() => ({ post: vi.fn(), interceptors: {
  request: { use: vi.fn() }, response: { use: vi.fn() },
} }));
vi.mock('axios', () => ({ default: { create: () => client } }));
import { cartAPI, orderAPI } from '../src/services/api';
import * as mutations from '../src/services/mutations';

beforeEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  sessionStorage.clear();
  client.post.mockReset();
  vi.stubGlobal('crypto', webcrypto);
  mutations.setMutationActor(null);
});

it('does not share checkout promises or receipts across accounts', async () => {
  mutations.setMutationActor(1);
  let finish;
  client.post.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }))
    .mockResolvedValue({ data: { reference_code: 'account-two' } });
  const first = cartAPI.checkout({ books: [], shipping_address: 'same' });
  const rejectedFirst = first.catch(error => error);
  await vi.waitFor(() => expect(client.post).toHaveBeenCalledTimes(1));
  mutations.setMutationActor(2);
  const second = cartAPI.checkout({ books: [], shipping_address: 'same' });
  expect(second).not.toBe(first);
  expect(await second).toEqual({ data: { reference_code: 'account-two' } });
  finish({ data: { reference_code: 'account-one' } });
  expect(await rejectedFirst).toMatchObject({ code: 'ERR_CANCELED' });
});

it('cancels a prior account intent before its asynchronous fingerprint finishes', async () => {
  mutations.setMutationActor(1);
  client.post.mockResolvedValue({ data: {} });
  const request = cartAPI.checkout({ books: [] });
  mutations.setMutationActor(2);
  await expect(request).rejects.toMatchObject({ code: 'ERR_CANCELED' });
  expect(client.post).not.toHaveBeenCalled();
});

it('keeps persisted retry keys separate per account', async () => {
  client.post.mockRejectedValue(new Error('offline'));
  mutations.setMutationActor(1);
  await expect(orderAPI.payOrder(101)).rejects.toThrow();
  mutations.setMutationActor(2);
  await expect(orderAPI.payOrder(101)).rejects.toThrow();
  mutations.setMutationActor(1);
  await expect(orderAPI.payOrder(101)).rejects.toThrow();
  const keys = client.post.mock.calls.map(call => call[2].headers['Idempotency-Key']);
  expect(keys[1]).not.toBe(keys[0]);
  expect(keys[2]).toBe(keys[0]);
});

it.each([409, 429, 503])('retains a checkout key after HTTP %s across a reload', async status => {
  client.post.mockRejectedValueOnce({ response: { status } }).mockResolvedValue({ data: {} });
  const payload = { books: [{ id: 9, price: 120 }], shipping_address: 'confidential' };
  await expect(cartAPI.checkout(payload)).rejects.toEqual({ response: { status } });
  const originalKey = client.post.mock.calls[0][2]?.headers?.['Idempotency-Key'];
  expect(originalKey).toBeTruthy();
  vi.resetModules();
  const { cartAPI: reloaded } = await import('../src/services/api');
  const restoredMutations = await import('../src/services/mutations');
  restoredMutations.setMutationActor(null);
  await reloaded.checkout({ shipping_address: 'confidential', books: [{ price: 120, id: 9 }] });
  expect(client.post.mock.calls[1][2]?.headers?.['Idempotency-Key']).toBe(originalKey);
});

it('gives changed checkout payloads different keys', async () => {
  client.post.mockRejectedValue(new Error('offline'));
  await expect(cartAPI.checkout({ shipping_address: 'one', books: [] })).rejects.toThrow();
  await expect(cartAPI.checkout({ shipping_address: 'two', books: [] })).rejects.toThrow();
  const keys = client.post.mock.calls.map(call => call[2]?.headers?.['Idempotency-Key']);
  expect(keys[0]).toBeTruthy();
  expect(keys[1]).not.toBe(keys[0]);
});

it('starts a fresh intent after validation failure or 24 hours', async () => {
  const now = Date.now();
  vi.spyOn(Date, 'now').mockReturnValue(now);
  client.post.mockRejectedValueOnce({ response: { status: 400 } }).mockRejectedValue(new Error('offline'));
  await expect(orderAPI.cancelOrder(95)).rejects.toEqual({ response: { status: 400 } });
  await expect(orderAPI.cancelOrder(95)).rejects.toThrow();
  vi.spyOn(Date, 'now').mockReturnValue(now + 24 * 60 * 60 * 1000);
  await expect(orderAPI.cancelOrder(95)).rejects.toThrow();
  const keys = client.post.mock.calls.map(call => call[2]?.headers?.['Idempotency-Key']);
  expect(keys[0]).toBeTruthy();
  expect(new Set(keys).size).toBe(3);
});

it('retains retry keys in memory when session storage is unavailable', async () => {
  vi.stubGlobal('sessionStorage', { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } });
  client.post.mockRejectedValue(new Error('offline'));
  await expect(orderAPI.payOrder(96)).rejects.toThrow();
  await expect(orderAPI.payOrder(96)).rejects.toThrow();
  const keys = client.post.mock.calls.map(call => call[2]?.headers?.['Idempotency-Key']);
  expect(keys[0]).toBeTruthy();
  expect(keys[1]).toBe(keys[0]);
});

it('retains retry keys when storage reads work but writes exceed the quota', async () => {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
  client.post.mockRejectedValue(new Error('offline'));
  await expect(orderAPI.payOrder(98)).rejects.toThrow();
  await expect(orderAPI.payOrder(98)).rejects.toThrow();
  const keys = client.post.mock.calls.map(call => call[2]?.headers?.['Idempotency-Key']);
  expect(keys[0]).toBeTruthy();
  expect(keys[1]).toBe(keys[0]);
});

it('includes an idempotency key when creating a pending order', async () => {
  client.post.mockResolvedValue({ data: { id: 97 } });
  await orderAPI.createOrder({ book: 97, shipping_address: 'address' });
  expect(client.post.mock.calls[0][0]).toBe('/orders/create/');
  expect(client.post.mock.calls[0][2]?.headers?.['Idempotency-Key']).toMatch(/^[\x21-\x7e]{8,128}$/);
});

it('reuses a payment key after network failure and starts a new intent after success', async () => {
  client.post.mockRejectedValueOnce(new Error('network'))
    .mockResolvedValue({ data: { reference_code: '123' } });
  await expect(orderAPI.payOrder(71)).rejects.toThrow('network');
  await orderAPI.payOrder(71);
  const key = call => call[2]?.headers?.['Idempotency-Key'];
  expect(key(client.post.mock.calls[0])).toBeTruthy();
  expect(key(client.post.mock.calls[1])).toBe(key(client.post.mock.calls[0]));
  await orderAPI.payOrder(71);
  expect(key(client.post.mock.calls[2])).not.toBe(key(client.post.mock.calls[0]));
});

it('shares an in-flight checkout intent and does not persist its private address', async () => {
  let finish;
  client.post.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const payload = { books: [{ id: 8, price: 100 }], shipping_address: 'private address' };
  const first = cartAPI.checkout(payload);
  const second = cartAPI.checkout(payload);
  expect(second).toBe(first);
  await vi.waitFor(() => expect(client.post).toHaveBeenCalled());
  expect(client.post).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(sessionStorage)).not.toContain('private address');
  const receipt = { data: { reference_code: '456', orders: [1] } };
  finish(receipt);
  expect(await first).toEqual(receipt);
  expect(await second).toEqual(receipt);
});

it('keeps cancellation retries scoped to their order', async () => {
  client.post.mockRejectedValue(new Error('offline'));
  await expect(orderAPI.cancelOrder(81)).rejects.toThrow('offline');
  await expect(orderAPI.cancelOrder(82)).rejects.toThrow('offline');
  const keys = client.post.mock.calls.map(call => call[2]?.headers?.['Idempotency-Key']);
  expect(keys[0]).toBeTruthy();
  expect(keys[0]).not.toBe(keys[1]);
});
