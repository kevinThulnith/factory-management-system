from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
    TokenBlacklistView,
)
from main.views import UserCreateView, UserDetailView, UserInfoView
from django.urls import path, include
from django.contrib import admin

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/user/", UserInfoView.as_view(), name="user_info"),
    path("api/user/<int:pk>/", UserDetailView.as_view(), name="user_detail"),
    path("api/user/register/", UserCreateView.as_view(), name="register"),
    path("api/token/", TokenObtainPairView.as_view(), name="get_token"),
    path("api/token/refresh/", TokenRefreshView.as_view(), name="refresh_token"),
    path("api/token/blacklist/", TokenBlacklistView.as_view(), name="blacklist_token"),
    path("api-auth/", include("rest_framework.urls")),
    # !App URLs
    path("api/", include("api.urls")),
]
