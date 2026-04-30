# main_project/urls.py (your main project's urls.py)

from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)

urlpatterns = [
    # Django admin
    path('admin/', admin.site.urls),
    
    # Badminton app URLs
    path('', include('match.urls')),
    
    # Alternative: if you want to prefix all badminton URLs
    # path('badminton/', include('badminton_app.urls')),
    
    # DRF browsable API authentication (optional)
    path('api-auth/', include('rest_framework.urls')),

    # JWT Auth Endpoints
    path('api/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
]

# Serve media files during development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)