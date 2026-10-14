import { useSearchParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { bookAPI } from "../../services/api";
import { seriesInk } from "../../utils/series";
const DEFAULT_ORDERING = '-created_at';
export const CONDITION_OPTIONS = [{
  value: '',
  label: 'همه وضعیت‌ها'
}, {
  value: 'new',
  label: 'نو'
}, {
  value: 'like_new',
  label: 'در حد نو'
}, {
  value: 'good',
  label: 'خوب'
}, {
  value: 'fair',
  label: 'قابل قبول'
}, {
  value: 'poor',
  label: 'فرسوده'
}];
const formatToman = value => `${Number(value).toLocaleString('fa-IR')} تومان`;
export const ORDERING_OPTIONS = [{
  value: DEFAULT_ORDERING,
  label: 'جدیدترین'
}, {
  value: 'price',
  label: 'ارزان‌ترین'
}, {
  value: '-price',
  label: 'گران‌ترین'
}];
export function useCatalogFilters(setLoading, setLoadError) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [categories, setCategories] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCondition, setSelectedCondition] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [priceError, setPriceError] = useState('');
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const filterParams = new URLSearchParams(searchParams);
  filterParams.delete('page');
  const paramsKey = filterParams.toString();
  const [prevParamsKey, setPrevParamsKey] = useState(null);
  if (paramsKey !== prevParamsKey) {
    setPrevParamsKey(paramsKey);
    setLoading(true); // به‌جای افکت، در حین رندر تنظیم می‌شود
    setLoadError(false);
    setSearch(searchParams.get('search') || '');
    setSelectedCondition(searchParams.get('condition') || '');
    setMinPrice(searchParams.get('min_price') || '');
    setMaxPrice(searchParams.get('max_price') || '');
    setPriceError('');
  }
  const activeSlug = searchParams.get('category') || '';
  const ordering = searchParams.get('ordering') || DEFAULT_ORDERING;
  useEffect(() => {
    let ignore = false;
    bookAPI.getCategories().then(response => {
      if (!ignore) setCategories(response.data.results ?? response.data);
    }).catch(() => {});
    return () => {
      ignore = true;
    };
  }, []);
  const withParams = changes => {
    const next = new URLSearchParams(searchParams);
    Object.entries(changes).forEach(([key, value]) => {
      if (value) next.set(key, value);else next.delete(key);
    });
    next.delete('page');
    return next;
  };
  const handleSubmit = e => {
    e.preventDefault();
    if (minPrice && maxPrice && Number(minPrice) > Number(maxPrice)) {
      setPriceError('حداقل قیمت نمی‌تواند بیشتر از حداکثر قیمت باشد.');
      setShowFilters(true);
      return;
    }
    setSearchParams(withParams({
      search: search.trim(),
      condition: selectedCondition,
      min_price: minPrice,
      max_price: maxPrice
    }));
    setShowFilters(false);
  };
  const handleOrderingChange = e => {
    const value = e.target.value;
    setSearchParams(withParams({
      ordering: value === DEFAULT_ORDERING ? '' : value
    }));
  };
  const rootCategories = categories.filter(cat => cat.parent === null);
  const activeCategory = categories.find(cat => cat.slug === activeSlug);
  const activeRoot = activeCategory?.parent ? categories.find(cat => cat.id === activeCategory.parent) : activeCategory;
  const subCategories = activeRoot ? categories.filter(cat => cat.parent === activeRoot.id) : [];
  const categoryHref = slug => ({
    search: withParams({
      category: slug
    }).toString()
  });
  const conditionLabel = CONDITION_OPTIONS.find(opt => opt.value === searchParams.get('condition'))?.label;
  const chips = [searchParams.get('search') && {
    key: 'search',
    label: `«${searchParams.get('search')}»`
  }, conditionLabel && {
    key: 'condition',
    label: `وضعیت: ${conditionLabel}`
  }, searchParams.get('min_price') && {
    key: 'min_price',
    label: `از ${formatToman(searchParams.get('min_price'))}`
  }, searchParams.get('max_price') && {
    key: 'max_price',
    label: `تا ${formatToman(searchParams.get('max_price'))}`
  }].filter(Boolean);
  const sheetFilterCount = chips.filter(chip => chip.key !== 'search').length;
  const clearChips = () => setSearchParams(withParams({
    search: '',
    condition: '',
    min_price: '',
    max_price: ''
  }));
  const title = activeCategory?.name ?? (activeSlug ? 'کتاب‌ها' : 'همه‌ی کتاب‌ها');
  const titleInk = activeRoot ? seriesInk(activeRoot.id) : 'var(--rb-brand)';
  return {
    searchParams,
    setSearchParams,
    search,
    setSearch,
    selectedCondition,
    setSelectedCondition,
    minPrice,
    setMinPrice,
    maxPrice,
    setMaxPrice,
    priceError,
    setPriceError,
    showFilters,
    setShowFilters,
    paramsKey,
    page,
    activeSlug,
    ordering,
    handleSubmit,
    handleOrderingChange,
    rootCategories,
    activeCategory,
    activeRoot,
    subCategories,
    categoryHref,
    chips,
    sheetFilterCount,
    clearChips,
    withParams,
    title,
    titleInk
  };
}
