import { toLatinDigits } from "../../utils/digits";
export const INITIAL_FORM = {
  title: '',
  author: '',
  publisher: '',
  isbn: '',
  description: '',
  price: '',
  condition: 'good',
  category: ''
};
export const MAX_IMAGE_SIZE_MB = 5;
export const ACCEPTED_IMAGES = 'image/jpeg,image/png,image/webp';
export const FIELD_ORDER = ['title', 'author', 'publisher', 'isbn', 'category', 'condition', 'price', 'cover_image', 'description'];
export function normalizeServerErrors(errorData) {
  const nextFieldErrors = {};
  let nextGeneralError = '';
  if (!errorData) {
    return {
      nextFieldErrors,
      nextGeneralError: 'مشکلی پیش آمد. دوباره امتحان کن.'
    };
  }
  if (typeof errorData === 'string') {
    return {
      nextFieldErrors,
      nextGeneralError: errorData
    };
  }
  if (Array.isArray(errorData)) {
    return {
      nextFieldErrors,
      nextGeneralError: errorData[0] || 'مشکلی پیش آمد. دوباره امتحان کن.'
    };
  }
  Object.entries(errorData).forEach(([key, value]) => {
    const message = Array.isArray(value) ? value[0] : String(value);
    if (key === 'detail' || key === 'non_field_errors') {
      if (!nextGeneralError) nextGeneralError = message;
    } else {
      nextFieldErrors[key] = Array.isArray(value) ? value : [message];
    }
  });
  if (!nextGeneralError && Object.keys(nextFieldErrors).length === 0) {
    nextGeneralError = 'مشکلی پیش آمد. دوباره امتحان کن.';
  }
  return {
    nextFieldErrors,
    nextGeneralError
  };
}
export const EDIT_LEADS = {
  approved: 'پس از ذخیره، آگهی تا تأیید دوباره‌ی تیم ری‌بوک از فهرست عمومی بیرون می‌رود.',
  rejected: 'این آگهی تأیید نشد. ویرایشش کن و دوباره برای بررسی بفرست.',
  pending: 'آگهی هنوز در صف بررسی است؛ تیم ری‌بوک نسخه‌ی ویرایش‌شده را بررسی می‌کند.'
};
export const normalizeIsbn = value => toLatinDigits(value).replace(/[\s-]/g, '').toUpperCase();
export function validate(form) {
  const errors = {};
  if (!form.title.trim()) errors.title = ['عنوان کتاب را بنویس.'];
  if (!form.author.trim()) errors.author = ['نام نویسنده را بنویس.'];
  if (!form.price) errors.price = ['قیمت را به تومان بنویس.'];else if (Number(form.price) <= 0) errors.price = ['قیمت باید بیشتر از صفر باشد.'];
  const isbn = normalizeIsbn(form.isbn);
  if (isbn && !/^(\d{9}[\dX]|\d{13})$/.test(isbn)) {
    errors.isbn = ['شابک ۱۰ یا ۱۳ رقم است؛ خط تیره‌ها مهم نیستند.'];
  }
  return errors;
}
