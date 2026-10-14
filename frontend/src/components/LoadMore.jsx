import { Button } from 'react-bootstrap';

export default function LoadMore({ hasMore, loadingMore, moreError, loadMore, refresh, retry }) {
  if (!hasMore && !moreError) return null;
  return <div className="text-center mt-4" aria-busy={loadingMore}>
    {moreError && <p role="alert">{moreError}</p>}
    <Button variant="outline-primary" aria-disabled={loadingMore || undefined}
      onClick={() => { if (!loadingMore) (moreError ? retry : hasMore ? loadMore : refresh)(); }}>
      {loadingMore ? 'در حال بارگذاری…' : moreError ? 'تلاش دوباره' : 'نمایش بیشتر'}
    </Button>
    <span className="visually-hidden" role="status">
      {loadingMore ? 'در حال بارگذاری' : ''}
    </span>
  </div>;
}
