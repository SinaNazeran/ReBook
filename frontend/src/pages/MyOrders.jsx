import { useState, useEffect, useCallback } from 'react';
import { Container, Tabs, Tab } from 'react-bootstrap';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { orderAPI, getErrorMessage } from '../services/api';
import Loading from '../components/Loading';
import OrdersTable from '../components/OrdersTable';

function MyOrders() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') === 'sales' ? 'sales' : 'purchases';

  const [purchases, setPurchases] = useState([]);
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [payingId, setPayingId] = useState(null);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        const [purchasesRes, salesRes] = await Promise.all([
          orderAPI.getMyOrders(),
          orderAPI.getMySales(),
        ]);
        setPurchases(purchasesRes.data.results ?? purchasesRes.data);
        setSales(salesRes.data.results ?? salesRes.data);
      } catch (error) {
        toast.error(getErrorMessage(error));
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  const refreshPurchases = useCallback(async () => {
    try {
      const response = await orderAPI.getMyOrders();
      setPurchases(response.data.results ?? response.data);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  }, []);

  const handlePay = async (orderId) => {
    setPayingId(orderId);
    try {
      const response = await orderAPI.payOrder(orderId);
      toast.success(`پرداخت موفق! کد پیگیری: ${response.data.reference_code}`);
      await refreshPurchases();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setPayingId(null);
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
            payingId={payingId}
            emptyMessage="هنوز خریدی ثبت نکرده‌اید."
          />
        </Tab>

        <Tab eventKey="sales" title={`فروش‌های من${sales.length ? ` (${sales.length})` : ''}`}>
          <OrdersTable
            orders={sales}
            type="sale"
            emptyMessage="هنوز فروشی نداشته‌اید."
          />
        </Tab>
      </Tabs>
    </Container>
  );
}

export default MyOrders;