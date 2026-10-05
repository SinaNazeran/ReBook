import { FiClock, FiCheck, FiX, FiTruck, FiTag } from 'react-icons/fi';

// شکل هر وضعیت جدا از رنگش خوانده می‌شود: ساعت = منتظر، تیک = انجام‌شده، ضربدر = بسته‌شده
const TONES = {
  waiting: { icon: FiClock, className: 'is-waiting' },
  done: { icon: FiCheck, className: 'is-done' },
  closed: { icon: FiX, className: 'is-closed' },
  moving: { icon: FiTruck, className: 'is-moving' },
  sold: { icon: FiTag, className: 'is-sold' },
};

/** @param {'waiting'|'done'|'closed'|'moving'|'sold'} tone */
function StatusMark({ tone, children }) {
  const { icon: Icon, className } = TONES[tone] ?? TONES.closed;
  return (
    <span className={`status-mark ${className}`}>
      <Icon aria-hidden="true" />
      {children}
    </span>
  );
}

export default StatusMark;
