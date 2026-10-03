from django.urls import path

from . import views

urlpatterns = [
    path("create/", views.OrderCreateView.as_view(), name="order-create"),
    path("my-orders/", views.MyOrdersView.as_view(), name="my-orders"),
    path("my-sales/", views.MySalesView.as_view(), name="my-sales"),
    path("<int:pk>/", views.OrderDetailView.as_view(), name="order-detail"),
    path("<int:order_id>/pay/", views.FakePaymentView.as_view(), name="fake-payment"),
]
