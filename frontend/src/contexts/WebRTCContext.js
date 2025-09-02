import React, { createContext, useContext, useReducer, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const WebRTCContext = createContext();

export const useWebRTC = () => {
  const context = useContext(WebRTCContext);
  if (!context) {
    throw new Error('useWebRTC must be used within WebRTCProvider');
  }
  return context;
};

// WebRTC state management
const initialState = {
  localStream: null,
  remoteStreams: {},
  isStreaming: false,
  isViewing: false,
  connectionState: 'disconnected',
  chatMessages: [],
  streamInfo: null,
  viewers: [],
  error: null,
  isConnected: false,
  currentStreamId: null
};

const webrtcReducer = (state, action) => {
  switch (action.type) {
    case 'SET_LOCAL_STREAM':
      return { ...state, localStream: action.payload };
    case 'ADD_REMOTE_STREAM':
      return {
        ...state,
        remoteStreams: { ...state.remoteStreams, [action.userId]: action.stream }
      };
    case 'REMOVE_REMOTE_STREAM':
      const { [action.userId]: removed, ...remainingStreams } = state.remoteStreams;
      return { ...state, remoteStreams: remainingStreams };
    case 'SET_STREAMING':
      return { ...state, isStreaming: action.payload };
    case 'SET_VIEWING':
      return { ...state, isViewing: action.payload };
    case 'SET_CONNECTION_STATE':
      return { ...state, connectionState: action.payload };
    case 'ADD_CHAT_MESSAGE':
      return { 
        ...state, 
        chatMessages: [...state.chatMessages, action.message].slice(-100) // Keep last 100 messages
      };
    case 'SET_STREAM_INFO':
      return { ...state, streamInfo: action.payload };
    case 'UPDATE_VIEWERS':
      return { ...state, viewers: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'SET_CONNECTED':
      return { ...state, isConnected: action.payload };
    case 'SET_CURRENT_STREAM':
      return { ...state, currentStreamId: action.payload };
    case 'CLEAR_CHAT':
      return { ...state, chatMessages: [] };
    case 'RESET_STATE':
      return { 
        ...initialState, 
        localStream: state.localStream // Preserve local stream 
      };
    default:
      return state;
  }
};

export const WebRTCProvider = ({ children }) => {
  const [state, dispatch] = useReducer(webrtcReducer, initialState);
  const { user, token } = useAuth();
  
  const socketRef = useRef(null);
  const peerConnectionsRef = useRef({});
  const localVideoRef = useRef(null);
  
  // WebRTC configuration
  const rtcConfig = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  };

  // Initialize WebSocket connection
  const connectWebSocket = useCallback((streamId) => {
    if (socketRef.current) {
      socketRef.current.disconnect();
    }

    const wsUrl = `${BACKEND_URL}/ws/stream/${streamId}`;
    socketRef.current = io(wsUrl, {
      query: { 
        user_id: user?.user_id || `anonymous_${Date.now()}`,
        token: token 
      },
      transports: ['websocket', 'polling']
    });

    socketRef.current.on('connect', () => {
      console.log('WebSocket connected');
      dispatch({ type: 'SET_CONNECTED', payload: true });
      dispatch({ type: 'SET_CURRENT_STREAM', payload: streamId });
    });

    socketRef.current.on('disconnect', () => {
      console.log('WebSocket disconnected');
      dispatch({ type: 'SET_CONNECTED', payload: false });
    });

    socketRef.current.on('message', (message) => {
      handleWebSocketMessage(message);
    });

    return socketRef.current;
  }, [user, token]);

  // Handle WebSocket messages
  const handleWebSocketMessage = useCallback((message) => {
    try {
      const data = typeof message === 'string' ? JSON.parse(message) : message;
      
      switch (data.type) {
        case 'offer':
          handleRemoteOffer(data);
          break;
        case 'answer':
          handleRemoteAnswer(data);
          break;
        case 'ice_candidate':
          handleRemoteIceCandidate(data);
          break;
        case 'chat_message':
          dispatch({ type: 'ADD_CHAT_MESSAGE', message: data.data });
          break;
        case 'user_joined':
          console.log('User joined:', data.data.user_id);
          break;
        case 'user_left':
          console.log('User left:', data.data.user_id);
          break;
        case 'stream_started':
          console.log('Stream started');
          break;
        case 'stream_ended':
          console.log('Stream ended');
          stopViewing();
          break;
        case 'error':
          dispatch({ type: 'SET_ERROR', payload: data.data.message });
          break;
        default:
          console.log('Unknown message type:', data.type);
      }
    } catch (error) {
      console.error('Error handling WebSocket message:', error);
    }
  }, []);

  // Create peer connection
  const createPeerConnection = useCallback((userId, isInitiator = false) => {
    if (peerConnectionsRef.current[userId]) {
      return peerConnectionsRef.current[userId];
    }

    const peerConnection = new RTCPeerConnection(rtcConfig);
    peerConnectionsRef.current[userId] = peerConnection;

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit('message', JSON.stringify({
          type: 'ice_candidate',
          data: {
            candidate: event.candidate.candidate,
            sdpMLineIndex: event.candidate.sdpMLineIndex,
            sdpMid: event.candidate.sdpMid
          },
          target_id: userId,
          stream_id: state.currentStreamId
        }));
      }
    };

    // Handle remote streams
    peerConnection.ontrack = (event) => {
      console.log('Received remote track:', event.track.kind);
      const [remoteStream] = event.streams;
      dispatch({ type: 'ADD_REMOTE_STREAM', userId, stream: remoteStream });
    };

    // Handle connection state changes
    peerConnection.onconnectionstatechange = () => {
      console.log(`Connection state for ${userId}:`, peerConnection.connectionState);
      dispatch({ type: 'SET_CONNECTION_STATE', payload: peerConnection.connectionState });
      
      if (peerConnection.connectionState === 'failed' || 
          peerConnection.connectionState === 'closed') {
        cleanupPeerConnection(userId);
      }
    };

    return peerConnection;
  }, [state.currentStreamId]);

  // Handle remote offer
  const handleRemoteOffer = useCallback(async (message) => {
    try {
      const { sender_id, data } = message;
      const peerConnection = createPeerConnection(sender_id, false);
      
      await peerConnection.setRemoteDescription(new RTCSessionDescription(data));
      
      // Add local stream if available
      if (state.localStream) {
        state.localStream.getTracks().forEach(track => {
          peerConnection.addTrack(track, state.localStream);
        });
      }
      
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      
      if (socketRef.current) {
        socketRef.current.emit('message', JSON.stringify({
          type: 'answer',
          data: answer,
          target_id: sender_id,
          stream_id: state.currentStreamId
        }));
      }
    } catch (error) {
      console.error('Error handling remote offer:', error);
    }
  }, [createPeerConnection, state.localStream, state.currentStreamId]);

  // Handle remote answer
  const handleRemoteAnswer = useCallback(async (message) => {
    try {
      const { sender_id, data } = message;
      const peerConnection = peerConnectionsRef.current[sender_id];
      
      if (peerConnection) {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data));
      }
    } catch (error) {
      console.error('Error handling remote answer:', error);
    }
  }, []);

  // Handle remote ICE candidate
  const handleRemoteIceCandidate = useCallback(async (message) => {
    try {
      const { sender_id, data } = message;
      const peerConnection = peerConnectionsRef.current[sender_id];
      
      if (peerConnection) {
        await peerConnection.addIceCandidate(new RTCIceCandidate(data));
      }
    } catch (error) {
      console.error('Error handling remote ICE candidate:', error);
    }
  }, []);

  // Initialize local stream (for streaming)
  const initializeCamera = useCallback(async (constraints = { video: true, audio: true }) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      dispatch({ type: 'SET_LOCAL_STREAM', payload: stream });
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      
      return stream;
    } catch (error) {
      console.error('Error accessing camera:', error);
      dispatch({ type: 'SET_ERROR', payload: 'Failed to access camera/microphone' });
      throw error;
    }
  }, []);

  // Start streaming
  const startStreaming = useCallback(async (streamId, streamOptions = {}) => {
    try {
      dispatch({ type: 'SET_ERROR', payload: null });
      
      // Initialize camera
      const stream = await initializeCamera(streamOptions.constraints);
      
      // Connect WebSocket
      connectWebSocket(streamId);
      
      dispatch({ type: 'SET_STREAMING', payload: true });
      dispatch({ type: 'SET_CONNECTION_STATE', payload: 'connecting' });
      
      return stream;
    } catch (error) {
      console.error('Error starting stream:', error);
      dispatch({ type: 'SET_ERROR', payload: 'Failed to start streaming' });
      throw error;
    }
  }, [initializeCamera, connectWebSocket]);

  // Join stream as viewer
  const joinStream = useCallback(async (streamId) => {
    try {
      dispatch({ type: 'SET_ERROR', payload: null });
      dispatch({ type: 'CLEAR_CHAT' });
      
      // Connect WebSocket
      connectWebSocket(streamId);
      
      dispatch({ type: 'SET_VIEWING', payload: true });
      dispatch({ type: 'SET_CONNECTION_STATE', payload: 'connecting' });
      
    } catch (error) {
      console.error('Error joining stream:', error);
      dispatch({ type: 'SET_ERROR', payload: 'Failed to join stream' });
      throw error;
    }
  }, [connectWebSocket]);

  // Send chat message
  const sendChatMessage = useCallback((message) => {
    if (socketRef.current && state.isConnected) {
      socketRef.current.emit('message', JSON.stringify({
        type: 'chat_message',
        data: { content: message.trim() },
        stream_id: state.currentStreamId
      }));
    }
  }, [state.isConnected, state.currentStreamId]);

  // Stop streaming
  const stopStreaming = useCallback(() => {
    // Stop local stream
    if (state.localStream) {
      state.localStream.getTracks().forEach(track => track.stop());
    }
    
    // Close peer connections
    Object.values(peerConnectionsRef.current).forEach(pc => {
      pc.close();
    });
    peerConnectionsRef.current = {};
    
    // Disconnect WebSocket
    if (socketRef.current) {
      socketRef.current.disconnect();
    }
    
    dispatch({ type: 'RESET_STATE' });
  }, [state.localStream]);

  // Stop viewing
  const stopViewing = useCallback(() => {
    // Close peer connections
    Object.values(peerConnectionsRef.current).forEach(pc => {
      pc.close();
    });
    peerConnectionsRef.current = {};
    
    // Disconnect WebSocket
    if (socketRef.current) {
      socketRef.current.disconnect();
    }
    
    dispatch({ type: 'SET_VIEWING', payload: false });
    dispatch({ type: 'SET_CONNECTED', payload: false });
    dispatch({ type: 'SET_CONNECTION_STATE', payload: 'disconnected' });
  }, []);

  // Cleanup peer connection
  const cleanupPeerConnection = useCallback((userId) => {
    if (peerConnectionsRef.current[userId]) {
      peerConnectionsRef.current[userId].close();
      delete peerConnectionsRef.current[userId];
      dispatch({ type: 'REMOVE_REMOTE_STREAM', userId });
    }
  }, []);

  const value = {
    ...state,
    localVideoRef,
    startStreaming,
    stopStreaming,
    joinStream,
    stopViewing,
    sendChatMessage,
    initializeCamera
  };

  return (
    <WebRTCContext.Provider value={value}>
      {children}
    </WebRTCContext.Provider>
  );
};

export default WebRTCProvider;