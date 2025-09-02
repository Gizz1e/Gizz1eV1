import React, { useState, useEffect, useRef } from "react";
import "./App.css";
import "./VideoPlayer.css";
import { BrowserRouter, Routes, Route, Link, useLocation } from "react-router-dom";
import axios from "axios";
import { Upload, Play, Image, Users, Crown, ShoppingBag, Menu, X, Star, Check, Pause, Volume2, VolumeX, Maximize, SkipBack, SkipForward, ChevronLeft, ChevronRight, Info, Video, Shield, User } from "lucide-react";

// Import contexts and components
import AuthProvider, { useAuth } from './contexts/AuthContext';
import WebRTCProvider from './contexts/WebRTCContext';
import ViewerAuth from './components/ViewerAuth';
import ModelLogin from './components/ModelLogin';
import ModelApplication from './components/ModelApplication';
import LiveStreaming from './components/LiveStreaming';
import StreamViewer from './components/StreamViewer';
import LiveStreamsList from './components/LiveStreamsList';
import MobileNavigation from './components/MobileNavigation';
import ResponsiveVideoPlayer from './components/ResponsiveVideoPlayer';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// In-App Video Player Component
const VideoPlayer = ({ isOpen, onClose, videoSrc, title, description, poster }) => {
  const videoRef = useRef(null);
  const progressRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isBuffering, setIsBuffering] = useState(false);

  const controlsTimeoutRef = useRef(null);

  // Auto-hide controls after 3 seconds of inactivity
  const resetControlsTimeout = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
      }
    }, 3000);
  };

  // Video event handlers
  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
      setIsLoading(false);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleWaiting = () => setIsBuffering(true);
  const handleCanPlay = () => setIsBuffering(false);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleProgressClick = (e) => {
    if (progressRef.current && videoRef.current) {
      const rect = progressRef.current.getBoundingClientRect();
      const pos = (e.clientX - rect.left) / rect.width;
      const newTime = pos * duration;
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const handleVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
    }
    setIsMuted(newVolume === 0);
  };

  const toggleMute = () => {
    if (videoRef.current) {
      const newMuted = !isMuted;
      videoRef.current.muted = newMuted;
      setIsMuted(newMuted);
      if (newMuted) {
        videoRef.current.volume = 0;
      } else {
        videoRef.current.volume = volume;
      }
    }
  };

  const skipTime = (seconds) => {
    if (videoRef.current) {
      const newTime = Math.max(0, Math.min(duration, currentTime + seconds));
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      videoRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const formatTime = (time) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen) return;
      
      switch (e.code) {
        case 'Space':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          skipTime(-10);
          break;
        case 'ArrowRight':
          e.preventDefault();
          skipTime(10);
          break;
        case 'KeyM':
          e.preventDefault();
          toggleMute();
          break;
        case 'KeyF':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
        default:
          break;
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, isPlaying, currentTime, duration]);

  // Reset player state when opening
  useEffect(() => {
    if (isOpen) {
      setIsPlaying(false);
      setCurrentTime(0);
      setIsLoading(true);
      setIsBuffering(false);
      setShowControls(true);
      resetControlsTimeout();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="video-player-overlay" onClick={onClose}>
      <div className="video-player-container" onClick={(e) => e.stopPropagation()}>
        <button className="video-player-close" onClick={onClose}>
          <X size={24} />
        </button>

        <div 
          className="video-player-wrapper"
          onMouseMove={resetControlsTimeout}
          onMouseEnter={resetControlsTimeout}
        >
          <video
            ref={videoRef}
            className="video-player-video"
            src={videoSrc}
            poster={poster}
            onLoadedMetadata={handleLoadedMetadata}
            onTimeUpdate={handleTimeUpdate}
            onWaiting={handleWaiting}
            onCanPlay={handleCanPlay}
            onEnded={() => setIsPlaying(false)}
            onClick={togglePlay}
          />

          {/* Loading Spinner */}
          {(isLoading || isBuffering) && (
            <div className="video-player-loading">
              <div className="loading-spinner"></div>
              <p>{isLoading ? 'Loading video...' : 'Buffering...'}</p>
            </div>
          )}

          {/* Play Button Overlay */}
          {!isPlaying && !isLoading && (
            <div className="video-player-play-overlay" onClick={togglePlay}>
              <div className="video-player-play-button">
                <Play size={48} />
              </div>
            </div>
          )}

          {/* Controls */}
          <div className={`video-player-controls ${showControls ? 'show' : 'hide'}`}>
            <div className="video-player-progress-container">
              <div 
                className="video-player-progress-bar"
                ref={progressRef}
                onClick={handleProgressClick}
              >
                <div 
                  className="video-player-progress-filled"
                  style={{ width: `${(currentTime / duration) * 100}%` }}
                />
              </div>
            </div>

            <div className="video-player-controls-bottom">
              <div className="video-player-controls-left">
                <button className="video-control-btn" onClick={togglePlay}>
                  {isPlaying ? <Pause size={20} /> : <Play size={20} />}
                </button>

                <button className="video-control-btn" onClick={() => skipTime(-10)}>
                  <SkipBack size={20} />
                </button>

                <button className="video-control-btn" onClick={() => skipTime(10)}>
                  <SkipForward size={20} />
                </button>

                <div className="video-player-volume">
                  <button className="video-control-btn" onClick={toggleMute}>
                    {isMuted || volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
                  </button>
                  <input
                    type="range"
                    className="volume-slider"
                    min="0"
                    max="1"
                    step="0.1"
                    value={isMuted ? 0 : volume}
                    onChange={handleVolumeChange}
                  />
                </div>

                <div className="video-player-time">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </div>
              </div>

              <div className="video-player-controls-right">
                <button className="video-control-btn" onClick={toggleFullscreen}>
                  <Maximize size={20} />
                </button>
              </div>
            </div>
          </div>

          {/* Video Info */}
          <div className="video-player-info">
            <h3>{title}</h3>
            {description && <p>{description}</p>}
          </div>
        </div>
      </div>
    </div>
  );
};

// Netflix-style Header
const NetflixHeader = ({ 
  activeSection, 
  setActiveSection, 
  showViewerAuth, 
  setShowViewerAuth, 
  setViewerAuthMode,
  showModelLogin,
  setShowModelLogin,
  setShowModelApplication, 
  setShowLiveStreaming,
  user,
  isAuthenticated,
  canCreateStreams,
  logout
}) => {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 0);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header className={`netflix-header ${isScrolled ? 'scrolled' : ''}`}>
      <div className="header-left">
        <div className="logo">
          <img 
            src="https://customer-assets.emergentagent.com/job_media-upload-2/artifacts/ysim4ger_thumbnail_FD3537EB-E493-45C7-8E2E-1C6F4DC548FB.jpg"
            alt="Gizzle TV"
            className="logo-img"
          />
          <span className="logo-text">Gizzle TV</span>
        </div>
        
        <nav className="main-nav">
          <button 
            className={`nav-item ${activeSection === 'home' ? 'active' : ''}`}
            onClick={() => setActiveSection('home')}
          >
            Home
          </button>
          <button 
            className={`nav-item ${activeSection === 'models' ? 'active' : ''}`}
            onClick={() => setActiveSection('models')}
          >
            Models
          </button>
          <button 
            className={`nav-item ${activeSection === 'gizzle-tv' ? 'active' : ''}`}
            onClick={() => setActiveSection('gizzle-tv')}
          >
            Gizzle TV
          </button>
          <button 
            className={`nav-item ${activeSection === 'videos' ? 'active' : ''}`}
            onClick={() => setActiveSection('videos')}
          >
            Videos
          </button>
          <button 
            className={`nav-item ${activeSection === 'pictures' ? 'active' : ''}`}
            onClick={() => setActiveSection('pictures')}
          >
            Pictures
          </button>
          <button 
            className={`nav-item ${activeSection === 'community' ? 'active' : ''}`}
            onClick={() => setActiveSection('community')}
          >
            Community
          </button>
          <button 
            className={`nav-item ${activeSection === 'live-streams' ? 'active' : ''}`}
            onClick={() => setActiveSection('live-streams')}
          >
            <Video size={16} />
            Live
          </button>
        </nav>
      </div>

      <div className="header-right">
        {/* Streaming Actions for verified models */}
        {canCreateStreams && canCreateStreams() && (
          <button 
            className="nav-item streaming-btn"
            onClick={() => setShowLiveStreaming(true)}
            title="Start Live Stream"
          >
            <Video size={16} />
            Go Live
          </button>
        )}
        
        <button 
          className={`nav-item ${activeSection === 'subscriptions' ? 'active' : ''}`}
          onClick={() => setActiveSection('subscriptions')}
        >
          <Crown size={16} />
          Premium
        </button>
        <button 
          className={`nav-item ${activeSection === 'store' ? 'active' : ''}`}
          onClick={() => setActiveSection('store')}
        >
          <ShoppingBag size={16} />
          Store
        </button>
        
        {/* Dual Authentication UI */}
        <div className="profile-menu">
          {isAuthenticated ? (
            <div className="user-dropdown">
              <div className="profile-avatar authenticated">
                <User size={20} />
                <span className="username">{user?.username}</span>
                <span className="account-badge">
                  {user?.account_type === 'model' ? '👑' : '👤'}
                </span>
              </div>
              <div className="dropdown-content">
                {user?.is_model && user?.model_verification_status === 'pending' && (
                  <button onClick={() => setShowModelApplication(true)}>
                    <Shield size={16} />
                    Complete Model Application
                  </button>
                )}
                {user?.is_model && user?.model_verification_status === 'approved' && (
                  <button onClick={() => setShowLiveStreaming(true)}>
                    <Video size={16} />
                    Start Streaming
                  </button>
                )}
                <button onClick={logout}>
                  Logout
                </button>
              </div>
            </div>
          ) : (
            <div className="auth-buttons">
              <div className="viewer-auth-section">
                <button 
                  className="viewer-login-btn"
                  onClick={() => {
                    setViewerAuthMode('login');
                    setShowViewerAuth(true);
                  }}
                >
                  <User size={16} />
                  Sign In
                </button>
                <button 
                  className="viewer-signup-btn"
                  onClick={() => {
                    setViewerAuthMode('register');
                    setShowViewerAuth(true);
                  }}
                >
                  Join Now
                </button>
              </div>
              
              <div className="divider">|</div>
              
              <button 
                className="model-login-btn"
                onClick={() => setShowModelLogin(true)}
                title="Model Portal Access"
              >
                <Shield size={16} />
                Model Login
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

// Netflix-style Hero Banner
const HeroBanner = ({ onPlayClick }) => {
  const heroContent = {
    src: "https://customer-assets.emergentagent.com/job_media-upload-2/artifacts/hd2ztl4a_Rimmington.mp4",
    title: "Rimmington",
    description: "Experience the ultimate entertainment with Gizzle TV's exclusive content. Dive into a world of premium videos, community features, and unlimited streaming.",
    poster: "https://customer-assets.emergentagent.com/job_media-upload-2/artifacts/ysim4ger_thumbnail_FD3537EB-E493-45C7-8E2E-1C6F4DC548FB.jpg"
  };

  return (
    <div className="hero-banner">
      <div className="hero-background">
        <img 
          src="https://customer-assets.emergentagent.com/job_media-upload-2/artifacts/5xzuzie2_thumbnail_FD3537EB-E493-45C7-8E2E-1C6F4DC548FB.png"
          alt="Gizzle TV Background"
          className="hero-bg-img"
          onError={(e) => {
            console.log("Image failed to load, using fallback");
            e.target.src = "https://customer-assets.emergentagent.com/job_media-upload-2/artifacts/ysim4ger_thumbnail_FD3537EB-E493-45C7-8E2E-1C6F4DC548FB.jpg";
          }}
        />
        <div className="hero-video-overlay"></div>
        <div className="hero-gradient-overlay"></div>
        <div className="hero-fade-animation"></div>
      </div>
      
      <div className="hero-content">
        <h1 className="hero-title">Welcome to Gizzle TV</h1>
        <p className="hero-description">
          Experience the ultimate entertainment with Gizzle TV's exclusive content. Dive into a world of premium videos, community features, and unlimited streaming.
        </p>
        
        <div className="hero-buttons">
          <button 
            className="hero-btn primary"
            onClick={() => onPlayClick(heroContent)}
          >
            <Play size={20} />
            Play Now
          </button>
          <button className="hero-btn secondary">
            <Info size={20} />
            More Info
          </button>
        </div>
      </div>
    </div>
  );
};

// Content Row Component
const ContentRow = ({ title, items, onItemClick }) => {
  const scrollRef = useRef(null);

  const scroll = (direction) => {
    const container = scrollRef.current;
    const scrollAmount = 320;
    
    if (container) {
      container.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  return (
    <div className="content-row">
      <h2 className="row-title">{title}</h2>
      <div className="row-container">
        <button className="scroll-btn left" onClick={() => scroll('left')}>
          <ChevronLeft size={24} />
        </button>
        
        <div className="content-slider" ref={scrollRef}>
          {items.map((item, index) => (
            <div 
              key={index} 
              className="content-card"
              onClick={() => onItemClick && onItemClick(item)}
            >
              <div className="card-image">
                <img src={item.image} alt={item.title} />
                <div className="card-overlay">
                  <button className="play-btn">
                    <Play size={24} />
                  </button>
                </div>
              </div>
              <div className="card-info">
                <h4>{item.title}</h4>
                <p>{item.category}</p>
              </div>
            </div>
          ))}
        </div>
        
        <button className="scroll-btn right" onClick={() => scroll('right')}>
          <ChevronRight size={24} />
        </button>
      </div>
    </div>
  );
};

// Models Section Component
const ModelsSection = ({ onVideoClick, onBecomeModel }) => {
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Sample model data - in production this would come from API
    setModels([
      {
        id: 1,
        name: "Sophia Chen",
        category: "Fashion Model",
        image: "https://images.unsplash.com/photo-1735212769704-d03b95dd1a14",
        videos: 12,
        subscribers: "2.3M",
        verified: true,
        featured: true
      },
      {
        id: 2,
        name: "Maya Rodriguez",
        category: "Fitness Model",
        image: "https://images.unsplash.com/photo-1735212659418-715ca2ff7c20",
        videos: 8,
        subscribers: "1.8M",
        verified: true,
        featured: false
      },
      {
        id: 3,
        name: "Elena Kowalski",
        category: "Lifestyle Model",
        image: "https://images.unsplash.com/photo-1726935068680-73cef7e8412b",
        videos: 15,
        subscribers: "3.1M",
        verified: true,
        featured: false
      },
      {
        id: 4,
        name: "Aria Thompson",
        category: "Commercial Model",
        image: "https://images.unsplash.com/photo-1685440663653-fa3e81dd109c",
        videos: 6,
        subscribers: "1.2M",
        verified: false,
        featured: false
      },
      {
        id: 5,
        name: "Luna Martinez",
        category: "Creative Model",
        image: "https://images.unsplash.com/photo-1616469829941-c7200edec809",
        videos: 20,
        subscribers: "4.5M",
        verified: true,
        featured: true
      }
    ]);
    setLoading(false);
  }, []);

  const featuredModels = models.filter(model => model.featured);
  const allModels = models;

  return (
    <div className="models-section">
      <div className="models-hero">
        <div className="models-hero-bg">
          <img src="https://images.unsplash.com/photo-1735212769704-d03b95dd1a14" alt="Models Background" />
          <div className="models-hero-gradient"></div>
        </div>
        <div className="models-hero-content">
          <h1>Discover Amazing Models</h1>
          <p>Connect with talented creators and explore exclusive content from verified models</p>
          <button className="hero-btn primary">
            <Star size={20} />
            Become a Model
          </button>
        </div>
      </div>

      <div className="content-rows">
        {/* Featured Models */}
        <div className="content-row">
          <h2 className="row-title">Featured Models</h2>
          <div className="models-grid featured">
            {featuredModels.map(model => (
              <div key={model.id} className="model-card featured-card">
                <div className="model-image">
                  <img src={model.image} alt={model.name} />
                  {model.verified && (
                    <div className="verified-badge">
                      <Check size={16} />
                    </div>
                  )}
                  <div className="model-overlay">
                    <button 
                      className="view-profile-btn"
                      onClick={() => onVideoClick && onVideoClick({
                        src: "https://customer-assets.emergentagent.com/job_media-upload-2/artifacts/hd2ztl4a_Rimmington.mp4",
                        title: `${model.name} - Portfolio`,
                        description: `Exclusive content from ${model.name}, ${model.category}`,
                        poster: model.image
                      })}
                    >
                      View Profile
                    </button>
                  </div>
                </div>
                <div className="model-info">
                  <h3>{model.name}</h3>
                  <p className="model-category">{model.category}</p>
                  <div className="model-stats">
                    <span>{model.videos} videos</span>
                    <span>{model.subscribers} subscribers</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* All Models */}
        <div className="content-row">
          <h2 className="row-title">All Models</h2>
          <div className="models-grid">
            {allModels.map(model => (
              <div key={model.id} className="model-card">
                <div className="model-image">
                  <img src={model.image} alt={model.name} />
                  {model.verified && (
                    <div className="verified-badge">
                      <Check size={16} />
                    </div>
                  )}
                  <div className="model-overlay">
                    <button 
                      className="view-profile-btn"
                      onClick={() => onVideoClick && onVideoClick({
                        src: "https://customer-assets.emergentagent.com/job_media-upload-2/artifacts/ttfzvpjp_GizzleSummer2.mp4",
                        title: `${model.name} - Content`,
                        description: `Watch ${model.name}'s latest content and portfolio`,
                        poster: model.image
                      })}
                    >
                      View Profile
                    </button>
                  </div>
                </div>
                <div className="model-info">
                  <h3>{model.name}</h3>
                  <p className="model-category">{model.category}</p>
                  <div className="model-stats">
                    <span>{model.videos} videos</span>
                    <span>{model.subscribers} subscribers</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// Enhanced Upload Section Component with larger file support
const UploadSection = ({ category }) => {
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [fileSize, setFileSize] = useState(0);
  const [uploadSpeed, setUploadSpeed] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(0);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileUpload(e.target.files[0]);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatTime = (seconds) => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m ${Math.round(seconds % 60)}s`;
    return `${Math.round(seconds / 3600)}h ${Math.round((seconds % 3600) / 60)}m`;
  };

  const handleFileUpload = async (file) => {
    // Check file size (allow up to 10GB for high-quality videos)
    const maxSize = category === 'videos' ? 10 * 1024 * 1024 * 1024 : 100 * 1024 * 1024; // 10GB for videos, 100MB for pictures
    
    if (file.size > maxSize) {
      setUploadStatus(`File too large. Maximum size: ${formatFileSize(maxSize)}`);
      setTimeout(() => setUploadStatus(''), 5000);
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setFileSize(file.size);
    setUploadStatus(`Uploading ${formatFileSize(file.size)} file...`);
    
    const startTime = Date.now();
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('category', category);
    formData.append('description', `High-quality ${category.slice(0, -1)} - ${file.name}`);
    
    try {
      const response = await axios.post(`${API}/content/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(progress);
          
          // Calculate upload speed and time remaining
          const elapsed = (Date.now() - startTime) / 1000;
          const speed = progressEvent.loaded / elapsed;
          const remaining = (progressEvent.total - progressEvent.loaded) / speed;
          
          setUploadSpeed(speed);
          setTimeRemaining(remaining);
          
          setUploadStatus(`Uploading... ${progress}% - ${formatFileSize(speed)}/s - ${formatTime(remaining)} remaining`);
        }
      });
      
      setUploadStatus('Upload successful! Processing high-quality video...');
      setUploadProgress(100);
      setTimeout(() => {
        setUploadStatus('');
        setUploadProgress(0);
      }, 3000);
    } catch (error) {
      console.error('Upload error:', error);
      setUploadStatus('Upload failed. Please check your connection and try again.');
      setTimeout(() => {
        setUploadStatus('');
        setUploadProgress(0);
      }, 5000);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="netflix-upload-section">
      <div className="upload-header">
        <h2>Upload High-Quality Content</h2>
        <div className="upload-info">
          <p>
            {category === 'videos' 
              ? 'Upload videos up to 10GB in 4K, 8K, or any high resolution format' 
              : 'Upload pictures up to 100MB in high resolution'}
          </p>
          <div className="supported-formats">
            <span>Supported formats:</span>
            {category === 'videos' 
              ? <span>MP4, MOV, AVI, MKV, WebM (4K, 8K supported)</span>
              : <span>JPG, PNG, WebP, HEIC (RAW formats supported)</span>
            }
          </div>
        </div>
      </div>

      <div 
        className={`upload-zone enhanced ${dragActive ? 'drag-active' : ''} ${uploading ? 'uploading' : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input 
          type="file" 
          className="file-input"
          onChange={handleFileInput}
          accept={category === 'videos' ? 'video/*' : 'image/*'}
          disabled={uploading}
        />
        
        {!uploading ? (
          <div className="upload-content">
            <Upload size={64} className="upload-icon" />
            <h3>Drop your high-quality {category.slice(0, -1)} here</h3>
            <p>or click to browse files</p>
            <div className="upload-specs">
              <div className="spec-item">
                <strong>Max size:</strong> {category === 'videos' ? '10GB' : '100MB'}
              </div>
              <div className="spec-item">
                <strong>Quality:</strong> {category === 'videos' ? 'Up to 8K resolution' : 'RAW formats supported'}
              </div>
            </div>
          </div>
        ) : (
          <div className="upload-progress-container">
            <div className="upload-progress-circle">
              <svg viewBox="0 0 36 36" className="circular-chart">
                <path className="circle-bg"
                  d="M18 2.0845
                    a 15.9155 15.9155 0 0 1 0 31.831
                    a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path className="circle"
                  strokeDasharray={`${uploadProgress}, 100`}
                  d="M18 2.0845
                    a 15.9155 15.9155 0 0 1 0 31.831
                    a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <text x="18" y="20.35" className="percentage">{Math.round(uploadProgress)}%</text>
              </svg>
            </div>
            <div className="upload-details">
              <h3>Uploading {formatFileSize(fileSize)}</h3>
              <div className="progress-bar">
                <div 
                  className="progress-fill"
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
            </div>
          </div>
        )}

        {uploadStatus && (
          <div className={`upload-status enhanced ${uploadStatus.includes('successful') ? 'success' : uploadStatus.includes('failed') ? 'error' : 'info'}`}>
            {uploadStatus}
          </div>
        )}
      </div>
    </div>
  );
};

// Footer Contact Section
const Footer = () => {
  return (
    <footer className="netflix-footer">
      <div className="footer-content">
        <div className="footer-main">
          <div className="footer-brand">
            <img 
              src="https://customer-assets.emergentagent.com/job_media-upload-2/artifacts/ysim4ger_thumbnail_FD3537EB-E493-45C7-8E2E-1C6F4DC548FB.jpg"
              alt="Gizzle TV"
              className="footer-logo"
            />
            <span className="footer-brand-text">Gizzle TV L.L.C.</span>
          </div>
          
          <div className="footer-links">
            <div className="footer-column">
              <h4>Platform</h4>
              <ul>
                <li><a href="#models">Models</a></li>
                <li><a href="#videos">Videos</a></li>
                <li><a href="#pictures">Pictures</a></li>
                <li><a href="#community">Community</a></li>
              </ul>
            </div>
            
            <div className="footer-column">
              <h4>Services</h4>
              <ul>
                <li><a href="#premium">Premium Plans</a></li>
                <li><a href="#store">Store</a></li>
                <li><a href="#gizzle-tv">Gizzle TV Originals</a></li>
                <li><a href="#live-streams">Live Streaming</a></li>
              </ul>
            </div>
            
            <div className="footer-column">
              <h4>Support</h4>
              <ul>
                <li><a href="#help">Help Center</a></li>
                <li><a href="#terms">Terms of Service</a></li>
                <li><a href="#privacy">Privacy Policy</a></li>
                <li><a href="#guidelines">Community Guidelines</a></li>
              </ul>
            </div>
            
            <div className="footer-column contact-column">
              <h4>Contact Us</h4>
              <div className="contact-info">
                <p>Get in touch with our team</p>
                <a 
                  href="mailto:GizzleTV_LLC@proton.me"
                  className="contact-email"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                    <polyline points="22,6 12,13 2,6"/>
                  </svg>
                  GizzleTV_LLC@proton.me
                </a>
                <p className="contact-note">
                  Business inquiries, partnerships, and support
                </p>
              </div>
            </div>
          </div>
        </div>
        
        <div className="footer-bottom">
          <div className="footer-social">
            <span>Follow Gizzle TV:</span>
            <div className="social-links">
              <a href="#" className="social-link">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z"/>
                </svg>
              </a>
              <a href="#" className="social-link">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22.46 6c-.77.35-1.6.58-2.46.69.88-.53 1.56-1.37 1.88-2.38-.83.5-1.75.85-2.72 1.05C18.37 4.5 17.26 4 16 4c-2.35 0-4.27 1.92-4.27 4.29 0 .34.04.67.11.98C8.28 9.09 5.11 7.38 3 4.79c-.37.63-.58 1.37-.58 2.15 0 1.49.75 2.81 1.91 3.56-.71 0-1.37-.2-1.95-.5v.03c0 2.08 1.48 3.82 3.44 4.21a4.22 4.22 0 0 1-1.93.07 4.28 4.28 0 0 0 4 2.98 8.521 8.521 0 0 1-5.33 1.84c-.34 0-.68-.02-1.02-.06C3.44 20.29 5.7 21 8.12 21 16 21 20.33 14.46 20.33 8.79c0-.19 0-.37-.01-.56.84-.6 1.56-1.36 2.14-2.23z"/>
                </svg>
              </a>
              <a href="#" className="social-link">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.174-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.719-.359-1.781c0-1.663.967-2.911 2.168-2.911 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.791.099.12.112.225.083.345-.09.375-.293 1.199-.334 1.363-.053.225-.172.271-.402.165-1.495-.69-2.433-2.878-2.433-4.646 0-3.776 2.748-7.252 7.92-7.252 4.158 0 7.392 2.967 7.392 6.923 0 4.135-2.607 7.462-6.233 7.462-1.214 0-2.357-.629-2.748-1.378 0 0-.599 2.282-.744 2.840-.282 1.064-1.027 2.486-1.486 3.307C9.725 23.789 10.85 24.016 12.017 24.016c6.624 0 11.99-5.367 11.99-11.989C24.007 5.367 18.641.001 12.017.001z"/>
                </svg>
              </a>
              <a href="#" className="social-link">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                </svg>
              </a>
            </div>
          </div>
          
          <div className="footer-copyright">
            <p>&copy; 2024 Gizzle TV L.L.C. All rights reserved.</p>
            <p className="footer-tagline">Premium Entertainment Platform</p>
          </div>
        </div>
      </div>
    </footer>
  );
};

// Main App Component
function AppContent() {
  const { user, isAuthenticated, logout, canCreateStreams } = useAuth();
  const [activeSection, setActiveSection] = useState('home');
  const [videoPlayerOpen, setVideoPlayerOpen] = useState(false);
  const [currentVideo, setCurrentVideo] = useState(null);
  const [contentData, setContentData] = useState({
    trending: [],
    featured: [],
    community: [],
    recent: []
  });

  // New states for dual authentication system
  const [showViewerAuth, setShowViewerAuth] = useState(false);
  const [showModelLogin, setShowModelLogin] = useState(false);
  const [showModelApplication, setShowModelApplication] = useState(false);
  const [showLiveStreaming, setShowLiveStreaming] = useState(false);
  const [showStreamViewer, setShowStreamViewer] = useState(false);
  const [selectedStreamId, setSelectedStreamId] = useState(null);
  const [viewerAuthMode, setViewerAuthMode] = useState('register');

  // Sample data for Netflix-style rows
  useEffect(() => {
    setContentData({
      trending: [
        { 
          title: "Gizzle Summer", 
          category: "Featured",
          image: "https://images.unsplash.com/photo-1735212769704-d03b95dd1a14",
          video: "https://customer-assets.emergentagent.com/job_media-upload-2/artifacts/ttfzvpjp_GizzleSummer2.mp4"
        },
        { 
          title: "Entertainment Hub", 
          category: "Original",
          image: "https://images.unsplash.com/photo-1735212659418-715ca2ff7c20"
        },
        { 
          title: "Mobile Experience", 
          category: "Series",
          image: "https://images.unsplash.com/photo-1726935068680-73cef7e8412b"
        },
        { 
          title: "Streaming Tech", 
          category: "Documentary",
          image: "https://images.unsplash.com/photo-1685440663653-fa3e81dd109c"
        },
        { 
          title: "Platform Features", 
          category: "Original",
          image: "https://images.unsplash.com/photo-1616469829941-c7200edec809"
        }
      ],
      featured: [
        { 
          title: "Rimmington", 
          category: "Exclusive",
          image: "https://customer-assets.emergentagent.com/job_media-upload-2/artifacts/ysim4ger_thumbnail_FD3537EB-E493-45C7-8E2E-1C6F4DC548FB.jpg",
          video: "https://customer-assets.emergentagent.com/job_media-upload-2/artifacts/hd2ztl4a_Rimmington.mp4"
        },
        { 
          title: "Community Highlights", 
          category: "Community",
          image: "https://images.unsplash.com/photo-1735212769704-d03b95dd1a14"
        },
        { 
          title: "Live Streaming", 
          category: "Live",
          image: "https://images.unsplash.com/photo-1685440663653-fa3e81dd109c"
        }
      ]
    });
  }, []);

  const openVideoPlayer = (videoData) => {
    setCurrentVideo({
      src: videoData.video || videoData.src,
      title: videoData.title,
      description: videoData.description || `Watch ${videoData.title} on Gizzle TV`,
      poster: videoData.image || videoData.poster
    });
    setVideoPlayerOpen(true);
  };

  const renderContent = () => {
    switch (activeSection) {
      case 'home':
        return (
          <div className="netflix-home">
            <HeroBanner onPlayClick={openVideoPlayer} />
            <div className="content-rows">
              <ContentRow 
                title="Trending Now" 
                items={contentData.trending}
                onItemClick={openVideoPlayer}
              />
              <ContentRow 
                title="Gizzle TV Originals" 
                items={contentData.featured}
                onItemClick={openVideoPlayer}
              />
              <ContentRow 
                title="Continue Watching" 
                items={contentData.trending.slice(1, 4)}
                onItemClick={openVideoPlayer}
              />
            </div>
          </div>
        );
      
      case 'models':
        return <ModelsSection onVideoClick={openVideoPlayer} />;
      
      case 'gizzle-tv':
        return (
          <div className="netflix-section">
            <div className="section-hero">
              <div className="section-hero-bg">
                <img src="https://customer-assets.emergentagent.com/job_media-upload-2/artifacts/ysim4ger_thumbnail_FD3537EB-E493-45C7-8E2E-1C6F4DC548FB.jpg" alt="Gizzle TV" />
                <div className="section-hero-gradient"></div>
              </div>
              <div className="section-hero-content">
                <h1>Gizzle TV Exclusives</h1>
                <p>Premium content created exclusively for our community</p>
              </div>
            </div>
            
            <div className="content-rows">
              {/* Retrospective Featured Section */}
              <div className="retrospective-section">
                <h2 className="row-title featured-title">Retrospective</h2>
                <p className="featured-subtitle">A cinematic journey through our finest moments</p>
                
                <div className="retrospective-featured">
                  <div 
                    className="retrospective-card"
                    onClick={() => openVideoPlayer({
                      src: "https://customer-assets.emergentagent.com/job_media-upload-2/artifacts/jzu6cqn5_AVAssetExportPreset3840x21602.mp4",
                      title: "Retrospective",
                      description: "A premium cinematic experience showcasing the finest moments and artistic vision of Gizzle TV. This exclusive 4K content represents the pinnacle of our creative journey.",
                      poster: "https://customer-assets.emergentagent.com/job_media-upload-2/artifacts/ysim4ger_thumbnail_FD3537EB-E493-45C7-8E2E-1C6F4DC548FB.jpg"
                    })}
                  >
                    <div className="retrospective-image">
                      <img 
                        src="https://customer-assets.emergentagent.com/job_media-upload-2/artifacts/ysim4ger_thumbnail_FD3537EB-E493-45C7-8E2E-1C6F4DC548FB.jpg" 
                        alt="Retrospective"
                      />
                      <div className="retrospective-overlay">
                        <div className="retrospective-play-btn">
                          <Play size={48} />
                        </div>
                        <div className="video-quality-badge">4K UHD</div>
                      </div>
                    </div>
                    
                    <div className="retrospective-info">
                      <div className="retrospective-header">
                        <h3>Retrospective</h3>
                        <div className="retrospective-badges">
                          <span className="exclusive-badge">
                            <Star size={14} />
                            Exclusive
                          </span>
                          <span className="premium-badge">
                            <Crown size={14} />
                            Premium
                          </span>
                        </div>
                      </div>
                      <p className="retrospective-description">
                        A premium cinematic experience showcasing the artistic vision and finest moments of Gizzle TV's creative journey.
                      </p>
                      <div className="retrospective-meta">
                        <span className="duration">Featured Length</span>
                        <span className="quality">Ultra HD Quality</span>
                        <span className="year">2024</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Other Gizzle TV Content */}
              <ContentRow 
                title="Featured Originals" 
                items={contentData.featured}
                onItemClick={openVideoPlayer}
              />
              
              <ContentRow 
                title="Latest Releases" 
                items={contentData.trending.slice(0, 3)}
                onItemClick={openVideoPlayer}
              />
            </div>
          </div>
        );
      
      case 'videos':
        return (
          <div className="netflix-section">
            <UploadSection category="videos" />
            <div className="content-rows">
              <ContentRow 
                title="Your Videos" 
                items={contentData.trending}
                onItemClick={openVideoPlayer}
              />
            </div>
          </div>
        );
      
      case 'pictures':
        return (
          <div className="netflix-section">
            <UploadSection category="pictures" />
            <div className="content-rows">
              <ContentRow 
                title="Your Pictures" 
                items={contentData.trending}
              />
            </div>
          </div>
        );
      
      case 'subscriptions':
        return (
          <div className="netflix-section subscription-plans">
            <div className="plans-header">
              <h1>Choose Your Plan</h1>
              <p>Unlock premium features and exclusive content</p>
            </div>
            
            <div className="plans-container">
              <div className="plan-card">
                <h3>Basic</h3>
                <div className="plan-price">$9.99<span>/month</span></div>
                <ul className="plan-features">
                  <li>Upload videos up to 1GB</li>
                  <li>10 videos per day</li>
                  <li>Basic community access</li>
                  <li>Standard quality streaming</li>
                </ul>
                <button className="plan-btn">Choose Basic</button>
              </div>
              
              <div className="plan-card featured">
                <div className="popular-badge">Most Popular</div>
                <h3>Premium</h3>
                <div className="plan-price">$19.99<span>/month</span></div>
                <ul className="plan-features">
                  <li>Upload videos up to 5GB</li>
                  <li>Unlimited uploads</li>
                  <li>Premium community features</li>
                  <li>4K quality streaming</li>
                  <li>Model verification badge</li>
                </ul>
                <button className="plan-btn primary">Choose Premium</button>
              </div>
              
              <div className="plan-card">
                <h3>VIP</h3>
                <div className="plan-price">$39.99<span>/month</span></div>
                <ul className="plan-features">
                  <li>Upload videos up to 10GB</li>
                  <li>8K quality streaming</li>
                  <li>Exclusive model features</li>
                  <li>Priority support</li>
                  <li>Advanced analytics</li>
                </ul>
                <button className="plan-btn">Choose VIP</button>
              </div>
            </div>
          </div>
        );
      
      case 'live-streams':
        return (
          <div className="netflix-section">
            <LiveStreamsList 
              onStreamSelect={(stream) => {
                setSelectedStreamId(stream.stream_id);
                setShowStreamViewer(true);
              }}
            />
          </div>
        );
      
      default:
        return (
          <div className="netflix-section">
            <div className="coming-soon">
              <h1>Coming Soon</h1>
              <p>This section is under development</p>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="netflix-app">
      <NetflixHeader 
        activeSection={activeSection}
        setActiveSection={setActiveSection}
        showViewerAuth={showViewerAuth}
        setShowViewerAuth={setShowViewerAuth}
        setViewerAuthMode={setViewerAuthMode}
        showModelLogin={showModelLogin}
        setShowModelLogin={setShowModelLogin}
        setShowModelApplication={setShowModelApplication}
        setShowLiveStreaming={setShowLiveStreaming}
        user={user}
        isAuthenticated={isAuthenticated}
        canCreateStreams={canCreateStreams}
        logout={logout}
      />

      {/* Mobile Navigation */}
      <MobileNavigation
        activeSection={activeSection}
        setActiveSection={setActiveSection}
        setShowViewerAuth={setShowViewerAuth}
        setViewerAuthMode={setViewerAuthMode}
        setShowModelLogin={setShowModelLogin}
        isAuthenticated={isAuthenticated}
        user={user}
        logout={logout}
      />
      
      <main className="netflix-main">
        {renderContent()}
      </main>

      <Footer />

      {/* Responsive Video Player */}
      {videoPlayerOpen && currentVideo && (
        <ResponsiveVideoPlayer
          isOpen={videoPlayerOpen}
          onClose={() => setVideoPlayerOpen(false)}
          videoSrc={currentVideo.src}
          title={currentVideo.title}
          description={currentVideo.description}
          poster={currentVideo.poster}
        />
      )}

      {/* Viewer Authentication Modal */}
      <ViewerAuth
        isOpen={showViewerAuth}
        onClose={() => setShowViewerAuth(false)}
        initialMode={viewerAuthMode}
      />

      {/* Model Login Modal */}
      <ModelLogin
        isOpen={showModelLogin}
        onClose={() => setShowModelLogin(false)}
      />

      {/* Model Application Modal */}
      <ModelApplication
        isOpen={showModelApplication}
        onClose={() => setShowModelApplication(false)}
      />

      {/* Live Streaming Modal */}
      <LiveStreaming
        isOpen={showLiveStreaming}
        onClose={() => setShowLiveStreaming(false)}
      />

      {/* Stream Viewer Modal */}
      <StreamViewer
        streamId={selectedStreamId}
        isOpen={showStreamViewer}
        onClose={() => {
          setShowStreamViewer(false);
          setSelectedStreamId(null);
        }}
      />
    </div>
  );
}

// Main App Component with Providers
function App() {
  return (
    <AuthProvider>
      <WebRTCProvider>
        <AppContent />
      </WebRTCProvider>
    </AuthProvider>
  );
}

export default App;