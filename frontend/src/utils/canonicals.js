const PUBLIC_PATHS = new Set(['/', '/books', '/about', '/contact', '/login', '/register']);
const CATALOG_PARAMS = new Set(['category', 'search', 'condition', 'min_price', 'max_price', 'ordering', 'page', 'page_size']);

export function siteOrigin(value, { required = false } = {}) {
  if (!value?.trim() && !required) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error();
    return url.origin;
  } catch {
    throw new Error('VITE_SITE_URL must be an explicit HTTPS origin without credentials, a path, query, or fragment.');
  }
}

function configuredOrigin() {
  return siteOrigin(import.meta.env?.VITE_SITE_URL);
}

export function routeCanonical(pathname, search = '') {
  const origin = configuredOrigin();
  const path = pathname.replace(/\/+$/, '').toLowerCase() || '/';
  if (!origin || !PUBLIC_PATHS.has(path)) return null;
  const url = new URL(path, origin);
  if (path === '/books') {
    for (const [key, value] of new URLSearchParams(search)) {
      if (CATALOG_PARAMS.has(key)) url.searchParams.append(key, value);
    }
    // مرتب‌سازی پایدار است؛ ترتیب مقدارهای تکراری که در رفتار فیلتر مؤثرند حفظ می‌شود.
    url.searchParams.sort();
  }
  return url.href;
}

export function bookCanonical(book) {
  const origin = configuredOrigin();
  const id = Number(book?.id);
  if (!origin || !['approved', 'sold'].includes(book?.status) || !Number.isSafeInteger(id) || id < 1) return null;
  return new URL(`/books/${id}`, origin).href;
}
