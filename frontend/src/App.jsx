import { Suspense, lazy } from "react";
import { Routes, Route } from "react-router-dom";
import { ToastContainer, Slide } from "react-toastify";
import { AuthProvider } from "./context/AuthContext.jsx";
import { CartProvider } from "./context/CartContext.jsx";

// کامپوننت‌های ثابت (همیشه لازم‌اند، lazy نمی‌شوند)
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import Loading from "./components/Loading";
import ProtectedRoute from "./components/ProtectedRoute";
import ErrorBoundary from "./components/ErrorBoundary";
import ScrollToTop from "./components/ScrollToTop";
import NotFound from "./pages/NotFound";

// صفحات به‌صورت Lazy — فقط زمانی لود می‌شوند که کاربر واقعاً به آن‌ها نیاز داشته باشد
const Home = lazy(() => import("./pages/Home"));
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const BookList = lazy(() => import("./pages/BookList"));
const BookDetail = lazy(() => import("./pages/BookDetail"));
const CreateBook = lazy(() => import("./pages/CreateBook"));
const Profile = lazy(() => import("./pages/Profile"));
const MyBooks = lazy(() => import("./pages/MyBooks"));
const MyOrders = lazy(() => import("./pages/MyOrders"));
const Wishlist = lazy(() => import("./pages/Wishlist"));
const Notifications = lazy(() => import("./pages/Notifications"));
const Support = lazy(() => import("./pages/Support"));
const Cart = lazy(() => import("./pages/Cart"));

function App() {
  return (
    <AuthProvider>
      <CartProvider>
      <div className="d-flex flex-column min-vh-100">
        <ScrollToTop />
        <a href="#main" className="skip-link visually-hidden-focusable">
          رفتن به محتوای اصلی
        </a>
        <Navbar />

        <main id="main" className="flex-grow-1" tabIndex={-1}>
          <ErrorBoundary>
            <Suspense fallback={<Loading fullPage />}>
              <Routes>
                {/* صفحات عمومی */}
                <Route path="/" element={<Home />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/books" element={<BookList />} />
                <Route path="/books/:id" element={<BookDetail />} />
                <Route path="/cart" element={<Cart />} />

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
          </ErrorBoundary>
        </main>

        <Footer />

        <ToastContainer
          position="top-right"
          autoClose={3000}
          hideProgressBar={false}
          rtl={true}
          newestOnTop
          transition={Slide}
        />
      </div>
      </CartProvider>
    </AuthProvider>
  );
}

export default App;
