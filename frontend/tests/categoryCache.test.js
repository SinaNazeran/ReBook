import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ getCategories: vi.fn() }));
vi.mock('../src/services/api', () => ({ bookAPI: api }));
let fetchCategories;
const page = (id, next = null, maxAge = 60) => ({ data: { results: [{ id }], next },
  headers: { 'cache-control': `public, max-age=${maxAge}` } });

beforeEach(async () => {
  vi.resetModules();
  api.getCategories.mockReset();
  vi.useFakeTimers();
  vi.setSystemTime(1000);
  ({ fetchCategories } = await import('../src/utils/categories'));
});
afterEach(() => vi.useRealTimers());

it('shares a complete tree then reloads after its freshness expires', async () => {
  api.getCategories.mockResolvedValueOnce(page(1)).mockResolvedValueOnce(page(2));
  expect(await fetchCategories()).toEqual([{ id: 1 }]);
  expect(await fetchCategories()).toEqual([{ id: 1 }]);
  vi.setSystemTime(61001);
  expect(await fetchCategories()).toEqual([{ id: 2 }]);
});

it('uses the earliest page freshness and shares slow in-flight loading', async () => {
  let finish;
  api.getCategories.mockResolvedValueOnce(page(1, '?page=2', 10))
    .mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }))
    .mockResolvedValueOnce(page(3));
  const first = fetchCategories();
  await Promise.resolve();
  vi.setSystemTime(71000);
  const shared = fetchCategories();
  finish(page(2));
  expect(await shared).toEqual(await first);
  expect(api.getCategories).toHaveBeenCalledTimes(2);
  expect(await fetchCategories()).toEqual([{ id: 3 }]);
});

it('retries a failed refresh without retaining the expired tree or partial pages', async () => {
  api.getCategories.mockResolvedValueOnce(page(1)).mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce(page(2));
  await fetchCategories();
  vi.setSystemTime(61001);
  await expect(fetchCategories()).rejects.toThrow('offline');
  expect(await fetchCategories()).toEqual([{ id: 2 }]);
});

it('does not restart freshness when a browser reuses an HTTP cached page', async () => {
  vi.setSystemTime(31000);
  const cached = page(1);
  cached.headers.date = new Date(1000).toUTCString();
  api.getCategories.mockResolvedValueOnce(cached).mockResolvedValueOnce(page(2));
  await fetchCategories();
  vi.setSystemTime(61001);
  expect(await fetchCategories()).toEqual([{ id: 2 }]);
});
