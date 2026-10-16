import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Breadcrumbs from '../src/components/Breadcrumbs.jsx';
import BookBreadcrumbs from '../src/components/BookBreadcrumbs.jsx';
import { categoryCrumbs } from '../src/utils/breadcrumbs.js';

const state = vi.hoisted(() => ({ categories: [] }));
vi.mock('../src/utils/categories', () => ({ useCategories: () => ({ categories: state.categories }) }));
afterEach(() => { cleanup(); state.categories = []; });

const root = { id: 1, name: 'ادبیات', slug: 'ادبیات', parent: null };
const child = { id: 2, name: 'داستان', slug: 'داستان', parent: 1 };

it('renders a named navigation list, real ancestor anchors, and one non-link current page', () => {
  const items = [{ label: 'خانه', to: '/' }, { label: 'کتاب‌ها', to: '/books' }, { label: 'عنوان English کتاب' }];
  render(<MemoryRouter><Breadcrumbs items={items} /></MemoryRouter>);
  const nav = screen.getByRole('navigation', { name: 'مسیر راهنما' });
  expect(within(nav).getAllByRole('listitem')).toHaveLength(3);
  expect(within(nav).getAllByRole('link').map(a => a.getAttribute('href'))).toEqual(['/', '/books']);
  const current = nav.querySelector('[aria-current="page"]');
  expect(current.textContent).toBe('عنوان English کتاب');
  expect(current.tagName).toBe('SPAN');
  expect(current.querySelector('bdi')).toBeTruthy();
  expect(nav.querySelectorAll('[aria-current]')).toHaveLength(1);
  expect(nav.querySelectorAll('h1,h2,h3,h4,h5,h6')).toHaveLength(0);
  expect([...nav.querySelectorAll('svg')].every(svg => svg.getAttribute('aria-hidden') === 'true')).toBe(true);
});

it('lets an ancestor link navigate through the router without requiring a click handler', () => {
  render(<MemoryRouter initialEntries={['/books/5']}><Routes>
    <Route path="/books/5" element={<Breadcrumbs items={[{ label: 'کتاب‌ها', to: '/books' }, { label: 'کتاب' }]} />} />
    <Route path="/books" element={<h1>فهرست مقصد</h1>} />
  </Routes></MemoryRouter>);
  fireEvent.click(screen.getByRole('link', { name: 'کتاب‌ها' }));
  expect(screen.getByRole('heading', { name: 'فهرست مقصد' })).toBeTruthy();
});

it('builds the actual category ancestry with safely encoded category-only targets', () => {
  const special = { ...child, slug: 'داستان & شعر' };
  const crumbs = categoryCrumbs(special, [root, special]);
  expect(crumbs.map(crumb => crumb.label)).toEqual(['ادبیات', 'داستان']);
  expect(crumbs.map(crumb => new URL(crumb.to, 'https://rebook.example').searchParams.get('category')))
    .toEqual(['ادبیات', 'داستان & شعر']);
  expect(crumbs.every(crumb => crumb.to.startsWith('/books?category='))).toBe(true);
});

it('falls back to the known leaf for missing parents or cyclic category data', () => {
  expect(categoryCrumbs(child, []).map(c => c.label)).toEqual(['داستان']);
  expect(categoryCrumbs(child, [{ ...root, parent: 2 }, child]).map(c => c.label)).toEqual(['داستان']);
  expect(categoryCrumbs(null, [root])).toEqual([]);
});

it('updates book trails after category recovery and book navigation without retaining old labels', () => {
  const book = { title: 'کتاب اول', category: child };
  const tree = value => <MemoryRouter><BookBreadcrumbs book={value} /></MemoryRouter>;
  const view = render(tree(book));
  expect(screen.queryByRole('link', { name: 'ادبیات' })).toBeNull();
  expect(screen.getByRole('link', { name: 'داستان' })).toBeTruthy();
  state.categories = [root, child];
  view.rerender(tree(book));
  expect(screen.getByRole('link', { name: 'ادبیات' })).toBeTruthy();
  view.rerender(tree({ title: '<script>کتاب دوم</script>', category: null }));
  expect(screen.queryByRole('link', { name: 'داستان' })).toBeNull();
  expect(view.container.querySelector('[aria-current="page"]').textContent).toBe('<script>کتاب دوم</script>');
  expect(view.container.querySelector('script')).toBeNull();
});
