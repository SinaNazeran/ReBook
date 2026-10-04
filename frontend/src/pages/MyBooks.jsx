import { useState, useEffect } from 'react';
import { Container, Card, Badge, Button, Table } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { bookAPI, getErrorMessage } from '../services/api';
import Loading from '../components/Loading';
import { FiPlus, FiTrash2, FiInbox } from 'react-icons/fi';

const STATUS_MAP = {
  pending: { text: 'در انتظار تأیید', className: 'status-pending' },
  approved: { text: 'تأیید شده', className: 'status-approved' },
  rejected: { text: 'رد شده', className: 'status-rejected' },
  sold: { text: 'فروخته شده', className: 'status-sold' },
};

function MyBooks() {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    const fetchMyBooks = async () => {
      try {
        const response = await bookAPI.getMyBooks();
        setBooks(response.data.results ?? response.data);
      } catch (error) {
        toast.error(getErrorMessage(error));
      } finally {
        setLoading(false);
      }
    };
    fetchMyBooks();
  }, []);

  const handleDelete = async (bookId) => {
    if (!window.confirm('آیا از حذف این کتاب مطمئن هستید؟')) return;

    setDeletingId(bookId);
    try {
      await bookAPI.deleteBook(bookId);
      setBooks((prev) => prev.filter((b) => b.id !== bookId));
      toast.success('کتاب حذف شد.');
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) return <Loading fullPage />;

  return (
    <Container className="py-5">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="h3 mb-0">کتاب‌های من</h1>
        <Link to="/create-book" className="btn btn-primary d-inline-flex align-items-center gap-2">
          <FiPlus />
          ثبت کتاب جدید
        </Link>
      </div>

      {books.length === 0 ? (
        <Card className="text-center py-5 border-0 shadow-sm">
          <Card.Body>
            <FiInbox size={64} className="text-muted" aria-hidden="true" />
            <h2 className="h5 mt-3">هنوز کتابی ثبت نکرده‌اید</h2>
            <Link to="/create-book" className="btn btn-primary mt-3">
              ثبت اولین کتاب
            </Link>
          </Card.Body>
        </Card>
      ) : (
        <Card className="shadow-sm border-0">
          <Table responsive hover className="mb-0 align-middle">
            <thead className="table-light">
              <tr>
                <th>عنوان</th>
                <th>نویسنده</th>
                <th>قیمت</th>
                <th>وضعیت</th>
                <th>تاریخ ثبت</th>
                <th>عملیات</th>
              </tr>
            </thead>
            <tbody>
              {books.map((book) => {
                const status = STATUS_MAP[book.status] || { text: book.status, className: 'status-sold' };
                return (
                  <tr key={book.id}>
                    <td>
                      <Link to={`/books/${book.id}`}>{book.title}</Link>
                    </td>
                    <td>{book.author}</td>
                    <td>{Number(book.price).toLocaleString('fa-IR')} تومان</td>
                    <td>
                      <Badge bg="" className={status.className}>{status.text}</Badge>
                    </td>
                    <td>{new Date(book.created_at).toLocaleDateString('fa-IR')}</td>
                    <td>
                      {book.status !== 'sold' && (
                        <Button
                          variant="outline-danger"
                          size="sm"
                          onClick={() => handleDelete(book.id)}
                          disabled={deletingId === book.id}
                          aria-label={`حذف کتاب ${book.title}`}
                        >
                          <FiTrash2 />
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Card>
      )}
    </Container>
  );
}

export default MyBooks;