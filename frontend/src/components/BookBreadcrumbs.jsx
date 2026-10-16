import { useCategories } from '../utils/categories';
import { catalogCrumbs } from '../utils/breadcrumbs';
import Breadcrumbs from './Breadcrumbs';

function CategorizedBookBreadcrumbs({ book }) {
  const { categories } = useCategories();
  return <Breadcrumbs items={[...catalogCrumbs(book.category, categories), { label: book.title }]} />;
}

export default function BookBreadcrumbs({ book }) {
  return book.category
    ? <CategorizedBookBreadcrumbs book={book} />
    : <Breadcrumbs items={[...catalogCrumbs(null), { label: book.title }]} />;
}
