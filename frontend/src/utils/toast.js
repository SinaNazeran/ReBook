import { toast as base } from 'react-toastify';

/**
 * همه‌ی toastهای سایت از این‌جا می‌گذرند (به‌جای import مستقیم از react-toastify).
 * - زمان نمایش از طول پیام: حدود ۶۰ms برای هر نویسه (خواندن آرام فارسی) + ۲ ثانیه برای دیدن؛ خطا دست‌کم ۶ ثانیه.
 *   با hover، فوکوس یا رفتن به تب دیگر شمارش می‌ایستد (پیش‌فرض react-toastify).
 * - خطا و هشدار role="alert" (فوری خوانده می‌شود)، موفقیت و اطلاع role="status" (بی‌وقفه).
 * - پیام تکراری روی هم انباشته نمی‌شود: پیام یکسان همان toast قبلی است.
 */
const readTime = (message, min) =>
  typeof message === 'string' ? Math.min(10000, Math.max(min, 2000 + message.length * 60)) : min;

const make =
  (type, role, min) =>
  (message, options = {}) =>
    base[type](message, {
      autoClose: readTime(message, min),
      role,
      toastId: typeof message === 'string' ? `${type}:${message}` : undefined,
      ...options,
    });

export const toast = {
  success: make('success', 'status', 4000),
  info: make('info', 'status', 4000),
  warning: make('warning', 'alert', 6000),
  error: make('error', 'alert', 6000),
};
