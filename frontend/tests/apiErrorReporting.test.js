import { expect, it, vi } from 'vitest';

const handlers = vi.hoisted(() => ({ failure: null, report: vi.fn() }));
vi.mock('axios', () => ({ default: { create: () => ({ interceptors: {
  request: { use: () => {} }, response: { use: (_success, failure) => { handlers.failure = failure; } },
} }) } }));
vi.mock('../src/services/errorReporting.js', () => ({ reportError: handlers.report }));
import '../src/services/api.js';

it('correlates server failures without changing the caller error or passing request contents', async () => {
  const error = { response: { status: 503, headers: { 'x-request-id': 'a'.repeat(32) }, data: 'private response' }, config: { data: 'password' } };
  await expect(handlers.failure(error)).rejects.toBe(error);
  expect(handlers.report).toHaveBeenCalledExactlyOnceWith('api_server_error', { status: 503, request_id: 'a'.repeat(32) });
  handlers.report.mockClear();
});

it('preserves unauthorized recovery and excludes expected failures and cancellation', async () => {
  const recovery = vi.fn();
  window.addEventListener('auth:unauthorized', recovery);
  try {
    for (const status of [401, 403, 404, 409, 429, undefined]) {
      const error = status ? { response: { status } } : { code: 'ERR_CANCELED' };
      await expect(handlers.failure(error)).rejects.toBe(error);
    }
    expect(recovery).toHaveBeenCalledTimes(1);
    expect(handlers.report).not.toHaveBeenCalled();
  } finally { window.removeEventListener('auth:unauthorized', recovery); }
});
