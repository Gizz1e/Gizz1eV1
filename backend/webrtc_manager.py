from aiortc import RTCPeerConnection, RTCSessionDescription, RTCConfiguration, RTCIceServer
from aiortc.contrib.media import MediaRelay
import asyncio
import json
import logging
from typing import Dict, Optional, Set, List
from datetime import datetime, timezone
from enum import Enum
import uuid

logger = logging.getLogger(__name__)

class StreamType(Enum):
    PUBLIC = "public"
    PRIVATE = "private"
    PREMIUM = "premium"

class ConnectionState(Enum):
    CONNECTING = "connecting"
    CONNECTED = "connected"
    DISCONNECTED = "disconnected"
    FAILED = "failed"

class WebRTCConnection:
    def __init__(self, connection_id: str, user_id: str, peer_connection: RTCPeerConnection):
        self.connection_id = connection_id
        self.user_id = user_id
        self.peer_connection = peer_connection
        self.state = ConnectionState.CONNECTING
        self.created_at = datetime.now(timezone.utc)
        self.last_activity = datetime.now(timezone.utc)
        self.is_streaming = False
        self.stream_id = None

class LiveStream:
    def __init__(self, stream_id: str, streamer_id: str, title: str, stream_type: StreamType = StreamType.PUBLIC):
        self.stream_id = stream_id
        self.streamer_id = streamer_id
        self.title = title
        self.stream_type = stream_type
        self.viewers: Set[str] = set()
        self.max_viewers = 1000  # Can be configurable
        self.created_at = datetime.now(timezone.utc)
        self.is_active = False
        self.chat_messages: List[Dict] = []
        self.viewer_connections: Dict[str, WebRTCConnection] = {}
        self.streamer_connection: Optional[WebRTCConnection] = None
        self.tips_received = 0.0

class WebRTCManager:
    def __init__(self):
        self.connections: Dict[str, WebRTCConnection] = {}
        self.live_streams: Dict[str, LiveStream] = {}
        self.media_relay = MediaRelay()
        
        # STUN/TURN configuration
        self.rtc_configuration = RTCConfiguration(
            iceServers=[
                RTCIceServer("stun:stun.l.google.com:19302"),
                RTCIceServer("stun:stun1.l.google.com:19302"),
            ]
        )
        
        # Start cleanup task
        asyncio.create_task(self.periodic_cleanup())
    
    async def create_peer_connection(self, user_id: str) -> str:
        """Create new peer connection and return connection ID"""
        connection_id = str(uuid.uuid4())
        
        try:
            pc = RTCPeerConnection(self.rtc_configuration)
            connection = WebRTCConnection(connection_id, user_id, pc)
            
            # Handle ICE connection state changes
            @pc.on("connectionstatechange")
            async def on_connectionstatechange():
                logger.info(f"Connection state for {connection_id}: {pc.connectionState}")
                
                if pc.connectionState == "connected":
                    connection.state = ConnectionState.CONNECTED
                elif pc.connectionState in ["failed", "closed"]:
                    connection.state = ConnectionState.FAILED
                    await self.cleanup_connection(connection_id)
            
            # Handle incoming tracks (for streamers)
            @pc.on("track")
            def on_track(track):
                logger.info(f"Received track: {track.kind} from {user_id}")
                
                if track.kind == "video":
                    # Relay video track to viewers
                    relayed_track = self.media_relay.relay(track)
                    
                    # Find the stream for this connection
                    for stream in self.live_streams.values():
                        if (stream.streamer_connection and 
                            stream.streamer_connection.connection_id == connection_id):
                            # Add track to all viewer connections
                            asyncio.create_task(
                                self.broadcast_track_to_viewers(stream.stream_id, relayed_track)
                            )
                            break
            
            self.connections[connection_id] = connection
            logger.info(f"Created peer connection {connection_id} for user {user_id}")
            
            return connection_id
            
        except Exception as e:
            logger.error(f"Error creating peer connection: {str(e)}")
            raise
    
    async def handle_offer(self, connection_id: str, offer: dict) -> dict:
        """Handle WebRTC offer and create answer"""
        try:
            connection = self.connections.get(connection_id)
            if not connection:
                raise ValueError("Connection not found")
            
            pc = connection.peer_connection
            
            # Set remote description
            await pc.setRemoteDescription(RTCSessionDescription(
                sdp=offer["sdp"],
                type=offer["type"]
            ))
            
            # Create and set local description
            answer = await pc.createAnswer()
            await pc.setLocalDescription(answer)
            
            connection.last_activity = datetime.now(timezone.utc)
            
            return {
                "sdp": pc.localDescription.sdp,
                "type": pc.localDescription.type
            }
            
        except Exception as e:
            logger.error(f"Error handling offer: {str(e)}")
            raise
    
    async def handle_answer(self, connection_id: str, answer: dict):
        """Handle WebRTC answer"""
        try:
            connection = self.connections.get(connection_id)
            if not connection:
                raise ValueError("Connection not found")
            
            pc = connection.peer_connection
            
            await pc.setRemoteDescription(RTCSessionDescription(
                sdp=answer["sdp"],
                type=answer["type"]
            ))
            
            connection.last_activity = datetime.now(timezone.utc)
            logger.info(f"Answer processed for connection {connection_id}")
            
        except Exception as e:
            logger.error(f"Error handling answer: {str(e)}")
            raise
    
    async def handle_ice_candidate(self, connection_id: str, candidate: dict):
        """Handle ICE candidate"""
        try:
            connection = self.connections.get(connection_id)
            if not connection:
                raise ValueError("Connection not found")
            
            pc = connection.peer_connection
            await pc.addIceCandidate(candidate)
            
            connection.last_activity = datetime.now(timezone.utc)
            
        except Exception as e:
            logger.error(f"Error handling ICE candidate: {str(e)}")
            raise
    
    async def create_live_stream(self, streamer_id: str, title: str, stream_type: StreamType = StreamType.PUBLIC) -> str:
        """Create a new live stream"""
        stream_id = str(uuid.uuid4())
        
        # Check if user already has an active stream
        for existing_stream in self.live_streams.values():
            if (existing_stream.streamer_id == streamer_id and 
                existing_stream.is_active):
                raise ValueError("User already has an active stream")
        
        stream = LiveStream(stream_id, streamer_id, title, stream_type)
        self.live_streams[stream_id] = stream
        
        logger.info(f"Created live stream {stream_id} for streamer {streamer_id}")
        return stream_id
    
    async def start_streaming(self, stream_id: str, connection_id: str) -> bool:
        """Start streaming for a live stream"""
        try:
            stream = self.live_streams.get(stream_id)
            connection = self.connections.get(connection_id)
            
            if not stream or not connection:
                return False
            
            # Verify the connection belongs to the stream owner
            if connection.user_id != stream.streamer_id:
                return False
            
            stream.streamer_connection = connection
            stream.is_active = True
            connection.is_streaming = True
            connection.stream_id = stream_id
            
            logger.info(f"Started streaming for stream {stream_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error starting stream: {str(e)}")
            return False
    
    async def join_stream_as_viewer(self, stream_id: str, connection_id: str) -> bool:
        """Join a stream as viewer"""
        try:
            stream = self.live_streams.get(stream_id)
            connection = self.connections.get(connection_id)
            
            if not stream or not connection:
                return False
            
            # Check if stream is active
            if not stream.is_active:
                return False
            
            # Check viewer limit
            if len(stream.viewers) >= stream.max_viewers:
                return False
            
            # Add viewer to stream
            stream.viewers.add(connection.user_id)
            stream.viewer_connections[connection_id] = connection
            connection.stream_id = stream_id
            
            # If streamer is already broadcasting, add the track to this viewer
            if (stream.streamer_connection and 
                stream.streamer_connection.peer_connection.getTransceivers()):
                await self.add_viewer_to_stream(stream_id, connection_id)
            
            logger.info(f"User {connection.user_id} joined stream {stream_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error joining stream: {str(e)}")
            return False
    
    async def broadcast_track_to_viewers(self, stream_id: str, track):
        """Broadcast track to all viewers of a stream"""
        try:
            stream = self.live_streams.get(stream_id)
            if not stream:
                return
            
            for connection in stream.viewer_connections.values():
                try:
                    connection.peer_connection.addTrack(track)
                except Exception as e:
                    logger.error(f"Error adding track to viewer {connection.connection_id}: {e}")
            
        except Exception as e:
            logger.error(f"Error broadcasting track: {str(e)}")
    
    async def add_viewer_to_stream(self, stream_id: str, connection_id: str):
        """Add existing viewer connection to active stream"""
        try:
            stream = self.live_streams.get(stream_id)
            connection = self.connections.get(connection_id)
            
            if not stream or not connection or not stream.streamer_connection:
                return
            
            # Get tracks from streamer connection
            streamer_pc = stream.streamer_connection.peer_connection
            
            for transceiver in streamer_pc.getTransceivers():
                if transceiver.receiver.track:
                    relayed_track = self.media_relay.relay(transceiver.receiver.track)
                    connection.peer_connection.addTrack(relayed_track)
            
        except Exception as e:
            logger.error(f"Error adding viewer to stream: {str(e)}")
    
    async def leave_stream(self, connection_id: str):
        """Leave stream (viewer or streamer)"""
        try:
            connection = self.connections.get(connection_id)
            if not connection or not connection.stream_id:
                return
            
            stream = self.live_streams.get(connection.stream_id)
            if not stream:
                return
            
            # If this is the streamer leaving
            if (stream.streamer_connection and 
                stream.streamer_connection.connection_id == connection_id):
                stream.is_active = False
                stream.streamer_connection = None
                
                # Notify all viewers
                for viewer_conn in stream.viewer_connections.values():
                    # Close viewer connections
                    await self.cleanup_connection(viewer_conn.connection_id)
                
                stream.viewer_connections.clear()
                stream.viewers.clear()
                
                logger.info(f"Streamer left stream {stream.stream_id}, stream ended")
            
            # If this is a viewer leaving
            else:
                if connection_id in stream.viewer_connections:
                    del stream.viewer_connections[connection_id]
                
                stream.viewers.discard(connection.user_id)
                logger.info(f"Viewer left stream {stream.stream_id}")
            
            connection.stream_id = None
            connection.is_streaming = False
            
        except Exception as e:
            logger.error(f"Error leaving stream: {str(e)}")
    
    async def cleanup_connection(self, connection_id: str):
        """Clean up peer connection and resources"""
        try:
            if connection_id not in self.connections:
                return
            
            connection = self.connections[connection_id]
            
            # Leave any stream first
            await self.leave_stream(connection_id)
            
            # Close peer connection
            try:
                await connection.peer_connection.close()
            except Exception as e:
                logger.error(f"Error closing peer connection: {e}")
            
            # Remove from connections
            del self.connections[connection_id]
            
            logger.info(f"Cleaned up connection {connection_id}")
            
        except Exception as e:
            logger.error(f"Error cleaning up connection: {str(e)}")
    
    async def get_active_streams(self) -> List[Dict]:
        """Get list of active streams"""
        active_streams = []
        
        for stream in self.live_streams.values():
            if stream.is_active:
                active_streams.append({
                    "stream_id": stream.stream_id,
                    "streamer_id": stream.streamer_id,
                    "title": stream.title,
                    "stream_type": stream.stream_type.value,
                    "viewer_count": len(stream.viewers),
                    "created_at": stream.created_at.isoformat(),
                    "tips_received": stream.tips_received
                })
        
        return active_streams
    
    async def get_stream_info(self, stream_id: str) -> Optional[Dict]:
        """Get information about a specific stream"""
        stream = self.live_streams.get(stream_id)
        if not stream:
            return None
        
        return {
            "stream_id": stream.stream_id,
            "streamer_id": stream.streamer_id,
            "title": stream.title,
            "stream_type": stream.stream_type.value,
            "viewer_count": len(stream.viewers),
            "is_active": stream.is_active,
            "created_at": stream.created_at.isoformat(),
            "max_viewers": stream.max_viewers,
            "tips_received": stream.tips_received
        }
    
    async def periodic_cleanup(self):
        """Periodic cleanup of expired connections and streams"""
        while True:
            try:
                current_time = datetime.now(timezone.utc)
                cleanup_threshold = 300  # 5 minutes
                
                # Cleanup inactive connections
                inactive_connections = []
                for conn_id, connection in self.connections.items():
                    if (current_time - connection.last_activity).total_seconds() > cleanup_threshold:
                        inactive_connections.append(conn_id)
                
                for conn_id in inactive_connections:
                    await self.cleanup_connection(conn_id)
                
                # Cleanup inactive streams
                inactive_streams = []
                for stream_id, stream in self.live_streams.items():
                    if (not stream.is_active and 
                        (current_time - stream.created_at).total_seconds() > cleanup_threshold):
                        inactive_streams.append(stream_id)
                
                for stream_id in inactive_streams:
                    del self.live_streams[stream_id]
                
                await asyncio.sleep(60)  # Run every minute
                
            except Exception as e:
                logger.error(f"Error in periodic cleanup: {str(e)}")
                await asyncio.sleep(60)

# Global WebRTC manager instance
webrtc_manager = WebRTCManager()