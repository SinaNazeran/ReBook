import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useCategories } from '../src/utils/categories';

const api = vi.hoisted(() => ({ getCategories: vi.fn() }));
vi.mock('../src/services/api', () => ({ bookAPI: api }));
const page = results => ({ data: { results, next: null }, headers: { 'cache-control': 'no-store' } });
beforeEach(() => { api.getCategories.mockReset(); });
afterEach(cleanup);

it('distinguishes failed categories from empty data and recovers on retry', async () => {
  let fail;
  api.getCategories.mockImplementationOnce(() => new Promise((resolve, reject) => { fail = reject; }))
    .mockResolvedValueOnce(page([]));
  const { result } = renderHook(() => useCategories());
  expect(result.current.status).toBe('loading');
  await act(async () => { fail(new Error('offline')); });
  expect(result.current.status).toBe('error');
  await act(async () => { result.current.retry(); });
  expect(result.current).toMatchObject({ status: 'ready', categories: [] });
});

it('preserves a complete tree while retrying and prevents duplicate retries', async () => {
  let finish;
  api.getCategories.mockResolvedValueOnce(page([{ id: 1, parent: null }]))
    .mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const { result } = renderHook(() => useCategories());
  await act(async () => {});
  act(() => { result.current.retry(); result.current.retry(); });
  expect(result.current.categories).toEqual([{ id: 1, parent: null }]);
  expect(result.current.status).toBe('loading');
  await act(async () => {});
  expect(api.getCategories).toHaveBeenCalledTimes(2);
  await act(async () => { finish(page([{ id: 2, parent: null }])); });
  expect(result.current.categories).toEqual([{ id: 2, parent: null }]);
});
