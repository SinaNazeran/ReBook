import { Form } from "react-bootstrap";
import { FiSearch } from "react-icons/fi";
export function NavbarSearch({
  className,
  handleSearchSubmit,
  searchQuery,
  setSearchQuery
}) {
  return <Form className={className} onSubmit={handleSearchSubmit} role="search">
          <div className="input-group">
            <span className="input-group-text bg-white border-end-0">
              <FiSearch className="text-muted" />
            </span>
            <Form.Control type="search" dir={searchQuery ? "auto" : "rtl"} name="search" placeholder="جستجوی نام کتاب یا نویسنده…" aria-label="جستجوی کتاب" className="border-start-0" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          </div>
        </Form>;
}
