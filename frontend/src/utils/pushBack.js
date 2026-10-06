// وقتی مودال یا برگه‌ی فیلتر باز می‌شود، depth.css صفحه را کمی کوچک می‌کند تا عقب برود.
// مبدأ کوچک شدن باید مرکز پنجره باشد، نه مرکز کل سند؛ اسکرول در آن لحظه قفل است، پس یک بار اندازه گرفتن کافی است.
// پس‌زمینه‌ی تیره (backdrop) مستقیم به body اضافه می‌شود؛ همان لحظه را می‌گیریم.
export function watchPushBack() {
  const observer = new MutationObserver(() => {
    const main = document.getElementById('main');
    if (!main) return;
    const y = window.scrollY + window.innerHeight / 2 - main.offsetTop;
    document.documentElement.style.setProperty('--push-y', `${y}px`);
  });
  observer.observe(document.body, { childList: true });
}
