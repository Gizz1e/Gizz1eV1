import React, { useState, useRef, useEffect } from 'react';
import { 
  Heart, 
  MessageCircle, 
  DollarSign, 
  Users, 
  Volume2, 
  VolumeX, 
  Maximize, 
  Eye,
  Crown,
  Shield,
  Gift
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useWebRTC } from '../contexts/WebRTCContext';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const StreamViewer = ({ streamId, isOpen, onClose }) => {
  const { user, token, canAccessStream } = useAuth();
  const { 
    remoteStreams, 
    isViewing, 
    chatMessages, 
    viewers,
    joinStream, 
    stopViewing, 
    sendChatMessage,
    error 
  } = useWebRTC();

  const [streamInfo, setStreamInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [chatMessage, setChatMessage] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [showTipModal, setShowTipModal] = useState(false);
  const [tipAmount, setTipAmount] = useState('');
  const [tipMessage, setTipMessage] = useState('');
  
  const videoRef = useRef(null);
  const chatContainerRef = useRef(null);

  // Load stream info
  useEffect(() => {
    if (streamId && isOpen) {
      loadStreamInfo();
    }
  }, [streamId, isOpen]);

  // Auto-scroll chat
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages]);

  // Handle remote stream
  useEffect(() => {
    const remoteStreamKeys = Object.keys(remoteStreams);
    if (remoteStreamKeys.length > 0 && videoRef.current) {
      const firstStream = remoteStreams[remoteStreamKeys[0]];
      videoRef.current.srcObject = firstStream;
    }
  }, [remoteStreams]);

  const loadStreamInfo = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/streams/${streamId}`);
      const info = response.data;
      
      setStreamInfo(info);
      
      // Check access permissions
      if (!canAccessStream(info.stream_type)) {
        alert('You do not have permission to view this stream');
        onClose();
        return;
      }
      
      // Join the stream
      await joinStream(streamId);
      
    } catch (error) {
      console.error('Error loading stream:', error);
      alert('Failed to load stream');
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handleSendChat = (e) => {
    e.preventDefault();
    if (chatMessage.trim() && isViewing) {
      sendChatMessage(chatMessage);
      setChatMessage('');
    }
  };

  const handleTip = async () => {
    if (!user) {
      alert('Please login to send tips');
      return;
    }

    const amount = parseFloat(tipAmount);
    if (!amount || amount < 1 || amount > 500) {
      alert('Tip amount must be between $1 and $500');
      return;
    }

    try {
      const response = await axios.post(`${API}/streams/${streamId}/tip`, {
        stream_id: streamId,
        amount: amount,
        message: tipMessage
      }, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      // Redirect to Stripe checkout
      window.open(response.data.checkout_url, '_blank');
      setShowTipModal(false);
      setTipAmount('');
      setTipMessage('');
      
    } catch (error) {
      console.error('Error sending tip:', error);
      alert('Failed to process tip');
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const toggleFullscreen = () => {
    if (videoRef.current) {
      if (!document.fullscreenElement) {
        videoRef.current.requestFullscreen();
      } else {
        document.exitFullscreen();
      }
    }
  };

  const handleLeave = () => {
    stopViewing();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="stream-viewer-overlay">
      <div className="stream-viewer-container">
        {/* Header */}
        <div className="viewer-header">
          <div className="stream-info">
            {loading ? (
              <div className="loading-text">Loading stream...</div>
            ) : streamInfo ? (
              <>
                <h2>{streamInfo.title}</h2>
                <div className="stream-meta">
                  <span className="streamer">
                    {streamInfo.stream_type === 'premium' && <Crown size={16} />}
                    {streamInfo.stream_type === 'private' && <Shield size={16} />}
                    @{streamInfo.streamer_username}
                  </span>
                  <span className="live-badge">
                    <div className="pulse"></div>
                    LIVE
                  </span>
                  <span className="viewer-count">
                    <Eye size={16} />
                    {streamInfo.viewer_count}
                  </span>
                </div>
              </>
            ) : (
              <div>Stream not found</div>
            )}
          </div>
          
          <button onClick={handleLeave} className="leave-btn">
            Leave Stream
          </button>
        </div>

        <div className="viewer-content">
          {/* Video Player */}
          <div className="video-section">
            <div className="video-container">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="stream-video"
                muted={isMuted}
              />
              
              {error && (
                <div className="error-overlay">
                  <p>Connection error: {error}</p>
                </div>
              )}
              
              {loading && (
                <div className="loading-overlay">
                  <div className="loading-spinner">
                    <div className="spinner"></div>
                    <p>Connecting to stream...</p>
                  </div>
                </div>
              )}

              {/* Video Controls */}
              <div className="video-controls">
                <div className="controls-left">
                  <button onClick={toggleMute} className="control-btn" title="Toggle sound">
                    {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                  </button>
                </div>
                
                <div className="controls-right">
                  <button onClick={toggleFullscreen} className="control-btn" title="Fullscreen">
                    <Maximize size={20} />
                  </button>
                </div>
              </div>
            </div>

            {/* Stream Actions */}
            <div className="stream-actions">
              <button 
                className="action-btn like-btn"
                onClick={() => {}} // Like functionality
              >
                <Heart size={20} />
                Like
              </button>
              
              {user && (
                <button 
                  className="action-btn tip-btn"
                  onClick={() => setShowTipModal(true)}
                >
                  <DollarSign size={20} />
                  Tip
                </button>
              )}
              
              <div className="stream-stats">
                <span><Users size={16} /> {viewers.length} viewers</span>
              </div>
            </div>
          </div>

          {/* Chat Section */}
          <div className="chat-section">
            <div className="chat-header">
              <MessageCircle size={20} />
              <span>Live Chat</span>
              <span className="chat-count">{chatMessages.length}</span>
            </div>

            <div className="chat-messages" ref={chatContainerRef}>
              {chatMessages.length === 0 ? (
                <div className="no-messages">
                  Be the first to say something!
                </div>
              ) : (
                chatMessages.map((msg, index) => (
                  <div key={index} className="chat-message">
                    <span className="username">{msg.user_id}:</span>
                    <span className="message">{msg.content}</span>
                    <span className="timestamp">
                      {new Date(msg.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                ))
              )}
            </div>

            {user ? (
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
            ) : (
              <div className="chat-login-prompt">
                <p>Login to participate in chat</p>
              </div>
            )}
          </div>
        </div>

        {/* Tip Modal */}
        {showTipModal && (
          <div className="tip-modal-overlay" onClick={() => setShowTipModal(false)}>
            <div className="tip-modal" onClick={(e) => e.stopPropagation()}>
              <div className="tip-header">
                <h3>Send a Tip</h3>
                <button onClick={() => setShowTipModal(false)}>×</button>
              </div>
              
              <div className="tip-content">
                <p>Send a tip to <strong>@{streamInfo?.streamer_username}</strong></p>
                
                <div className="tip-amounts">
                  {[5, 10, 25, 50, 100].map(amount => (
                    <button
                      key={amount}
                      className={`tip-amount-btn ${tipAmount === amount.toString() ? 'selected' : ''}`}
                      onClick={() => setTipAmount(amount.toString())}
                    >
                      ${amount}
                    </button>
                  ))}
                </div>
                
                <div className="custom-amount">
                  <label>Custom Amount ($1-$500)</label>
                  <input
                    type="number"
                    min="1"
                    max="500"
                    value={tipAmount}
                    onChange={(e) => setTipAmount(e.target.value)}
                    placeholder="Enter amount"
                  />
                </div>
                
                <div className="tip-message-input">
                  <label>Message (optional)</label>
                  <textarea
                    value={tipMessage}
                    onChange={(e) => setTipMessage(e.target.value)}
                    placeholder="Say something nice..."
                    maxLength={200}
                    rows="3"
                  />
                </div>
                
                <button 
                  className="send-tip-btn"
                  onClick={handleTip}
                  disabled={!tipAmount || parseFloat(tipAmount) < 1}
                >
                  <Gift size={20} />
                  Send ${tipAmount || '0'} Tip
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .stream-viewer-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.95);
          backdrop-filter: blur(10px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
        }

        .stream-viewer-container {
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

        .viewer-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 30px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(0, 0, 0, 0.3);
        }

        .stream-info h2 {
          margin: 0 0 8px 0;
          color: #ffffff;
          font-size: 24px;
          font-weight: 600;
        }

        .stream-meta {
          display: flex;
          align-items: center;
          gap: 16px;
          color: #cccccc;
          font-size: 14px;
        }

        .streamer {
          display: flex;
          align-items: center;
          gap: 6px;
          color: #e53e3e;
          font-weight: 600;
        }

        .live-badge {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 4px 8px;
          background: rgba(229, 62, 62, 0.2);
          border: 1px solid rgba(229, 62, 62, 0.4);
          border-radius: 12px;
          color: #e53e3e;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .pulse {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: currentColor;
          animation: pulse 2s infinite;
        }

        .viewer-count {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .leave-btn {
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 8px;
          padding: 12px 20px;
          color: #ffffff;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .leave-btn:hover {
          background: rgba(229, 62, 62, 0.1);
          border-color: rgba(229, 62, 62, 0.4);
          color: #e53e3e;
        }

        .viewer-content {
          display: flex;
          flex: 1;
          overflow: hidden;
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

        .stream-video {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .error-overlay,
        .loading-overlay {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(0, 0, 0, 0.8);
          color: #ffffff;
        }

        .error-overlay {
          background: rgba(229, 62, 62, 0.1);
          color: #ff6b6b;
        }

        .loading-spinner {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
        }

        .spinner {
          width: 40px;
          height: 40px;
          border: 3px solid rgba(255, 255, 255, 0.1);
          border-top: 3px solid #e53e3e;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
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
          opacity: 0;
          transition: opacity 0.3s;
        }

        .video-container:hover .video-controls {
          opacity: 1;
        }

        .control-btn {
          background: rgba(255, 255, 255, 0.1);
          border: none;
          border-radius: 50%;
          width: 44px;
          height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ffffff;
          cursor: pointer;
          transition: all 0.2s;
        }

        .control-btn:hover {
          background: rgba(255, 255, 255, 0.2);
        }

        .stream-actions {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 20px;
          background: rgba(255, 255, 255, 0.02);
          border-radius: 12px;
        }

        .action-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 20px;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .like-btn {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #ffffff;
        }

        .like-btn:hover {
          background: rgba(255, 105, 180, 0.1);
          border-color: rgba(255, 105, 180, 0.3);
          color: #ff69b4;
        }

        .tip-btn {
          background: linear-gradient(135deg, #ffd700, #ffb347);
          color: #000;
        }

        .tip-btn:hover {
          background: linear-gradient(135deg, #ffb347, #ffa500);
          transform: translateY(-2px);
        }

        .stream-stats {
          margin-left: auto;
          color: #888;
          font-size: 14px;
        }

        .stream-stats span {
          display: flex;
          align-items: center;
          gap: 6px;
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
          gap: 8px;
          padding: 20px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          color: #ffffff;
          font-weight: 600;
        }

        .chat-count {
          margin-left: auto;
          color: #888;
          font-size: 12px;
          background: rgba(255, 255, 255, 0.1);
          padding: 4px 8px;
          border-radius: 12px;
        }

        .chat-messages {
          flex: 1;
          padding: 20px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .no-messages {
          color: #888;
          text-align: center;
          font-style: italic;
          margin-top: 50%;
          transform: translateY(-50%);
        }

        .chat-message {
          display: flex;
          flex-direction: column;
          gap: 4px;
          padding: 8px;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.02);
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

        .chat-message .timestamp {
          color: #666;
          font-size: 12px;
          align-self: flex-end;
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

        .chat-login-prompt {
          padding: 20px;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
          text-align: center;
          color: #888;
        }

        .tip-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1001;
        }

        .tip-modal {
          background: linear-gradient(145deg, #1a1a2e, #16213e);
          border: 1px solid rgba(229, 62, 62, 0.2);
          border-radius: 16px;
          width: 100%;
          max-width: 500px;
          margin: 20px;
        }

        .tip-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 24px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .tip-header h3 {
          margin: 0;
          color: #ffffff;
          font-size: 20px;
        }

        .tip-header button {
          background: none;
          border: none;
          color: #888;
          font-size: 24px;
          cursor: pointer;
        }

        .tip-content {
          padding: 24px;
        }

        .tip-content p {
          margin: 0 0 20px 0;
          color: #cccccc;
          text-align: center;
        }

        .tip-amounts {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 12px;
          margin-bottom: 20px;
        }

        .tip-amount-btn {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          padding: 12px;
          color: #ffffff;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .tip-amount-btn:hover {
          background: rgba(255, 215, 0, 0.1);
          border-color: rgba(255, 215, 0, 0.3);
        }

        .tip-amount-btn.selected {
          background: rgba(255, 215, 0, 0.2);
          border-color: rgba(255, 215, 0, 0.5);
          color: #ffd700;
        }

        .custom-amount {
          margin-bottom: 20px;
        }

        .custom-amount label,
        .tip-message-input label {
          display: block;
          color: #ffffff;
          font-size: 14px;
          font-weight: 500;
          margin-bottom: 8px;
        }

        .custom-amount input,
        .tip-message-input textarea {
          width: 100%;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          padding: 12px;
          color: #ffffff;
          font-size: 14px;
          box-sizing: border-box;
        }

        .custom-amount input:focus,
        .tip-message-input textarea:focus {
          outline: none;
          border-color: #ffd700;
        }

        .tip-message-input {
          margin-bottom: 24px;
        }

        .tip-message-input textarea {
          resize: vertical;
          min-height: 80px;
        }

        .send-tip-btn {
          width: 100%;
          background: linear-gradient(135deg, #ffd700, #ffb347);
          border: none;
          border-radius: 8px;
          padding: 16px;
          color: #000;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: all 0.2s;
        }

        .send-tip-btn:hover:not(:disabled) {
          background: linear-gradient(135deg, #ffb347, #ffa500);
          transform: translateY(-2px);
        }

        .send-tip-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        @media (max-width: 1200px) {
          .chat-section {
            width: 300px;
          }
        }

        @media (max-width: 768px) {
          .stream-viewer-container {
            height: 100vh;
            border-radius: 0;
            max-width: none;
          }

          .viewer-content {
            flex-direction: column;
          }

          .chat-section {
            width: 100%;
            height: 300px;
            border-left: none;
            border-top: 1px solid rgba(255, 255, 255, 0.1);
          }

          .tip-amounts {
            grid-template-columns: repeat(3, 1fr);
          }
        }
      `}</style>
    </div>
  );
};

export default StreamViewer;