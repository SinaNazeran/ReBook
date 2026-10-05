// صفحه‌کلید فارسی رقم فارسی (و گاهی عربی) می‌فرستد؛ API فقط رقم لاتین را می‌شناسد
const PERSIAN = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC = '٠١٢٣٤٥٦٧٨٩';

export const toLatinDigits = (value) =>
  String(value)
    .replace(/[۰-۹]/g, (d) => PERSIAN.indexOf(d))
    .replace(/[٠-٩]/g, (d) => ARABIC.indexOf(d));

// فقط رقم‌ها، برای قیمت: «۱۵۰٬۰۰۰» → «150000»
export const onlyDigits = (value) => toLatinDigits(value).replace(/\D/g, '');
