export const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8000/api').replace(/\/+$/, '');

export function validCSRFToken(token) {
  return typeof token === 'string' && /^(?:[a-zA-Z0-9]{32}|[a-zA-Z0-9]{64})$/.test(token);
}

export function csrfToken() {
  const cookie = document.cookie.split(';').map(value => value.trim()).find(value => value.startsWith('csrftoken='));
  const token = cookie?.slice('csrftoken='.length) ?? '';
  return validCSRFToken(token) ? token : '';
}
