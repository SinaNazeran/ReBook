import { useState, useEffect } from 'react';
import { Container, Tabs, Tab } from 'react-bootstrap';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { orderAPI, getErrorMessage } from '../services/api';
import Loading from '../components/Loading';
import OrdersTable from '../components/OrdersTable';

const fetchOrders = () => Promise.all([orderAPI.getMyOrders(), orderAPI.getMySales()]);

function MyOrders() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') === 'sales' ? 'sales' : 'purchases';

  const [purchases, setPurchases] = useState([]);
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null); // سفارشی که پرداخت یا لغوش در جریان است

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
      .catch((error) => {
        if (!ignore) toast.error(getErrorMessage(error));
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, []);

  // هر دو فهرست: لغو توسط فروشنده «فروش‌های من» را عوض می‌کند و لغو توسط خریدار «خریدهای من» را
  const refreshAll = async () => {
    try {
      showOrders(await fetchOrders());
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handlePay = async (orderId) => {
    setBusyId(orderId);
    try {
      const response = await orderAPI.payOrder(orderId);
      toast.success(`پرداخت موفق! کد پیگیری: ${response.data.reference_code}`);
      await refreshAll();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setBusyId(null);
    }
  };

  const handleCancel = async (orderId) => {
    if (!window.confirm('این سفارش لغو شود؟ این کار قابل بازگشت نیست.')) return;
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
    setSearchParams(key === 'sales' ? { tab: 'sales' } : {});
  };

  if (loading) return <Loading fullPage />;

  return (
    <Container className="py-5">
      <h1 className="h3 mb-4">معاملات من</h1>

      <Tabs activeKey={activeTab} onSelect={handleTabSelect} className="mb-4">
        <Tab eventKey="purchases" title={`خریدهای من${purchases.length ? ` (${purchases.length})` : ''}`}>
          <OrdersTable
            orders={purchases}
            type="purchase"
            onPay={handlePay}
            onCancel={handleCancel}
            busyId={busyId}
            emptyMessage="هنوز خریدی ثبت نکرده‌اید."
          />
        </Tab>

        <Tab eventKey="sales" title={`فروش‌های من${sales.length ? ` (${sales.length})` : ''}`}>
          <OrdersTable
            orders={sales}
            type="sale"
            onCancel={handleCancel}
            busyId={busyId}
            emptyMessage="هنوز فروشی نداشته‌اید."
          />
        </Tab>
      </Tabs>
    </Container>
  );
}

export default MyOrders;