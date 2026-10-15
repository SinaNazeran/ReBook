import { execFileSync } from 'node:child_process';
import process from 'node:process';
import { MemoryRouter } from 'react-router-dom';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { NavbarAccountMenu } from '../src/components/navigation/NavbarAccountMenu';
import { NavbarSearch } from '../src/components/navigation/NavbarSearch';

afterEach(cleanup);

it.each([
  ['2024-03-19T20:29:59Z', '۱۴۰۲/۱۲/۲۹'],
  ['2024-03-19T20:30:00Z', '۱۴۰۳/۱/۱'],
])('formats %s at the Tehran Persian New Year boundary', async (date, expected) => {
  const { formatPersianDate } = await import('../src/utils/locale');
  expect(formatPersianDate(date)).toBe(expected);
});

it('preserves long, month, and year date presentations', async () => {
  const { formatPersianDate } = await import('../src/utils/locale');
  const date = '2024-03-19T20:30:00Z';
  expect(formatPersianDate(date, 'long')).toBe('۱ فروردین ۱۴۰۳');
  expect(formatPersianDate(date, 'month')).toBe('۱۴۰۳ فروردین');
  expect(formatPersianDate(new Date(date), 'year')).toBe('۱۴۰۳');
});

it.each([null, undefined, '', 'invalid-date'])('handles absent or invalid date %s', async value => {
  const { formatPersianDate } = await import('../src/utils/locale');
  expect(formatPersianDate(value)).toBe('—');
});

it('renders the same Tehran date in different client timezones', async () => {
  await import('../src/utils/locale');
  const script = "import { formatPersianDate } from './src/utils/locale.js'; process.stdout.write(formatPersianDate('2024-03-19T20:30:00Z'));";
  for (const TZ of ['UTC', 'America/Los_Angeles', 'Pacific/Auckland']) {
    expect(execFileSync(process.execPath, ['--input-type=module', '-e', script], {
      cwd: process.cwd(), env: { ...process.env, TZ }, encoding: 'utf8',
    })).toBe('۱۴۰۳/۱/۱');
  }
});

it('formats numbers as Persian text independently of the font', async () => {
  const { formatPersianNumber } = await import('../src/utils/locale');
  expect(formatPersianNumber(12345)).toBe('۱۲٬۳۴۵');
  expect(formatPersianNumber(0)).toBe('۰');
});

const user = {
  username: 'reader123', first_name: 'Alice (علی)', last_name: 'Reader 2',
  email: 'reader123+books@example.com',
};
function openAccount(count = 7, account = user) {
  const view = render(<MemoryRouter><NavbarAccountMenu
    user={account} isAuthenticated displayedUnreadCount={count} isAdmin={false}
    handleLogout={vi.fn()} location={{ pathname: '/books' }}
  /></MemoryRouter>);
  fireEvent.click(view.container.querySelector('.dropdown-toggle'));
  return view;
}

it('isolates mixed-script account names and keeps email left-to-right', () => {
  const view = openAccount();
  expect(view.getByText(user.first_name).tagName).toBe('BDI');
  expect(view.getByText(user.first_name + ' ' + user.last_name).tagName).toBe('BDI');
  expect(view.getByText(user.email).closest('[dir="ltr"]')).not.toBeNull();
});

it('preserves the Latin username identity when no name is provided', () => {
  const view = openAccount(0, { ...user, first_name: '', last_name: '' });
  for (const name of view.getAllByText(user.username)) {
    expect(name.closest('bdi.latin-id')).not.toBeNull();
  }
});

it.each([[0, null], [7, '۷'], [99, '۹۹'], [100, '۹۹+']])(
  'localizes notification badge count %s', (count, expected) => {
    const view = openAccount(count);
    expect(view.container.querySelector('.badge')?.textContent ?? null).toBe(expected);
  },
);

it('uses automatic direction for search without changing the entered text', () => {
  const setSearchQuery = vi.fn();
  const view = render(<NavbarSearch
    searchQuery="Clean Code (نسخه ۲)" setSearchQuery={setSearchQuery}
    handleSearchSubmit={vi.fn()}
  />);
  const input = view.getByRole('searchbox');
  expect(input.getAttribute('dir')).toBe('auto');
  fireEvent.change(input, { target: { value: 'کتاب React 19' } });
  expect(setSearchQuery).toHaveBeenCalledWith('کتاب React 19');
});

