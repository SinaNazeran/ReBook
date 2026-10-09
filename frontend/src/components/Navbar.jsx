import { useState, useEffect } from 'react';
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { Navbar as BSNavbar, Nav, Container, Badge, NavDropdown, Form } from 'react-bootstrap';
import { useAuth } from '../context/useAuth.js';
import { useCart } from '../context/useCart.js';
import BrandMark from './BrandMark';
import { notificationAPI, ADMIN_URL } from '../services/api';
import {
  FiBell,
  FiUser,
  FiHeart,
  FiBookOpen,
  FiPlusCircle,
  FiShoppingBag,
  FiShoppingCart,
  FiLogOut,
  FiSearch,
  FiSettings,
} from 'react-icons/fi';

const UNREAD_POLL_INTERVAL = 60000;

function Navbar() {
  const { user, isAuthenticated, isAdmin, logoutUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  // کنترل‌شده تا دکمه‌ی منو aria-expanded درست داشته باشد (Toggle خودِ react-bootstrap آن را نمی‌گذارد)
  const [menuOpen, setMenuOpen] = useState(false);
  // با رفتن به صفحه‌ی دیگر منوی موبایل بسته می‌شود؛ وگرنه روی صفحه‌ی تازه باز می‌ماند
  const [menuPath, setMenuPath] = useState(location.pathname);
  if (menuPath !== location.pathname) {
    setMenuPath(location.pathname);
    setMenuOpen(false);
  }

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    let ignore = false;

    const fetchCount = () => {
      notificationAPI
        .getUnreadCount()
        .then((response) => {
          if (!ignore) {
            setUnreadCount(response.data.count);
          }
        })
        .catch((error) => {
          if (!ignore) {
            console.error('خطا در دریافت اعلان‌ها:', error);
          }
        });
    };

    fetchCount();
    const intervalId = setInterval(fetchCount, UNREAD_POLL_INTERVAL);

    return () => {
      ignore = true;
      clearInterval(intervalId);
    };
  }, [isAuthenticated]);

  const handleLogout = async () => {
    try {
      await logoutUser();
    } catch (error) {
      console.error('خطا در خروج:', error);
    } finally {
      navigate('/');
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const trimmed = searchQuery.trim();
    // در صفحهٔ کتاب‌ها بقیهٔ فیلترها (دسته‌بندی، قیمت، ...) حفظ می‌شوند و فقط جستجو عوض می‌شود
    const params = new URLSearchParams(location.pathname === '/books' ? location.search : '');
    params.delete('page');
    if (trimmed) {
      params.set('search', trimmed);
    } else {
      params.delete('search');
    }
    const query = params.toString();
    navigate(query ? `/books?${query}` : '/books');
  };

  const renderUserAvatar = () => {
    const name = user?.first_name || user?.username || '';
    const initial = name.charAt(0).toUpperCase() || '؟';

    if (user?.avatar) {
      return (
        <img
          src={user.avatar}
          alt=""
          className="nav-avatar"
          width={24}
          height={24}
        />
      );
    }

    return (
      <span className="nav-avatar" aria-hidden="true">
        {initial}
      </span>
    );
  };

  const { count: cartCount } = useCart();
  const cartLabel = cartCount ? `سبد خرید، ${cartCount.toLocaleString('fa-IR')} کتاب` : 'سبد خرید، خالی';
  // خرید فقط از راه سبد است، پس روی موبایل هم بیرون از منو می‌ماند
  const renderCartLink = (className) => (
    <Link to="/cart" className={`nav-cart ${className}`} aria-label={cartLabel}>
      <FiShoppingCart aria-hidden="true" />
      {cartCount > 0 && (
        <span className="nav-cart-count" aria-hidden="true">
          {cartCount > 99 ? '۹۹+' : cartCount.toLocaleString('fa-IR')}
        </span>
      )}
    </Link>
  );

  const displayedUnreadCount = isAuthenticated ? unreadCount : 0;
  // صفحه‌ی کتاب‌ها جستجوی خودش را دارد؛ دو جعبه‌ی جستجو روی هم نمی‌آیند
  const showSearch = location.pathname !== '/books';

  return (
    <BSNavbar expand="lg" expanded={menuOpen} onToggle={setMenuOpen} className="site-navbar sticky-top py-2" aria-label="منوی اصلی">
      <Container>
        <BSNavbar.Brand as={Link} to="/" className="d-flex align-items-center gap-2" translate="no">
          <BrandMark />
          ری‌بوک
        </BSNavbar.Brand>

        {renderCartLink('d-lg-none ms-auto me-1')}
        {/* در موبایل فروش هم‌ارز خرید است، پس پشت منو پنهان نمی‌شود */}
        <Link to="/create-book" className="btn btn-primary text-nowrap d-lg-none me-2 nav-sell-mobile">
          فروش کتاب
        </Link>

        <BSNavbar.Toggle label="باز و بسته کردن منو" aria-controls="site-nav" aria-expanded={menuOpen} className="border-0" />

        {/* نوار جستجوی موبایل */}
        {showSearch && (
        <Form
          className="d-lg-none w-100 mt-3 mb-2"
          onSubmit={handleSearchSubmit}
          role="search"
        >
          <div className="input-group">
            <span className="input-group-text bg-white border-end-0">
              <FiSearch className="text-muted" />
            </span>
            <Form.Control
              type="search"
              name="search"
              placeholder="جستجوی نام کتاب یا نویسنده…"
              aria-label="جستجوی کتاب"
              className="border-start-0"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </Form>
        )}

        <BSNavbar.Collapse id="site-nav" className="mt-2 mt-lg-0">
          <Nav className="me-auto flex-column flex-lg-row">
            <Nav.Link as={NavLink} to="/books" className="py-2 py-lg-1">
              کتاب‌ها
            </Nav.Link>
          </Nav>

          {/* جستجوی دسکتاپ */}
          {showSearch && (
          <Form
            className="nav-search d-none d-lg-flex flex-grow-1 mx-lg-3 my-2 my-lg-0"
            onSubmit={handleSearchSubmit}
            role="search"
          >
            <div className="input-group">
              <span className="input-group-text bg-white border-end-0">
                <FiSearch className="text-muted" />
              </span>
              <Form.Control
                type="search"
                name="search"
                placeholder="جستجوی نام کتاب یا نویسنده…"
                aria-label="جستجوی کتاب"
                className="border-start-0"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </Form>
          )}

          {/* اکشن‌ها و منوی کاربر */}
          <Nav className="align-items-lg-center gap-lg-2 mt-3 mt-lg-0 flex-column flex-lg-row">
            {renderCartLink('d-none d-lg-inline-flex')}
            {/* فروش هم‌ارز خرید است، پس برای همه دیده می‌شود؛ مهمان پس از ورود به همین فرم برمی‌گردد */}
            <Link
              to="/create-book"
              className="btn btn-primary d-none d-lg-flex align-items-center justify-content-center gap-2 text-nowrap nav-sell-desktop"
            >
              <FiPlusCircle aria-hidden="true" />
              فروش کتاب
            </Link>

            {isAuthenticated ? (
              <>
                <NavDropdown
                  title={
                    <span className="d-inline-flex align-items-center gap-2">
                      {renderUserAvatar()}
                      <span
                        className="nav-user-name text-truncate d-inline-block align-middle"
                      >
                        {user?.first_name || <bdi translate="no" className="latin-id">{user?.username}</bdi>}
                      </span>
                    </span>
                  }
                  align="end"
                  className="w-100 w-lg-auto text-center text-lg-start mt-2 mt-lg-0"
                >
                  {/* نام و ایمیل متن معمولی‌اند، نه سرتیتر (پیش‌فرض react-bootstrap role="heading" است) */}
                  <NavDropdown.Header className="pb-2" role="none">
                    <div className="fw-bold text-truncate text-dark">
                      {user?.first_name
                        ? `${user.first_name} ${user.last_name || ''}`
                        : <bdi translate="no" className="latin-id">{user?.username}</bdi>}
                    </div>
                    {user?.email && (
                      <div translate="no" className="small text-muted text-truncate latin-id">
                        {user.email}
                      </div>
                    )}
                  </NavDropdown.Header>

                  <NavDropdown.Item as={Link} to="/profile" className="d-flex align-items-center gap-2 py-2">
                    <FiUser size={16} className="text-muted" />
                    پروفایل
                  </NavDropdown.Item>

                  <NavDropdown.Item as={Link} to="/my-books" className="d-flex align-items-center gap-2 py-2">
                    <FiBookOpen size={16} className="text-muted" />
                    کتاب‌های من
                  </NavDropdown.Item>

                  <NavDropdown.Item as={Link} to="/my-orders" className="d-flex align-items-center gap-2 py-2">
                    <FiShoppingBag size={16} className="text-muted" />
                    معاملات من
                  </NavDropdown.Item>

                  <NavDropdown.Item as={Link} to="/notifications" className="d-flex align-items-center gap-2 py-2">
                    <FiBell size={16} className="text-muted" />
                    اعلان‌ها
                    {displayedUnreadCount > 0 && (
                      <Badge bg="danger" pill className="ms-auto">
                        {displayedUnreadCount > 99 ? '۹۹+' : displayedUnreadCount}
                      </Badge>
                    )}
                  </NavDropdown.Item>

                  <NavDropdown.Item as={Link} to="/wishlist" className="d-flex align-items-center gap-2 py-2">
                    <FiHeart size={16} className="text-muted" />
                    علاقه‌مندی‌ها
                  </NavDropdown.Item>

                  {isAdmin && (
                    <>
                      <NavDropdown.Divider />
                      <NavDropdown.Item
                        as="a"
                        href={ADMIN_URL}
                        target="_blank"
                        rel="noreferrer"
                        className="d-flex align-items-center gap-2 py-2"
                      >
                        <FiSettings size={16} className="text-muted" />
                        پنل مدیریت
                      </NavDropdown.Item>
                    </>
                  )}

                  <NavDropdown.Divider />

                  <NavDropdown.Item
                    as="button"
                    onClick={handleLogout}
                    className="d-flex align-items-center gap-2 py-2 text-danger"
                  >
                    <FiLogOut size={16} />
                    خروج
                  </NavDropdown.Item>
                </NavDropdown>
              </>
            ) : (
              <Link
                to="/login"
                // پس از ورود به همین صفحه برمی‌گردد (مگر از خود صفحه‌ی ورود/ثبت‌نام)؛ صفحه‌ی ورود لینک ثبت‌نام دارد
                state={['/login', '/register'].includes(location.pathname) ? undefined : { from: location }}
                className="btn btn-outline-primary text-nowrap w-100 w-lg-auto"
              >
                ورود / ثبت‌نام
              </Link>
            )}
          </Nav>
        </BSNavbar.Collapse>
      </Container>
    </BSNavbar>
  );
}

export default Navbar;