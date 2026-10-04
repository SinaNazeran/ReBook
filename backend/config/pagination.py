from rest_framework.pagination import PageNumberPagination


class StandardPagination(PageNumberPagination):
    """صفحه‌بندی پیش‌فرض (۱۲ مورد) با امکان درخواست چند صفحه یکجا

    فرانت‌اند با ?page_size=۱۲×N چند صفحهٔ اول را در یک درخواست بازیابی می‌کند
    (مثلاً وقتی لینک /books?page=3 مستقیم باز می‌شود).
    """

    page_size_query_param = "page_size"
    max_page_size = 120
