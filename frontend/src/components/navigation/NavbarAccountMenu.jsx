import { NavDropdown, Badge } from "react-bootstrap";
import { Link } from "react-router-dom";
import { FiUser, FiBookOpen, FiShoppingBag, FiBell, FiHeart, FiSettings, FiLogOut } from "react-icons/fi";
import { ADMIN_URL } from "../../services/api";
export function NavbarAccountMenu({
  user,
  isAuthenticated,
  displayedUnreadCount,
  isAdmin,
  handleLogout,
  location
}) {
  const renderUserAvatar = () => {
    const name = user?.first_name || user?.username || '';
    const initial = name.charAt(0).toUpperCase() || '؟';
    if (user?.avatar) {
      return <img src={user.avatar} alt="" className="nav-avatar" width={24} height={24} />;
    }
    return <span className="nav-avatar" aria-hidden="true">
        {initial}
      </span>;
  };
  return <>
            {isAuthenticated ? <>
                <NavDropdown title={<span className="d-inline-flex align-items-center gap-2">
                      {renderUserAvatar()}
                      <span className="nav-user-name text-truncate d-inline-block align-middle">
                        {user?.first_name || <bdi translate="no" className="latin-id">{user?.username}</bdi>}
                      </span>
                    </span>} align="end" className="w-100 w-lg-auto text-center text-lg-start mt-2 mt-lg-0">
                  {/* نام و ایمیل متن معمولی‌اند، نه سرتیتر (پیش‌فرض react-bootstrap role="heading" است) */}
                  <NavDropdown.Header className="pb-2" role="none">
                    <div className="fw-bold text-truncate text-dark">
                      {user?.first_name ? `${user.first_name} ${user.last_name || ''}` : <bdi translate="no" className="latin-id">{user?.username}</bdi>}
                    </div>
                    {user?.email && <div translate="no" className="small text-muted text-truncate latin-id">
                        {user.email}
                      </div>}
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
                    {displayedUnreadCount > 0 && <Badge bg="danger" pill className="ms-auto">
                        {displayedUnreadCount > 99 ? '۹۹+' : displayedUnreadCount}
                      </Badge>}
                  </NavDropdown.Item>

                  <NavDropdown.Item as={Link} to="/wishlist" className="d-flex align-items-center gap-2 py-2">
                    <FiHeart size={16} className="text-muted" />
                    علاقه‌مندی‌ها
                  </NavDropdown.Item>

                  {isAdmin && <>
                      <NavDropdown.Divider />
                      <NavDropdown.Item as="a" href={ADMIN_URL} target="_blank" rel="noreferrer" className="d-flex align-items-center gap-2 py-2">
                        <FiSettings size={16} className="text-muted" />
                        پنل مدیریت
                      </NavDropdown.Item>
                    </>}

                  <NavDropdown.Divider />

                  <NavDropdown.Item as="button" onClick={handleLogout} className="d-flex align-items-center gap-2 py-2 text-danger">
                    <FiLogOut size={16} />
                    خروج
                  </NavDropdown.Item>
                </NavDropdown>
              </> : <Link to="/login"
    // پس از ورود به همین صفحه برمی‌گردد (مگر از خود صفحه‌ی ورود/ثبت‌نام)؛ صفحه‌ی ورود لینک ثبت‌نام دارد
    state={['/login', '/register'].includes(location.pathname) ? undefined : {
      from: location
    }} className="btn btn-outline-primary text-nowrap w-100 w-lg-auto">
                ورود / ثبت‌نام
              </Link>}
</>;
}
