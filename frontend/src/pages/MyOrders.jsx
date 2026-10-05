import { useState, useEffect } from 'react';
import { Container, Tabs, Tab, Button } from 'react-bootstrap';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { orderAPI, getErrorMessage } from '../services/api';
import Loading from '../components/Loading';
import OrderList from '../components/OrderList';
import PurchaseModal from '../components/PurchaseModal';
import EmptyShelf from '../components/EmptyShelf';

const fetchOrders = () => Promise.all([orderAPI.getMyOrders(), orderAPI.getMySales()]);

function MyOrders() {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlTab = searchParams.get('tab') === 'sales' ? 'sales' : 'purchases';
  // زبانه در state محلی هم نگه داشته می‌شود: URL یک رندر دیرتر به‌روز می‌شود و react-bootstrap با کلید جهت‌نما
  // فوکوس را روی زبانه‌ی قبلی می‌گذاشت، پس «فروش‌های من» با صفحه‌کلید در دسترس نبود. URL (عقب/جلو) هنوز منبع است.
  const [activeTab, setActiveTab] = useState(urlTab);
  const [prevUrlTab, setPrevUrlTab] = useState(urlTab);
  if (urlTab !== prevUrlTab) {
    setPrevUrlTab(urlTab);
    setActiveTab(urlTab);
  }

  const [purchases, setPurchases] = useState([]);
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [busyId, setBusyId] = useState(null); // سفارشی که لغوش در جریان است
  const [payingOrder, setPayingOrder] = useState(null);

  const showOrders = ([purchasesRes, salesRes]) => {
    setPurchases(purchasesRes.data.results ?? purchasesRes.data);
    setSales(salesRes.data.results ?? salesRes.data);
  };

  useEffect(() => {
    let ignore = false;
    fetchOrders()
      .then((responses) => {
        if (!ignore) showOrders(responses);
      })
      .catch(() => {
        if (!ignore) setLoadError(true);
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [reloadKey]);

  const handleRetry = () => {
    setLoadError(false);
    setLoading(true);
    setReloadKey((key) => key + 1);
  };

  // هر دو فهرست: لغو توسط فروشنده «فروش‌های من» را عوض می‌کند و لغو توسط خریدار «خریدهای من» را
  const refreshAll = async () => {
    try {
      showOrders(await fetchOrders());
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleCancel = async (orderId) => {
    if (!window.confirm('این سفارش لغو شود؟ این کار برگشت‌پذیر نیست.')) return;
    setBusyId(orderId);
    try {
      const response = await orderAPI.cancelOrder(orderId);
      toast.success(response.data.message);
      await refreshAll();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setBusyId(null);
    }
  };

  const handleTabSelect = (key) => {
    setActiveTab(key);
    setSearchParams(key === 'sales' ? { tab: 'sales' } : {});
  };

  if (loading) return <Loading fullPage />;

  const tabTitle = (label, list) => (list.length ? `${label} (${list.length.toLocaleString('fa-IR')})` : label);

  return (
    <Container className="ledger-page">
      <title>معاملات من | ری‌بوک</title>
      <header className="ledger-header">
        <h1 className="ledger-title">معاملات من</h1>
      </header>

      {loadError ? (
        <div className="list-state" role="alert">
          <p>سفارش‌ها بارگذاری نشدند. اتصال اینترنت را بررسی کن و دوباره امتحان کن.</p>
          <Button variant="outline-secondary" onClick={handleRetry}>
            تلاش دوباره
          </Button>
        </div>
      ) : (
        <Tabs activeKey={activeTab} onSelect={handleTabSelect} variant="underline" className="ledger-tabs">
          <Tab eventKey="purchases" title={tabTitle('خریدهای من', purchases)}>
            {purchases.length ? (
              <OrderList
                orders={purchases}
                type="purchase"
                onPay={setPayingOrder}
                onCancel={handleCancel}
                busyId={busyId}
              />
            ) : (
              <div className="list-state">
                <EmptyShelf />
                <p>هنوز کتابی نخریده‌ای.</p>
                <Link to="/books" className="btn btn-primary">
                  مرور کتاب‌ها
                </Link>
              </div>
            )}
          </Tab>

          <Tab eventKey="sales" title={tabTitle('فروش‌های من', sales)}>
            {sales.length ? (
              <OrderList orders={sales} type="sale" onCancel={handleCancel} busyId={busyId} />
            ) : (
              <div className="list-state">
                <EmptyShelf />
                <p>هنوز کسی از تو کتابی نخریده. آگهی‌هایت در «کتاب‌های من» است.</p>
                <Link to="/my-books" className="btn btn-outline-secondary">
                  کتاب‌های من
                </Link>
              </div>
            )}
          </Tab>
        </Tabs>
      )}

      {payingOrder && (
        <PurchaseModal
          show
          onHide={() => {
            setPayingOrder(null);
            refreshAll();
          }}
          book={{ ...payingOrder.book_detail, price: payingOrder.total_price }}
          existingOrderId={payingOrder.id}
          onStale={refreshAll}
        />
      )}
    </Container>
  );
}

export default MyOrders;
