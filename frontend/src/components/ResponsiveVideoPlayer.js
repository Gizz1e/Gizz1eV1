import React, { useState, useRef, useEffect } from 'react';
import { 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Maximize, 
  Minimize, 
  SkipBack, 
  SkipForward, 
  RotateCcw, 
  X,
  Settings,
  Cast,
  PictureInPicture
} from 'lucide-react';

const ResponsiveVideoPlayer = ({ 
  isOpen, 
  onClose, 
  videoSrc, 
  title, 
  description, 
  poster 
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [orientation, setOrientation] = useState('portrait');

  const videoRef = useRef(null);
  const playerRef = useRef(null);
  const controlsTimeoutRef = useRef(null);
  const progressRef = useRef(null);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    const checkOrientation = () => {
      setOrientation(window.innerHeight > window.innerWidth ? 'portrait' : 'landscape');
    };

    checkMobile();
    checkOrientation();

    window.addEventListener('resize', checkMobile);
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);

    return () => {
      window.removeEventListener('resize', checkMobile);
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedMetadata = () => {
      setDuration(video.duration);
      setIsLoading(false);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('ended', handleEnded);

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('ended', handleEnded);
    };
  }, [videoSrc]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (isPlaying) {
      video.pause();
    } else {
      video.play();
    }
    setIsPlaying(!isPlaying);
  };

  const toggleMute = () => {
    const video = videoRef.current;
    video.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const handleVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value);
    const video = videoRef.current;
    video.volume = newVolume;
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  };

  const handleProgressClick = (e) => {
    const progressBar = progressRef.current;
    const rect = progressBar.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const newTime = (clickX / rect.width) * duration;
    
    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const skipTime = (seconds) => {
    const video = videoRef.current;
    video.currentTime = Math.max(0, Math.min(video.currentTime + seconds, duration));
  };

  const toggleFullscreen = async () => {
    const player = playerRef.current;
    
    try {
      if (!isFullscreen) {
        if (player.requestFullscreen) {
          await player.requestFullscreen();
        } else if (player.webkitRequestFullscreen) {
          await player.webkitRequestFullscreen();
        } else if (player.msRequestFullscreen) {
          await player.msRequestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
          await document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) {
          await document.msExitFullscreen();
        }
      }
      setIsFullscreen(!isFullscreen);
    } catch (error) {
      console.error('Fullscreen error:', error);
    }
  };

  const showControlsTemporarily = () => {
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

  const handleVideoClick = () => {
    if (isMobile) {
      showControlsTemporarily();
    } else {
      togglePlay();
    }
  };

  const formatTime = (time) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;

  if (!isOpen) return null;

  return (
    <div className={`video-player-overlay ${isFullscreen ? 'fullscreen' : ''}`}>
      <div 
        ref={playerRef}
        className={`video-player-container ${isMobile ? 'mobile' : ''} ${orientation}`}
      >
        {/* Video Element */}
        <video
          ref={videoRef}
          src={videoSrc}
          poster={poster}
          className="video-element"
          onClick={handleVideoClick}
          onMouseMove={showControlsTemporarily}
          preload="metadata"
        />

        {/* Loading Overlay */}
        {isLoading && (
          <div className="video-loading">
            <div className="loading-spinner">
              <div className="spinner"></div>
            </div>
            <p>Loading video...</p>
          </div>
        )}

        {/* Close Button (Mobile) */}
        {isMobile && !isFullscreen && (
          <button className="mobile-close-btn" onClick={onClose}>
            <X size={24} />
          </button>
        )}

        {/* Video Controls */}
        <div className={`video-controls-overlay ${showControls || !isPlaying ? 'visible' : ''}`}>
          {/* Top Controls */}
          <div className="video-controls-top">
            {!isMobile && (
              <button className="control-btn close-btn" onClick={onClose}>
                <X size={20} />
              </button>
            )}
            <div className="video-info">
              <h3 className="video-title">{title}</h3>
              {description && !isMobile && (
                <p className="video-description">{description}</p>
              )}
            </div>
            <div className="top-control-actions">
              <button className="control-btn">
                <Cast size={20} />
              </button>
              <button className="control-btn">
                <Settings size={20} />
              </button>
            </div>
          </div>

          {/* Center Play Button */}
          {!isPlaying && !isLoading && (
            <div className="center-play-btn" onClick={togglePlay}>
              <div className="play-button-circle">
                <Play size={isMobile ? 32 : 48} />
              </div>
            </div>
          )}

          {/* Bottom Controls */}
          <div className="video-controls-bottom">
            {/* Progress Bar */}
            <div 
              className="progress-container"
              ref={progressRef}
              onClick={handleProgressClick}
            >
              <div className="progress-bar">
                <div 
                  className="progress-fill"
                  style={{ width: `${progressPercentage}%` }}
                ></div>
              </div>
            </div>

            {/* Control Buttons */}
            <div className="control-buttons">
              <div className="left-controls">
                <button className="control-btn" onClick={togglePlay}>
                  {isPlaying ? <Pause size={isMobile ? 20 : 24} /> : <Play size={isMobile ? 20 : 24} />}
                </button>

                {!isMobile && (
                  <>
                    <button className="control-btn" onClick={() => skipTime(-10)}>
                      <SkipBack size={20} />
                    </button>
                    <button className="control-btn" onClick={() => skipTime(10)}>
                      <SkipForward size={20} />
                    </button>
                  </>
                )}

                <button className="control-btn" onClick={toggleMute}>
                  {isMuted ? <VolumeX size={isMobile ? 18 : 20} /> : <Volume2 size={isMobile ? 18 : 20} />}
                </button>

                {!isMobile && (
                  <div className="volume-container">
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={isMuted ? 0 : volume}
                      onChange={handleVolumeChange}
                      className="volume-slider"
                    />
                  </div>
                )}

                <div className="time-display">
                  <span>{formatTime(currentTime)} / {formatTime(duration)}</span>
                </div>
              </div>

              <div className="right-controls">
                {!isMobile && (
                  <button className="control-btn">
                    <PictureInPicture size={20} />
                  </button>
                )}

                <button className="control-btn" onClick={toggleFullscreen}>
                  {isFullscreen ? <Minimize size={isMobile ? 20 : 24} /> : <Maximize size={isMobile ? 20 : 24} />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Touch Gestures Overlay */}
        {isMobile && (
          <div className="mobile-gestures">
            <div 
              className="gesture-zone left"
              onDoubleClick={() => skipTime(-10)}
            >
              <div className="gesture-indicator">
                <RotateCcw size={24} />
                <span>10s</span>
              </div>
            </div>
            
            <div 
              className="gesture-zone center"
              onClick={togglePlay}
            >
            </div>
            
            <div 
              className="gesture-zone right"
              onDoubleClick={() => skipTime(10)}
            >
              <div className="gesture-indicator">
                <RotateCcw size={24} style={{ transform: 'scaleX(-1)' }} />
                <span>10s</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .video-player-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.95);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 3000;
        }

        .video-player-overlay.fullscreen {
          background: #000000;
        }

        .video-player-container {
          position: relative;
          width: 100%;
          height: 100%;
          max-width: 1200px;
          max-height: 80vh;
          background: #000000;
          border-radius: 12px;
          overflow: hidden;
        }

        .video-player-container.mobile {
          max-width: none;
          max-height: none;
          border-radius: 0;
          height: 100vh;
        }

        .video-player-container.mobile.portrait {
          display: flex;
          flex-direction: column;
          justify-content: center;
        }

        .video-element {
          width: 100%;
          height: 100%;
          object-fit: contain;
          cursor: pointer;
        }

        .video-loading {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: rgba(0, 0, 0, 0.8);
          color: #ffffff;
        }

        .loading-spinner {
          margin-bottom: 16px;
        }

        .spinner {
          width: 40px;
          height: 40px;
          border: 3px solid rgba(255, 255, 255, 0.3);
          border-top: 3px solid #e53e3e;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        .mobile-close-btn {
          position: absolute;
          top: 16px;
          right: 16px;
          z-index: 10;
          background: rgba(0, 0, 0, 0.5);
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

        .mobile-close-btn:hover {
          background: rgba(0, 0, 0, 0.8);
        }

        .video-controls-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          background: linear-gradient(
            to bottom,
            rgba(0, 0, 0, 0.6) 0%,
            transparent 30%,
            transparent 70%,
            rgba(0, 0, 0, 0.8) 100%
          );
          opacity: 0;
          transition: opacity 0.3s ease;
          pointer-events: none;
        }

        .video-controls-overlay.visible {
          opacity: 1;
          pointer-events: auto;
        }

        .video-controls-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          padding: 20px;
        }

        .video-player-container.mobile .video-controls-top {
          padding: 16px;
        }

        .close-btn {
          background: rgba(255, 255, 255, 0.1);
          border: none;
          border-radius: 50%;
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ffffff;
          cursor: pointer;
          transition: all 0.2s;
        }

        .video-info {
          flex: 1;
          margin: 0 20px;
          text-align: center;
        }

        .video-title {
          color: #ffffff;
          font-size: 18px;
          font-weight: 600;
          margin: 0 0 8px 0;
          line-height: 1.4;
        }

        .video-player-container.mobile .video-title {
          font-size: 16px;
        }

        .video-description {
          color: #cccccc;
          font-size: 14px;
          margin: 0;
          line-height: 1.5;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .top-control-actions {
          display: flex;
          gap: 8px;
        }

        .center-play-btn {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          cursor: pointer;
          z-index: 5;
        }

        .play-button-circle {
          width: 80px;
          height: 80px;
          background: rgba(229, 62, 62, 0.9);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ffffff;
          transition: all 0.3s ease;
          box-shadow: 0 4px 20px rgba(229, 62, 62, 0.4);
        }

        .video-player-container.mobile .play-button-circle {
          width: 60px;
          height: 60px;
        }

        .play-button-circle:hover {
          transform: scale(1.1);
          background: rgba(229, 62, 62, 1);
        }

        .video-controls-bottom {
          padding: 20px;
        }

        .video-player-container.mobile .video-controls-bottom {
          padding: 16px;
        }

        .progress-container {
          margin-bottom: 16px;
          cursor: pointer;
        }

        .progress-bar {
          width: 100%;
          height: 4px;
          background: rgba(255, 255, 255, 0.3);
          border-radius: 2px;
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          background: #e53e3e;
          border-radius: 2px;
          transition: width 0.1s ease;
        }

        .control-buttons {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .left-controls,
        .right-controls {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .video-player-container.mobile .left-controls,
        .video-player-container.mobile .right-controls {
          gap: 8px;
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

        .video-player-container.mobile .control-btn {
          width: 40px;
          height: 40px;
        }

        .control-btn:hover {
          background: rgba(255, 255, 255, 0.2);
        }

        .volume-container {
          display: flex;
          align-items: center;
        }

        .volume-slider {
          width: 60px;
          margin-left: 8px;
        }

        .time-display {
          color: #ffffff;
          font-size: 14px;
          font-weight: 500;
          white-space: nowrap;
        }

        .video-player-container.mobile .time-display {
          font-size: 12px;
        }

        .mobile-gestures {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          display: flex;
          z-index: 1;
        }

        .gesture-zone {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          position: relative;
        }

        .gesture-indicator {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          color: rgba(255, 255, 255, 0.8);
          opacity: 0;
          transform: scale(0.8);
          transition: all 0.2s ease;
        }

        .gesture-zone:active .gesture-indicator {
          opacity: 1;
          transform: scale(1);
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        @media (max-width: 480px) {
          .video-title {
            font-size: 14px;
          }
          
          .time-display {
            font-size: 11px;
          }
          
          .control-btn {
            width: 36px;
            height: 36px;
          }
        }

        @media (orientation: landscape) and (max-width: 768px) {
          .video-player-container.mobile {
            height: 100vh;
          }
          
          .video-controls-top {
            padding: 12px 16px;
          }
          
          .video-controls-bottom {
            padding: 12px 16px;
          }
        }
      `}</style>
    </div>
  );
};

export default ResponsiveVideoPlayer;