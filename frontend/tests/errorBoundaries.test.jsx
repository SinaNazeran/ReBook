import { useEffect } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Link, MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import ErrorBoundary from '../src/components/ErrorBoundary';
import RouteErrorBoundary from '../src/components/RouteErrorBoundary';
import { reportError } from '../src/services/errorReporting.js';

vi.mock('../src/services/errorReporting.js', () => ({ reportError: vi.fn().mockResolvedValue(false) }));

function Crash({ effect = false }) {
  useEffect(() => { if (effect) throw new Error('private effect detail'); }, [effect]);
  if (!effect) throw new Error('private render detail');
  return <p>before effect</p>;
}

beforeEach(() => { vi.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it.each([false, true])('provides a standalone global fallback for render/effect failure %s', effect => {
  render(<ErrorBoundary global><Crash effect={effect} /></ErrorBoundary>);
  expect(screen.getByRole('main')).toBeTruthy();
  expect(screen.getByRole('alert')).toBeTruthy();
  expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('ری‌بوک با مشکلی روبه‌رو شد');
  expect(screen.getByRole('link', { name: 'صفحه اصلی' }).getAttribute('href')).toBe('/');
  expect(screen.getByRole('button', { name: 'بارگذاری دوباره' })).toBeTruthy();
  expect(document.body.textContent).not.toContain('private');
  expect(reportError).toHaveBeenCalledWith('render_error');
});

it('keeps the shell usable and recovers on navigation, including a different query on the same route', () => {
  render(<MemoryRouter initialEntries={['/broken?mode=bad']}>
    <header>shell<Link to="/healthy">healthy link</Link><Link to="/broken?mode=good">query link</Link></header>
    <RouteErrorBoundary><Routes>
      <Route path="/broken" element={<QueryPage />} />
      <Route path="/healthy" element={<p>healthy page</p>} />
    </Routes></RouteErrorBoundary>
    <footer>footer</footer>
  </MemoryRouter>);
  expect(screen.getByRole('alert')).toBeTruthy();
  expect(screen.getByText('footer')).toBeTruthy();
  fireEvent.click(screen.getByText('query link'));
  expect(screen.getByText('query recovered')).toBeTruthy();
  fireEvent.click(screen.getByText('healthy link'));
  expect(screen.getByText('healthy page')).toBeTruthy();
  expect(screen.queryByRole('alert')).toBeNull();
});

function QueryPage() {
  const location = useLocation();
  if (location.search.includes('bad')) throw new Error('private route detail');
  return <p>query recovered</p>;
}

it('does not remount a healthy page when the URL changes', () => {
  let mounts = 0;
  function Page() {
    useEffect(() => { mounts++; }, []);
    return <Link to="/?filter=new">filter</Link>;
  }
  render(<MemoryRouter><RouteErrorBoundary><Page /></RouteErrorBoundary></MemoryRouter>);
  fireEvent.click(screen.getByText('filter'));
  expect(mounts).toBe(1);
});

