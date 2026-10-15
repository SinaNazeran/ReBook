import { afterEach, beforeEach, expect, it, vi } from 'vitest';

let imports;
beforeEach(() => {
  imports = 0;
  vi.resetModules();
  vi.doMock('../src/pages/BookDetail', () => {
    imports++;
    return { default: () => null };
  });
});
afterEach(() => { document.body.innerHTML = ''; vi.doUnmock('../src/pages/BookDetail'); });

const linkEvent = href => {
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.innerHTML = '<span>کتاب</span>';
  document.body.append(anchor);
  return { target: anchor.firstChild, defaultPrevented: false, preventDefault: vi.fn() };
};

it('does not fetch details on import or unrelated and external link intent', async () => {
  const { prefetchBookDetail } = await import('../src/utils/bookDetailLoading.js');
  expect(imports).toBe(0);
  for (const href of ['/books', '/books?category=1', '/books/7/edit', '/login', 'https://elsewhere.example/books/7']) {
    await prefetchBookDetail(linkEvent(href));
  }
  expect(imports).toBe(0);
});

it('warms only code on book-link intent, deduplicates it with navigation, and leaves the event intact', async () => {
  const { prefetchBookDetail, loadBookDetail } = await import('../src/utils/bookDetailLoading.js');
  const event = linkEvent('/books/7?from=home');
  const warming = prefetchBookDetail(event);
  const first = loadBookDetail();
  expect(loadBookDetail()).toBe(first);
  await Promise.all([warming, first, prefetchBookDetail(event)]);
  expect(imports).toBe(1);
  expect(event.preventDefault).not.toHaveBeenCalled();
  expect(event.target.closest('a').pathname).toBe('/books/7');
});

it('contains a speculative load failure while leaving navigation errors observable', async () => {
  vi.doMock('../src/pages/BookDetail', () => { throw new Error('offline chunk'); });
  const { prefetchBookDetail, loadBookDetail } = await import('../src/utils/bookDetailLoading.js');
  await expect(prefetchBookDetail(linkEvent('/books/7'))).resolves.toBeUndefined();
  await expect(loadBookDetail()).rejects.toThrow();
});
