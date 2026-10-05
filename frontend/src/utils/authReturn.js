// مسیر بازگشت پس از ورود/ثبت‌نام؛ state.from را ProtectedRoute، صفحه‌ی کتاب و دکمه‌ی ورود نوار بالا می‌گذارند
export const returnPath = (location) => {
  const from = location.state?.from;
  return from ? `${from.pathname}${from.search ?? ''}` : '/';
};

// یک جمله درباره‌ی اینکه کاربر برای چه کاری وارد می‌شود
export const returnReason = (location) => {
  const path = location.state?.from?.pathname ?? '';
  if (path === '/create-book') return 'برای ثبت آگهی فروش وارد شو.';
  if (path.startsWith('/books/')) return 'برای خرید یا نشان کردن این کتاب وارد شو؛ بعد به همان صفحه برمی‌گردی.';
  if (path && path !== '/') return 'برای دیدن این صفحه وارد شو؛ بعد به همان‌جا برمی‌گردی.';
  return null;
};
