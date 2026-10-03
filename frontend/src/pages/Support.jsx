import { useState, useEffect } from 'react';
import { Container, Row, Col, Form, Button, Card, Badge, Accordion } from 'react-bootstrap';
import { toast } from 'react-toastify';
import { notificationAPI, getErrorMessage } from '../services/api';
import Loading from '../components/Loading';
import { FiHelpCircle, FiInbox } from 'react-icons/fi';

const STATUS_MAP = {
  open: { text: 'باز', className: 'ticket-status-open' },
  in_progress: { text: 'در حال بررسی', className: 'ticket-status-in_progress' },
  closed: { text: 'بسته شده', className: 'ticket-status-closed' },
};

function Support() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({ subject: '', message: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchTickets = async () => {
      try {
        const response = await notificationAPI.getMyTickets();
        setTickets(response.data.results ?? response.data);
      } catch (error) {
        toast.error(getErrorMessage(error));
      } finally {
        setLoading(false);
      }
    };
    fetchTickets();
  }, []);

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.subject.trim() || !formData.message.trim()) {
      toast.warning('لطفاً موضوع و متن پیام را کامل وارد کنید.');
      return;
    }

    setSubmitting(true);
    try {
      await notificationAPI.createTicket({
        subject: formData.subject.trim(),
        message: formData.message.trim(),
      });
      toast.success('تیکت شما با موفقیت ارسال شد.');
      setFormData({ subject: '', message: '' });

      // رفرش لیست تیکت‌ها
      const response = await notificationAPI.getMyTickets();
      setTickets(response.data.results ?? response.data);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Loading fullPage />;

  return (
    <Container className="py-5">
      <h1 className="h3 mb-4 d-flex align-items-center gap-2">
        <FiHelpCircle />
        پشتیبانی
      </h1>

      <Row className="g-4">
        {/* فرم ارسال تیکت */}
        <Col md={5}>
          <Card className="shadow-sm border-0">
            <Card.Body className="p-4">
              <h2 className="h5 mb-3">ارسال تیکت جدید</h2>
              <Form onSubmit={handleSubmit} noValidate>
                <Form.Group className="mb-3">
                  <Form.Label htmlFor="subject">موضوع</Form.Label>
                  <Form.Control
                    id="subject"
                    type="text"
                    name="subject"
                    value={formData.subject}
                    onChange={handleChange}
                    placeholder="مثال: مشکل در ثبت سفارش"
                    required
                  />
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label htmlFor="message">متن پیام</Form.Label>
                  <Form.Control
                    id="message"
                    as="textarea"
                    rows={5}
                    name="message"
                    value={formData.message}
                    onChange={handleChange}
                    placeholder="مشکل یا سؤال خود را با جزئیات شرح دهید..."
                    required
                  />
                </Form.Group>

                <Button type="submit" className="btn-primary w-100" disabled={submitting}>
                  {submitting ? 'در حال ارسال...' : 'ارسال تیکت'}
                </Button>
              </Form>
            </Card.Body>
          </Card>
        </Col>

        {/* لیست تیکت‌ها */}
        <Col md={7}>
          <Card className="shadow-sm border-0">
            <Card.Body className="p-4">
              <h2 className="h5 mb-3">تیکت‌های من</h2>

              {tickets.length === 0 ? (
                <div className="text-center py-4">
                  <FiInbox size={48} className="text-muted" aria-hidden="true" />
                  <p className="text-muted mt-3 mb-0">تیکتی ارسال نشده است.</p>
                </div>
              ) : (
                <Accordion>
                  {tickets.map((ticket, index) => {
                    const status = STATUS_MAP[ticket.status] || {
                      text: ticket.status,
                      className: 'ticket-status-closed',
                    };
                    return (
                      <Accordion.Item key={ticket.id} eventKey={String(index)}>
                        <Accordion.Header>
                          <div className="d-flex justify-content-between align-items-center w-100 me-3">
                            <span>{ticket.subject}</span>
                            <Badge className={status.className}>{status.text}</Badge>
                          </div>
                        </Accordion.Header>
                        <Accordion.Body>
                          <p className="mb-1">
                            <strong>پیام شما:</strong>
                          </p>
                          <p className="text-muted">{ticket.message}</p>

                          {ticket.admin_reply && (
                            <>
                              <hr />
                              <p className="mb-1">
                                <strong>پاسخ پشتیبانی:</strong>
                              </p>
                              <p style={{ color: 'var(--rb-success)' }}>{ticket.admin_reply}</p>
                            </>
                          )}

                          <small className="text-muted">
                            {new Date(ticket.created_at).toLocaleDateString('fa-IR')}
                          </small>
                        </Accordion.Body>
                      </Accordion.Item>
                    );
                  })}
                </Accordion>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}

export default Support;