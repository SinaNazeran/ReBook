import { createContext, useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef } from "react";
import { cartAPI } from "../services/api";
import { useAuth } from "./useAuth.js";

const CartContext = createContext(null);

const EMPTY_CART = { items: [], count: 0, total: 0 };

export function CartProvider({ children }) {
  const { user, loading, authError } = useAuth();
  const authLoading = loading || Boolean(authError);
  const [cart, setCart] = useState(EMPTY_CART);
  const [status, setStatus] = useState("loading"); // loading | ready | error
  const [reloadKey, setReloadKey] = useState(0);
  const queueRef = useRef(null);
  const userId = user?.id;
  // کاربر عوض شد (خروج، پایان session، ورود دیگری): سبد قبلی همین حالا پاک می‌شود، نه وقتی سبد تازه رسید
  const [owner, setOwner] = useState({ userId, authLoading });
  if (owner.userId !== userId || owner.authLoading !== authLoading) {
    setOwner({ userId, authLoading });
    setCart(EMPTY_CART);
    setStatus("loading");
  }

  useLayoutEffect(() => {
    const queue = { owner, active: !owner.authLoading, tail: Promise.resolve(), pending: 0, version: 0, refreshRequested: false };
    queueRef.current = queue;
    return () => { queue.active = false; };
  }, [owner]);

  // پس از روشن شدن وضعیت ورود، و هر بار که کاربر عوض شد: ورود (سرور سبد مهمان را ادغام کرده)، خروج، پایان session
  useEffect(() => {
    const queue = queueRef.current;
    if (!queue.active || queue.pending) return undefined;
    queue.refreshRequested = false;
    const version = ++queue.version;
    let ignore = false;
    cartAPI
      .getCart()
      .then((response) => {
        if (!ignore && queue.active && version === queue.version && !queue.pending) {
          setCart(response.data);
          setStatus("ready");
        }
      })
      .catch(() => {
        if (!ignore && queue.active && version === queue.version && !queue.pending) setStatus("error");
      });
    return () => {
      ignore = true;
    };
  }, [owner, reloadKey]);

  const refresh = useCallback(() => {
    const queue = queueRef.current;
    if (!queue.active || queue.owner !== owner) return;
    queue.refreshRequested = true;
    if (!queue.pending) setReloadKey(key => key + 1);
  }, [owner]);

  // تغییرهای همین کاربر به ترتیب اجرا می‌شوند؛ پاسخ سرور وضعیت قطعی سبد است.
  const mutate = useCallback((send, bookId) => {
    const queue = queueRef.current;
    if (!queue.active || queue.owner !== owner) {
      const error = new Error('وضعیت ورود هنوز مشخص نیست؛ بررسی ورود را دوباره انجام بده.');
      error.code = 'ERR_SESSION_UNAVAILABLE';
      return Promise.reject(error);
    }
    ++queue.pending;
    ++queue.version;
    const request = queue.tail.then(async () => {
      if (!queue.active) return;
      try {
        const response = await send(bookId);
        if (queue.active) {
          setCart(response.data);
          setStatus("ready");
        }
      } catch (error) {
        if (queue.active) queue.refreshRequested = true;
        throw error;
      } finally {
        --queue.pending;
        ++queue.version;
        if (queue.active && !queue.pending && queue.refreshRequested) {
          setReloadKey(key => key + 1);
        }
      }
    });
    queue.tail = request.catch(() => {});
    return request;
  }, [owner]);

  const add = useCallback(bookId => mutate(cartAPI.addToCart, bookId), [mutate]);
  const remove = useCallback(bookId => mutate(cartAPI.removeFromCart, bookId), [mutate]);

  const value = useMemo(
    () => ({
      ...cart,
      status,
      add,
      remove,
      refresh,
      inCart: (bookId) => cart.items.some((item) => item.book.id === bookId),
    }),
    [cart, status, add, remove, refresh],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export default CartContext;
