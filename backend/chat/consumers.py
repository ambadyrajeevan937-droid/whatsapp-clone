import json

from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async

from django.contrib.auth.models import User
from .models import Message


class ChatConsumer(AsyncWebsocketConsumer):

    async def connect(self):
        self.user_id = self.scope["url_route"]["kwargs"]["user_id"]

        # Current logged-in user ID
        self.sender_id = self.scope["query_string"].decode().replace(
            "sender_id=",
            ""
        )

        # Create same room for both users
        user_ids = sorted([
            int(self.sender_id),
            int(self.user_id)
        ])

        self.room_group_name = f"chat_{user_ids[0]}_{user_ids[1]}"

        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )

        await self.accept()

        # Mark unread messages as read
        read_message_ids = await self.mark_messages_as_read(
            self.user_id,
            self.sender_id
        )

        # Notify sender that messages were read
        if read_message_ids:
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    "type": "messages_read",
                    "message_ids": read_message_ids,
                    "reader_id": int(self.sender_id),
                }
            )

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )

    async def receive(self, text_data):
        data = json.loads(text_data)

        message_text = data.get("message", "").strip()

        if not message_text:
            return

        saved_message = await self.save_message(
            self.sender_id,
            self.user_id,
            message_text
        )

        # Send new message to both users
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                "type": "chat_message",
                "message": message_text,
                "sender_id": int(self.sender_id),
                "message_id": saved_message["id"],
            }
        )

    async def chat_message(self, event):
        await self.send(
            text_data=json.dumps({
                "type": "chat_message",
                "id": event["message_id"],
                "message": event["message"],
                "sender_id": event["sender_id"],
            })
        )

    async def messages_read(self, event):
        await self.send(
            text_data=json.dumps({
                "type": "messages_read",
                "message_ids": event["message_ids"],
                "reader_id": event["reader_id"],
            })
        )

    @database_sync_to_async
    def mark_messages_as_read(self, receiver_id, sender_id):

        messages = Message.objects.filter(
            sender_id=receiver_id,
            receiver_id=sender_id,
            is_read=False
        )

        message_ids = list(
            messages.values_list("id", flat=True)
        )

        messages.update(is_read=True)

        return message_ids

    @database_sync_to_async
    def save_message(self, sender_id, receiver_id, content):

        sender = User.objects.get(id=sender_id)
        receiver = User.objects.get(id=receiver_id)

        message = Message.objects.create(
            sender=sender,
            receiver=receiver,
            content=content
        )

        return {
            "id": message.id
        }