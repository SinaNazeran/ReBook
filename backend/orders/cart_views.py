from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from books.models import Book
from books.views import visible_books
from orders import cart
from orders.request_serializers import CartAddSerializer


@method_decorator(csrf_protect, name="dispatch")
class CartView(APIView):
    """سبد خرید؛ برای مهمان هم کار می‌کند"""

    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "cart"

    def get(self, request):
        return Response(cart.cart_payload(request))

    def post(self, request):
        serializer = CartAddSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            book = visible_books(request.user).get(pk=serializer.validated_data["book"])
        except Book.DoesNotExist:
            return Response({"detail": "کتاب یافت نشد."}, status=status.HTTP_404_NOT_FOUND)

        ids = cart.get_ids(request)
        if book.pk not in ids:
            reason = cart.unavailable_reason(book, request.user, cart.pending_buyers([book.pk]))
            if reason:
                return Response(
                    {"detail": f"این کتاب را نمی‌شود به سبد اضافه کرد: {reason}."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if len(ids) >= cart.MAX_ITEMS:
                return Response(
                    {"detail": "سبد پر است؛ اول چند کتاب را بخر یا از سبد بردار."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            cart.add(request, book)
        return Response(cart.cart_payload(request))



@method_decorator(csrf_protect, name="dispatch")
class CartItemView(APIView):
    """برداشتن یک نسخه از سبد"""

    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "cart"

    def delete(self, request, book_id):
        cart.remove(request, [book_id])
        return Response(cart.cart_payload(request))

