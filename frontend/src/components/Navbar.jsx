import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Navbar as BSNavbar, Nav, Container, Badge, NavDropdown, Form } from 'react-bootstrap';
import { useAuth } from '../context/useAuth.js';
import { notificationAPI, ADMIN_URL } from '../services/api';
import {
  FiBell,
  FiUser,
  FiHeart,
  FiBookOpen,
  FiPlusCircle,
  FiShoppingBag,
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

  const renderUserAvatar = (size = 28) => {
    const name = user?.first_name || user?.username || '';
    const initial = name.charAt(0).toUpperCase() || '؟';

    if (user?.avatar) {
      return (
        <img
          src={user.avatar}
          alt="avatar"
          className="rounded-circle"
          width={size}
          height={size}
          style={{ objectFit: 'cover' }}
        />
      );
    }

    return (
      <span
        className="d-inline-flex align-items-center justify-content-center bg-primary text-white rounded-circle fw-bold"
        style={{ width: size, height: size, fontSize: '0.8rem' }}
      >
        {initial}
      </span>
    );
  };

  const displayedUnreadCount = isAuthenticated ? unreadCount : 0;

  return (
    <BSNavbar bg="white" expand="lg" className="shadow-sm sticky-top py-2 navbar-light">
      <Container>
        <BSNavbar.Brand as={Link} to="/" className="text-primary d-flex align-items-center gap-2">
          <FiBookOpen size={26} />
          <span className="fw-bold">ری‌بوک</span>
        </BSNavbar.Brand>

        <BSNavbar.Toggle aria-label="باز و بسته کردن منو" className="border-0" />

        {/* نوار جستجوی موبایل */}
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
              placeholder="جستجوی نام کتاب یا نویسنده..."
              aria-label="جستجوی کتاب"
              className="border-start-0"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </Form>

        <BSNavbar.Collapse className="mt-2 mt-lg-0">
          <Nav className="me-auto flex-column flex-lg-row">
            <Nav.Link as={Link} to="/" className="py-2 py-lg-1">
              خانه
            </Nav.Link>
            <Nav.Link as={Link} to="/books" className="py-2 py-lg-1">
              کتاب‌ها
            </Nav.Link>
          </Nav>

          {/* جستجوی دسکتاپ */}
          <Form
            className="d-none d-lg-flex flex-grow-1 mx-lg-3 my-2 my-lg-0"
            style={{ maxWidth: 380 }}
            onSubmit={handleSearchSubmit}
            role="search"
          >
            <div className="input-group">
              <span className="input-group-text bg-white border-end-0">
                <FiSearch className="text-muted" />
              </span>
              <Form.Control
                type="search"
                placeholder="جستجوی نام کتاب یا نویسنده..."
                aria-label="جستجوی کتاب"
                className="border-start-0"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </Form>

          {/* اکشن‌ها و منوی کاربر */}
          <Nav className="align-items-lg-center gap-lg-2 mt-3 mt-lg-0 flex-column flex-lg-row">
            {isAuthenticated && (
              <Link
                to="/create-book"
                className="btn btn-primary btn-sm d-flex align-items-center justify-content-center gap-1 w-100 w-lg-auto mb-2 mb-lg-0"
              >
                <FiPlusCircle />
                ثبت کتاب
              </Link>
            )}

            {isAuthenticated ? (
              <>
                <NavDropdown
                  title={
                    <span className="d-inline-flex align-items-center gap-2">
                      {renderUserAvatar(24)}
                      <span
                        className="text-truncate d-inline-block align-middle"
                        style={{ maxWidth: 100 }}
                      >
                        {user?.first_name || user?.username}
                      </span>
                    </span>
                  }
                  align="end"
                  className="w-100 w-lg-auto text-center text-lg-start mt-2 mt-lg-0"
                >
                  <NavDropdown.Header className="pb-2">
                    <div className="fw-bold text-truncate text-dark">
                      {user?.first_name
                        ? `${user.first_name} ${user.last_name || ''}`
                        : user?.username}
                    </div>
                    {user?.email && (
                      <div className="text-muted text-truncate" style={{ fontSize: '0.8rem' }}>
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
                    سفارش‌های من
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
              <div className="d-flex gap-2 w-100 w-lg-auto mt-2 mt-lg-0">
                <Link
                  to="/login"
                  // پس از ورود به همین صفحه برمی‌گردد (مگر از خود صفحه‌ی ورود/ثبت‌نام)
                  state={['/login', '/register'].includes(location.pathname) ? undefined : { from: location }}
                  className="btn btn-outline-primary btn-sm w-100 w-lg-auto"
                >
                  ورود
                </Link>
                <Link to="/register" className="btn btn-primary btn-sm w-100 w-lg-auto">
                  ثبت‌نام
                </Link>
              </div>
            )}
          </Nav>
        </BSNavbar.Collapse>
      </Container>
    </BSNavbar>
  );
}

export default Navbar;