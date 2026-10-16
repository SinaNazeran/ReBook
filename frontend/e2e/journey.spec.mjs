import { test, expect } from '@playwright/test';
import process from 'node:process';

const api = process.env.REBOOK_SMOKE_API_URL;
const password = 'Rebook-smoke-only-74!';
const pageErrors = new WeakMap();

async function login(page, username) {
  await page.getByLabel('نام کاربری', { exact: true }).fill(username);
  await page.getByLabel('رمز', { exact: true }).fill(password);
  const response = page.waitForResponse(response => response.url() === `${api}/accounts/login/`);
  await page.getByRole('button', { name: 'ورود', exact: true }).click();
  expect((await response).status()).toBe(200);
}

async function openMenu(page) {
  const toggle = page.getByRole('button', { name: 'باز و بسته کردن منو' });
  if (await toggle.isVisible() && await toggle.getAttribute('aria-expanded') !== 'true') await toggle.click();
}

test.beforeEach(async ({ context, page, baseURL }) => {
  const origins = new Set([new URL(baseURL).origin, new URL(api).origin]);
  await context.route('**/*', route => origins.has(new URL(route.request().url()).origin)
    ? route.continue() : route.abort('blockedbyclient'));
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  pageErrors.set(page, errors);
});

test.afterEach(async ({ page }) => {
  expect(pageErrors.get(page), 'uncaught browser errors').toEqual([]);
});

test('public visitor browses from landing page to a book', async ({ page }, testInfo) => {
  await page.goto('/');
  await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toBeVisible();
  await openMenu(page);
  await page.getByRole('navigation', { name: 'منوی اصلی' }).getByRole('link', { name: 'کتاب‌ها', exact: true }).click();
  await expect(page).toHaveURL(/\/books$/);
  await page.getByRole('link', { name: new RegExp(`کتاب دود ${testInfo.project.name}`) }).first().click();
  await expect(page.getByRole('heading', { level: 1, name: `کتاب دود ${testInfo.project.name}` })).toBeVisible();
});

test('real login survives reload and logout removes access', async ({ page }, testInfo) => {
  await page.goto('/profile');
  await expect(page).toHaveURL(/\/login$/);
  await login(page, `reader_${testInfo.project.name}`);
  await expect(page).toHaveURL(/\/profile$/);
  await page.reload();
  await expect(page).toHaveURL(/\/profile$/);
  const profile = await page.request.get(`${api}/accounts/profile/`);
  expect(profile.status()).toBe(200);
  expect((await profile.json()).username).toBe(`reader_${testInfo.project.name}`);
  await openMenu(page);
  await page.getByRole('button', { name: new RegExp(`reader_${testInfo.project.name}`) }).click();
  const logout = page.waitForResponse(response => response.url() === `${api}/accounts/logout/`);
  await page.getByRole('button', { name: 'خروج', exact: true }).click();
  expect((await logout).status()).toBe(200);
  expect((await page.request.get(`${api}/accounts/profile/`)).status()).toBe(401);
  await page.goto('/profile');
  await expect(page).toHaveURL(/\/login$/);
});

test('guest cart merges on login and checkout persists exactly one paid order', async ({ page }, testInfo) => {
  const title = `کتاب دود ${testInfo.project.name}`;
  await page.goto('/books');
  await page.getByRole('link', { name: new RegExp(title) }).first().click();
  const addition = page.waitForResponse(response => response.url() === `${api}/orders/cart/`
    && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'افزودن به سبد', exact: true }).filter({ visible: true }).first().click();
  expect((await addition).status()).toBe(200);
  await page.getByRole('link', { name: /^سبد خرید،/ }).filter({ visible: true }).click();
  await page.getByRole('link', { name: 'برای پرداخت وارد شو', exact: true }).filter({ visible: true }).first().click();
  await login(page, `buyer_${testInfo.project.name}`);
  await expect(page).toHaveURL(/\/cart$/);
  await expect(page.getByRole('main').getByText(title, { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'ادامه‌ی خرید', exact: true }).filter({ visible: true }).first().click();
  await page.getByLabel('آدرس ارسال', { exact: true }).fill('نشانی آزمایشی، تهران، پلاک ۷');
  const checkout = page.waitForResponse(response => response.url() === `${api}/orders/checkout/`);
  await page.getByRole('button', { name: /^پرداخت آزمایشی / }).filter({ visible: true }).first().click();
  const checkoutResponse = await checkout;
  expect(checkoutResponse.status()).toBe(201);
  const result = await checkoutResponse.json();
  await expect(page.getByText(result.reference_code, { exact: true })).toBeVisible();
  // Use the browser's real session cookie; these are read-only requests, never fixture shortcuts.
  const orders = await page.request.get(`${api}/orders/my-orders/`);
  expect(orders.status()).toBe(200);
  const data = await orders.json();
  expect(data.count).toBe(1);
  expect(data.results).toHaveLength(1);
  expect(data.results[0]).toMatchObject({
    status: 'paid', total_price: 74000, shipping_address: 'نشانی آزمایشی، تهران، پلاک ۷',
    book_detail: { title, status: 'sold' },
    transaction: { status: 'success', amount: 74000, reference_code: result.reference_code },
  });
  await page.reload();
  await expect(page.getByText('سبدت خالی است.', { exact: true })).toBeVisible();
});
