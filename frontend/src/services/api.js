import axios from "axios";
import { durableMutation } from "./mutations";
import { API_BASE, csrfToken } from './apiBase.js';
import { reportError } from './errorReporting.js';

const BASE_URL = API_BASE;

// پنل مدیریت جنگو روی دامنه بک‌اند است، نه روی سرور Vite
export const ADMIN_URL = new URL("/admin/", BASE_URL).href;

// ساخت یک instance از axios با تنظیمات پایه
const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true, // برای ارسال کوکی‌های session و CSRF
  timeout: 15000, // اگر سرور تا ۱۵ ثانیه پاسخ ندهد، درخواست با خطا لغو می‌شود
});

// ============================================
// مدیریت CSRF Token
// ============================================

// افزودن CSRF token به تمام درخواست‌ها
api.interceptors.request.use((config) => {
  const token = csrfToken();
  if (token) {
    config.headers["X-CSRFToken"] = token;
  }
  return config;
});

// ============================================
// مدیریت مرکزی خطای احراز هویت (401)
// ============================================

/**
 * وقتی سرور خطای 401 برگرداند (session منقضی یا نامعتبر شده)،
 * به‌جای تکرار مدیریت این حالت در تک‌تک صفحات، یک رویداد سراسری
 * منتشر می‌کنیم. AuthContext به این رویداد گوش می‌دهد و state کاربر
 * را پاک می‌کند؛ ProtectedRoute به‌صورت خودکار و واکنشی کاربر را
 * به صفحه‌ی ورود هدایت می‌کند.
 */
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status >= 500) {
      void reportError('api_server_error', {
        status: error.response.status, request_id: error.response.headers?.['x-request-id'],
      });
    }
    if (error.response?.status === 401) {
      window.dispatchEvent(new CustomEvent("auth:unauthorized"));
    }
    return Promise.reject(error);
  },
);

// ============================================
// استخراج پیام خطای قابل‌نمایش به کاربر
// ============================================

/**
 * پاسخ‌های خطای Django REST Framework را به یک پیام متنی یکنواخت
 * تبدیل می‌کند تا در سراسر پروژه (toast.error, alert و...) یکسان باشد.
 *
 * پشتیبانی از قالب‌های رایج DRF:
 *   { "detail": "..." }
 *   { "field_name": ["پیام خطا"] }
 *   { "non_field_errors": ["پیام خطا"] }
 */
export function getErrorMessage(error) {
  if (!error.response) {
    return "ارتباط با سرور برقرار نشد. اتصال اینترنتت را بررسی کن و دوباره امتحان کن.";
  }

  const data = error.response.data;

  if (!data) {
    return "مشکلی پیش آمد. دوباره امتحان کن؛ اگر تکرار شد، به پشتیبانی خبر بده.";
  }

  if (typeof data === "string") {
    return data;
  }

  if (data.detail) {
    return data.detail;
  }

  if (data.non_field_errors?.length) {
    return data.non_field_errors[0];
  }

  // اولین خطای مربوط به هر فیلد را برمی‌گرداند (مثلاً خطای فیلد phone)
  const firstFieldError = Object.values(data).find(
    (value) => Array.isArray(value) && value.length > 0,
  );
  if (firstFieldError) {
    return firstFieldError[0];
  }

  return "مشکلی پیش آمد. دوباره امتحان کن؛ اگر تکرار شد، به پشتیبانی خبر بده.";
}

// ============================================
// توابع مربوط به حساب کاربری
// ============================================

export const authAPI = {
  getCsrfToken: () => api.get("/accounts/csrf/"),
  register: (data) => api.post("/accounts/register/", data),
  login: (data) => api.post("/accounts/login/", data),
  logout: () => api.post("/accounts/logout/"),
  getProfile: () => api.get("/accounts/profile/"),
  updateProfile: (data) =>
    api.patch("/accounts/profile/", data, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
};

// ============================================
// توابع مربوط به کتاب‌ها
// ============================================

export const bookAPI = {
  getBooks: (params) => api.get("/books/", { params }),
  getBook: (id, config) => api.get(`/books/${id}/`, config),
  createBook: (data) =>
    api.post("/books/create/", data, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  // ویرایش هم عکس جلد می‌فرستد؛ هر ویرایش آگهی را به صف بررسی برمی‌گرداند. سفارش باز → 400 با detail
  updateBook: (id, data) =>
    api.patch(`/books/${id}/update/`, data, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  deleteBook: (id) => api.delete(`/books/${id}/delete/`),
  getMyBooks: (params) => api.get("/books/my-books/", { params }),
  getCategories: (params) => api.get("/books/categories/", { params }),
  getWishlist: (params) => api.get("/books/wishlist/", { params }),
  toggleWishlist: (bookId) => api.post(`/books/${bookId}/wishlist-toggle/`),
};

// ============================================
// توابع مربوط به سفارش‌ها
// ============================================

export const orderAPI = {
  getMyOrders: (params) => api.get("/orders/my-orders/", { params }), // تب «خریدهای من»
  getMySales: (params) => api.get("/orders/my-sales/", { params }), // تب «فروش‌های من»
  createOrder: (data) => mutationPost("/orders/create/", data),
  payOrder: (orderId) => mutationPost(`/orders/${orderId}/pay/`),
  cancelOrder: (orderId) => mutationPost(`/orders/${orderId}/cancel/`), // خریدار یا فروشنده، فقط سفارش در انتظار پرداخت
};

// ============================================
// سبد خرید؛ برای مهمان هم (سبد در session سرور) و پس از ورود به حساب منتقل می‌شود
// ============================================

export const cartAPI = {
  getCart: () => api.get("/orders/cart/"), // { items: [{ book, available, reason }], count, total }
  addToCart: (bookId) => api.post("/orders/cart/", { book: bookId }),
  removeFromCart: (bookId) => api.delete(`/orders/cart/${bookId}/`),
  // books = [{ id, price }] همان چیزی است که خریدار دید؛ اگر سرور چیز دیگری ببیند 400 می‌دهد
  checkout: (data) => mutationPost("/orders/checkout/", data), // → { reference_code, orders }
};

function mutationPost(path, data) {
  return durableMutation(path, data, key => api.post(path, data, {
    headers: { "Idempotency-Key": key },
  }));
}

// ============================================
// توابع مربوط به اعلان‌ها
// ============================================

export const notificationAPI = {
  getNotifications: (params) => api.get("/notifications/", { params }),
  getUnreadCount: (config = {}) => api.get("/notifications/unread-count/", config), // { count } برای نشان نوار بالا
  markAsRead: (id) => api.post(`/notifications/${id}/read/`),
  markAllAsRead: () => api.post("/notifications/read-all/"),
  createTicket: (data) => api.post("/notifications/support/create/", data),
  getMyTickets: (params) => api.get("/notifications/support/", { params }),
  sendContactMessage: (data) => api.post("/notifications/contact/", data), // فرم تماس مهمان
};
