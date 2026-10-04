from rest_framework.test import APITestCase

from accounts.models import User

from .models import Notification, SupportTicket


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
