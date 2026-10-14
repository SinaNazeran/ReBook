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
  const [loadedId, setLoadedId] = useState(null);
  const routeRef = useRef(null);
  const requestRef = useRef(null);
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
  const loadBook = useCallback((scope, isRefresh = false) => {
    if (!scope.active) return;
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    const isCurrent = () => scope.active && routeRef.current === scope &&
      requestRef.current === controller && !controller.signal.aborted;

    return bookAPI.getBook(scope.id, { signal: controller.signal }).then(response => {
      if (isCurrent()) {
        setBook(response.data);
        if (!isRefresh) setWishlisted(response.data.is_wishlisted || false);
        setLoadError(null);
      }
    }).catch(error => {
      if (isCurrent() && !isRefresh) {
        setLoadError(error.response?.status === 404 ? 'not_found' : getErrorMessage(error));
      }
    }).finally(() => {
      if (isCurrent()) {
        setLoading(false);
        setLoadedId(scope.id);
      }
    });
  }, []);
  useEffect(() => {
    const scope = { id, active: true };
    routeRef.current = scope;
    loadBook(scope);
    return () => {
      scope.active = false;
      if (routeRef.current === scope) {
        requestRef.current?.abort();
        requestRef.current = null;
        routeRef.current = null;
      }
    };
  }, [id, reloadKey, loadBook]);
  const handleRetry = () => {
    setLoadError(null);
    setLoading(true);
    setReloadKey(key => key + 1);
  };
  const refreshBook = useCallback(() => {
    const scope = routeRef.current;
    if (scope?.id === id) return loadBook(scope, true);
  }, [id, loadBook]);
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
    loading: loading || loadedId !== id,
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
