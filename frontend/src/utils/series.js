// هر دسته‌بندی سطح اول یک مرکب «مجموعه» دارد (--rb-series-1..8 در theme.css)؛ زیرشاخه‌ها مرکب والد را می‌گیرند.
// نگاشت با باقی‌مانده‌ی شناسه است؛ از دسته‌ی نهم به بعد رنگ‌ها تکرار می‌شوند
const SERIES_COUNT = 8;

export function seriesInk(rootId) {
  if (rootId == null) return 'var(--rb-ink-muted)';
  return `var(--rb-series-${(rootId % SERIES_COUNT) + 1})`;
}
