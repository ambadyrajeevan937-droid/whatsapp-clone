from django.contrib.auth.models import User

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from .models import Message


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def send_message(request):

    receiver_id = request.data.get('receiver_id')
    content = request.data.get('content')

    if not receiver_id or not content:
        return Response(
            {'error': 'Receiver and message are required.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        receiver = User.objects.get(id=receiver_id)
    except User.DoesNotExist:
        return Response(
            {'error': 'Receiver not found.'},
            status=status.HTTP_404_NOT_FOUND
        )

    message = Message.objects.create(
        sender=request.user,
        receiver=receiver,
        content=content
    )

    return Response({
        'id': message.id,
        'sender': message.sender.username,
        'receiver': message.receiver.username,
        'content': message.content,
        'created_at': message.created_at,
        'is_read': message.is_read,
    }, status=status.HTTP_201_CREATED)



@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_messages(request, user_id):

    try:
        other_user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return Response(
            {'error': 'User not found.'},
            status=status.HTTP_404_NOT_FOUND
        )

    messages = Message.objects.filter(
        sender__in=[request.user, other_user],
        receiver__in=[request.user, other_user]
    ).order_by('created_at')

    data = []

    for message in messages:
        data.append({
            'id': message.id,
            'sender': message.sender.username,
            'receiver': message.receiver.username,
            'content': message.content,
            'created_at': message.created_at,
            'is_read': message.is_read,
        })

    return Response(data)