import { useAuth } from "../../context/useAuth.js";
import { useState } from "react";
import { useSubmissionGuard } from '../../hooks/useSubmissionGuard';
import { bookAPI, getErrorMessage } from "../../services/api";
import { toast } from "../../utils/toast";

export function useCatalogWishlist(books) {
  const { isAuthenticated, user } = useAuth();
  const [overrides, setOverrides] = useState({ userId: null, values: {} });
  const { run, pending: pendingWishlistIds } = useSubmissionGuard();
  const userId = user?.id;
  const values = overrides.userId === userId ? overrides.values : {};
  const displayedWishlistIds = new Set(isAuthenticated ? books.filter(book =>
    values[book.id] ?? book.is_wishlisted).map(book => book.id) : []);

  const handleToggleWishlist = bookId => run(async () => {
    if (!isAuthenticated) return;
    const previous = displayedWishlistIds.has(bookId);
    const write = value => setOverrides(current => ({
      userId,
      values: { ...(current.userId === userId ? current.values : {}), [bookId]: value },
    }));
    write(!previous);
    try {
      const { data } = await bookAPI.toggleWishlist(bookId);
      write(data.wishlisted);
    } catch (error) {
      write(previous);
      toast.error(getErrorMessage(error));
    }
  }, bookId);
  return { isAuthenticated, displayedWishlistIds, handleToggleWishlist, pendingWishlistIds };
}
