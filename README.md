# ری‌بوک (ReBook)

بازارچهٔ آنلاین خرید و فروش کتاب‌های دست دوم — پروژهٔ درس توسعهٔ وب، کالج فردوسی.

بک‌اند با **Django REST Framework** و فرانت‌اند با **React + Vite** نوشته شده و کل رابط کاربری فارسی و راست‌به‌چپ است.

## امکانات

- ثبت‌نام، ورود و پروفایل کاربر (احراز هویت مبتنی بر Session و CSRF)
- ثبت آگهی کتاب با تصویر جلد، و تأیید آگهی توسط مدیر در پنل ادمین جنگو
- جست‌وجو و فهرست کتاب‌ها بر اساس دسته‌بندی، و فهرست علاقه‌مندی‌ها
- ثبت سفارش و پرداخت **شبیه‌سازی‌شده** (درگاه واقعی وصل نیست)
- اعلان‌ها برای خریدار و فروشنده، و تیکت پشتیبانی

## پیش‌نیازها

- Python 3.12 یا بالاتر (Django 6)
- Node.js 20.19 یا بالاتر

## راه‌اندازی

### بک‌اند

```bash
python -m venv venv
venv/Scripts/activate          # در لینوکس/مک: source venv/bin/activate
cd backend
pip install -r requirements.txt
cp .env.example .env           # مقدار DJANGO_SECRET_KEY را عوض کنید
python manage.py migrate
python manage.py createsuperuser   # برای ورود به /admin و تأیید آگهی‌ها
python manage.py runserver         # http://localhost:8000
```

یک کلید امن با این دستور بسازید:

```bash
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

### فرانت‌اند

```bash
cd frontend
npm install
npm run dev                    # http://localhost:5173
```

آدرس API به‌طور پیش‌فرض `http://localhost:8000/api` است و با متغیر `VITE_API_URL` در `frontend/.env` قابل تغییر است.

> فرانت‌اند باید روی پورت `5173` اجرا شود؛ تنظیمات CORS و CSRF در `backend/config/settings.py` فقط همین مبدأ را مجاز می‌دانند.

## تست و بررسی کد

```bash
cd backend
python manage.py test
python -m ruff check .

cd ../frontend
npm run lint
npm run build
```

## ساختار پروژه

```
backend/
  config/          تنظیمات و مسیرهای اصلی
  accounts/        کاربر سفارشی، ثبت‌نام، ورود، پروفایل
  books/           کتاب، دسته‌بندی، علاقه‌مندی‌ها
  orders/          سفارش و تراکنش (پرداخت شبیه‌سازی‌شده)
  notifications/   اعلان‌ها و تیکت پشتیبانی
frontend/src/
  pages/           صفحه‌ها
  components/      کامپوننت‌های مشترک
  context/         وضعیت ورود کاربر
  services/api.js  همهٔ فراخوانی‌های API
```

## چرخهٔ آگهی و سفارش

1. فروشنده آگهی ثبت می‌کند؛ وضعیت آگهی «در انتظار تأیید» است.
2. مدیر در پنل ادمین (`/admin`) آگهی را تأیید می‌کند تا در فهرست عمومی نمایش داده شود.
3. خریدار سفارش ثبت می‌کند و فروشنده اعلان می‌گیرد.
4. پس از پرداخت شبیه‌سازی‌شده، سفارش «پرداخت‌شده» و کتاب «فروخته‌شده» می‌شود.
