import { StrictMode } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Link, MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import PageMetadata from '../src/components/PageMetadata.jsx';
import RouteMetadata from '../src/components/RouteMetadata.jsx';
import ErrorBoundary from '../src/components/ErrorBoundary.jsx';
import NotFound from '../src/pages/NotFound.jsx';

const origin = 'https://frontend.verification-only.example';
const links = () => [...document.head.querySelectorAll('link[rel~="canonical" i]')].map(node => node.href);
beforeEach(() => {
  vi.stubEnv('VITE_SITE_URL', origin);
  document.head.innerHTML = '<title>fallback</title><meta name="description" content="fallback">';
});
afterEach(() => { cleanup(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });

it('inherits a route canonical alongside page-owned titles and clears it for excluded routes', () => {
  render(<MemoryRouter initialEntries={['/ABOUT/?utm_source=mail#section']}>
    <RouteMetadata /><PageMetadata title="درباره | ری‌بوک" />
    <Link to="/books?category=fiction&page=2&utm_source=mail">catalog</Link>
    <Link to="/cart">cart</Link><Link to="/books/5">loading book</Link><Link to="/missing">missing</Link>
  </MemoryRouter>);
  expect(links()).toEqual([`${origin}/about`]);
  fireEvent.click(screen.getByText('catalog'));
  expect(links()).toEqual([`${origin}/books?category=fiction&page=2`]);
  for (const name of ['cart', 'loading book', 'missing']) {
    fireEvent.click(screen.getByText(name));
    expect(links()).toEqual([]);
  }
});

it('deduplicates canonical tags, survives StrictMode, and restores the original on final unmount', () => {
  document.head.innerHTML += `<link rel="canonical" href="${origin}/old"><link rel="Canonical" href="${origin}/duplicate">`;
  const view = render(<StrictMode><PageMetadata title="book" canonical={`${origin}/books/5`} /></StrictMode>);
  expect(links()).toEqual([`${origin}/books/5`]);
  view.rerender(<StrictMode><PageMetadata title="error" canonical={null} /></StrictMode>);
  expect(links()).toEqual([]);
  view.unmount();
  expect(links()).toEqual([`${origin}/old`]);
});

it('allows an explicit error override and does not inherit a stale peer page canonical', () => {
  const route = render(<PageMetadata priority={0} title="route A" canonical={`${origin}/about`} />);
  const old = render(<PageMetadata title="book" canonical={`${origin}/books/5`} />);
  route.rerender(<PageMetadata priority={0} title="route B" canonical={`${origin}/contact`} />);
  const next = render(<PageMetadata title="contact" />);
  expect(links()).toEqual([`${origin}/contact`]);
  old.unmount();
  expect(links()).toEqual([`${origin}/contact`]);
  const error = render(<PageMetadata priority={2} title="error" canonical={null} />);
  expect(links()).toEqual([]);
  error.unmount();
  expect(links()).toEqual([`${origin}/contact`]);
  next.unmount();
  route.unmount();
  expect(links()).toEqual([]);
});

it('clears a public route canonical for a rendered not-found page and an actual error boundary', () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  function Crash() { throw new Error('private detail'); }
  const view = render(<MemoryRouter initialEntries={['/about']}>
    <RouteMetadata /><NotFound />
  </MemoryRouter>);
  expect(links()).toEqual([]);
  view.rerender(<MemoryRouter initialEntries={['/about']}>
    <RouteMetadata /><ErrorBoundary><Crash /></ErrorBoundary>
  </MemoryRouter>);
  expect(links()).toEqual([]);
});
