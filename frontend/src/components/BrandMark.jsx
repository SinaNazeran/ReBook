/**
 * نشان ناشر ری‌بوک: برچسب عطف کتاب جیبی، با دو نوار کاغذی بالا و پایینِ عطف.
 * قرمز فقط همین نشان است. روی جلد ساده تک‌رنگ می‌شود (mono)، چون قرمز روی مرکب مجموعه خوانا نیست.
 */
function BrandMark({ mono = false, className = '' }) {
  return (
    <svg
      className={`brand-mark${mono ? ' is-mono' : ''} ${className}`}
      viewBox="0 0 10 16"
      aria-hidden="true"
      focusable="false"
    >
      <rect className="brand-mark-spine" width="10" height="16" rx="1" />
      <rect className="brand-mark-band" x="0" y="2.4" width="10" height="1" />
      <rect className="brand-mark-band" x="0" y="12.6" width="10" height="1" />
    </svg>
  );
}

export default BrandMark;
