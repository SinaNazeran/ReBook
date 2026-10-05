import { useState, useEffect } from 'react';
import { Container, Row, Col, Button, Accordion } from 'react-bootstrap';
import Form from '../components/Form';
import { toast } from 'react-toastify';
import { notificationAPI, getErrorMessage } from '../services/api';
import Loading from '../components/Loading';
import StatusMark from '../components/StatusMark';

const TICKET_STATUS = {
  open: { tone: 'waiting', label: 'در انتظار پاسخ' },
  in_progress: { tone: 'waiting', label: 'در حال بررسی' },
  closed: { tone: 'done', label: 'بسته شد' },
};

const formatDate = (value) =>
  new Date(value).toLocaleDateString('fa-IR', { month: 'long', day: 'numeric', year: 'numeric' });

function Support() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [formData, setFormData] = useState({ subject: '', message: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let ignore = false;
    notificationAPI
      .getMyTickets()
      .then((response) => {
        if (!ignore) setTickets(response.data.results ?? response.data);
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

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setFieldErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const errors = {};
    if (!formData.subject.trim()) errors.subject = 'موضوع را در یک خط بنویس.';
    if (!formData.message.trim()) errors.message = 'پیامت را بنویس.';
    if (errors.subject || errors.message) {
      setFieldErrors(errors);
      document.getElementById(errors.subject ? 'subject' : 'message')?.focus();
      return;
    }

    setSubmitting(true);
    try {
      const response = await notificationAPI.createTicket({
        subject: formData.subject.trim(),
        message: formData.message.trim(),
      });
      toast.success('پیامت رسید؛ پاسخ را همین‌جا می‌بینی.');
      setFormData({ subject: '', message: '' });
      setTickets((prev) => [response.data, ...prev]);
    } catch (error) {
      const data = error.response?.data;
      if (data && typeof data === 'object' && (data.subject || data.message)) {
        setFieldErrors({ subject: data.subject?.[0], message: data.message?.[0] });
      } else {
        toast.error(getErrorMessage(error));
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Loading fullPage />;

  return (
    <Container className="ledger-page">
      <title>پشتیبانی | ری‌بوک</title>
      <header className="ledger-header">
        <div>
          <h1 className="ledger-title">پشتیبانی</h1>
          <p className="sell-lead mt-2 mb-0">
            سؤال درباره‌ی سفارش، پرداخت یا آگهی‌ات را بپرس؛ پاسخ تیم ری‌بوک در همین صفحه می‌آید.
          </p>
        </div>
      </header>

      <Row className="g-4 g-lg-5">
        <Col lg={5}>
          <Form onSubmit={handleSubmit} noValidate className="support-form" aria-labelledby="new-ticket-title">
            <h2 id="new-ticket-title" className="support-heading">
              پیام تازه
            </h2>
            <Form.Group controlId="subject" className="mb-3">
              <Form.Label>موضوع</Form.Label>
              <Form.Control
                name="subject"
                value={formData.subject}
                onChange={handleChange}
                maxLength={200}
                placeholder="مثلاً: آگهی‌ام تأیید نشد"
                required
                aria-required="true"
                isInvalid={!!fieldErrors.subject}
              />
              <Form.Control.Feedback type="invalid">{fieldErrors.subject}</Form.Control.Feedback>
            </Form.Group>

            <Form.Group controlId="message" className="mb-3">
              <Form.Label>پیام</Form.Label>
              <Form.Control
                as="textarea"
                rows={6}
                name="message"
                value={formData.message}
                onChange={handleChange}
                placeholder="اگر درباره‌ی سفارش است، شماره‌ی سفارش یا نام کتاب را هم بنویس."
                required
                aria-required="true"
                isInvalid={!!fieldErrors.message}
              />
              <Form.Control.Feedback type="invalid">{fieldErrors.message}</Form.Control.Feedback>
            </Form.Group>

            <Button type="submit" variant="primary" disabled={submitting}>
              {submitting ? 'در حال ارسال...' : 'ارسال پیام'}
            </Button>
          </Form>
        </Col>

        <Col lg={7}>
          <section aria-labelledby="tickets-title">
            <h2 id="tickets-title" className="support-heading">
              پیام‌های من
            </h2>

            {loadError ? (
              <div className="list-state" role="alert">
                <p>پیام‌هایت بارگذاری نشدند. اتصال اینترنت را بررسی کن و دوباره امتحان کن.</p>
                <Button variant="outline-secondary" onClick={handleRetry}>
                  تلاش دوباره
                </Button>
              </div>
            ) : tickets.length === 0 ? (
              <div className="list-state">
                <p>هنوز پیامی نفرستاده‌ای. هر پیامی که بفرستی با وضعیت و پاسخش اینجا می‌ماند.</p>
              </div>
            ) : (
              <Accordion className="ticket-list">
                {tickets.map((ticket) => {
                  const status = TICKET_STATUS[ticket.status] ?? { tone: 'closed', label: ticket.status };
                  return (
                    <Accordion.Item key={ticket.id} eventKey={String(ticket.id)}>
                      <Accordion.Header>
                        <span className="ticket-head">
                          <span className="ticket-subject">
                            <bdi>{ticket.subject}</bdi>
                            <span className="ticket-date">{formatDate(ticket.created_at)}</span>
                          </span>
                          <StatusMark tone={status.tone}>{status.label}</StatusMark>
                        </span>
                      </Accordion.Header>
                      <Accordion.Body>
                        <p className="ticket-message" dir="auto">
                          {ticket.message}
                        </p>
                        {ticket.admin_reply ? (
                          <div className="ticket-reply">
                            <p className="ticket-reply-label">پاسخ پشتیبانی</p>
                            <p className="ticket-message" dir="auto">
                              {ticket.admin_reply}
                            </p>
                          </div>
                        ) : (
                          <p className="ledger-note mb-0">هنوز پاسخی نیامده.</p>
                        )}
                      </Accordion.Body>
                    </Accordion.Item>
                  );
                })}
              </Accordion>
            )}
          </section>
        </Col>
      </Row>
    </Container>
  );
}

export default Support;
