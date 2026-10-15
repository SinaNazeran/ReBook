import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/useAuth.js';
import Loading from './Loading';

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading, authError } = useAuth();
  const location = useLocation();

  if (loading) {
    return <Loading fullPage heading="بررسی وضعیت ورود" />;
  }

  // پیام و تلاش دوباره در SessionStatus، داخل پوستهٔ صفحه است.
  if (authError) return <h1 className="visually-hidden">وضعیت ورود بررسی نشد</h1>;

  if (!isAuthenticated) {
    // مسیر فعلی را همراه ریدایرکت ذخیره می‌کنیم تا Login.jsx بتواند
    // بعد از ورود موفق، کاربر را دقیقاً به همین صفحه برگرداند.
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}

export default ProtectedRoute;
