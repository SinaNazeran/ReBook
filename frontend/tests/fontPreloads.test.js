// @vitest-environment node
import { build } from 'vite';
import { Buffer } from 'node:buffer';
import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => vi.unstubAllEnvs());

it('emits reusable WOFF2 font preloads that match the production CSS and asset bytes', async () => {
  vi.stubEnv('VITE_API_URL', 'https://api.verification-only.example/api');
  const result = await build({ logLevel: 'silent', build: { write: false } });
  const assets = (Array.isArray(result) ? result : [result]).flatMap(bundle => bundle.output);
  const html = String(assets.find(asset => asset.fileName === 'index.html').source);
  const css = assets.filter(asset => asset.fileName.endsWith('.css')).map(asset => String(asset.source)).join('\n');
  const links = [...html.matchAll(/<link\b[^>]*>/g)].map(match => match[0])
    .filter(link => /rel="preload"/.test(link) && /as="font"/.test(link));
  expect(links).toHaveLength(2);
  const hrefs = links.map(link => link.match(/href="([^"]+)"/)[1]);
  expect(new Set(hrefs).size).toBe(2);
  expect(hrefs.some(href => /\/lalezar-arabic-400-normal-[\w-]+\.woff2$/.test(href))).toBe(true);
  expect(hrefs.some(href => /\/Vazirmatn-FD-Regular-[\w-]+\.woff2$/.test(href))).toBe(true);
  for (const [index, href] of hrefs.entries()) {
    expect(links[index]).toMatch(/type="font\/woff2"/);
    expect(links[index]).toMatch(/\bcrossorigin(?:="(?:anonymous)?")?(?:\s|>)/);
    expect(css).toContain(href);
    const asset = assets.find(asset => '/' + asset.fileName === href);
    expect(asset).toBeDefined();
    expect(Buffer.from(asset.source).subarray(0, 4).toString()).toBe('wOF2');
  }
}, 30000);
