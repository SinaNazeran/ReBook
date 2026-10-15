// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest';
vi.mock('vite', async importOriginal => ({ ...await importOriginal(), loadEnv: () => ({}) }));
import configure from '../vite.config.js';

afterEach(() => vi.unstubAllEnvs());

it('rejects a production build without its site origin even when the API origin is supplied', () => {
  vi.stubEnv('VITE_API_URL', 'https://api.verification-only.example/api');
  vi.stubEnv('VITE_SITE_URL', '');
  expect(() => configure({ mode: 'production', command: 'build' })).toThrow('VITE_SITE_URL');
});

it('accepts an explicit HTTPS site origin and leaves development without an origin usable', () => {
  vi.stubEnv('VITE_API_URL', 'https://api.verification-only.example/api');
  vi.stubEnv('VITE_SITE_URL', 'https://frontend.verification-only.example');
  expect(() => configure({ mode: 'production', command: 'build' })).not.toThrow();
  vi.stubEnv('VITE_SITE_URL', '');
  expect(() => configure({ mode: 'development', command: 'serve' })).not.toThrow();
});
