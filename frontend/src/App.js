import React, { useState, useEffect, useRef } from "react";
import "./App.css";
import "./VideoPlayer.css";
import { BrowserRouter, Routes, Route, Link, useLocation } from "react-router-dom";
import axios from "axios";
import { Upload, Play, Image, Users, Crown, ShoppingBag, Menu, X, Star, Check, Pause, Volume2, VolumeX, Maximize, SkipBack, SkipForward, ChevronLeft, ChevronRight, Info } from "lucide-react";

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
const NetflixHeader = ({ activeSection, setActiveSection }) => {
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
        </nav>
      </div>

      <div className="header-right">
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
        <div className="profile-menu">
          <div className="profile-avatar">
            <Users size={20} />
          </div>
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
          src="https://images.unsplash.com/photo-1735212769704-d03b95dd1a14"
          alt="Hero Background"
          className="hero-bg-img"
        />
        <div className="hero-gradient"></div>
      </div>
      
      <div className="hero-content">
        <h1 className="hero-title">Welcome to Gizzle TV</h1>
        <p className="hero-description">
          {heroContent.description}
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
const ModelsSection = ({ onVideoClick }) => {
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

// Main App Component
function App() {
  const [activeSection, setActiveSection] = useState('home');
  const [videoPlayerOpen, setVideoPlayerOpen] = useState(false);
  const [currentVideo, setCurrentVideo] = useState(null);
  const [contentData, setContentData] = useState({
    trending: [],
    featured: [],
    community: [],
    recent: []
  });

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
              <ContentRow 
                title="Featured Content" 
                items={contentData.featured}
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
      />
      
      <main className="netflix-main">
        {renderContent()}
      </main>

      {/* Video Player */}
      {videoPlayerOpen && currentVideo && (
        <VideoPlayer
          isOpen={videoPlayerOpen}
          onClose={() => setVideoPlayerOpen(false)}
          videoSrc={currentVideo.src}
          title={currentVideo.title}
          description={currentVideo.description}
          poster={currentVideo.poster}
        />
      )}
    </div>
  );
}

export default App;