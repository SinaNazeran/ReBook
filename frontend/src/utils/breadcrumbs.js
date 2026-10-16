const CATALOG = [{ label: 'خانه', to: '/' }, { label: 'کتاب‌ها', to: '/books' }];

function categoryCrumb(category) {
  return { label: category.name, to: `/books?${new URLSearchParams({ category: category.slug })}` };
}

export function categoryCrumbs(category, categories = []) {
  if (!category?.name || !category.slug) return [];
  const byId = new Map(categories.map(node => [String(node.id), node]));
  const seen = new Set();
  const chain = [];
  let node = category;
  while (node) {
    // داده‌ی ناقص یا حلقوی نباید مسیر ساختگی یا حلقه‌ی رندر بسازد.
    if (seen.has(String(node.id))) return [categoryCrumb(category)];
    seen.add(String(node.id));
    if (node.name && node.slug) chain.unshift(categoryCrumb(node));
    node = node.parent == null ? null : byId.get(String(node.parent));
  }
  return chain;
}

export function catalogCrumbs(category, categories) {
  return [...CATALOG, ...categoryCrumbs(category, categories)];
}
