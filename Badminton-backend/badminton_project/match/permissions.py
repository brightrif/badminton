from rest_framework.permissions import BasePermission, SAFE_METHODS

class IsDirectorOrReadOnly(BasePermission):
    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True  # GET is open (big screen needs it)
        if not request.user or not request.user.is_authenticated:
            return False
        return request.user.groups.filter(name='directors').exists() or request.user.is_staff