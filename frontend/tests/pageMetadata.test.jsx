import { StrictMode } from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, expect, it } from 'vitest';
import PageMetadata from '../src/components/PageMetadata.jsx';
import RouteMetadata from '../src/components/RouteMetadata.jsx';
import { MemoryRouter, Link, Route, Routes } from 'react-router-dom';
import { fireEvent, screen } from '@testing-library/react';
import About from '../src/pages/About.jsx';
import NotFound from '../src/pages/NotFound.jsx';
import { bookDescription, catalogDescription, HOME_TITLE } from '../src/utils/metadata.js';

beforeEach(() => {
  document.head.innerHTML = '<title>fallback</title><meta name="description" content="fallback description">';
});
afterEach(cleanup);

function expectHead(title, description) {
  expect([...document.head.querySelectorAll('title')].map(node => node.textContent)).toEqual([title]);
  expect([...document.head.querySelectorAll('meta[name="description"]')].map(node => node.content)).toEqual([description]);
}

it('adopts static metadata, safely updates it, and restores it under StrictMode', () => {
  const view = render(<StrictMode><PageMetadata title="درباره | ری‌بوک" description="درباره کتاب‌ها" /></StrictMode>);
  expectHead('درباره | ری‌بوک', 'درباره کتاب‌ها');
  view.rerender(<StrictMode><PageMetadata title={'<script>book</script>'} description={'" & <img src=x onerror=alert(1)>'} /></StrictMode>);
  expectHead('<script>book</script>', '" & <img src=x onerror=alert(1)>');
  expect(document.head.querySelector('script, img')).toBeNull();
  view.unmount();
  expectHead('fallback', 'fallback description');
});

it('restores the current route fallback without stale cleanup overwriting a destination', () => {
  const shell = render(<PageMetadata priority={0} title="loading A" description="loading description A" />);
  const page = render(<PageMetadata title="book A" description="book description A" />);
  shell.rerender(<PageMetadata priority={0} title="loading B" description="loading description B" />);
  expectHead('book A', 'book description A');
  page.unmount();
  expectHead('loading B', 'loading description B');
  const next = render(<PageMetadata title="book B" description="book description B" />);
  shell.unmount();
  expectHead('book B', 'book description B');
  next.unmount();
  expectHead('fallback', 'fallback description');
});

it('deduplicates existing tags and creates missing tags', () => {
  document.head.innerHTML += '<title>duplicate</title><meta name="description" content="duplicate">';
  const view = render(<PageMetadata title="single" description="single description" />);
  expectHead('single', 'single description');
  view.unmount();
  document.head.innerHTML = '';
  render(<PageMetadata title="created" description="created description" />);
  expectHead('created', 'created description');
});

it('clears page metadata when navigating to a loading route and an unknown route', () => {
  render(<MemoryRouter initialEntries={['/about']}>
    <RouteMetadata />
    <Link to="/books/9">book</Link><Link to="/missing">missing</Link><Link to="/">home</Link>
    <Routes>
      <Route path="/about" element={<About />} />
      <Route path="/books/:id" element={<p>loading</p>} />
      <Route path="/" element={<p>home</p>} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  </MemoryRouter>);
  expect(document.title).toBe('درباره‌ی ری‌بوک | ری‌بوک');
  fireEvent.click(screen.getByText('book'));
  expectHead('بارگذاری کتاب | ری‌بوک', 'مشخصات کتاب در ری‌بوک در حال بارگذاری است.');
  fireEvent.click(screen.getByText('missing'));
  expect(document.title).toBe('این صفحه پیدا نشد | ری‌بوک');
  fireEvent.click(screen.getByText('home', { selector: 'a' }));
  expect(document.title).toBe(HOME_TITLE);
  expect(document.head.querySelectorAll('title')).toHaveLength(1);
});

it('uses known book/category data and applied filters without private fields', () => {
  const description = bookDescription({ title: 'کتاب الف', author: 'نویسنده', category: { name: 'داستان' },
    seller: { email: 'private@example.com' }, status: 'sold' });
  expect(description).toContain('کتاب الف');
  expect(description).toContain('نویسنده');
  expect(description).toContain('داستان');
  expect(description).toContain('فروخته شده');
  expect(description).not.toContain('private');
  expect(bookDescription({ title: 'کتاب ب' })).not.toMatch(/undefined|null/);
  expect(catalogDescription({ name: 'تاریخ' }, [{ label: '«ایران»' }])).toContain('تاریخ');
  expect(catalogDescription(null, [{ label: '«ایران»' }])).toContain('«ایران»');
});
