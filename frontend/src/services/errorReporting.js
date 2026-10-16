import { API_BASE, csrfToken, validCSRFToken } from './apiBase.js';

const kinds = new Set(['render_error', 'unhandled_error', 'unhandled_rejection', 'api_server_error']);
const pages = new Set(['login', 'register', 'cart', 'about', 'contact', 'profile', 'create-book',
  'my-books', 'my-orders', 'wishlist', 'notifications', 'support']);
const sent = new Map();
let started = 0;
let count = 0;
let lifetime = 0;
let pendingToken;
let cleanup;

export function pageBucket(path = window.location.pathname) {
  const normalized = path.toLowerCase().replace(/\/+$/, '') || '/';
  if (normalized === '/') return 'home';
  if (normalized === '/books') return 'catalog';
  if (/^\/books\/[^/]+\/edit$/.test(normalized)) return 'book-edit';
  if (/^\/books\/[^/]+$/.test(normalized)) return 'book-detail';
  return pages.has(normalized.slice(1)) ? normalized.slice(1) : 'unknown';
}

async function send(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    return await fetch(url, { ...options, credentials: 'include', cache: 'no-store', redirect: 'error', referrerPolicy: 'no-referrer', signal: controller.signal });
  } finally { clearTimeout(timer); }
}

async function tokenForReport() {
  if (csrfToken()) return csrfToken();
  if (!pendingToken) pendingToken = send(`${API_BASE}/accounts/csrf/`)
    .then(async response => response.ok ? (await response.json()).csrfToken : '')
    .finally(() => { pendingToken = undefined; });
  const token = await pendingToken;
  return validCSRFToken(token) ? token : '';
}

export async function reportError(kind, details = {}) {
  try {
    if (!kinds.has(kind)) return false;
    const body = { kind, page: pageBucket() };
    if (kind === 'api_server_error') {
      if (!Number.isInteger(details.status) || details.status < 500 || details.status > 599) return false;
      body.status = details.status;
      if (typeof details.request_id === 'string' && /^(?:[a-f0-9]{32}|[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})$/i.test(details.request_id)) body.request_id = details.request_id;
    }
    const now = Date.now();
    if (now - started >= 60000) { started = now; count = 0; sent.clear(); }
    const key = JSON.stringify(body);
    if (count >= 5 || lifetime >= 20 || sent.has(key)) return false;
    sent.set(key, now); count++; lifetime++;
    const token = await tokenForReport();
    if (!token) return false;
    const response = await send(`${API_BASE}/client-errors/`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRFToken': token }, body: key,
    });
    return response.ok;
  } catch { return false; }
}

export function installErrorReporting() {
  if (cleanup) return cleanup;
  const onError = event => { if (event instanceof ErrorEvent) void reportError('unhandled_error'); };
  const onRejection = () => { void reportError('unhandled_rejection'); };
  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onRejection);
  let active = true;
  cleanup = () => {
    if (!active) return;
    active = false;
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onRejection);
    cleanup = undefined;
  };
  return cleanup;
}
