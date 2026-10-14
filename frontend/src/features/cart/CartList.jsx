import { seriesInk } from "../../utils/series";
import CoverThumb from "../../components/CoverThumb";
import { Link } from "react-router-dom";
import StatusMark from "../../components/StatusMark";
import { Button } from "react-bootstrap";
const toman = value => Number(value).toLocaleString('fa-IR');
export function CartList({
  items,
  onRemove,
  removingId
}) {
  return <ul className="ledger">
      {items.map(({
      book,
      available,
      reason
    }) => <li key={book.id} className="ledger-row" style={{
      '--card-ink': seriesInk(book.category_root)
    }}>
          <CoverThumb book={book} />
          <div className="ledger-main">
            <Link to={`/books/${book.id}`} className="ledger-name">
              <bdi>{book.title}</bdi>
            </Link>
            <span className="ledger-meta">
              <bdi>{book.author}</bdi>
              <span aria-hidden="true"> · </span>
              <span className="visually-hidden">، </span>
              {book.condition_display}
              <span aria-hidden="true"> · </span>
              <span className="visually-hidden">، </span>
              فروشنده: <bdi translate="no" className="latin-id">{book.seller_name}</bdi>
            </span>
          </div>
          <span className="ledger-amount price-tag">
            {toman(book.price)} <span className="book-card-currency">تومان</span>
          </span>
          <span className="ledger-status">
            {!available && <StatusMark tone={book.status === 'sold' ? 'sold' : 'closed'}>{reason}</StatusMark>}
          </span>
          <span className="ledger-actions">
            <Button variant="outline-secondary" onClick={() => onRemove(book.id)} disabled={removingId !== null} aria-label={`حذف «${book.title}» از سبد`}>
              {removingId === book.id ? 'در حال حذف…' : 'حذف'}
            </Button>
          </span>
        </li>)}
    </ul>;
}
