"""
ASGI config for badminton_project project.

It exposes the ASGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/5.2/howto/deployment/asgi/
"""

import os

from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'badminton_project.settings')

django_asgi_app = get_asgi_application()

from channels.routing import ProtocolTypeRouter, URLRouter
from channels.security.websocket import AllowedHostsOriginValidator
from match.routing import websocket_urlpatterns
 
application = ProtocolTypeRouter({
    # Standard HTTP requests go through Django as normal
    "http": django_asgi_app,
 
    # WebSocket requests are routed through our consumer
    # AllowedHostsOriginValidator checks the Origin header against ALLOWED_HOSTS
    # so we get basic CSRF-style protection for WS connections.
    "websocket": AllowedHostsOriginValidator(
        URLRouter(websocket_urlpatterns)
    ),
})