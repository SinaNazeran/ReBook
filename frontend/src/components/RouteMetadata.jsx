import { useLocation } from 'react-router-dom';
import PageMetadata from './PageMetadata.jsx';
import { HOME_TITLE, HOME_DESCRIPTION } from '../utils/metadata.js';
import { routeCanonical } from '../utils/canonicals.js';

const titles = {
  '/': HOME_TITLE, '/books': 'همه‌ی کتاب‌ها | ری‌بوک',
  '/about': 'درباره‌ی ری‌بوک | ری‌بوک', '/contact': 'تماس با ما | ری‌بوک',
  '/login': 'ورود | ری‌بوک', '/register': 'ساخت حساب | ری‌بوک',
  '/cart': 'سبد خرید | ری‌بوک', '/profile': 'پروفایل | ری‌بوک',
  '/create-book': 'فروش کتاب | ری‌بوک', '/my-books': 'کتاب‌های من | ری‌بوک',
  '/my-orders': 'معاملات من | ری‌بوک', '/wishlist': 'علاقه‌مندی‌ها | ری‌بوک',
  '/notifications': 'اعلان‌ها | ری‌بوک', '/support': 'پشتیبانی | ری‌بوک',
};

export default function RouteMetadata() {
  const { pathname, search } = useLocation();
  const path = pathname.replace(/\/+$/, '').toLowerCase() || '/';
  const title = titles[path] || ( /^\/books\/[^/]+\/edit$/.test(path)
    ? 'ویرایش آگهی | ری‌بوک' : /^\/books\/[^/]+$/.test(path)
      ? 'بارگذاری کتاب | ری‌بوک' : 'این صفحه پیدا نشد | ری‌بوک');
  const description = path === '/' ? HOME_DESCRIPTION : title === 'همه‌ی کتاب‌ها | ری‌بوک'
    ? 'کتاب‌های دست دوم را در فهرست ری‌بوک مرور و جست‌وجو کنید.'
    : title.startsWith('بارگذاری') ? 'مشخصات کتاب در ری‌بوک در حال بارگذاری است.'
      : title.startsWith('این صفحه') ? 'این نشانی در ری‌بوک پیدا نشد. کتاب‌ها را در فهرست مرور کنید.' : undefined;
  return <PageMetadata priority={0} title={title} description={description} canonical={routeCanonical(pathname, search)} />;
}
