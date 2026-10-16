import { createServer } from 'vite';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import process from 'node:process';

const require = createRequire(import.meta.url);
const api = process.env.REBOOK_SMOKE_API_URL;
if (!/^http:\/\/127\.0\.0\.1:\d+\/api$/.test(api ?? '')) throw new Error('Run npm run test:smoke; a disposable backend is required.');
process.env.VITE_API_URL = api;
process.env.VITE_SITE_URL = 'https://frontend.verification-only.example';
const server = await createServer({ server: {
  host: '127.0.0.1', port: Number(process.env.REBOOK_SMOKE_PORT), strictPort: true, open: false,
} });
let child;
const stop = () => child?.kill('SIGINT');
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
try {
  await server.listen();
  const origin = server.resolvedUrls.local[0].replace(/\/$/, '');
  // Check the backend and exact cross-origin policy before opening a browser.
  const response = await fetch(`${api}/accounts/csrf/`, {
    headers: { Origin: origin }, signal: AbortSignal.timeout(10000),
  });
  if (!response.ok || response.headers.get('access-control-allow-origin') !== origin) {
    throw new Error('Disposable backend or CORS policy did not start.');
  }
  child = spawn(process.execPath, [require.resolve('@playwright/test/cli'), 'test', '--config=e2e/playwright.config.mjs'], {
    stdio: 'inherit', env: { ...process.env, REBOOK_SMOKE_ORIGIN: origin },
  });
  process.exitCode = await new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('exit', code => resolve(code ?? 1));
  });
} finally {
  process.removeListener('SIGINT', stop);
  process.removeListener('SIGTERM', stop);
  await server.close();
}
