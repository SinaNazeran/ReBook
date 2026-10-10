from django.core.cache import cache
from rest_framework.test import APIClient, APITestCase

from accounts.models import User

from .models import ContactMessage, Notification, SupportTicket


class PersonalListsTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="u", password="pass")
        other = User.objects.create_user(username="other", password="pass")
        # ۱۵ اعلان (بیشتر از PAGE_SIZE)، ۱۴ تا خوانده‌نشده؛ اعلان کاربر دیگر نباید شمرده شود
        Notification.objects.bulk_create(
            Notification(user=self.user, title=f"n{i}", message="m", is_read=(i == 0))
            for i in range(15)
        )
        Notification.objects.create(user=other, title="x", message="m")
        SupportTicket.objects.bulk_create(
            SupportTicket(user=self.user, subject=f"s{i}", message="m") for i in range(15)
        )
        self.client.force_authenticate(self.user)

    def test_notifications_list_is_not_cut_at_one_page(self):
        response = self.client.get("/api/notifications/")
        self.assertEqual(len(response.data), 15)

    def test_unread_count_counts_only_own_unread(self):
        response = self.client.get("/api/notifications/unread-count/")
        self.assertEqual(response.data, {"count": 14})

    def test_support_tickets_list_is_not_cut_at_one_page(self):
        response = self.client.get("/api/notifications/support/")
        self.assertEqual(len(response.data), 15)


class ContactMessageTests(APITestCase):
    def setUp(self):
        cache.clear()  # throttle «contact» در LocMem

    def send(self, **extra):
        data = {
            "name": "سارا",
            "email": "sara@example.com",
            "subject": "سؤال درباره‌ی ارسال",
            "message": "این یک پیام آزمایشی است.",
            **extra,
        }
        return self.client.post("/api/notifications/contact/", data)

    def test_guest_can_send_a_message(self):
        response = self.send()
        self.assertEqual(response.status_code, 201)
        message = ContactMessage.objects.get()
        self.assertEqual((message.email, message.is_handled), ("sara@example.com", False))

    def test_requires_csrf_token(self):
        client = APIClient(enforce_csrf_checks=True)
        data = {"name": "سارا", "email": "sara@example.com", "subject": "سؤال", "message": "این یک پیام آزمایشی است."}
        self.assertEqual(client.post("/api/notifications/contact/", data).status_code, 403)

        client.get("/api/accounts/csrf/")
        token = client.cookies["csrftoken"].value
        self.assertEqual(client.post("/api/notifications/contact/", data, HTTP_X_CSRFTOKEN=token).status_code, 201)

    def test_invalid_input_is_rejected(self):
        for extra in ({"email": "not-an-email"}, {"message": "کوتاه"}, {"message": "            "}, {"name": ""}):
            with self.subTest(extra=extra):
                response = self.send(**extra)
                self.assertEqual(response.status_code, 400)
                self.assertIn(next(iter(extra)), response.data)
        self.assertFalse(ContactMessage.objects.exists())

    def test_eleventh_message_in_an_hour_is_throttled(self):
        for _ in range(10):
            self.assertEqual(self.send().status_code, 201)
        self.assertEqual(self.send().status_code, 429)
