import React, { useState, useEffect } from 'react';
import { 
  Home, 
  Video, 
  Image, 
  Users, 
  Crown, 
  ShoppingBag, 
  Menu, 
  X, 
  Shield,
  User,
  Settings,
  Search,
  Heart,
  PlayCircle
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const MobileNavigation = ({ 
  activeSection, 
  setActiveSection, 
  setShowViewerAuth, 
  setViewerAuthMode,
  setShowModelLogin,
  isAuthenticated,
  user,
  logout 
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
      if (window.innerWidth > 768) {
        setIsMobileMenuOpen(false);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const navigationItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'live-streams', label: 'Live', icon: Video },
    { id: 'models', label: 'Models', icon: Users },
    { id: 'gizzle-tv', label: 'Gizzle TV', icon: PlayCircle },
    { id: 'videos', label: 'Videos', icon: Video },
    { id: 'pictures', label: 'Pictures', icon: Image },
    { id: 'community', label: 'Community', icon: Heart }
  ];

  const handleNavClick = (sectionId) => {
    setActiveSection(sectionId);
    setIsMobileMenuOpen(false);
  };

  const handleAuthAction = (action) => {
    setIsMobileMenuOpen(false);
    if (action === 'viewer-login') {
      setViewerAuthMode('login');
      setShowViewerAuth(true);
    } else if (action === 'viewer-signup') {
      setViewerAuthMode('register');
      setShowViewerAuth(true);
    } else if (action === 'model-login') {
      setShowModelLogin(true);
    }
  };

  if (!isMobile) return null;

  return (
    <>
      {/* Mobile Header Bar */}
      <div className="mobile-header">
        <div className="mobile-header-content">
          <div className="mobile-logo">
            <img 
              src="https://customer-assets.emergentagent.com/job_media-upload-2/artifacts/ysim4ger_thumbnail_FD3537EB-E493-45C7-8E2E-1C6F4DC548FB.jpg"
              alt="Gizzle TV"
              className="mobile-logo-img"
            />
            <span>Gizzle TV</span>
          </div>

          <div className="mobile-header-actions">
            <button className="mobile-search-btn">
              <Search size={20} />
            </button>
            <button 
              className="mobile-menu-btn"
              onClick={() => setIsMobileMenuOpen(true)}
            >
              <Menu size={24} />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Bottom Navigation */}
      <div className="mobile-bottom-nav">
        {navigationItems.slice(0, 5).map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;
          
          return (
            <button
              key={item.id}
              className={`mobile-nav-item ${isActive ? 'active' : ''}`}
              onClick={() => handleNavClick(item.id)}
            >
              <Icon size={20} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Mobile Slide-Out Menu */}
      {isMobileMenuOpen && (
        <div className="mobile-menu-overlay" onClick={() => setIsMobileMenuOpen(false)}>
          <div className="mobile-menu" onClick={(e) => e.stopPropagation()}>
            <div className="mobile-menu-header">
              <div className="mobile-menu-title">
                <Shield size={24} />
                <span>Gizzle TV</span>
              </div>
              <button 
                className="mobile-menu-close"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <X size={24} />
              </button>
            </div>

            <div className="mobile-menu-content">
              {/* User Section */}
              {isAuthenticated ? (
                <div className="mobile-user-section">
                  <div className="mobile-user-info">
                    <div className="mobile-user-avatar">
                      <User size={24} />
                    </div>
                    <div className="mobile-user-details">
                      <h4>{user?.username}</h4>
                      <p>{user?.account_type || 'Viewer'} Account</p>
                    </div>
                  </div>
                  
                  <div className="mobile-user-actions">
                    <button className="mobile-action-btn">
                      <Settings size={16} />
                      Settings
                    </button>
                    <button 
                      className="mobile-action-btn"
                      onClick={() => {
                        logout();
                        setIsMobileMenuOpen(false);
                      }}
                    >
                      Logout
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mobile-auth-section">
                  <h3>Join Gizzle TV</h3>
                  
                  <div className="mobile-auth-buttons">
                    <button 
                      className="mobile-auth-btn viewer"
                      onClick={() => handleAuthAction('viewer-signup')}
                    >
                      <User size={18} />
                      Create Viewer Account
                    </button>
                    
                    <button 
                      className="mobile-auth-btn viewer-login"
                      onClick={() => handleAuthAction('viewer-login')}
                    >
                      Sign In
                    </button>
                    
                    <button 
                      className="mobile-auth-btn model"
                      onClick={() => handleAuthAction('model-login')}
                    >
                      <Shield size={18} />
                      Model Portal
                    </button>
                  </div>
                </div>
              )}

              {/* Navigation Menu */}
              <div className="mobile-nav-section">
                <h3>Navigation</h3>
                <div className="mobile-nav-list">
                  {navigationItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeSection === item.id;
                    
                    return (
                      <button
                        key={item.id}
                        className={`mobile-nav-list-item ${isActive ? 'active' : ''}`}
                        onClick={() => handleNavClick(item.id)}
                      >
                        <Icon size={20} />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Premium Section */}
              <div className="mobile-premium-section">
                <div className="mobile-premium-card">
                  <Crown size={20} />
                  <div>
                    <h4>Upgrade to Premium</h4>
                    <p>Unlock exclusive content and features</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .mobile-header {
          display: block;
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 1000;
          background: linear-gradient(135deg, #1a1a2e, #16213e);
          border-bottom: 1px solid rgba(229, 62, 62, 0.2);
          backdrop-filter: blur(10px);
        }

        .mobile-header-content {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          max-width: 100%;
        }

        .mobile-logo {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .mobile-logo-img {
          width: 32px;
          height: 32px;
          border-radius: 6px;
        }

        .mobile-logo span {
          font-size: 18px;
          font-weight: 700;
          color: #ffffff;
        }

        .mobile-header-actions {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .mobile-search-btn,
        .mobile-menu-btn {
          background: rgba(255, 255, 255, 0.1);
          border: none;
          border-radius: 8px;
          padding: 8px;
          color: #ffffff;
          cursor: pointer;
          transition: all 0.2s;
        }

        .mobile-search-btn:hover,
        .mobile-menu-btn:hover {
          background: rgba(255, 255, 255, 0.2);
        }

        .mobile-bottom-nav {
          display: flex;
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          z-index: 1000;
          background: linear-gradient(135deg, #1a1a2e, #16213e);
          border-top: 1px solid rgba(229, 62, 62, 0.2);
          padding: 8px 0;
          backdrop-filter: blur(10px);
        }

        .mobile-nav-item {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          padding: 8px 4px;
          background: none;
          border: none;
          color: #888;
          cursor: pointer;
          transition: all 0.2s;
          font-size: 11px;
          font-weight: 500;
        }

        .mobile-nav-item.active {
          color: #e53e3e;
        }

        .mobile-nav-item:hover {
          color: #ffffff;
        }

        .mobile-menu-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.8);
          backdrop-filter: blur(5px);
          z-index: 2000;
          display: flex;
          animation: fadeIn 0.3s ease;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .mobile-menu {
          background: linear-gradient(145deg, #1a1a2e, #16213e);
          width: 85%;
          max-width: 320px;
          height: 100%;
          overflow-y: auto;
          animation: slideIn 0.3s ease;
        }

        @keyframes slideIn {
          from { transform: translateX(-100%); }
          to { transform: translateX(0); }
        }

        .mobile-menu-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .mobile-menu-title {
          display: flex;
          align-items: center;
          gap: 10px;
          color: #ffffff;
          font-size: 18px;
          font-weight: 700;
        }

        .mobile-menu-title svg {
          color: #e53e3e;
        }

        .mobile-menu-close {
          background: none;
          border: none;
          color: #888;
          cursor: pointer;
          padding: 4px;
        }

        .mobile-menu-content {
          padding: 20px;
        }

        .mobile-user-section,
        .mobile-auth-section,
        .mobile-nav-section,
        .mobile-premium-section {
          margin-bottom: 32px;
          padding-bottom: 24px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }

        .mobile-user-info {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
        }

        .mobile-user-avatar {
          width: 48px;
          height: 48px;
          background: linear-gradient(135deg, #e53e3e, #c53030);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ffffff;
        }

        .mobile-user-details h4 {
          margin: 0;
          color: #ffffff;
          font-size: 16px;
          font-weight: 600;
        }

        .mobile-user-details p {
          margin: 0;
          color: #888;
          font-size: 14px;
        }

        .mobile-user-actions {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .mobile-action-btn {
          display: flex;
          align-items: center;
          gap: 10px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          padding: 12px 16px;
          color: #ffffff;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .mobile-action-btn:hover {
          background: rgba(255, 255, 255, 0.1);
        }

        .mobile-auth-section h3,
        .mobile-nav-section h3 {
          margin: 0 0 16px 0;
          color: #ffffff;
          font-size: 16px;
          font-weight: 600;
        }

        .mobile-auth-buttons {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .mobile-auth-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 14px 20px;
          border: none;
          border-radius: 10px;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .mobile-auth-btn.viewer {
          background: linear-gradient(135deg, #4a90e2, #357abd);
          color: #ffffff;
        }

        .mobile-auth-btn.viewer-login {
          background: none;
          border: 1px solid rgba(74, 144, 226, 0.4);
          color: #4a90e2;
        }

        .mobile-auth-btn.model {
          background: linear-gradient(135deg, #ffd700, #ffb347);
          color: #000000;
        }

        .mobile-auth-btn:hover {
          transform: translateY(-2px);
        }

        .mobile-nav-list {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .mobile-nav-list-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 16px;
          background: none;
          border: none;
          border-radius: 8px;
          color: #888;
          font-size: 15px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          text-align: left;
        }

        .mobile-nav-list-item.active {
          background: rgba(229, 62, 62, 0.1);
          color: #e53e3e;
        }

        .mobile-nav-list-item:hover {
          background: rgba(255, 255, 255, 0.05);
          color: #ffffff;
        }

        .mobile-premium-card {
          display: flex;
          align-items: center;
          gap: 12px;
          background: linear-gradient(135deg, rgba(255, 215, 0, 0.1), rgba(255, 152, 0, 0.05));
          border: 1px solid rgba(255, 215, 0, 0.3);
          border-radius: 12px;
          padding: 16px;
        }

        .mobile-premium-card svg {
          color: #ffd700;
          flex-shrink: 0;
        }

        .mobile-premium-card h4 {
          margin: 0 0 4px 0;
          color: #ffd700;
          font-size: 14px;
          font-weight: 600;
        }

        .mobile-premium-card p {
          margin: 0;
          color: #cccccc;
          font-size: 12px;
        }

        @media (min-width: 769px) {
          .mobile-header,
          .mobile-bottom-nav {
            display: none;
          }
        }

        @media (max-width: 480px) {
          .mobile-menu {
            width: 100%;
          }
          
          .mobile-nav-item {
            font-size: 10px;
          }
          
          .mobile-header-content {
            padding: 10px 12px;
          }
        }
      `}</style>
    </>
  );
};

export default MobileNavigation;