from django.urls import path

from . import views

urlpatterns = [
    # دسته‌بندی‌ها
    path("categories/", views.CategoryListView.as_view(), name="category-list"),
    # کتاب‌ها
    path("", views.BookListView.as_view(), name="book-list"),
    path("<int:pk>/", views.BookDetailView.as_view(), name="book-detail"),
    path("create/", views.BookCreateView.as_view(), name="book-create"),
    path("my-books/", views.MyBooksView.as_view(), name="my-books"),
    path("<int:pk>/update/", views.BookUpdateView.as_view(), name="book-update"),
    path("<int:pk>/delete/", views.BookDeleteView.as_view(), name="book-delete"),
    # علاقه‌مندی‌ها
    path("wishlist/", views.WishlistView.as_view(), name="wishlist"),
    path(
        "<int:book_id>/wishlist-toggle/",
        views.WishlistToggleView.as_view(),
        name="wishlist-toggle",
    ),
]
