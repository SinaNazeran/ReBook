/** نشان مستقل کتاب و گردش؛ ماسک برداری رنگ مرکب جلد را می‌پذیرد. */
function BrandMark({ mono = false, className = '' }) {
  return (
    <span
      className={`brand-mark${mono ? ' is-mono' : ''} ${className}`}
      aria-hidden="true"
    />
  );
}

export default BrandMark;
