import { useCallback, useRef, useState } from 'react';

// قفل پیش از اولین await بسته می‌شود؛ state فقط بازخورد رابط را نگه می‌دارد.
export function useSubmissionGuard() {
  const locks = useRef(new Set());
  const [pending, setPending] = useState(new Set());
  const run = useCallback(async (action, key = 'submit') => {
    if (locks.current.has(key)) return;
    locks.current.add(key);
    setPending(new Set(locks.current));
    try {
      return await action();
    } finally {
      locks.current.delete(key);
      setPending(new Set(locks.current));
    }
  }, []);
  return { run, pending };
}
