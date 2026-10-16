import { Link } from 'react-router-dom';
import { FiChevronLeft } from 'react-icons/fi';

export default function Breadcrumbs({ items, className = '' }) {
  return <nav className={`page-breadcrumbs ${className}`.trim()} aria-label="مسیر راهنما">
    <ol>
      {items.map((item, index) => <li key={`${index}-${item.to ?? ''}`}>
        {index === 0 && <span className="series-index-mark" aria-hidden="true" />}
        {index > 0 && <FiChevronLeft aria-hidden="true" focusable="false" />}
        {index === items.length - 1
          ? <span aria-current="page"><bdi>{item.label}</bdi></span>
          : <Link to={item.to}><bdi>{item.label}</bdi></Link>}
      </li>)}
    </ol>
  </nav>;
}
