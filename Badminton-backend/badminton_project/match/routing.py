# match/routing.py
from django.urls import re_path
from . import consumers
from .court_consumer import CourtConsumer

websocket_urlpatterns = [
    # ws://host/ws/match/1/?token=xxx
    re_path(r'ws/match/(?P<match_id>\d+)/$', consumers.MatchConsumer.as_asgi()),
    # New: court-level channel for break mode broadcasts
    # ws://host/ws/court/<slug>/
    re_path(r'ws/court/(?P<slug>[a-z0-9_-]+)/$', CourtConsumer.as_asgi()),
]