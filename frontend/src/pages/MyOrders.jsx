import PageMetadata from '../components/PageMetadata.jsx';
import { usePagedList } from '../hooks/usePagedList';
import OrderCollection from '../components/OrderCollection';
import { useState } from 'react';
import { Container, Tabs, Tab } from 'react-bootstrap';
import { useSearchParams } from 'react-router-dom';
import { toast } from '../utils/toast';
import { orderAPI, getErrorMessage } from '../services/api';
import PurchaseModal from '../components/PurchaseModal';


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

  const purchaseList = usePagedList(orderAPI.getMyOrders);
  const saleList = usePagedList(orderAPI.getMySales);
  const [busyId, setBusyId] = useState(null); // سفارشی که لغوش در جریان است
  const [payingOrder, setPayingOrder] = useState(null);

  const refreshAll = () => Promise.all([purchaseList.refresh(), saleList.refresh()]);

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


  const tabTitle = (label, count) => (count ? `${label} (${count.toLocaleString('fa-IR')})` : label);

  return (
    <div className="series-paper">
      <Container className="ledger-page">
        <PageMetadata title="معاملات من | ری‌بوک" />
        <header className="ledger-header">
          <h1 className="ledger-title">معاملات من</h1>
        </header>

        <Tabs activeKey={activeTab} onSelect={handleTabSelect} variant="underline" className="ledger-tabs">
          <Tab eventKey="purchases" title={tabTitle('خریدهای من', purchaseList.count)}>
            <OrderCollection list={purchaseList} type="purchase" onPay={setPayingOrder}
              onCancel={handleCancel} busyId={busyId} />
          </Tab>
          <Tab eventKey="sales" title={tabTitle('فروش‌های من', saleList.count)}>
            <OrderCollection list={saleList} type="sale" onCancel={handleCancel} busyId={busyId} />
          </Tab>
        </Tabs>

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
    </div>
  );
}

export default MyOrders;
