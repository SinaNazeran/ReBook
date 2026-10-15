import { formatPersianNumber } from '../../utils/locale';

export default function UnreadStatus({ state }) {
  if (!state || state.status === 'ready' || state.status === 'idle') return null;
  const pending = state.status === 'loading' || state.status === 'refreshing';
  return <div className="async-state small text-wrap" role="status">
    <span>{pending ? 'در حال دریافت شمار اعلان‌ها…' : 'شمار اعلان‌ها در دسترس نیست.'}</span>
    {state.count !== null && <span>آخرین شمار: {formatPersianNumber(state.count)}؛ ممکن است تغییر کرده باشد.</span>}
    {!pending && <button type="button" className="async-retry" onClick={state.retry}>دریافت دوباره شمار اعلان‌ها</button>}
  </div>;
}
