from django.test import TestCase

from accounts.models import User
from books.models import Book
from notifications.models import Notification


class AdminReviewNotificationTests(TestCase):
    # تأیید و رد فقط در پنل مدیریت انجام می‌شود؛ هر دو مسیر ذخیره باید به فروشنده خبر بدهند
    @classmethod
    def setUpTestData(cls):
        cls.admin = User.objects.create_superuser(username="admin", password="pass")
        cls.seller = User.objects.create_user(username="seller", password="pass")

    def setUp(self):
        self.client.force_login(self.admin)
        self.book = Book.objects.create(title="سمفونی مردگان", author="a", price=100, seller=self.seller)

    def save_in_change_form(self, status):
        data = {
            "title": self.book.title,
            "author": self.book.author,
            "price": self.book.price,
            "condition": self.book.condition,
            "status": status,
            "seller": self.seller.pk,
            "_save": "ذخیره",
        }
        response = self.client.post(f"/admin/books/book/{self.book.pk}/change/", data)
        self.assertEqual(response.status_code, 302)

    def save_in_list(self, status):
        data = {
            "form-TOTAL_FORMS": "1",
            "form-INITIAL_FORMS": "1",
            "form-MIN_NUM_FORMS": "0",
            "form-MAX_NUM_FORMS": "1000",
            "form-0-id": self.book.pk,
            "form-0-status": status,
            "_save": "ذخیره",
        }
        response = self.client.post("/admin/books/book/", data)
        self.assertEqual(response.status_code, 302)

    def notices(self):
        return list(Notification.objects.filter(user=self.seller).values_list("notification_type", "book_id", "message"))

    def test_approving_in_change_form_notifies_seller_once(self):
        self.save_in_change_form("approved")
        self.book.refresh_from_db()
        self.assertEqual(self.book.status, "approved")
        [(kind, book_id, message)] = self.notices()
        self.assertEqual((kind, book_id), ("book_approved", self.book.pk))
        self.assertIn("«سمفونی مردگان»", message)

    def test_rejecting_in_list_notifies_seller_once(self):
        self.save_in_list("rejected")
        [(kind, book_id, message)] = self.notices()
        self.assertEqual((kind, book_id), ("book_rejected", self.book.pk))
        self.assertIn("پشتیبانی", message)

    def test_rejected_book_approved_later_gets_a_second_notice(self):
        self.save_in_list("rejected")
        self.save_in_list("approved")
        self.assertEqual([n[0] for n in self.notices()], ["book_approved", "book_rejected"])

    def test_saving_without_a_status_change_sends_nothing(self):
        Book.objects.filter(pk=self.book.pk).update(status="approved")
        self.book.refresh_from_db()
        self.save_in_change_form("approved")
        self.save_in_list("approved")
        self.assertEqual(self.notices(), [])

    def test_moving_back_to_pending_sends_nothing(self):
        Book.objects.filter(pk=self.book.pk).update(status="approved")
        self.save_in_list("pending")
        self.assertEqual(self.notices(), [])

