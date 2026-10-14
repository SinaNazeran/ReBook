import { toast } from "../../utils/toast";
import { bookAPI, getErrorMessage, orderAPI } from "../../services/api";
export function useBookActions({
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
  setCancelling
}) {
  const goToLogin = () => {
    toast.info('برای ادامه وارد حساب کاربری‌ات شو.');
    navigate('/login', {
      state: {
        from: location
      }
    });
  };
  const handleWishlistToggle = async () => {
    if (!isAuthenticated) {
      goToLogin();
      return;
    }
    const prevState = wishlisted;
    setWishlisted(!prevState); // آپدیت خوش‌بینانه
    try {
      const response = await bookAPI.toggleWishlist(id);
      setWishlisted(response.data.wishlisted);
    } catch (error) {
      setWishlisted(prevState);
      toast.error(getErrorMessage(error));
    }
  };
  const handleAddToCart = async () => {
    setCartBusy(true);
    try {
      await addToCart(book.id);
      focusCartLink.current = true;
      setCartMessage('به سبد اضافه شد.');
    } catch (error) {
      toast.error(getErrorMessage(error));
      refreshBook();
    } finally {
      setCartBusy(false);
    }
  };
  const handleRemoveFromCart = async () => {
    setCartBusy(true);
    try {
      await removeFromCart(book.id);
      setCartMessage('از سبد برداشته شد.');
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setCartBusy(false);
    }
  };
  const handlePaid = () => {
    setBoughtByMe(true);
    setBook(prev => ({
      ...prev,
      status: 'sold',
      open_order: null
    }));
  };
  const handleCancelOrder = async () => {
    // مثل «معاملات من»: لغو برگشت‌پذیر نیست
    if (!window.confirm('این سفارش لغو شود؟ این کار برگشت‌پذیر نیست.')) return;
    setCancelling(true);
    try {
      await orderAPI.cancelOrder(book.open_order.id);
      setBook(prev => ({
        ...prev,
        open_order: null
      }));
      toast.success('سفارش لغو شد.');
    } catch (error) {
      toast.error(getErrorMessage(error));
      refreshBook();
    } finally {
      setCancelling(false);
    }
  };
  return {
    handleWishlistToggle,
    handleAddToCart,
    handleRemoveFromCart,
    handlePaid,
    handleCancelOrder
  };
}
