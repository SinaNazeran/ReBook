import { Link } from "react-router-dom";
import { seriesInk } from "../../utils/series";
export function CatalogCategories({
  rootCategories,
  categoryHref,
  activeSlug,
  activeRoot,
  subCategories,
  activeCategory
}) {
  return <>
        {rootCategories.length > 0 && <nav className="series-tabs" aria-label="دسته‌ها">
            <ul className="series-tabs-list">
              <li>
                <Link to={categoryHref('')} className="series-tab" aria-current={!activeSlug ? 'page' : undefined} style={{
            '--series-ink': 'var(--rb-brand)'
          }}>
                  همه
                </Link>
              </li>
              {rootCategories.map(cat => <li key={cat.id}>
                  <Link to={categoryHref(cat.slug)} className="series-tab" aria-current={activeRoot?.id === cat.id ? 'page' : undefined} style={{
            '--series-ink': seriesInk(cat.id)
          }}>
                    <span className="series-index-mark" aria-hidden="true" />
                    {cat.name}
                  </Link>
                </li>)}
            </ul>
          </nav>}

        {subCategories.length > 0 && <nav className="sub-tabs" aria-label={`زیرشاخه‌های ${activeRoot.name}`}>
            <Link to={categoryHref(activeRoot.slug)} className="sub-tab" aria-current={activeCategory.id === activeRoot.id ? 'page' : undefined}>
              همه‌ی {activeRoot.name}
            </Link>
            {subCategories.map(cat => <Link key={cat.id} to={categoryHref(cat.slug)} className="sub-tab" aria-current={activeCategory.id === cat.id ? 'page' : undefined}>
                {cat.name}
              </Link>)}
          </nav>}
</>;
}
