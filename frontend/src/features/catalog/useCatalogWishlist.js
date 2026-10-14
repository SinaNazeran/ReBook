import { useAuth } from "../../context/useAuth.js";
import { useState, useEffect, useCallback } from "react";
import { bookAPI, getErrorMessage } from "../../services/api";
import { toast } from "../../utils/toast";
const EMPTY_SET = new Set();
export function useCatalogWishlist() {
  const {
    isAuthenticated
  } = useAuth();
  const [wishlistIds, setWishlistIds] = useState(new Set());
  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }
    let ignore = false;
    bookAPI.getWishlist().then(response => {
      const list = response.data.results ?? response.data;
      if (!ignore) {
        setWishlistIds(new Set(list.map(item => item.book.id)));
      }
    }).catch(() => {
      // خطای پس‌زمینه
    });
    return () => {
      ignore = true;
    };
  }, [isAuthenticated]);
  const displayedWishlistIds = isAuthenticated ? wishlistIds : EMPTY_SET;
  const handleToggleWishlist = useCallback(async bookId => {
    const flip = prev => {
      const next = new Set(prev);
      if (next.has(bookId)) {
        next.delete(bookId);
      } else {
        next.add(bookId);
      }
      return next;
    };
    setWishlistIds(flip);
    try {
      await bookAPI.toggleWishlist(bookId);
    } catch (error) {
      setWishlistIds(flip);
      toast.error(getErrorMessage(error));
    }
  }, []);
  return {
    isAuthenticated,
    displayedWishlistIds,
    handleToggleWishlist
  };
}
