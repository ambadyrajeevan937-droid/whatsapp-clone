from django.contrib.auth.models import User
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth import authenticate
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import permission_classes


@api_view(['POST'])
def register(request):

    username = request.data.get('username')
    password = request.data.get('password')

    if not username or not password:
        return Response({'error': 'Username and password are required.'}, status=status.HTTP_400_BAD_REQUEST)


    if User.objects.filter(username=username).exists():
        return Response({'error': 'Username already exists.'}, status=status.HTTP_400_BAD_REQUEST)



    user = User.objects.create_user(username=username, password=password)

    return Response({'message': 'User registered successfully.'}, status=status.HTTP_201_CREATED)



@api_view(['POST'])
def login(request):

    username = request.data.get('username')
    password = request.data.get('password')

    user = authenticate(
        username=username,
        password=password
    )

    if user is None:
        return Response(
            {'error': 'Invalid username or password'},
            status=status.HTTP_401_UNAUTHORIZED
        )

    refresh = RefreshToken.for_user(user)

    return Response({
        'message': 'Login successful',
        'user_id': user.id,
        'username': user.username,
        'access': str(refresh.access_token),
        'refresh': str(refresh),
    })




@api_view(['GET'])
@permission_classes([IsAuthenticated])
def users_list(request):

    users = User.objects.exclude(id=request.user.id)

    data = []

    for user in users:
        data.append({
            'id': user.id,
            'username': user.username,
        })

    return Response(data)

