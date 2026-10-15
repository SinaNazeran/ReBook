import { expect, it } from 'vitest';
import { hostHeaderArtifacts, parseHostHeaders, securityHeaders } from '../security-headers';

it('separates immutable build assets from revalidated SPA responses', () => {
  const artifacts = hostHeaderArtifacts(securityHeaders('https://api.example/api'), ['/assets/app-ABCDE123.js']);
  for (const path of ['/', '/index.html', '/books', '/books/123', '/unknown']) {
    expect(parseHostHeaders(artifacts._headers, path)['Cache-Control']).toBe('no-cache');
  }
  expect(parseHostHeaders(artifacts._headers, '/assets/app-ABCDE123.js')['Cache-Control'])
    .toBe('public, max-age=31536000, immutable');
  expect(parseHostHeaders(artifacts._headers, '/assets/missing.js')['Cache-Control']).toBeUndefined();
  expect(artifacts['cache-headers.conf']).toContain('map $uri $rebook_cache_control');
  expect(artifacts['cache-headers.conf']).toContain('default "no-cache";');
});
