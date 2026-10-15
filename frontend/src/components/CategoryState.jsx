export default function CategoryState({ state, label = 'دسته‌بندی‌ها', empty = state.categories.length === 0 }) {
  if (state.status === 'ready' && !empty) return null;
  return <div className="async-state small" role={state.status === 'error' ? 'alert' : 'status'}>
    {state.status === 'loading' ? <>
      <span className="async-placeholder" aria-hidden="true" />
      <span>در حال دریافت {label}…</span>
    </> : state.status === 'error' ? <>
      <span>{label} بارگذاری نشدند.</span>
      <button type="button" className="async-retry" onClick={state.retry} aria-label={`تلاش دوباره برای دریافت ${label}`}>تلاش دوباره</button>
    </> : <span>هنوز {label} ثبت نشده‌اند.</span>}
  </div>;
}
