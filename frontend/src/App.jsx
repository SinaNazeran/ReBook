import RouteMetadata from './components/RouteMetadata.jsx';
import { Suspense, lazy, useEffect } from "react";
import { Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext.jsx";
import { CartProvider } from "./context/CartContext.jsx";

// کامپوننت‌های ثابت (همیشه لازم‌اند، lazy نمی‌شوند)
import Navbar from "./components/Navbar";
import Toaster from "./components/Toaster";
import Footer from "./components/Footer";
import Loading from "./components/Loading";
import ProtectedRoute from "./components/ProtectedRoute";
import SessionStatus from "./components/SessionStatus";
import RouteErrorBoundary from "./components/RouteErrorBoundary";
import ScrollToTop from "./components/ScrollToTop";
import NotFound from "./pages/NotFound";
import { watchPushBack } from "./utils/pushBack.js";
import { loadBookDetail, prefetchBookDetail } from "./utils/bookDetailLoading.js";

// صفحات به‌صورت Lazy — فقط زمانی لود می‌شوند که کاربر واقعاً به آن‌ها نیاز داشته باشد
const Home = lazy(() => import("./pages/Home"));
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const BookList = lazy(() => import("./pages/BookList"));
// پیش‌دریافت تنها هنگام اشاره، فوکوس یا لمس لینک کتاب انجام می‌شود.
const BookDetail = lazy(loadBookDetail);
const CreateBook = lazy(() => import("./pages/CreateBook"));
const Profile = lazy(() => import("./pages/Profile"));
const MyBooks = lazy(() => import("./pages/MyBooks"));
const MyOrders = lazy(() => import("./pages/MyOrders"));
const Wishlist = lazy(() => import("./pages/Wishlist"));
const Notifications = lazy(() => import("./pages/Notifications"));
const Support = lazy(() => import("./pages/Support"));
const Cart = lazy(() => import("./pages/Cart"));
const About = lazy(() => import("./pages/About"));
const Contact = lazy(() => import("./pages/Contact"));

function App() {
  useEffect(() => watchPushBack(), []);

  return (
    <AuthProvider>
      <CartProvider>
      <div className="d-flex flex-column min-vh-100"
        onPointerOver={prefetchBookDetail} onFocus={prefetchBookDetail} onPointerDown={prefetchBookDetail}>
        <RouteMetadata />
        <ScrollToTop />
        <a href="#main" className="skip-link visually-hidden-focusable">
          رفتن به محتوای اصلی
        </a>
        <Navbar />

        <main id="main" className="flex-grow-1" tabIndex={-1}>
          <SessionStatus />
          <RouteErrorBoundary>
            <Suspense fallback={<Loading fullPage />}>
              <Routes>
                {/* صفحات عمومی */}
                <Route path="/" element={<Home />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/books" element={<BookList />} />
                <Route path="/books/:id" element={<BookDetail />} />
                <Route path="/cart" element={<Cart />} />
                <Route path="/about" element={<About />} />
                <Route path="/contact" element={<Contact />} />

                {/* صفحات محافظت‌شده (نیاز به لاگین) */}
                <Route
                  path="/profile"
                  element={
                    <ProtectedRoute>
                      <Profile />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/create-book"
                  element={
                    <ProtectedRoute>
                      <CreateBook />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/books/:id/edit"
                  element={
                    <ProtectedRoute>
                      <CreateBook />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/my-books"
                  element={
                    <ProtectedRoute>
                      <MyBooks />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/my-orders"
                  element={
                    <ProtectedRoute>
                      <MyOrders />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/wishlist"
                  element={
                    <ProtectedRoute>
                      <Wishlist />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/notifications"
                  element={
                    <ProtectedRoute>
                      <Notifications />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/support"
                  element={
                    <ProtectedRoute>
                      <Support />
                    </ProtectedRoute>
                  }
                />

                {/* هر مسیر نامعتبر دیگری */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </RouteErrorBoundary>
        </main>

        <Footer />

        <Toaster />
      </div>
      </CartProvider>
    </AuthProvider>
  );
}

export default App;
