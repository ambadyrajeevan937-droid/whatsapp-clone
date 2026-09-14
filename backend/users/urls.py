from django.urls import path
from .views import register, login, users_list

urlpatterns = [
    path('register/', register),
    path('login/', login),
    path('list/', users_list),
]