import React, { useState, useRef, useEffect } from 'react';
import { 
  Video, 
  VideoOff, 
  Mic, 
  MicOff, 
  Settings, 
  Users, 
  MessageCircle,
  DollarSign,
  Play,
  Square,
  Eye,
  EyeOff,
  Monitor,
  Smartphone
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useWebRTC } from '../contexts/WebRTCContext';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const LiveStreaming = ({ isOpen, onClose }) => {
  const { user, token } = useAuth();
  const { 
    localStream, 
    isStreaming, 
    connectionState, 
    chatMessages, 
    viewers,
    startStreaming, 
    stopStreaming, 
    sendChatMessage,
    localVideoRef,
    error 
  } = useWebRTC();

  const [streamConfig, setStreamConfig] = useState({
    title: '',
    description: '',
    stream_type: 'public',
    max_viewers: 1000
  });

  const [mediaSettings, setMediaSettings] = useState({
    video: true,
    audio: true,
    videoQuality: '720p'
  });

  const [streamStats, setStreamStats] = useState({
    currentViewers: 0,
    totalTips: 0,
    duration: '00:00:00'
  });

  const [chatMessage, setChatMessage] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [currentStreamId, setCurrentStreamId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [streamStartTime, setStreamStartTime] = useState(null);

  const chatContainerRef = useRef(null);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages]);

  // Update stream duration
  useEffect(() => {
    let interval;
    if (isStreaming && streamStartTime) {
      interval = setInterval(() => {
        const now = new Date();
        const diff = now - streamStartTime;
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        
        setStreamStats(prev => ({
          ...prev,
          duration: `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
        }));
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isStreaming, streamStartTime]);

  const getVideoConstraints = () => {
    const qualityMap = {
      '480p': { width: 854, height: 480 },
      '720p': { width: 1280, height: 720 },
      '1080p': { width: 1920, height: 1080 }
    };

    return {
      video: mediaSettings.video ? {
        ...qualityMap[mediaSettings.videoQuality],
        frameRate: { ideal: 30, max: 60 }
      } : false,
      audio: mediaSettings.audio
    };
  };

  const createStream = async () => {
    if (!streamConfig.title.trim()) {
      alert('Please enter a stream title');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${API}/streams/create`, streamConfig, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const streamId = response.data.stream_id;
      setCurrentStreamId(streamId);
      
      return streamId;
    } catch (error) {
      console.error('Error creating stream:', error);
      alert(error.response?.data?.detail || 'Failed to create stream');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const handleStartStreaming = async () => {
    try {
      setLoading(true);
      
      // Create stream first
      const streamId = await createStream();
      if (!streamId) return;

      // Start WebRTC streaming
      const constraints = getVideoConstraints();
      await startStreaming(streamId, { constraints });
      
      setStreamStartTime(new Date());
      
    } catch (error) {
      console.error('Error starting stream:', error);
      alert('Failed to start streaming. Please check camera/microphone permissions.');
    } finally {
      setLoading(false);
    }
  };

  const handleStopStreaming = async () => {
    try {
      if (currentStreamId) {
        // Notify backend that stream is ending
        await axios.post(`${API}/streams/${currentStreamId}/end`, {}, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
      }
    } catch (error) {
      console.error('Error ending stream:', error);
    }

    stopStreaming();
    setCurrentStreamId(null);
    setStreamStartTime(null);
    setStreamStats({ currentViewers: 0, totalTips: 0, duration: '00:00:00' });
  };

  const toggleVideo = async () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setMediaSettings(prev => ({ ...prev, video: videoTrack.enabled }));
      }
    }
  };

  const toggleAudio = async () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setMediaSettings(prev => ({ ...prev, audio: audioTrack.enabled }));
      }
    }
  };

  const handleSendChat = (e) => {
    e.preventDefault();
    if (chatMessage.trim() && isStreaming) {
      sendChatMessage(chatMessage);
      setChatMessage('');
    }
  };

  const handleStreamConfigChange = (field, value) => {
    setStreamConfig(prev => ({ ...prev, [field]: value }));
  };

  if (!isOpen) return null;

  return (
    <div className="livestream-overlay" onClick={onClose}>
      <div className="livestream-container" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="livestream-header">
          <div className="stream-info">
            <h2>{isStreaming ? 'Live Streaming' : 'Start Live Stream'}</h2>
            <div className="stream-status">
              <div className={`status-indicator ${isStreaming ? 'live' : 'offline'}`}>
                <div className="pulse"></div>
                {isStreaming ? 'LIVE' : 'OFFLINE'}
              </div>
              {isStreaming && (
                <div className="stream-stats">
                  <span><Users size={16} /> {streamStats.currentViewers}</span>
                  <span><DollarSign size={16} /> ${streamStats.totalTips}</span>
                  <span>{streamStats.duration}</span>
                </div>
              )}
            </div>
          </div>
          
          <div className="header-actions">
            <button 
              onClick={() => setShowSettings(!showSettings)}
              className="icon-btn"
              title="Settings"
            >
              <Settings size={20} />
            </button>
            <button onClick={onClose} className="close-btn">×</button>
          </div>
        </div>

        <div className="livestream-content">
          {/* Main Video Area */}
          <div className="video-section">
            <div className="video-container">
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className={`local-video ${!mediaSettings.video ? 'video-off' : ''}`}
              />
              
              {!mediaSettings.video && (
                <div className="video-off-overlay">
                  <VideoOff size={48} />
                  <p>Camera is off</p>
                </div>
              )}

              {error && (
                <div className="error-overlay">
                  <p>Error: {error}</p>
                </div>
              )}

              {/* Video Controls */}
              <div className="video-controls">
                <button 
                  onClick={toggleVideo}
                  className={`control-btn ${!mediaSettings.video ? 'off' : ''}`}
                  title={mediaSettings.video ? 'Turn off camera' : 'Turn on camera'}
                >
                  {mediaSettings.video ? <Video size={20} /> : <VideoOff size={20} />}
                </button>
                
                <button 
                  onClick={toggleAudio}
                  className={`control-btn ${!mediaSettings.audio ? 'off' : ''}`}
                  title={mediaSettings.audio ? 'Mute microphone' : 'Unmute microphone'}
                >
                  {mediaSettings.audio ? <Mic size={20} /> : <MicOff size={20} />}
                </button>

                <div className="stream-actions">
                  {!isStreaming ? (
                    <button 
                      onClick={handleStartStreaming}
                      disabled={loading}
                      className="start-stream-btn"
                    >
                      <Play size={20} />
                      {loading ? 'Starting...' : 'Go Live'}
                    </button>
                  ) : (
                    <button 
                      onClick={handleStopStreaming}
                      className="stop-stream-btn"
                    >
                      <Square size={20} />
                      End Stream
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Stream Configuration (shown when not streaming) */}
            {!isStreaming && (
              <div className="stream-config">
                <h3>Stream Configuration</h3>
                
                <div className="config-grid">
                  <div className="config-group">
                    <label>Stream Title *</label>
                    <input
                      type="text"
                      value={streamConfig.title}
                      onChange={(e) => handleStreamConfigChange('title', e.target.value)}
                      placeholder="Enter your stream title"
                      maxLength={100}
                    />
                  </div>

                  <div className="config-group">
                    <label>Stream Type</label>
                    <select
                      value={streamConfig.stream_type}
                      onChange={(e) => handleStreamConfigChange('stream_type', e.target.value)}
                    >
                      <option value="public">Public - Anyone can watch</option>
                      <option value="private">Private - Premium users only</option>
                      <option value="premium">Premium - VIP users only</option>
                    </select>
                  </div>

                  <div className="config-group">
                    <label>Description</label>
                    <textarea
                      value={streamConfig.description}
                      onChange={(e) => handleStreamConfigChange('description', e.target.value)}
                      placeholder="Describe your stream (optional)"
                      rows="3"
                    />
                  </div>

                  <div className="config-group">
                    <label>Max Viewers</label>
                    <input
                      type="number"
                      value={streamConfig.max_viewers}
                      onChange={(e) => handleStreamConfigChange('max_viewers', parseInt(e.target.value))}
                      min="1"
                      max="10000"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Chat Sidebar */}
          <div className="chat-section">
            <div className="chat-header">
              <MessageCircle size={20} />
              <span>Live Chat</span>
              {isStreaming && (
                <span className="viewer-count">
                  <Eye size={16} />
                  {viewers.length}
                </span>
              )}
            </div>

            <div className="chat-messages" ref={chatContainerRef}>
              {chatMessages.length === 0 ? (
                <div className="no-messages">
                  {isStreaming ? 'Waiting for messages...' : 'Chat will appear when you go live'}
                </div>
              ) : (
                chatMessages.map((msg, index) => (
                  <div key={index} className="chat-message">
                    <span className="username">{msg.user_id}:</span>
                    <span className="message">{msg.content}</span>
                  </div>
                ))
              )}
            </div>

            {isStreaming && (
              <form onSubmit={handleSendChat} className="chat-input">
                <input
                  type="text"
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  placeholder="Type a message..."
                  maxLength={500}
                />
                <button type="submit" disabled={!chatMessage.trim()}>
                  Send
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className="settings-panel">
            <h4>Stream Settings</h4>
            
            <div className="settings-group">
              <label>Video Quality</label>
              <select
                value={mediaSettings.videoQuality}
                onChange={(e) => setMediaSettings(prev => ({ ...prev, videoQuality: e.target.value }))}
                disabled={isStreaming}
              >
                <option value="480p">480p (854×480)</option>
                <option value="720p">720p HD (1280×720)</option>
                <option value="1080p">1080p Full HD (1920×1080)</option>
              </select>
            </div>

            <div className="settings-info">
              <p><Monitor size={16} /> Connection: {connectionState}</p>
              {isStreaming && (
                <p><Smartphone size={16} /> Stream ID: {currentStreamId}</p>
              )}
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .livestream-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.9);
          backdrop-filter: blur(10px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
        }

        .livestream-container {
          background: linear-gradient(145deg, #1a1a2e, #16213e);
          border: 1px solid rgba(229, 62, 62, 0.2);
          border-radius: 20px;
          width: 100%;
          max-width: 1400px;
          height: 90vh;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          box-shadow: 0 25px 50px rgba(0, 0, 0, 0.5);
        }

        .livestream-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 30px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(0, 0, 0, 0.2);
        }

        .stream-info h2 {
          margin: 0 0 8px 0;
          color: #ffffff;
          font-size: 24px;
          font-weight: 600;
        }

        .stream-status {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .status-indicator {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 1px;
          position: relative;
        }

        .status-indicator.live {
          background: rgba(229, 62, 62, 0.2);
          color: #e53e3e;
          border: 1px solid rgba(229, 62, 62, 0.4);
        }

        .status-indicator.offline {
          background: rgba(128, 128, 128, 0.2);
          color: #888;
          border: 1px solid rgba(128, 128, 128, 0.4);
        }

        .pulse {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: currentColor;
          animation: pulse 2s infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.2); }
        }

        .stream-stats {
          display: flex;
          align-items: center;
          gap: 16px;
          color: #cccccc;
          font-size: 14px;
        }

        .stream-stats span {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .icon-btn {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          padding: 10px;
          color: #ffffff;
          cursor: pointer;
          transition: all 0.2s;
        }

        .icon-btn:hover {
          background: rgba(255, 255, 255, 0.1);
        }

        .close-btn {
          background: none;
          border: none;
          color: #888;
          font-size: 24px;
          cursor: pointer;
          padding: 8px;
          border-radius: 50%;
          transition: all 0.2s;
        }

        .close-btn:hover {
          color: #ffffff;
          background: rgba(255, 255, 255, 0.1);
        }

        .livestream-content {
          display: flex;
          flex: 1;
          overflow: hidden;
          position: relative;
        }

        .video-section {
          flex: 1;
          display: flex;
          flex-direction: column;
          padding: 20px;
        }

        .video-container {
          position: relative;
          aspect-ratio: 16/9;
          background: #000;
          border-radius: 12px;
          overflow: hidden;
          margin-bottom: 20px;
        }

        .local-video {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .video-off-overlay {
          position: absolute;
          inset: 0;
          background: rgba(0, 0, 0, 0.8);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: #ffffff;
          gap: 12px;
        }

        .error-overlay {
          position: absolute;
          inset: 0;
          background: rgba(229, 62, 62, 0.1);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ff6b6b;
          padding: 20px;
        }

        .video-controls {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          background: linear-gradient(transparent, rgba(0, 0, 0, 0.8));
          padding: 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .control-btn {
          background: rgba(255, 255, 255, 0.1);
          border: none;
          border-radius: 50%;
          width: 48px;
          height: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ffffff;
          cursor: pointer;
          transition: all 0.2s;
          margin-right: 12px;
        }

        .control-btn:hover {
          background: rgba(255, 255, 255, 0.2);
        }

        .control-btn.off {
          background: rgba(229, 62, 62, 0.2);
          color: #e53e3e;
        }

        .start-stream-btn {
          background: linear-gradient(135deg, #e53e3e, #c53030);
          border: none;
          border-radius: 8px;
          padding: 12px 24px;
          color: #ffffff;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: all 0.2s;
        }

        .start-stream-btn:hover:not(:disabled) {
          background: linear-gradient(135deg, #c53030, #a02727);
          transform: translateY(-2px);
        }

        .start-stream-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .stop-stream-btn {
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 8px;
          padding: 12px 24px;
          color: #ffffff;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: all 0.2s;
        }

        .stop-stream-btn:hover {
          background: rgba(229, 62, 62, 0.1);
          border-color: rgba(229, 62, 62, 0.4);
          color: #e53e3e;
        }

        .stream-config {
          padding: 24px;
          background: rgba(255, 255, 255, 0.02);
          border-radius: 12px;
          flex: 1;
        }

        .stream-config h3 {
          margin: 0 0 20px 0;
          color: #ffffff;
          font-size: 18px;
          font-weight: 600;
        }

        .config-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        .config-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .config-group:nth-child(3) {
          grid-column: 1 / -1;
        }

        .config-group label {
          color: #ffffff;
          font-size: 14px;
          font-weight: 500;
        }

        .config-group input,
        .config-group select,
        .config-group textarea {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          padding: 12px;
          color: #ffffff;
          font-size: 14px;
          transition: all 0.2s;
        }

        .config-group input:focus,
        .config-group select:focus,
        .config-group textarea:focus {
          outline: none;
          border-color: #e53e3e;
          background: rgba(255, 255, 255, 0.08);
        }

        .config-group textarea {
          resize: vertical;
          min-height: 60px;
        }

        .chat-section {
          width: 350px;
          display: flex;
          flex-direction: column;
          border-left: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(0, 0, 0, 0.2);
        }

        .chat-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          color: #ffffff;
          font-weight: 600;
        }

        .chat-header > span:first-of-type {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .viewer-count {
          display: flex;
          align-items: center;
          gap: 4px;
          color: #888;
          font-size: 14px;
        }

        .chat-messages {
          flex: 1;
          padding: 20px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .no-messages {
          color: #888;
          text-align: center;
          font-style: italic;
        }

        .chat-message {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .chat-message .username {
          color: #e53e3e;
          font-weight: 600;
          font-size: 14px;
        }

        .chat-message .message {
          color: #ffffff;
          font-size: 14px;
          line-height: 1.4;
        }

        .chat-input {
          display: flex;
          padding: 20px;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
          gap: 12px;
        }

        .chat-input input {
          flex: 1;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          padding: 12px;
          color: #ffffff;
          font-size: 14px;
        }

        .chat-input input:focus {
          outline: none;
          border-color: #e53e3e;
        }

        .chat-input button {
          background: #e53e3e;
          border: none;
          border-radius: 8px;
          padding: 12px 16px;
          color: #ffffff;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .chat-input button:hover:not(:disabled) {
          background: #c53030;
        }

        .chat-input button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .settings-panel {
          position: absolute;
          top: 70px;
          right: 20px;
          width: 300px;
          background: rgba(0, 0, 0, 0.9);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          padding: 20px;
          backdrop-filter: blur(10px);
          z-index: 10;
        }

        .settings-panel h4 {
          margin: 0 0 16px 0;
          color: #ffffff;
          font-size: 16px;
          font-weight: 600;
        }

        .settings-group {
          margin-bottom: 16px;
        }

        .settings-group label {
          display: block;
          color: #ffffff;
          font-size: 14px;
          font-weight: 500;
          margin-bottom: 8px;
        }

        .settings-group select {
          width: 100%;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          padding: 10px;
          color: #ffffff;
          font-size: 14px;
        }

        .settings-info {
          border-top: 1px solid rgba(255, 255, 255, 0.1);
          padding-top: 16px;
          margin-top: 16px;
        }

        .settings-info p {
          margin: 0 0 8px 0;
          color: #888;
          font-size: 14px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        @media (max-width: 1200px) {
          .chat-section {
            width: 300px;
          }
        }

        @media (max-width: 768px) {
          .livestream-container {
            height: 100vh;
            border-radius: 0;
            max-width: none;
          }

          .livestream-content {
            flex-direction: column;
          }

          .chat-section {
            width: 100%;
            height: 300px;
            border-left: none;
            border-top: 1px solid rgba(255, 255, 255, 0.1);
          }

          .config-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
};

export default LiveStreaming;