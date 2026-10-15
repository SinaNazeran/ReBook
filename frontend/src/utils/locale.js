// تقویم، رقم و منطقهٔ زمانی نمایش تاریخ‌ها در همهٔ صفحه‌ها یکسان است.
const locale = 'fa-IR-u-ca-persian-nu-arabext';
const dateStyles = {
  short: { year: 'numeric', month: 'numeric', day: 'numeric' },
  long: { year: 'numeric', month: 'long', day: 'numeric' },
  month: { year: 'numeric', month: 'long' },
  year: { year: 'numeric' },
};
const dateFormatters = Object.fromEntries(Object.entries(dateStyles).map(([name, options]) => [
  name, new Intl.DateTimeFormat(locale, { ...options, timeZone: 'Asia/Tehran' }),
]));
const numberFormatter = new Intl.NumberFormat(locale);

export function formatPersianDate(value, style = 'short') {
  if (value == null || value === '') return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return dateFormatters[style].format(date);
}

export const formatPersianNumber = value => numberFormatter.format(value);

