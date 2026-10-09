import { createContext, useState, useEffect, useCallback, useMemo } from "react";
import { cartAPI } from "../services/api";
import { useAuth } from "./useAuth.js";

const CartContext = createContext(null);

const EMPTY_CART = { items: [], count: 0, total: 0 };

export function CartProvider({ children }) {
  const { user, loading: authLoading } = useAuth();
  const [cart, setCart] = useState(EMPTY_CART);
  const [status, setStatus] = useState("loading"); // loading | ready | error
  const [reloadKey, setReloadKey] = useState(0);
  const userId = user?.id;
  // کاربر عوض شد (خروج، پایان session، ورود دیگری): سبد قبلی همین حالا پاک می‌شود، نه وقتی سبد تازه رسید
  const [cartOwner, setCartOwner] = useState(userId);
  if (cartOwner !== userId) {
    setCartOwner(userId);
    setCart(EMPTY_CART);
    setStatus("loading");
  }

  // پس از روشن شدن وضعیت ورود، و هر بار که کاربر عوض شد: ورود (سرور سبد مهمان را ادغام کرده)، خروج، پایان session
  useEffect(() => {
    if (authLoading) return undefined;
    let ignore = false;
    cartAPI
      .getCart()
      .then((response) => {
        if (!ignore) {
          setCart(response.data);
          setStatus("ready");
        }
      })
      .catch(() => {
        if (!ignore) setStatus("error");
      });
    return () => {
      ignore = true;
    };
  }, [authLoading, userId, reloadKey]);

  const refresh = useCallback(() => setReloadKey((key) => key + 1), []);

  // سرور سبد تازه را برمی‌گرداند؛ درباره‌ی خریدنی بودن حدسی زده نمی‌شود
  const add = useCallback(async (bookId) => {
    const response = await cartAPI.addToCart(bookId);
    setCart(response.data);
  }, []);

  const remove = useCallback(async (bookId) => {
    const response = await cartAPI.removeFromCart(bookId);
    setCart(response.data);
  }, []);

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
