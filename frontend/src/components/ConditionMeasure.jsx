import { CONDITION_STEPS } from '../utils/condition';

/**
 * مقیاس پنج‌پله‌ای وضعیت ظاهری؛ در کارت و صفحه‌ی جزئیات یکی است.
 * @param {string} condition - مقدار enum بک‌اند (new, like_new, ...)
 * @param {string} label - برچسب فارسی (condition_display)
 */
function ConditionMeasure({ condition, label, className = '' }) {
  const steps = CONDITION_STEPS[condition];
  if (!steps) return null;

  return (
    <span className={`condition-measure ${className}`}>
      <span className="condition-steps" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((step) => (
          <span key={step} className={step <= steps ? 'is-filled' : undefined} />
        ))}
      </span>
      <span className="condition-label">{label}</span>
    </span>
  );
}

export default ConditionMeasure;
