import { afterEach, expect, it, vi } from 'vitest';
import { bookCanonical, routeCanonical, siteOrigin } from '../src/utils/canonicals.js';

afterEach(() => vi.unstubAllEnvs());
const origin = 'https://frontend.verification-only.example';

it('requires an explicit HTTPS origin for production and never derives it from the current host', () => {
  expect(siteOrigin(undefined)).toBeNull();
  expect(() => siteOrigin(undefined, { required: true })).toThrow('VITE_SITE_URL');
  expect(siteOrigin(`${origin}/`)).toBe(origin);
  for (const value of ['http://example.com', 'javascript:alert(1)', '//example.com', 'https://user:secret@example.com',
    'https://example.com/app', 'https://example.com/?key=value', 'https://example.com/#section']) {
    expect(() => siteOrigin(value)).toThrow('VITE_SITE_URL');
  }
  vi.stubEnv('VITE_SITE_URL', '');
  expect(routeCanonical('/about')).toBeNull();
});

it('preserves catalog content parameters and page size while removing tracking, unknown parameters, and fragments', () => {
  vi.stubEnv('VITE_SITE_URL', origin);
  const search = '?utm_source=mail&gclid=tracker&category=fiction&page=2&search=تاریخ&condition=good&ordering=price&min_price=100&max_price=200&page_size=24&unknown=x';
  const actual = new URL(routeCanonical('/BOOKS/', search));
  expect(actual.origin).toBe(origin);
  expect(actual.pathname).toBe('/books');
  expect([...actual.searchParams.keys()]).toEqual(['category', 'condition', 'max_price', 'min_price', 'ordering', 'page', 'page_size', 'search']);
  expect(actual.searchParams.get('search')).toBe('تاریخ');
  expect(actual.searchParams.get('page')).toBe('2');
  expect(actual.searchParams.get('page_size')).toBe('24');
  expect(routeCanonical('/about', '?utm_campaign=x#part')).toBe(`${origin}/about`);
  expect(routeCanonical('/login', '?next=/profile')).toBe(`${origin}/login`);
  expect(routeCanonical('/register')).toBe(`${origin}/register`);
});

it('preserves repeated-value order and makes equivalent query ordering deterministic', () => {
  vi.stubEnv('VITE_SITE_URL', origin);
  expect(routeCanonical('/books', '?search=a&category=b&search=c')).toBe(`${origin}/books?category=b&search=a&search=c`);
  expect(routeCanonical('/books', '?page=2&category=b')).toBe(routeCanonical('/books', '?category=b&page=2'));
});

it('omits private, cart, loading-book, unknown, and non-public book URLs', () => {
  vi.stubEnv('VITE_SITE_URL', origin);
  for (const path of ['/cart', '/profile', '/my-books', '/my-orders', '/wishlist', '/notifications', '/support', '/create-book', '/books/5/edit', '/books/5', '/missing']) {
    expect(routeCanonical(path, '?email=private@example.com')).toBeNull();
  }
  expect(bookCanonical({ id: 5, status: 'approved' })).toBe(`${origin}/books/5`);
  expect(bookCanonical({ id: 5, status: 'sold' })).toBe(`${origin}/books/5`);
  for (const book of [null, { id: 5, status: 'pending' }, { id: 5, status: 'rejected' },
    { id: '//attacker.example', status: 'approved' }, { id: -1, status: 'approved' }]) {
    expect(bookCanonical(book)).toBeNull();
  }
});
