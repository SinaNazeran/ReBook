import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.resetModules(); document.cookie = 'csrftoken=;max-age=0;path=/'; });

it('uses the same API paths when the configured base has a trailing slash', async () => {
  vi.stubEnv('VITE_API_URL', 'https://api.example/api/');
  document.cookie = 'csrftoken=abcdefghijklmnopqrstuvwxyzABCDEF;path=/';
  const fetcher = vi.fn().mockResolvedValue({ ok: true });
  vi.stubGlobal('fetch', fetcher);
  const { reportError } = await import('../src/services/errorReporting.js');
  await reportError('render_error');
  expect(fetcher.mock.calls[0][0]).toBe('https://api.example/api/client-errors/');
});

it('sends only allowlisted metadata, deduplicates, and stops after a bounded budget', async () => {
  const fetcher = vi.fn().mockResolvedValue({ ok: true });
  vi.stubGlobal('fetch', fetcher);
  document.cookie = 'csrftoken=abcdefghijklmnopqrstuvwxyzABCDEF;path=/';
  window.history.replaceState({}, '', '/books/42?secret=private@example.com');
  const { reportError } = await import('../src/services/errorReporting.js');
  const data = { status: 503, request_id: 'a'.repeat(32), message: 'secret', stack: 'private', user: 42 };
  await reportError('api_server_error', data);
  await reportError('api_server_error', data);
  expect(fetcher).toHaveBeenCalledTimes(1);
  const [url, options] = fetcher.mock.calls[0];
  expect(url).toMatch(/\/api\/client-errors\/$/);
  expect(JSON.parse(options.body)).toEqual({ kind: 'api_server_error', page: 'book-detail', status: 503, request_id: 'a'.repeat(32) });
  expect(options.credentials).toBe('include');
  expect(options.referrerPolicy).toBe('no-referrer');
  expect(options.headers['X-CSRFToken']).toBeTruthy();
  for (let index = 0; index < 30; index++) await reportError('api_server_error', { status: 500, request_id: index.toString(16).padStart(32, '0') });
  expect(fetcher.mock.calls.length).toBeLessThanOrEqual(5);
  expect(JSON.stringify(fetcher.mock.calls)).not.toContain('private');
});

it('acquires a CSRF token for early errors and quietly handles telemetry failures', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ csrfToken: 'a'.repeat(64) }) })
    .mockRejectedValue(new Error('private network details'));
  vi.stubGlobal('fetch', fetcher);
  const { reportError } = await import('../src/services/errorReporting.js');
  await expect(reportError('render_error')).resolves.toBe(false);
  expect(fetcher.mock.calls[0][0]).toMatch(/accounts\/csrf\/$/);
  expect(fetcher.mock.calls[0][1].referrerPolicy).toBe('no-referrer');
  expect(fetcher.mock.calls[1][1].headers['X-CSRFToken']).toBe('a'.repeat(64));
  await expect(reportError('invalid_kind')).resolves.toBe(false);
  expect(fetcher).toHaveBeenCalledTimes(2);
});

it('installs global handlers once, ignores raw event contents, and cleans up', async () => {
  document.cookie = 'csrftoken=abcdefghijklmnopqrstuvwxyzABCDEF;path=/';
  const fetcher = vi.fn().mockResolvedValue({ ok: true });
  vi.stubGlobal('fetch', fetcher);
  const { installErrorReporting } = await import('../src/services/errorReporting.js');
  const stop = installErrorReporting();
  const duplicateStop = installErrorReporting();
  window.dispatchEvent(new ErrorEvent('error', { message: 'secret', filename: 'https://private.example/' }));
  window.dispatchEvent(new Event('unhandledrejection'));
  await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
  stop(); duplicateStop();
  window.dispatchEvent(new ErrorEvent('error'));
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(JSON.stringify(fetcher.mock.calls)).not.toContain('private.example');
});
