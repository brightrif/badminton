# match/routing.py
from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    # ws://host/ws/match/1/?token=xxx
    re_path(r'ws/match/(?P<match_id>\d+)/$', consumers.MatchConsumer.as_asgi()),
]