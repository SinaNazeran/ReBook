/** لوگوی تأییدشدهٔ ۷.۱؛ نام دسترس‌پذیر روی پیوند خانه قرار می‌گیرد. */
function BrandLogo({ variant = 'header' }) {
  const primary = variant === 'primary';

  return (
    <img
      className={`brand-logo brand-logo--${variant}`}
      src={`/brand/rebook-${primary ? 'primary' : 'header'}-white.svg`}
      width={391}
      height={primary ? 150 : 126}
      alt=""
      aria-hidden="true"
      decoding="async"
    />
  );
}

export default BrandLogo;
