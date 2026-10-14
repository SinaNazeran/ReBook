import { useAuth } from "../../context/useAuth.js";
import { useRef, useState } from "react";
import { bookAPI, getErrorMessage } from "../../services/api";
import { toast } from "../../utils/toast";

export function useCatalogWishlist(books) {
  const { isAuthenticated, user } = useAuth();
  const [overrides, setOverrides] = useState({ userId: null, values: {} });
  const pending = useRef(new Set());
  const userId = user?.id;
  const values = overrides.userId === userId ? overrides.values : {};
  const displayedWishlistIds = new Set(isAuthenticated ? books.filter(book =>
    values[book.id] ?? book.is_wishlisted).map(book => book.id) : []);

  const handleToggleWishlist = async bookId => {
    if (!isAuthenticated || pending.current.has(bookId)) return;
    const previous = displayedWishlistIds.has(bookId);
    const write = value => setOverrides(current => ({
      userId,
      values: { ...(current.userId === userId ? current.values : {}), [bookId]: value },
    }));
    pending.current.add(bookId);
    write(!previous);
    try {
      const { data } = await bookAPI.toggleWishlist(bookId);
      write(data.wishlisted);
    } catch (error) {
      write(previous);
      toast.error(getErrorMessage(error));
    } finally {
      pending.current.delete(bookId);
    }
  };
  return { isAuthenticated, displayedWishlistIds, handleToggleWishlist };
}
