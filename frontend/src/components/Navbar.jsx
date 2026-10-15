import { useAuth } from "../context/useAuth.js";
import { useNavigate, useLocation, Link, NavLink } from "react-router-dom";
import { useUnreadCount } from "./navigation/useUnreadCount.js";
import { useState } from "react";
import { useCart } from "../context/useCart.js";
import { FiShoppingCart, FiBell, FiPlusCircle } from "react-icons/fi";
import { useSeries } from "../utils/categories";
import { seriesInk } from "../utils/series";
import { Navbar as BSNavbar, Container, Nav } from "react-bootstrap";
import BrandMark from "./BrandMark";
import { NavbarSearch } from "./navigation/NavbarSearch.jsx";
import { NavbarCategories } from "./navigation/NavbarCategories.jsx";
import { NavbarAccountMenu } from "./navigation/NavbarAccountMenu.jsx";
function Navbar() {
  const {
    user,
    isAuthenticated,
    isAdmin,
    logoutUser
  } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const unreadState = useUnreadCount(isAuthenticated ? user?.id : null);
  const displayedUnreadCount = unreadState.count;
  const unreadLabel = unreadState.status === 'ready'
    ? `اعلان‌ها، ${displayedUnreadCount.toLocaleString('fa-IR')} خوانده‌نشده`
    : 'اعلان‌ها، شمار به‌روز در دسترس نیست';
  const [searchQuery, setSearchQuery] = useState('');
  // کنترل‌شده تا دکمه‌ی منو aria-expanded درست داشته باشد (Toggle خودِ react-bootstrap آن را نمی‌گذارد)
  const [menuOpen, setMenuOpen] = useState(false);
  // با رفتن به صفحه‌ی دیگر منوی موبایل بسته می‌شود؛ وگرنه روی صفحه‌ی تازه باز می‌ماند
  const [menuPath, setMenuPath] = useState(location.pathname);
  if (menuPath !== location.pathname) {
    setMenuPath(location.pathname);
    setMenuOpen(false);
  }
  const handleLogout = async () => {
    try {
      await logoutUser();
    } catch (error) {
      console.error('خطا در خروج:', error);
    } finally {
      navigate('/');
    }
  };
  const handleSearchSubmit = e => {
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
  const {
    count: cartCount
  } = useCart();
  const cartLabel = cartCount ? `سبد خرید، ${cartCount.toLocaleString('fa-IR')} کتاب` : 'سبد خرید، خالی';
  // خرید فقط از راه سبد است، پس روی موبایل هم بیرون از منو می‌ماند
  const countLabel = count => count > 99 ? '۹۹+' : count.toLocaleString('fa-IR');
  const renderCartLink = className => <Link to="/cart" className={`nav-icon ${className}`} aria-label={cartLabel}>
      <FiShoppingCart aria-hidden="true" />
      {cartCount > 0 && <span className="nav-icon-count" aria-hidden="true">
          {countLabel(cartCount)}
        </span>}
    </Link>;

  // صفحه‌ی کتاب‌ها جستجوی خودش را دارد؛ دو جعبه‌ی جستجو روی هم نمی‌آیند
  const showSearch = location.pathname !== '/books';

  // هشت مجموعه (دسته‌های سطح اول)، هر کدام با مرکب خودش؛ اگر دسته‌ها نرسیدند، این پیوندها نمی‌آیند
  const categoryState = useSeries();
  const series = categoryState.series;
  const activeSlug = location.pathname === '/books' ? new URLSearchParams(location.search).get('category') : null;
  const seriesLinkProps = category => ({
    to: `/books?category=${category.slug}`,
    style: {
      '--series-ink': seriesInk(category.id)
    },
    'aria-current': activeSlug === category.slug ? 'page' : undefined
  });
  return <BSNavbar expand="lg" expanded={menuOpen} onToggle={setMenuOpen} className="site-navbar sticky-top py-2" aria-label="منوی اصلی">
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
        {showSearch && <NavbarSearch className="d-lg-none w-100 mt-3 mb-2" handleSearchSubmit={handleSearchSubmit} searchQuery={searchQuery} setSearchQuery={setSearchQuery} />}

        <BSNavbar.Collapse id="site-nav" className="mt-2 mt-lg-0">
          <Nav className="me-auto flex-column flex-lg-row">
            <Nav.Link as={NavLink} to="/books" className="py-2">
              کتاب‌ها
            </Nav.Link>
<NavbarCategories series={series} seriesLinkProps={seriesLinkProps} categoryState={categoryState} />
          </Nav>

          {/* جستجوی دسکتاپ */}
          {showSearch && <NavbarSearch className="nav-search d-none d-lg-flex flex-grow-1 mx-lg-3 my-2 my-lg-0" handleSearchSubmit={handleSearchSubmit} searchQuery={searchQuery} setSearchQuery={setSearchQuery} />}

          {/* اکشن‌ها و منوی کاربر */}
          <Nav className="nav-actions align-items-lg-center mt-3 mt-lg-0 flex-column flex-lg-row">
            {/* آیکن‌ها یک گروه‌اند: سبد برای همه، اعلان‌ها برای کاربر واردشده (در موبایل اعلان‌ها در منوی حساب است) */}
            <div className="nav-icons d-none d-lg-flex">
              {isAuthenticated && <Link to="/notifications" className="nav-icon nav-bell" aria-label={unreadLabel}>
                  <FiBell aria-hidden="true" />
                  {(displayedUnreadCount > 0 || unreadState.status !== 'ready') && <span className="nav-icon-count" aria-hidden="true">
                      {displayedUnreadCount !== null && displayedUnreadCount > 0 ? countLabel(displayedUnreadCount) : ''}{unreadState.status !== 'ready' ? '؟' : ''}
                    </span>}
                </Link>}
              {renderCartLink('')}
            </div>
            {/* فروش هم‌ارز خرید است، پس برای همه دیده می‌شود؛ مهمان پس از ورود به همین فرم برمی‌گردد */}
            <Link to="/create-book" className="btn btn-primary d-none d-lg-flex align-items-center justify-content-center gap-2 text-nowrap nav-sell-desktop">
              <FiPlusCircle aria-hidden="true" />
              فروش کتاب
            </Link>

<NavbarAccountMenu user={user} isAuthenticated={isAuthenticated} displayedUnreadCount={displayedUnreadCount} unreadState={unreadState} isAdmin={isAdmin} handleLogout={handleLogout} location={location} />
          </Nav>
        </BSNavbar.Collapse>
      </Container>
    </BSNavbar>;
}
export default Navbar;
