import { useId } from 'react';

/**
 * تصویر حالت خالی: قفسه‌ای با سه جلد ساده (مرکب سه مجموعه) و جای خالی، که یکی به دیگری تکیه داده.
 * همان زبان جلد ساده: میدان مرکب، قاب خطی سفید، نوار بالا و پایین عطف. تزیینی است و خوانده نمی‌شود.
 * عمق «صحنه»: تخته‌ی قفسه رویه‌ی روشن و لبه‌ی جلویی دارد و هر جلد سایه‌ی نرمش را روی تخته می‌اندازد (نور از بالا).
 */
function EmptyShelf({ className = '' }) {
  // شناسه‌ی useId نویسه‌هایی مثل «:» دارد که داخل url(#…) دردسر می‌سازد
  const blur = `shelf-blur-${useId().replace(/[^\w-]/g, '')}`;

  return (
    <svg className={`empty-shelf ${className}`} viewBox="0 0 160 92" aria-hidden="true" focusable="false">
      <defs>
        <filter id={blur} x="-20%" y="-200%" width="140%" height="500%">
          <feGaussianBlur stdDeviation="1.6" />
        </filter>
      </defs>

      {/* تخته: رویه (دیده‌شده از کمی بالا)، سپس لبه‌ی جلو و سایه‌ی زیرش روی برگه */}
      <ellipse cx="80" cy="88" rx="70" ry="2.5" fill="var(--rb-ink)" fillOpacity=".22" filter={`url(#${blur})`} />
      <polygon points="16,72 144,72 154,80 6,80" fill="var(--rb-ink-muted)" />
      <rect x="6" y="80" width="148" height="5" rx="1" fill="var(--rb-ink)" />

      {/* سایه‌ی تماسی هر جلد روی رویه‌ی تخته */}
      <g fill="var(--rb-ink)" fillOpacity=".45" filter={`url(#${blur})`}>
        <ellipse cx="117" cy="77" rx="15" ry="1.8" />
        <ellipse cx="92" cy="77" rx="13" ry="1.8" />
        <ellipse cx="50" cy="77" rx="11" ry="1.8" />
      </g>

      <g>
        <rect x="104" y="16" width="24" height="60" rx="1.5" fill="var(--rb-series-7)" />
        <rect x="107" y="19" width="18" height="54" fill="none" stroke="#fff" strokeOpacity=".55" />
        <rect x="104" y="24" width="24" height="2" fill="#fff" fillOpacity=".7" />
      </g>
      <g>
        <rect x="80" y="24" width="22" height="52" rx="1.5" fill="var(--rb-series-2)" />
        <rect x="83" y="27" width="16" height="46" fill="none" stroke="#fff" strokeOpacity=".55" />
        <rect x="80" y="32" width="22" height="2" fill="#fff" fillOpacity=".7" />
      </g>
      <g transform="rotate(24 56 76)">
        <rect x="34" y="20" width="22" height="56" rx="1.5" fill="var(--rb-series-3)" />
        <rect x="37" y="23" width="16" height="50" fill="none" stroke="#fff" strokeOpacity=".55" />
        <rect x="34" y="28" width="22" height="2" fill="#fff" fillOpacity=".7" />
      </g>
    </svg>
  );
}

export default EmptyShelf;
