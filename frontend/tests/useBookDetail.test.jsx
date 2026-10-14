import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useBookDetail } from '../src/features/book-detail/useBookDetail.js';
import { bookAPI } from '../src/services/api.js';

const route = vi.hoisted(() => ({ id: 'A' }));
vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: route.id }), useNavigate: () => vi.fn(), useLocation: () => ({}),
}));
vi.mock('../src/context/useAuth.js', () => ({ useAuth: () => ({ user: null, isAuthenticated: false }) }));
vi.mock('../src/context/useCart.js', () => ({ useCart: () => ({ inCart: () => false }) }));
vi.mock('../src/services/api.js', () => ({ bookAPI: { getBook: vi.fn() }, getErrorMessage: () => 'خطا' }));

let requests;
beforeEach(() => {
  route.id = 'A';
  requests = [];
  bookAPI.getBook.mockImplementation((id, config) => new Promise((resolve, reject) => {
    requests.push({ id, config, resolve, reject });
  }));
});
afterEach(cleanup);
const finish = async (request, id = request.id) => {
  await act(async () => { request.resolve({ data: { id, is_wishlisted: false } }); });
};

it('prevents a manual refresh for A overwriting B after navigation', async () => {
  const { result, rerender } = renderHook(useBookDetail);
  await finish(requests[0]);
  act(() => { result.current.refreshBook(); });
  const oldRefresh = requests[1];
  route.id = 'B';
  rerender();
  await finish(requests[2]);
  await finish(oldRefresh);
  expect(result.current.book.id).toBe('B');
  expect(oldRefresh.config?.signal.aborted).toBe(true);
});

it('lets only the latest manual refresh update the current book', async () => {
  const { result } = renderHook(useBookDetail);
  await finish(requests[0]);
  act(() => { result.current.refreshBook(); });
  act(() => { result.current.refreshBook(); });
  await finish(requests[2], 'new');
  await finish(requests[1], 'old');
  expect(result.current.book.id).toBe('new');
  expect(requests[1].config?.signal.aborted).toBe(true);
});

it('aborts StrictMode and unmounted requests even if the adapter later resolves', async () => {
  const { unmount } = renderHook(useBookDetail, { reactStrictMode: true });
  expect(requests).toHaveLength(2);
  expect(requests[0].config?.signal.aborted).toBe(true);
  unmount();
  expect(requests[1].config?.signal.aborted).toBe(true);
  await finish(requests[1]);
});

it('shows loading while a different book route is being fetched', async () => {
  const { result, rerender } = renderHook(useBookDetail);
  await finish(requests[0]);
  route.id = 'B';
  rerender();
  expect(result.current.loading).toBe(true);
  await finish(requests[1]);
  expect(result.current.loading).toBe(false);
  expect(result.current.book.id).toBe('B');
});
