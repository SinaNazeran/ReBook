const PREFIX = 'rebook:mutation:';
const MAX_AGE = 24 * 60 * 60 * 1000;
const fallback = new Map();
let actor = { id: undefined, pending: new Map() };

// undefined: احراز هویت در حال تغییر است؛ null: مهمان؛ شناسه: حساب تأییدشده.
export function setMutationActor(userId) {
  const id = userId == null ? userId : `user:${userId}`;
  if (actor.id !== id) actor = { id, pending: new Map() };
}

function ensureActor(owner) {
  if (owner !== actor || owner.id === undefined) {
    const error = new Error('حساب کاربری تغییر کرده است؛ دوباره تلاش کن.');
    error.code = 'ERR_CANCELED';
    throw error;
  }
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  }
  return value;
}

async function storageKey(intent) {
  const bytes = new TextEncoder().encode(intent);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return PREFIX + Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
}

function read(key) {
  if (fallback.has(key)) return fallback.get(key);
  try {
    return JSON.parse(sessionStorage.getItem(key));
  } catch {
    return fallback.get(key);
  }
}

function write(key, record) {
  try {
    sessionStorage.setItem(key, JSON.stringify(record));
    fallback.delete(key);
  } catch {
    fallback.set(key, record);
    // مرورگر ممکن است ذخیره‌سازی session را مسدود کرده باشد.
  }
}

function clear(key) {
  fallback.delete(key);
  try {
    sessionStorage.removeItem(key);
  } catch {
    // تا پایان همین صفحه، حافظه جایگزین ذخیره‌سازی است.
  }
}

// فقط اثر انگشت و کلید تصادفی ذخیره می‌شود؛ آدرس ارسال در storage قرار نمی‌گیرد.
export function durableMutation(scope, payload, send) {
  const owner = actor;
  const pending = owner.pending;
  const intent = JSON.stringify(canonical([owner.id, scope, payload]));
  if (pending.has(intent)) return pending.get(intent);

  const request = (async () => {
    ensureActor(owner);
    const key = await storageKey(intent);
    ensureActor(owner);
    let record = read(key);
    if (!record?.key || !(record.expiresAt > Date.now())) {
      record = { key: crypto.randomUUID(), expiresAt: Date.now() + MAX_AGE };
    }
    write(key, record);
    try {
      const response = await send(record.key);
      clear(key);
      ensureActor(owner);
      return response;
    } catch (error) {
      const status = error.response?.status;
      if (status && status < 500 && status !== 409 && status !== 429) clear(key);
      ensureActor(owner);
      throw error;
    }
  })().finally(() => pending.delete(intent));
  pending.set(intent, request);
  return request;
}
