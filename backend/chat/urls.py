from django.urls import path
from .views import send_message, get_messages

urlpatterns = [
    path('send/', send_message),
    path('<int:user_id>/', get_messages),
]