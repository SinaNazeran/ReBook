import { MemoryRouter } from 'react-router-dom';
import { act, cleanup, fireEvent, render, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useCoverUpload } from '../src/features/book-editor/useCoverUpload.js';
import Profile from '../src/pages/Profile.jsx';

vi.mock('../src/context/useAuth.js', () => ({
  useAuth: () => ({ user: { username: 'reader', avatar: '/original.webp' }, updateUser: vi.fn() }),
}));

let readers;
beforeEach(() => {
  readers = [];
  vi.stubGlobal('FileReader', class {
    static LOADING = 1;
    readyState = 0;
    result = null;
    error = null;
    abort = vi.fn(() => { this.readyState = 2; this.onabort?.(); this.onloadend?.(); });
    readAsDataURL(file) { this.file = file; this.readyState = 1; }
    constructor() { readers.push(this); }
    complete(value) {
      this.result = value;
      this.readyState = 2;
      this.onload?.();
      this.onloadend?.();
    }
  });
});
afterEach(cleanup);

const image = name => new File(['image'], name, { type: 'image/png' });
const event = file => ({ target: { files: [file], value: 'selected' } });
const useCover = () => useCoverUpload(vi.fn(), vi.fn());

it('keeps the most recently selected cover when reads finish out of order', () => {
  const { result } = renderHook(useCover);
  act(() => result.current.handleImageChange(event(image('A.png'))));
  const lateCallback = readers[0].onload || readers[0].onloadend;
  act(() => result.current.handleImageChange(event(image('B.png'))));
  act(() => readers[1].complete('data:B'));
  act(() => { readers[0].result = 'data:A'; lateCallback(); });
  expect(result.current.coverImage.name).toBe('B.png');
  expect(result.current.imagePreview).toBe('data:B');
  expect(readers[0].abort).toHaveBeenCalledOnce();
});

it('does not restore a removed cover from an already queued callback', () => {
  const { result } = renderHook(useCover);
  act(() => result.current.handleImageChange(event(image('A.png'))));
  const lateCallback = readers[0].onload || readers[0].onloadend;
  act(() => result.current.removeImage());
  act(() => { readers[0].result = 'data:A'; lateCallback(); });
  expect(result.current.coverImage).toBeNull();
  expect(result.current.imagePreview).toBeNull();
  expect(readers[0].abort).toHaveBeenCalledOnce();
});

it('aborts pending reads on unmount and supports StrictMode replay', () => {
  const { result, unmount } = renderHook(useCover, { reactStrictMode: true });
  act(() => result.current.handleImageChange(event(image('A.png'))));
  const lateCallback = readers[0].onload || readers[0].onloadend;
  unmount();
  expect(readers[0].abort).toHaveBeenCalledOnce();
  act(() => { readers[0].result = 'data:A'; lateCallback(); });
});

it('applies the same newest-selection guarantee to profile avatars', () => {
  const { getByLabelText, container } = render(<MemoryRouter><Profile /></MemoryRouter>);
  const input = getByLabelText('تغییر تصویر پروفایل');
  fireEvent.change(input, { target: { files: [image('A.png')] } });
  const lateCallback = readers[0].onload || readers[0].onloadend;
  fireEvent.change(input, { target: { files: [image('B.png')] } });
  act(() => readers[1].complete('data:B'));
  act(() => { readers[0].result = 'data:A'; lateCallback(); });
  expect(container.querySelector('.profile-avatar img').getAttribute('src')).toBe('data:B');
});
