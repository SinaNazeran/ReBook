import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import HomeHero from '../src/components/HomeHero';
import { MemoryRouter } from 'react-router-dom';

const runtime = vi.hoisted(() => ({ attempts: 0 }));
vi.mock('../src/components/home-hero/heroMotion.js', () => {
  runtime.attempts++;
  throw new Error('offline optional motion');
});
afterEach(cleanup);

it('keeps the real hero and links usable when the optional motion chunk fails', async () => {
  const preference = new EventTarget();
  preference.matches = true;
  vi.stubGlobal('matchMedia', () => preference);
  render(<MemoryRouter><HomeHero status="ready" books={[]} /></MemoryRouter>);
  await vi.waitFor(() => expect(runtime.attempts).toBe(1));
  await act(async () => {});
  const heading = screen.getByRole('heading', { level: 1 });
  expect(getComputedStyle(heading).visibility).toBe('visible');
  const link = screen.getByRole('link', { name: 'مرور کتاب‌ها' });
  expect(link.getAttribute('href')).toBe('/books');
  link.focus();
  expect(document.activeElement).toBe(link);
});
