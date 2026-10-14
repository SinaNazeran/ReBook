import { NavDropdown } from "react-bootstrap";
import { Link } from "react-router-dom";
export function NavbarCategories({
  series,
  seriesLinkProps
}) {
  return <>
            {series.length > 0 && <NavDropdown title="مجموعه‌ها" id="series-menu" className="series-menu d-none d-lg-block">
                <div className="series-menu-grid">
                  {series.map(category => <NavDropdown.Item key={category.id} as={Link} className="series-menu-item" {...seriesLinkProps(category)}>
                      <span className="series-index-mark" aria-hidden="true" />
                      <span className="series-link-label">{category.name}</span>
                    </NavDropdown.Item>)}
                </div>
                <NavDropdown.Divider />
                <NavDropdown.Item as={Link} to="/books" className="series-menu-all">
                  همه‌ی کتاب‌ها
                </NavDropdown.Item>
              </NavDropdown>}
            {series.length > 0 && <div className="nav-series-mobile d-lg-none">
                <p className="nav-series-title" id="nav-series-title">
                  مجموعه‌ها
                </p>
                <ul aria-labelledby="nav-series-title">
                  {series.map(category => <li key={category.id}>
                      <Link {...seriesLinkProps(category)}>
                        <span className="series-index-mark" aria-hidden="true" />
                        {category.name}
                      </Link>
                    </li>)}
                </ul>
              </div>}
</>;
}
