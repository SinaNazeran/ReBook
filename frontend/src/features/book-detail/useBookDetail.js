import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/useAuth.js";
import { useState, useRef, useEffect, useCallback } from "react";
import { useCart } from "../../context/useCart.js";
import { bookAPI, getErrorMessage } from "../../services/api";
export function useBookDetail() {
  const {
    id
  } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const {
    user,
    isAuthenticated
  } = useAuth();
  const [book, setBook] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [wishlisted, setWishlisted] = useState(false);
  const [payingOrderId, setPayingOrderId] = useState(null);
  const [boughtByMe, setBoughtByMe] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const {
    inCart,
    add: addToCart,
    remove: removeFromCart
  } = useCart();
  const [cartBusy, setCartBusy] = useState(false);
  const [cartMessage, setCartMessage] = useState('');
  const focusCartLink = useRef(false);
  const isInCart = book ? inCart(book.id) : false;
  useEffect(() => {
    if (!isInCart || !focusCartLink.current) return;
    focusCartLink.current = false;
    [...document.querySelectorAll('.buy-cart-link')].find(el => el.offsetParent !== null)?.focus();
  }, [isInCart]);
  useEffect(() => {
    let ignore = false;
    bookAPI.getBook(id).then(response => {
      if (!ignore) {
        setBook(response.data);
        setWishlisted(response.data.is_wishlisted || false);
      }
    }).catch(error => {
      if (!ignore) {
        setLoadError(error.response?.status === 404 ? 'not_found' : getErrorMessage(error));
      }
    }).finally(() => {
      if (!ignore) {
        setLoading(false);
      }
    });
    return () => {
      ignore = true;
    };
  }, [id, reloadKey]);
  const handleRetry = () => {
    setLoadError(null);
    setLoading(true);
    setReloadKey(key => key + 1);
  };
  const refreshBook = useCallback(() => {
    bookAPI.getBook(id).then(response => setBook(response.data)).catch(() => {});
  }, [id]);
  return {
    navigate,
    location,
    isAuthenticated,
    wishlisted,
    setWishlisted,
    id,
    setCartBusy,
    addToCart,
    book,
    focusCartLink,
    setCartMessage,
    refreshBook,
    removeFromCart,
    setBoughtByMe,
    setBook,
    setCancelling,
    user,
    loading,
    loadError,
    payingOrderId,
    setPayingOrderId,
    boughtByMe,
    cancelling,
    cartBusy,
    cartMessage,
    isInCart,
    handleRetry
  };
}
