/**
 * تصویر حالت خالی: قفسه‌ای با سه جلد ساده (مرکب سه مجموعه) و جای خالی، که یکی به دیگری تکیه داده.
 * همان زبان جلد ساده: میدان مرکب، قاب خطی سفید، نوار بالا و پایین عطف. تزیینی است و خوانده نمی‌شود.
 */
function EmptyShelf({ className = '' }) {
  return (
    <svg className={`empty-shelf ${className}`} viewBox="0 0 160 84" aria-hidden="true" focusable="false">
      <g>
        <rect x="104" y="18" width="24" height="60" rx="1.5" fill="var(--rb-series-7)" />
        <rect x="107" y="21" width="18" height="54" fill="none" stroke="#fff" strokeOpacity=".55" />
        <rect x="104" y="26" width="24" height="2" fill="#fff" fillOpacity=".7" />
      </g>
      <g>
        <rect x="80" y="26" width="22" height="52" rx="1.5" fill="var(--rb-series-2)" />
        <rect x="83" y="29" width="16" height="46" fill="none" stroke="#fff" strokeOpacity=".55" />
        <rect x="80" y="34" width="22" height="2" fill="#fff" fillOpacity=".7" />
      </g>
      <g transform="rotate(24 34 78)">
        <rect x="34" y="22" width="22" height="56" rx="1.5" fill="var(--rb-series-3)" />
        <rect x="37" y="25" width="16" height="50" fill="none" stroke="#fff" strokeOpacity=".55" />
        <rect x="34" y="30" width="22" height="2" fill="#fff" fillOpacity=".7" />
      </g>
      <rect x="8" y="78" width="144" height="3" rx="1" fill="var(--rb-ink)" />
    </svg>
  );
}

export default EmptyShelf;
