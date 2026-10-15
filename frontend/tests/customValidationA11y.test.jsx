import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import CreateBook from '../src/pages/CreateBook';
import Profile from '../src/pages/Profile';

const api = vi.hoisted(() => ({ getCategories: vi.fn(), createBook: vi.fn(), updateUser: vi.fn() }));
vi.mock('../src/services/api', () => ({ bookAPI: api, getErrorMessage: () => 'ارسال ناموفق بود.' }));
vi.mock('../src/context/useAuth', () => ({ useAuth: () => ({ user: { id: 1, username: 'reader' }, updateUser: api.updateUser }) }));
vi.mock('../src/utils/toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
beforeEach(() => {
  Object.values(api).forEach(mock => mock.mockReset());
  api.getCategories.mockResolvedValue({ data: [], headers: { 'cache-control': 'no-store' } });
  vi.stubGlobal('scrollTo', vi.fn());
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it('marks condition radios invalid after a server error, retains the group description, and clears on selection', async () => {
  api.createBook.mockRejectedValue({ response: { data: { condition: ['درجه انتخاب‌شده پذیرفته نشد.'] } } });
  await act(async () => { render(<MemoryRouter><CreateBook /></MemoryRouter>); });
  for (const [name, value] of [['title', 'کتاب'], ['author', 'نویسنده'], ['price', '1000']]) {
    fireEvent.change(document.querySelector(`[name=${name}]`), { target: { value } });
  }
  await act(async () => { fireEvent.submit(document.querySelector('form')); });
  const radios = screen.getAllByRole('radio');
  const group = radios[0].closest('fieldset');
  expect(group.getAttribute('aria-describedby')).toBe('condition-error');
  expect(document.getElementById('condition-error').textContent).toBe('درجه انتخاب‌شده پذیرفته نشد.');
  expect(document.activeElement.id).toBe('condition-good');
  radios.forEach(radio => expect(radio.getAttribute('aria-invalid')).toBe('true'));
  fireEvent.click(document.querySelector('#condition-new'));
  radios.forEach(radio => expect(radio.getAttribute('aria-invalid')).toBeNull());
  expect(group.getAttribute('aria-describedby')).toBeNull();
  expect(document.getElementById('condition-error')).toBeNull();
});

it.each([
  ['cover', CreateBook, 'cover_image', 'cover-error'],
  ['avatar', Profile, 'avatar-input', 'avatar-error'],
])('%s exposes an invalid upload and its error, then removes stale semantics for a valid replacement', async (_, Page, inputId, errorId) => {
  await act(async () => { render(<MemoryRouter><Page /></MemoryRouter>); });
  const input = document.getElementById(inputId);
  expect(input.getAttribute('aria-invalid')).toBeNull();
  expect(input.getAttribute('aria-describedby')).toBeNull();
  fireEvent.change(input, { target: { files: [new File(['bad'], 'invalid.txt', { type: 'text/plain' })] } });
  expect(input.getAttribute('aria-invalid')).toBe('true');
  expect(input.getAttribute('aria-describedby')).toBe(errorId);
  expect(document.getElementById(errorId).textContent).toBe('فقط تصویر JPG، PNG یا WebP.');
  if (inputId === 'avatar-input') expect(document.getElementById(errorId).getAttribute('role')).toBe('alert');
  // خواندن پیش‌نمایش محلی است؛ هیچ تصویری به API فرستاده نمی‌شود.
  await act(async () => { fireEvent.change(input, { target: { files: [new File(['image'], 'valid.png', { type: 'image/png' })] } }); });
  expect(input.getAttribute('aria-invalid')).toBeNull();
  expect(input.getAttribute('aria-describedby')).toBeNull();
  expect(document.getElementById(errorId)).toBeNull();
});
