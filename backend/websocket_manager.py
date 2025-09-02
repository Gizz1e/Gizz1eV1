import asyncio
import json
import logging
from typing import Dict, Set, Optional, List, Any
from fastapi import WebSocket, WebSocketDisconnect
from enum import Enum
from datetime import datetime, timezone
from dataclasses import dataclass, asdict
import uuid

logger = logging.getLogger(__name__)

class MessageType(Enum):
    # WebRTC Signaling
    OFFER = "offer"
    ANSWER = "answer"
    ICE_CANDIDATE = "ice_candidate"
    
    # Stream Management
    CREATE_STREAM = "create_stream"
    JOIN_STREAM = "join_stream"
    LEAVE_STREAM = "leave_stream"
    STREAM_STARTED = "stream_started"
    STREAM_ENDED = "stream_ended"
    
    # Chat
    CHAT_MESSAGE = "chat_message"
    
    # User Events
    USER_JOINED = "user_joined"
    USER_LEFT = "user_left"
    
    # Tips/Payments
    TIP_SENT = "tip_sent"
    
    # System
    ERROR = "error"
    SUCCESS = "success"

@dataclass
class WebSocketMessage:
    type: MessageType
    data: Dict[str, Any]
    sender_id: str
    target_id: Optional[str] = None
    stream_id: Optional[str] = None
    timestamp: Optional[str] = None
    message_id: Optional[str] = None

class WebSocketConnection:
    def __init__(self, websocket: WebSocket, user_id: str, connection_id: str):
        self.websocket = websocket
        self.user_id = user_id
        self.connection_id = connection_id
        self.connected_at = datetime.now(timezone.utc)
        self.last_activity = datetime.now(timezone.utc)
        self.current_stream_id: Optional[str] = None
        self.webrtc_connection_id: Optional[str] = None

class ChatMessage:
    def __init__(self, message_id: str, user_id: str, content: str, stream_id: str):
        self.message_id = message_id
        self.user_id = user_id
        self.content = content
        self.stream_id = stream_id
        self.timestamp = datetime.now(timezone.utc)
        self.is_deleted = False

class WebSocketManager:
    def __init__(self):
        # Active WebSocket connections
        self.connections: Dict[str, WebSocketConnection] = {}  # connection_id -> WebSocketConnection
        
        # User to connection mapping (for quick lookups)
        self.user_connections: Dict[str, str] = {}  # user_id -> connection_id
        
        # Stream rooms (stream_id -> set of connection_ids)
        self.stream_rooms: Dict[str, Set[str]] = {}
        
        # Chat messages (stream_id -> list of ChatMessage)
        self.chat_history: Dict[str, List[ChatMessage]] = {}
        
        # Rate limiting
        self.message_counts: Dict[str, Dict[str, int]] = {}  # connection_id -> {timestamp: count}
        
    async def connect(self, websocket: WebSocket, user_id: str) -> str:
        """Accept WebSocket connection and return connection ID"""
        try:
            await websocket.accept()
            
            connection_id = str(uuid.uuid4())
            
            # Close existing connection if user is already connected
            if user_id in self.user_connections:
                old_conn_id = self.user_connections[user_id]
                await self.disconnect(old_conn_id, reason="New connection established")
            
            connection = WebSocketConnection(websocket, user_id, connection_id)
            self.connections[connection_id] = connection
            self.user_connections[user_id] = connection_id
            
            logger.info(f"WebSocket connected: user {user_id}, connection {connection_id}")
            
            # Send connection confirmation
            await self.send_to_connection(connection_id, WebSocketMessage(
                type=MessageType.SUCCESS,
                data={"message": "Connected successfully", "connection_id": connection_id},
                sender_id="system"
            ))
            
            return connection_id
            
        except Exception as e:
            logger.error(f"Error connecting WebSocket: {str(e)}")
            raise
    
    async def disconnect(self, connection_id: str, reason: str = "Normal disconnect"):
        """Disconnect WebSocket connection"""
        try:
            if connection_id not in self.connections:
                return
            
            connection = self.connections[connection_id]
            
            # Leave any stream room
            await self.leave_stream_room(connection_id)
            
            # Close WebSocket
            try:
                await connection.websocket.close()
            except Exception as e:
                logger.debug(f"WebSocket already closed: {e}")
            
            # Clean up mappings
            if connection.user_id in self.user_connections:
                del self.user_connections[connection.user_id]
            
            del self.connections[connection_id]
            
            # Clean up rate limiting data
            if connection_id in self.message_counts:
                del self.message_counts[connection_id]
            
            logger.info(f"WebSocket disconnected: {connection_id}, reason: {reason}")
            
        except Exception as e:
            logger.error(f"Error disconnecting WebSocket: {str(e)}")
    
    async def send_to_connection(self, connection_id: str, message: WebSocketMessage):
        """Send message to specific WebSocket connection"""
        try:
            connection = self.connections.get(connection_id)
            if not connection:
                logger.warning(f"Connection {connection_id} not found")
                return False
            
            # Add timestamp and message ID if not present
            if not message.timestamp:
                message.timestamp = datetime.now(timezone.utc).isoformat()
            if not message.message_id:
                message.message_id = str(uuid.uuid4())
            
            message_json = json.dumps(asdict(message), default=str)
            await connection.websocket.send_text(message_json)
            
            # Update last activity
            connection.last_activity = datetime.now(timezone.utc)
            
            return True
            
        except Exception as e:
            logger.error(f"Error sending message to {connection_id}: {str(e)}")
            # Disconnect on error
            await self.disconnect(connection_id, "Send error")
            return False
    
    async def send_to_user(self, user_id: str, message: WebSocketMessage):
        """Send message to user by user ID"""
        connection_id = self.user_connections.get(user_id)
        if connection_id:
            return await self.send_to_connection(connection_id, message)
        return False
    
    async def broadcast_to_stream(self, stream_id: str, message: WebSocketMessage, exclude_connection: Optional[str] = None):
        """Broadcast message to all connections in a stream room"""
        if stream_id not in self.stream_rooms:
            return
        
        connections_to_send = self.stream_rooms[stream_id].copy()
        if exclude_connection:
            connections_to_send.discard(exclude_connection)
        
        # Send to all connections
        send_tasks = []
        for connection_id in connections_to_send:
            send_tasks.append(self.send_to_connection(connection_id, message))
        
        if send_tasks:
            await asyncio.gather(*send_tasks, return_exceptions=True)
    
    async def join_stream_room(self, connection_id: str, stream_id: str):
        """Add connection to stream room"""
        try:
            connection = self.connections.get(connection_id)
            if not connection:
                return False
            
            # Leave current stream room if any
            await self.leave_stream_room(connection_id)
            
            # Add to new stream room
            if stream_id not in self.stream_rooms:
                self.stream_rooms[stream_id] = set()
            
            self.stream_rooms[stream_id].add(connection_id)
            connection.current_stream_id = stream_id
            
            # Initialize chat history if needed
            if stream_id not in self.chat_history:
                self.chat_history[stream_id] = []
            
            # Notify other users in the stream
            await self.broadcast_to_stream(stream_id, WebSocketMessage(
                type=MessageType.USER_JOINED,
                data={"user_id": connection.user_id, "stream_id": stream_id},
                sender_id="system"
            ), exclude_connection=connection_id)
            
            logger.info(f"Connection {connection_id} joined stream room {stream_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error joining stream room: {str(e)}")
            return False
    
    async def leave_stream_room(self, connection_id: str):
        """Remove connection from current stream room"""
        try:
            connection = self.connections.get(connection_id)
            if not connection or not connection.current_stream_id:
                return
            
            stream_id = connection.current_stream_id
            
            # Remove from stream room
            if stream_id in self.stream_rooms:
                self.stream_rooms[stream_id].discard(connection_id)
                
                # Clean up empty rooms
                if not self.stream_rooms[stream_id]:
                    del self.stream_rooms[stream_id]
                    # Clean up chat history for empty rooms
                    if stream_id in self.chat_history:
                        del self.chat_history[stream_id]
            
            # Notify other users in the stream
            if stream_id in self.stream_rooms:
                await self.broadcast_to_stream(stream_id, WebSocketMessage(
                    type=MessageType.USER_LEFT,
                    data={"user_id": connection.user_id, "stream_id": stream_id},
                    sender_id="system"
                ))
            
            connection.current_stream_id = None
            logger.info(f"Connection {connection_id} left stream room {stream_id}")
            
        except Exception as e:
            logger.error(f"Error leaving stream room: {str(e)}")
    
    async def handle_message(self, connection_id: str, raw_message: str):
        """Process incoming WebSocket message"""
        try:
            connection = self.connections.get(connection_id)
            if not connection:
                logger.warning(f"Message from unknown connection: {connection_id}")
                return
            
            # Rate limiting check
            if not await self.check_rate_limit(connection_id):
                await self.send_to_connection(connection_id, WebSocketMessage(
                    type=MessageType.ERROR,
                    data={"message": "Rate limit exceeded"},
                    sender_id="system"
                ))
                return
            
            # Parse message
            try:
                message_data = json.loads(raw_message)
            except json.JSONDecodeError:
                await self.send_to_connection(connection_id, WebSocketMessage(
                    type=MessageType.ERROR,
                    data={"message": "Invalid JSON format"},
                    sender_id="system"
                ))
                return
            
            # Create WebSocketMessage object
            message = WebSocketMessage(
                type=MessageType(message_data["type"]),
                data=message_data.get("data", {}),
                sender_id=connection.user_id,
                target_id=message_data.get("target_id"),
                stream_id=message_data.get("stream_id")
            )
            
            # Route message based on type
            await self.route_message(connection_id, message)
            
            # Update last activity
            connection.last_activity = datetime.now(timezone.utc)
            
        except Exception as e:
            logger.error(f"Error handling message from {connection_id}: {str(e)}")
            await self.send_to_connection(connection_id, WebSocketMessage(
                type=MessageType.ERROR,
                data={"message": "Message processing failed"},
                sender_id="system"
            ))
    
    async def route_message(self, connection_id: str, message: WebSocketMessage):
        """Route message to appropriate handler"""
        handlers = {
            MessageType.OFFER: self.handle_webrtc_offer,
            MessageType.ANSWER: self.handle_webrtc_answer,
            MessageType.ICE_CANDIDATE: self.handle_ice_candidate,
            MessageType.JOIN_STREAM: self.handle_join_stream,
            MessageType.LEAVE_STREAM: self.handle_leave_stream,
            MessageType.CHAT_MESSAGE: self.handle_chat_message,
        }
        
        handler = handlers.get(message.type)
        if handler:
            await handler(connection_id, message)
        else:
            logger.warning(f"Unknown message type: {message.type}")
    
    async def handle_webrtc_offer(self, connection_id: str, message: WebSocketMessage):
        """Handle WebRTC offer message"""
        # Forward to target or broadcast to stream
        if message.target_id:
            await self.send_to_user(message.target_id, message)
        elif message.stream_id:
            await self.broadcast_to_stream(message.stream_id, message, exclude_connection=connection_id)
    
    async def handle_webrtc_answer(self, connection_id: str, message: WebSocketMessage):
        """Handle WebRTC answer message"""
        # Forward to target or broadcast to stream
        if message.target_id:
            await self.send_to_user(message.target_id, message)
        elif message.stream_id:
            await self.broadcast_to_stream(message.stream_id, message, exclude_connection=connection_id)
    
    async def handle_ice_candidate(self, connection_id: str, message: WebSocketMessage):
        """Handle ICE candidate message"""
        # Forward to target or broadcast to stream
        if message.target_id:
            await self.send_to_user(message.target_id, message)
        elif message.stream_id:
            await self.broadcast_to_stream(message.stream_id, message, exclude_connection=connection_id)
    
    async def handle_join_stream(self, connection_id: str, message: WebSocketMessage):
        """Handle join stream request"""
        stream_id = message.data.get("stream_id")
        if stream_id:
            success = await self.join_stream_room(connection_id, stream_id)
            
            if success:
                # Send recent chat history to new user
                await self.send_chat_history(connection_id, stream_id)
                
                await self.send_to_connection(connection_id, WebSocketMessage(
                    type=MessageType.SUCCESS,
                    data={"message": "Joined stream successfully", "stream_id": stream_id},
                    sender_id="system"
                ))
            else:
                await self.send_to_connection(connection_id, WebSocketMessage(
                    type=MessageType.ERROR,
                    data={"message": "Failed to join stream"},
                    sender_id="system"
                ))
    
    async def handle_leave_stream(self, connection_id: str, message: WebSocketMessage):
        """Handle leave stream request"""
        await self.leave_stream_room(connection_id)
        
        await self.send_to_connection(connection_id, WebSocketMessage(
            type=MessageType.SUCCESS,
            data={"message": "Left stream successfully"},
            sender_id="system"
        ))
    
    async def handle_chat_message(self, connection_id: str, message: WebSocketMessage):
        """Handle chat message"""
        connection = self.connections.get(connection_id)
        if not connection or not connection.current_stream_id:
            await self.send_to_connection(connection_id, WebSocketMessage(
                type=MessageType.ERROR,
                data={"message": "Not in a stream room"},
                sender_id="system"
            ))
            return
        
        content = message.data.get("content", "").strip()
        if not content:
            return
        
        # Create chat message
        chat_message = ChatMessage(
            message_id=str(uuid.uuid4()),
            user_id=connection.user_id,
            content=content,
            stream_id=connection.current_stream_id
        )
        
        # Store in chat history
        if connection.current_stream_id not in self.chat_history:
            self.chat_history[connection.current_stream_id] = []
        
        self.chat_history[connection.current_stream_id].append(chat_message)
        
        # Limit chat history to last 100 messages
        if len(self.chat_history[connection.current_stream_id]) > 100:
            self.chat_history[connection.current_stream_id] = self.chat_history[connection.current_stream_id][-100:]
        
        # Broadcast to stream room
        chat_data = {
            "message_id": chat_message.message_id,
            "user_id": chat_message.user_id,
            "content": chat_message.content,
            "timestamp": chat_message.timestamp.isoformat()
        }
        
        await self.broadcast_to_stream(connection.current_stream_id, WebSocketMessage(
            type=MessageType.CHAT_MESSAGE,
            data=chat_data,
            sender_id=connection.user_id,
            stream_id=connection.current_stream_id
        ))
    
    async def send_chat_history(self, connection_id: str, stream_id: str, limit: int = 50):
        """Send recent chat history to connection"""
        if stream_id not in self.chat_history:
            return
        
        recent_messages = self.chat_history[stream_id][-limit:]
        
        for chat_msg in recent_messages:
            if not chat_msg.is_deleted:
                chat_data = {
                    "message_id": chat_msg.message_id,
                    "user_id": chat_msg.user_id,
                    "content": chat_msg.content,
                    "timestamp": chat_msg.timestamp.isoformat()
                }
                
                await self.send_to_connection(connection_id, WebSocketMessage(
                    type=MessageType.CHAT_MESSAGE,
                    data=chat_data,
                    sender_id=chat_msg.user_id,
                    stream_id=stream_id
                ))
    
    async def check_rate_limit(self, connection_id: str, max_messages: int = 30, window_seconds: int = 60) -> bool:
        """Check if connection is within rate limits"""
        current_time = datetime.now(timezone.utc)
        window_start = current_time.timestamp() - window_seconds
        
        if connection_id not in self.message_counts:
            self.message_counts[connection_id] = {}
        
        # Clean old entries
        timestamps = list(self.message_counts[connection_id].keys())
        for ts in timestamps:
            if float(ts) < window_start:
                del self.message_counts[connection_id][ts]
        
        # Count current messages
        current_count = sum(self.message_counts[connection_id].values())
        
        if current_count >= max_messages:
            return False
        
        # Add current message
        current_key = str(current_time.timestamp())
        self.message_counts[connection_id][current_key] = self.message_counts[connection_id].get(current_key, 0) + 1
        
        return True
    
    async def notify_stream_started(self, stream_id: str, streamer_id: str, title: str):
        """Notify connections about stream start"""
        message = WebSocketMessage(
            type=MessageType.STREAM_STARTED,
            data={
                "stream_id": stream_id,
                "streamer_id": streamer_id,
                "title": title,
                "timestamp": datetime.now(timezone.utc).isoformat()
            },
            sender_id="system"
        )
        
        await self.broadcast_to_stream(stream_id, message)
    
    async def notify_stream_ended(self, stream_id: str):
        """Notify connections about stream end"""
        message = WebSocketMessage(
            type=MessageType.STREAM_ENDED,
            data={"stream_id": stream_id},
            sender_id="system"
        )
        
        await self.broadcast_to_stream(stream_id, message)
    
    def get_connection_stats(self) -> Dict:
        """Get WebSocket connection statistics"""
        total_connections = len(self.connections)
        active_streams = len(self.stream_rooms)
        total_users = len(self.user_connections)
        
        return {
            "total_connections": total_connections,
            "total_users": total_users,
            "active_streams": active_streams,
            "connections_per_stream": {
                stream_id: len(connections) 
                for stream_id, connections in self.stream_rooms.items()
            }
        }

# Global WebSocket manager instance
websocket_manager = WebSocketManager()