import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api";

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

function getCookie(name) {
  let cookieValue = null;
  if (document.cookie && document.cookie !== "") {
    const cookies = document.cookie.split(";");
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim();
      if (cookie.substring(0, name.length + 1) === name + "=") {
        cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
        break;
      }
    }
  }
  return cookieValue;
}

// افزودن CSRF token به تمام درخواست‌ها
api.interceptors.request.use((config) => {
  const csrfToken = getCookie("csrftoken");
  if (csrfToken) {
    config.headers["X-CSRFToken"] = csrfToken;
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
    return "ارتباط با سرور برقرار نشد. اتصال اینترنت خود را بررسی کنید.";
  }

  const data = error.response.data;

  if (!data) {
    return "خطای غیرمنتظره‌ای رخ داد.";
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

  return "خطای غیرمنتظره‌ای رخ داد.";
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
  getBook: (id) => api.get(`/books/${id}/`),
  createBook: (data) =>
    api.post("/books/create/", data, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  updateBook: (id, data) => api.patch(`/books/${id}/update/`, data),
  deleteBook: (id) => api.delete(`/books/${id}/delete/`),
  getMyBooks: () => api.get("/books/my-books/"),
  getCategories: () => api.get("/books/categories/"),
  getWishlist: () => api.get("/books/wishlist/"),
  toggleWishlist: (bookId) => api.post(`/books/${bookId}/wishlist-toggle/`),
};

// ============================================
// توابع مربوط به سفارش‌ها
// ============================================

export const orderAPI = {
  createOrder: (data) => api.post("/orders/create/", data),
  getMyOrders: () => api.get("/orders/my-orders/"), // تب «خریدهای من»
  getMySales: () => api.get("/orders/my-sales/"), // تب «فروش‌های من»
  getOrder: (id) => api.get(`/orders/${id}/`),
  payOrder: (orderId) => api.post(`/orders/${orderId}/pay/`),
  cancelOrder: (orderId) => api.post(`/orders/${orderId}/cancel/`), // خریدار یا فروشنده، فقط سفارش در انتظار پرداخت
};

// ============================================
// توابع مربوط به اعلان‌ها
// ============================================

export const notificationAPI = {
  getNotifications: () => api.get("/notifications/"),
  markAsRead: (id) => api.post(`/notifications/${id}/read/`),
  markAllAsRead: () => api.post("/notifications/read-all/"),
  createTicket: (data) => api.post("/notifications/support/create/", data),
  getMyTickets: () => api.get("/notifications/support/"),
};

export default api;
