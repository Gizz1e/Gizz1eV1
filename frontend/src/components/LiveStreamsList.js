import React, { useState, useEffect } from 'react';
import { Eye, Crown, Shield, Users, Play, Clock } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const LiveStreamsList = ({ onStreamSelect }) => {
  const { canAccessStream } = useAuth();
  const [streams, setStreams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, public, private, premium

  useEffect(() => {
    loadActiveStreams();
    
    // Refresh streams every 30 seconds
    const interval = setInterval(loadActiveStreams, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadActiveStreams = async () => {
    try {
      const response = await axios.get(`${API}/streams/active`);
      setStreams(response.data);
    } catch (error) {
      console.error('Error loading streams:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredStreams = streams.filter(stream => {
    if (filter === 'all') return true;
    return stream.stream_type === filter;
  });

  const getStreamTypeIcon = (type) => {
    switch (type) {
      case 'premium':
        return <Crown size={16} />;
      case 'private':
        return <Shield size={16} />;
      default:
        return <Eye size={16} />;
    }
  };

  const getStreamTypeLabel = (type) => {
    switch (type) {
      case 'premium':
        return 'Premium';
      case 'private':
        return 'Private';
      default:
        return 'Public';
    }
  };

  const getStreamTypeBadgeClass = (type) => {
    switch (type) {
      case 'premium':
        return 'premium';
      case 'private':
        return 'private';
      default:
        return 'public';
    }
  };

  if (loading) {
    return (
      <div className="streams-loading">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading live streams...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="live-streams-list">
      <div className="streams-header">
        <h2>Live Streams</h2>
        
        <div className="streams-filters">
          <button
            className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All Streams
          </button>
          <button
            className={`filter-btn ${filter === 'public' ? 'active' : ''}`}
            onClick={() => setFilter('public')}
          >
            <Eye size={16} />
            Public
          </button>
          <button
            className={`filter-btn ${filter === 'private' ? 'active' : ''}`}
            onClick={() => setFilter('private')}
          >
            <Shield size={16} />
            Private
          </button>
          <button
            className={`filter-btn ${filter === 'premium' ? 'active' : ''}`}
            onClick={() => setFilter('premium')}
          >
            <Crown size={16} />
            Premium
          </button>
        </div>
      </div>

      {filteredStreams.length === 0 ? (
        <div className="no-streams">
          <div className="no-streams-content">
            <Play size={48} />
            <h3>No live streams</h3>
            <p>No {filter === 'all' ? '' : filter} streams are currently live.</p>
          </div>
        </div>
      ) : (
        <div className="streams-grid">
          {filteredStreams.map((stream) => {
            const canAccess = canAccessStream(stream.stream_type);
            
            return (
              <div
                key={stream.stream_id}
                className={`stream-card ${!canAccess ? 'locked' : ''}`}
                onClick={() => canAccess && onStreamSelect(stream)}
              >
                <div className="stream-thumbnail">
                  {/* Placeholder thumbnail - in real app would be actual video thumbnail */}
                  <div className="thumbnail-placeholder">
                    <Play size={32} />
                  </div>
                  
                  <div className="stream-overlay">
                    <div className="live-badge">
                      <div className="pulse"></div>
                      LIVE
                    </div>
                    
                    <div className="viewer-count">
                      <Users size={14} />
                      {stream.viewer_count}
                    </div>
                  </div>

                  <div className={`stream-type-badge ${getStreamTypeBadgeClass(stream.stream_type)}`}>
                    {getStreamTypeIcon(stream.stream_type)}
                    {getStreamTypeLabel(stream.stream_type)}
                  </div>

                  {!canAccess && (
                    <div className="access-overlay">
                      <div className="lock-icon">🔒</div>
                      <p>Requires {stream.stream_type} access</p>
                    </div>
                  )}
                </div>

                <div className="stream-info">
                  <h4 className="stream-title">{stream.title}</h4>
                  <div className="stream-meta">
                    <span className="streamer-name">@{stream.streamer_username}</span>
                    <span className="stream-duration">
                      <Clock size={12} />
                      {formatDuration(stream.created_at)}
                    </span>
                  </div>
                  
                  {stream.tips_received > 0 && (
                    <div className="tips-received">
                      💰 ${stream.tips_received} tips received
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <style jsx>{`
        .live-streams-list {
          padding: 40px;
          max-width: 1400px;
          margin: 0 auto;
        }

        .streams-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 32px;
        }

        .streams-header h2 {
          color: #ffffff;
          font-size: 28px;
          font-weight: 600;
          margin: 0;
        }

        .streams-filters {
          display: flex;
          gap: 8px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 12px;
          padding: 4px;
        }

        .filter-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 12px 16px;
          border: none;
          background: none;
          color: #888;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .filter-btn:hover {
          color: #ffffff;
        }

        .filter-btn.active {
          background: #e53e3e;
          color: #ffffff;
        }

        .streams-loading {
          display: flex;
          justify-content: center;
          align-items: center;
          height: 400px;
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

        .loading-spinner p {
          color: #888;
          margin: 0;
        }

        .no-streams {
          display: flex;
          justify-content: center;
          align-items: center;
          height: 400px;
        }

        .no-streams-content {
          text-align: center;
          color: #888;
        }

        .no-streams-content svg {
          margin-bottom: 20px;
          opacity: 0.5;
        }

        .no-streams-content h3 {
          margin: 0 0 8px 0;
          font-size: 20px;
        }

        .no-streams-content p {
          margin: 0;
          font-size: 16px;
        }

        .streams-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 24px;
        }

        .stream-card {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 16px;
          overflow: hidden;
          cursor: pointer;
          transition: all 0.3s ease;
          position: relative;
        }

        .stream-card:hover:not(.locked) {
          transform: translateY(-4px);
          border-color: rgba(229, 62, 62, 0.3);
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
        }

        .stream-card.locked {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .stream-thumbnail {
          position: relative;
          aspect-ratio: 16/9;
          background: linear-gradient(135deg, #2a2a2a, #1a1a1a);
        }

        .thumbnail-placeholder {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #888;
        }

        .stream-overlay {
          position: absolute;
          top: 12px;
          left: 12px;
          right: 12px;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }

        .live-badge {
          display: flex;
          align-items: center;
          gap: 6px;
          background: rgba(229, 62, 62, 0.9);
          color: #ffffff;
          padding: 6px 10px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .pulse {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: currentColor;
          animation: pulse 2s infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.2); }
        }

        .viewer-count {
          display: flex;
          align-items: center;
          gap: 4px;
          background: rgba(0, 0, 0, 0.7);
          color: #ffffff;
          padding: 6px 10px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 500;
        }

        .stream-type-badge {
          position: absolute;
          top: 12px;
          right: 12px;
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 6px 10px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
        }

        .stream-type-badge.public {
          background: rgba(76, 175, 80, 0.9);
          color: #ffffff;
        }

        .stream-type-badge.private {
          background: rgba(156, 39, 176, 0.9);
          color: #ffffff;
        }

        .stream-type-badge.premium {
          background: rgba(255, 193, 7, 0.9);
          color: #000000;
        }

        .access-overlay {
          position: absolute;
          inset: 0;
          background: rgba(0, 0, 0, 0.8);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: #ffffff;
        }

        .lock-icon {
          font-size: 32px;
          margin-bottom: 12px;
        }

        .access-overlay p {
          margin: 0;
          font-size: 14px;
          font-weight: 500;
        }

        .stream-info {
          padding: 16px;
        }

        .stream-title {
          margin: 0 0 8px 0;
          color: #ffffff;
          font-size: 16px;
          font-weight: 600;
          line-height: 1.3;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .stream-meta {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }

        .streamer-name {
          color: #e53e3e;
          font-size: 14px;
          font-weight: 500;
        }

        .stream-duration {
          display: flex;
          align-items: center;
          gap: 4px;
          color: #888;
          font-size: 12px;
        }

        .tips-received {
          color: #ffd700;
          font-size: 12px;
          font-weight: 500;
        }

        @media (max-width: 768px) {
          .live-streams-list {
            padding: 20px;
          }

          .streams-header {
            flex-direction: column;
            gap: 16px;
            align-items: flex-start;
          }

          .streams-filters {
            width: 100%;
            justify-content: center;
          }

          .streams-grid {
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 16px;
          }
        }
      `}</style>
    </div>
  );
};

// Helper function to format stream duration
const formatDuration = (createdAt) => {
  const now = new Date();
  const start = new Date(createdAt);
  const diff = now - start;
  
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else {
    return `${minutes}m`;
  }
};

export default LiveStreamsList;