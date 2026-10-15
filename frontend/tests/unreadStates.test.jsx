import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useUnreadCount } from '../src/components/navigation/useUnreadCount';

const api = vi.hoisted(() => ({ getUnreadCount: vi.fn() }));
vi.mock('../src/services/api', () => ({ notificationAPI: api }));
beforeEach(() => { vi.useFakeTimers(); api.getUnreadCount.mockReset(); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

it('distinguishes pending and unavailable counts from a confirmed zero', async () => {
  let fail;
  api.getUnreadCount.mockImplementationOnce(() => new Promise((resolve, reject) => { fail = reject; }))
    .mockResolvedValueOnce({ data: { count: 0 } });
  const { result } = renderHook(() => useUnreadCount(1));
  expect(result.current.count).toBeNull();
  expect(result.current.status).toBe('loading');
  await act(async () => {});
  await act(async () => { fail(new Error('offline')); });
  expect(result.current.status).toBe('error');
  expect(result.current.count).toBeNull();
  await act(async () => { result.current.retry(); });
  expect(result.current.status).toBe('ready');
  expect(result.current.count).toBe(0);
});

it('retains a same-account count as stale on polling failure, then retries', async () => {
  api.getUnreadCount.mockResolvedValueOnce({ data: { count: 7 } })
    .mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ data: { count: 2 } });
  const { result } = renderHook(() => useUnreadCount(1));
  await act(async () => {});
  await act(async () => { vi.advanceTimersByTime(60000); });
  expect(result.current.count).toBe(7);
  expect(result.current.status).toBe('stale');
  await act(async () => { result.current.retry(); });
  expect(result.current).toMatchObject({ count: 2, status: 'ready' });
});

it('does not overlap polling requests while a response is pending', async () => {
  api.getUnreadCount.mockImplementation(() => new Promise(() => {}));
  renderHook(() => useUnreadCount(1));
  await act(async () => { vi.advanceTimersByTime(180000); });
  expect(api.getUnreadCount).toHaveBeenCalledTimes(1);
});

it('hides old account counts immediately and ignores old responses', async () => {
  let finishOld;
  api.getUnreadCount.mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve; }))
    .mockResolvedValueOnce({ data: { count: 3 } });
  const { result, rerender } = renderHook(({ id }) => useUnreadCount(id), { initialProps: { id: 1 } });
  await act(async () => {});
  rerender({ id: 2 });
  expect(result.current.count).toBeNull();
  await act(async () => {});
  expect(result.current.count).toBe(3);
  await act(async () => { finishOld({ data: { count: 99 } }); });
  expect(result.current.count).toBe(3);
  rerender({ id: null });
  expect(result.current).toMatchObject({ count: null, status: 'idle' });
});

it('does not reuse a count as current after logout and return to the same account', async () => {
  api.getUnreadCount.mockResolvedValueOnce({ data: { count: 7 } })
    .mockImplementationOnce(() => new Promise(() => {}));
  const { result, rerender } = renderHook(({ id }) => useUnreadCount(id), { initialProps: { id: 1 } });
  await act(async () => {});
  expect(result.current.count).toBe(7);
  rerender({ id: null });
  rerender({ id: 1 });
  expect(result.current.count).toBeNull();
  expect(result.current.status).toBe('loading');
});

it('aborts a superseded count request when a read action requests a refresh', async () => {
  api.getUnreadCount.mockImplementationOnce(() => new Promise(() => {}))
    .mockResolvedValueOnce({ data: { count: 0 } });
  const { result, rerender } = renderHook(({ version }) => useUnreadCount(1, version), { initialProps: { version: 0 } });
  await act(async () => {});
  const firstSignal = api.getUnreadCount.mock.calls[0][0]?.signal;
  rerender({ version: 1 });
  await act(async () => {});
  expect(firstSignal?.aborted).toBe(true);
  expect(result.current).toMatchObject({ count: 0, status: 'ready' });
});
