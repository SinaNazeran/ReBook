import { cleanup, render, screen } from '@testing-library/react';
import { useLocation } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import AppRoot from '../src/AppRoot';
vi.mock('../src/services/errorReporting.js', () => ({ reportError: vi.fn().mockResolvedValue(false) }));

const state = vi.hoisted(() => ({ crash: false }));
vi.mock('../src/App', () => ({ default: function App() {
  const location = useLocation();
  if (state.crash) throw new Error('private shell failure');
  return <p>app path: {location.pathname}</p>;
} }));

beforeEach(() => { vi.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); state.crash = false; });

it('mounts the app with its router inside the global boundary', () => {
  render(<AppRoot />);
  expect(screen.getByText('app path: /')).toBeTruthy();
  expect(screen.queryByRole('alert')).toBeNull();
});

it('contains an app shell failure outside the route boundary', () => {
  state.crash = true;
  render(<AppRoot />);
  expect(screen.getByRole('main')).toBeTruthy();
  expect(screen.getByRole('heading').textContent).toBe('ری‌بوک با مشکلی روبه‌رو شد');
  expect(document.activeElement).toBe(screen.getByRole('heading'));
  expect(document.body.textContent).not.toContain('private shell failure');
});
