import React, { useState, useEffect } from "react";
import "./App.css";
import { BrowserRouter, Routes, Route, Link, useLocation } from "react-router-dom";
import axios from "axios";
import { Upload, Play, Image, Users, Crown, ShoppingBag, Menu, X, Star, Check } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Hero Section Component
const HeroSection = () => {
  return (
    <div className="hero-section">
      <div className="hero-background">
        <img 
          src="https://images.unsplash.com/photo-1735212769704-d03b95dd1a14" 
          alt="Entertainment Platform"
          className="hero-image"
        />
        <div className="hero-overlay"></div>
      </div>
      <div className="hero-content">
        <div className="hero-logo">
          <img 
            src="https://customer-assets.emergentagent.com/job_media-upload-2/artifacts/ysim4ger_thumbnail_FD3537EB-E493-45C7-8E2E-1C6F4DC548FB.jpg"
            alt="Gizzle TV L.L.C."
            className="logo-image"
          />
        </div>
        <h1 className="hero-title">Welcome to Gizzle TV L.L.C.</h1>
        <p className="hero-subtitle">Your ultimate entertainment platform for videos, pictures, live streams, and community content.</p>
        <div className="hero-buttons">
          <button className="btn-primary">Start Creating</button>
          <button className="btn-secondary">Explore Content</button>
        </div>
      </div>
    </div>
  );
};

// Navigation Component
const Navigation = ({ activeTab, setActiveTab, isMobileMenuOpen, setIsMobileMenuOpen }) => {
  const navItems = [
    { id: 'home', label: 'Home', icon: <Star size={20} /> },
    { id: 'gizzle-tv', label: 'Gizzle TV', icon: <Play size={20} /> },
    { id: 'videos', label: 'Videos', icon: <Upload size={20} /> },
    { id: 'pictures', label: 'Pictures', icon: <Image size={20} /> },
    { id: 'live-streams', label: 'Live Streams', icon: <Upload size={20} /> },
    { id: 'community', label: 'Community', icon: <Users size={20} /> },
    { id: 'subscriptions', label: 'Subscriptions', icon: <Crown size={20} /> },
    { id: 'store', label: 'Store', icon: <ShoppingBag size={20} /> },
  ];

  return (
    <nav className="navigation">
      <div className="nav-container">
        <div className="nav-brand">
          <img 
            src="https://customer-assets.emergentagent.com/job_media-upload-2/artifacts/ysim4ger_thumbnail_FD3537EB-E493-45C7-8E2E-1C6F4DC548FB.jpg"
            alt="Gizzle TV"
            className="nav-logo"
          />
          <span className="nav-title">Gizzle TV</span>
        </div>
        
        {/* Desktop Navigation */}
        <div className="nav-links desktop-nav">
          {navItems.map((item) => (
            <button
              key={item.id}
              className={`nav-link ${activeTab === item.id ? 'active' : ''}`}
              onClick={() => setActiveTab(item.id)}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </div>

        {/* Mobile Menu Toggle */}
        <button 
          className="mobile-menu-toggle"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Navigation */}
      {isMobileMenuOpen && (
        <div className="mobile-nav">
          {navItems.map((item) => (
            <button
              key={item.id}
              className={`mobile-nav-link ${activeTab === item.id ? 'active' : ''}`}
              onClick={() => {
                setActiveTab(item.id);
                setIsMobileMenuOpen(false);
              }}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </nav>
  );
};

// Upload Component
const UploadSection = ({ category }) => {
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');

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

  const handleFileUpload = async (file) => {
    setUploading(true);
    setUploadStatus('Uploading...');
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('category', category);
    formData.append('description', `Uploaded ${category.slice(0, -1)}`);
    
    try {
      const response = await axios.post(`${API}/content/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      setUploadStatus('Upload successful!');
      setTimeout(() => setUploadStatus(''), 3000);
    } catch (error) {
      console.error('Upload error:', error);
      setUploadStatus('Upload failed. Please try again.');
      setTimeout(() => setUploadStatus(''), 3000);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="upload-section">
      <div 
        className={`upload-dropzone ${dragActive ? 'drag-active' : ''} ${uploading ? 'uploading' : ''}`}
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
        <div className="upload-content">
          <Upload size={48} className="upload-icon" />
          <h3>Drop your {category.slice(0, -1)} here</h3>
          <p>or click to browse files</p>
          {uploadStatus && (
            <div className={`upload-status ${uploadStatus.includes('successful') ? 'success' : uploadStatus.includes('failed') ? 'error' : 'info'}`}>
              {uploadStatus}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Content Gallery Component
const ContentGallery = ({ category }) => {
  const [content, setContent] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchContent();
  }, [category]);

  const fetchContent = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/content/${category}`);
      setContent(response.data);
    } catch (error) {
      console.error('Error fetching content:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="content-gallery">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading {category}...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="content-gallery">
      <div className="gallery-header">
        <h2>Your {category}</h2>
        <span className="content-count">{content.length} items</span>
      </div>
      
      {content.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">
            {category === 'videos' ? <Play size={64} /> : 
             category === 'pictures' ? <Image size={64} /> : 
             <Upload size={64} />}
          </div>
          <h3>No {category} uploaded yet</h3>
          <p>Start by uploading your first {category.slice(0, -1)}!</p>
        </div>
      ) : (
        <div className="gallery-grid">
          {content.map((item) => (
            <div key={item.id} className="gallery-item">
              <div className="item-preview">
                {category === 'pictures' ? (
                  <img 
                    src={`${API}/content/file/${item.filename}`}
                    alt={item.original_filename}
                    className="preview-image"
                  />
                ) : (
                  <div className="video-preview">
                    <video 
                      src={`${API}/content/file/${item.filename}`}
                      className="preview-video"
                      muted
                    />
                    <div className="play-overlay">
                      <Play size={32} />
                    </div>
                  </div>
                )}
              </div>
              <div className="item-info">
                <h4>{item.original_filename}</h4>
                <p className="item-date">
                  {new Date(item.upload_timestamp).toLocaleDateString()}
                </p>
                {item.tags && item.tags.length > 0 && (
                  <div className="item-tags">
                    {item.tags.slice(0, 3).map((tag, index) => (
                      <span key={index} className="tag">{tag}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Community Component
const CommunitySection = () => {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMembers();
  }, []);

  const fetchMembers = async () => {
    try {
      const response = await axios.get(`${API}/community/members`);
      setMembers(response.data);
    } catch (error) {
      console.error('Error fetching members:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="community-section">
      <div className="section-header">
        <h2>Community Members</h2>
        <p>Connect with fellow creators and entertainers</p>
      </div>

      <div className="community-features">
        <div className="feature-card">
          <img 
            src="https://images.unsplash.com/photo-1726935068680-73cef7e8412b" 
            alt="Mobile Community"
            className="feature-image"
          />
          <div className="feature-content">
            <h3>Mobile Community</h3>
            <p>Stay connected on the go with our mobile community features</p>
          </div>
        </div>

        <div className="feature-card">
          <img 
            src="https://images.unsplash.com/photo-1616469829941-c7200edec809" 
            alt="Cross Platform"
            className="feature-image"
          />
          <div className="feature-content">
            <h3>Cross-Platform Access</h3>
            <p>Access your content and community from any device</p>
          </div>
        </div>

        <div className="feature-card">
          <img 
            src="https://images.unsplash.com/photo-1685440663653-fa3e81dd109c" 
            alt="Streaming Features"
            className="feature-image"
          />
          <div className="feature-content">
            <h3>Live Streaming</h3>
            <p>Share your content live with the community</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading community members...</p>
        </div>
      ) : (
        <div className="members-grid">
          {members.slice(0, 12).map((member) => (
            <div key={member.id} className="member-card">
              <div className="member-avatar">
                <Users size={32} />
              </div>
              <div className="member-info">
                <h4>{member.display_name}</h4>
                <p className="member-username">@{member.username}</p>
                <span className={`subscription-badge ${member.subscription_status}`}>
                  {member.subscription_status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Subscription Plans Component
const SubscriptionPlans = () => {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      const response = await axios.get(`${API}/subscriptions/plans`);
      setPlans(response.data);
    } catch (error) {
      console.error('Error fetching plans:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async (planId) => {
    try {
      const response = await axios.post(`${API}/subscriptions/checkout?plan_id=${planId}`);
      
      // In a real implementation, this would redirect to Stripe
      window.open(response.data.checkout_url, '_blank');
    } catch (error) {
      console.error('Subscription error:', error);
    }
  };

  return (
    <div className="subscription-plans">
      <div className="section-header">
        <h2>Choose Your Plan</h2>
        <p>Unlock premium features with our subscription plans</p>
      </div>

      {loading ? (
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading subscription plans...</p>
        </div>
      ) : (
        <div className="plans-grid">
          {plans.map((plan) => (
            <div key={plan.id} className={`plan-card ${plan.is_popular ? 'popular' : ''}`}>
              {plan.is_popular && (
                <div className="popular-badge">
                  <Star size={16} />
                  Most Popular
                </div>
              )}
              
              <div className="plan-header">
                <h3>{plan.name}</h3>
                <div className="plan-price">
                  <span className="currency">$</span>
                  <span className="amount">{plan.price}</span>
                  <span className="interval">/{plan.interval}</span>
                </div>
              </div>

              <div className="plan-features">
                {plan.features.map((feature, index) => (
                  <div key={index} className="feature-item">
                    <Check size={16} className="check-icon" />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>

              <button 
                className={`plan-button ${plan.is_popular ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => handleSubscribe(plan.id)}
              >
                Subscribe Now
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Gizzle TV Section Component
const GizzleTVSection = () => {
  return (
    <div className="gizzle-tv-section">
      <div className="section-header">
        <h2>Gizzle TV</h2>
        <p>Featured content from our entertainment network</p>
      </div>

      <div className="featured-content">
        <div className="main-feature">
          <div className="video-container">
            <video 
              className="featured-video"
              controls
              poster="https://customer-assets.emergentagent.com/job_media-upload-2/artifacts/ysim4ger_thumbnail_FD3537EB-E493-45C7-8E2E-1C6F4DC548FB.jpg"
            >
              <source 
                src="https://customer-assets.emergentagent.com/job_media-upload-2/artifacts/hd2ztl4a_Rimmington.mp4" 
                type="video/mp4" 
              />
              Your browser does not support the video tag.
            </video>
            
            <div className="video-overlay">
              <div className="video-info">
                <h3>Rimmington</h3>
                <p className="video-description">
                  Exclusive Gizzle TV content featuring stunning visuals and entertainment
                </p>
                <div className="video-stats">
                  <span className="stat-item">
                    <Play size={16} />
                    Featured Video
                  </span>
                  <span className="stat-item">
                    <Star size={16} />
                    Premium Content
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Additional Content Grid */}
        <div className="content-grid">
          <div className="content-card">
            <div className="content-image">
              <img 
                src="https://images.unsplash.com/photo-1735212769704-d03b95dd1a14" 
                alt="Entertainment Setup"
              />
              <div className="play-button">
                <Play size={24} />
              </div>
            </div>
            <div className="content-info">
              <h4>Entertainment Hub</h4>
              <p>Your ultimate streaming destination</p>
            </div>
          </div>

          <div className="content-card">
            <div className="content-image">
              <img 
                src="https://images.unsplash.com/photo-1735212659418-715ca2ff7c20" 
                alt="Multi-Platform"
              />
              <div className="play-button">
                <Play size={24} />
              </div>
            </div>
            <div className="content-info">
              <h4>Multi-Platform Access</h4>
              <p>Watch anywhere, anytime</p>
            </div>
          </div>

          <div className="content-card">
            <div className="content-image">
              <img 
                src="https://images.unsplash.com/photo-1726935068680-73cef7e8412b" 
                alt="Mobile Experience"
              />
              <div className="play-button">
                <Play size={24} />
              </div>
            </div>
            <div className="content-info">
              <h4>Mobile Experience</h4>
              <p>Optimized for mobile viewing</p>
            </div>
          </div>

          <div className="content-card">
            <div className="content-image">
              <img 
                src="https://images.unsplash.com/photo-1685440663653-fa3e81dd109c" 
                alt="Streaming Technology"
              />
              <div className="play-button">
                <Play size={24} />
              </div>
            </div>
            <div className="content-info">
              <h4>Latest Technology</h4>
              <p>Cutting-edge streaming tech</p>
            </div>
          </div>
        </div>

        {/* Call to Action */}
        <div className="gizzle-cta">
          <h3>Ready to Experience Gizzle TV?</h3>
          <p>Join our premium membership for exclusive access to all content</p>
          <div className="cta-buttons">
            <button 
              className="btn-primary cta-btn"
              onClick={() => window.scrollTo(0, 0)}
            >
              Subscribe Now
            </button>
            <button 
              className="btn-secondary cta-btn"
              onClick={() => window.scrollTo(0, 0)}
            >
              Learn More
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Store Component  
const StoreSection = () => {
  const storeItems = [
    {
      id: 'premium_upload',
      name: 'Premium Upload Credits',
      price: 4.99,
      description: '10 premium upload credits for larger files',
      icon: <Upload size={32} />
    },
    {
      id: 'live_stream_hours',
      name: 'Live Stream Hours',
      price: 9.99,
      description: '5 additional hours of live streaming',
      icon: <Play size={32} />
    },
    {
      id: 'premium_features',
      name: 'Premium Features',
      price: 2.99,
      description: 'Unlock advanced editing and analytics tools',
      icon: <Star size={32} />
    }
  ];

  const handlePurchase = async (itemId) => {
    try {
      const response = await axios.post(`${API}/purchases/checkout?item_id=${itemId}`);
      
      // In a real implementation, this would redirect to Stripe
      window.open(response.data.checkout_url, '_blank');
    } catch (error) {
      console.error('Purchase error:', error);
    }
  };

  return (
    <div className="store-section">
      <div className="section-header">
        <h2>In-App Store</h2>
        <p>Enhance your experience with premium add-ons</p>
      </div>

      <div className="store-grid">
        {storeItems.map((item) => (
          <div key={item.id} className="store-item">
            <div className="store-item-icon">
              {item.icon}
            </div>
            <div className="store-item-info">
              <h3>{item.name}</h3>
              <p>{item.description}</p>
              <div className="store-item-price">
                ${item.price}
              </div>
            </div>
            <button 
              className="btn-primary store-button"
              onClick={() => handlePurchase(item.id)}
            >
              Purchase
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

// Main App Component
function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const renderContent = () => {
    switch (activeTab) {
      case 'home':
        return <HeroSection />;
      case 'gizzle-tv':
        return <GizzleTVSection />;
      case 'videos':
        return (
          <div className="content-section">
            <h1 className="section-title">Videos</h1>
            <UploadSection category="videos" />
            <ContentGallery category="videos" />
          </div>
        );
      case 'pictures':
        return (
          <div className="content-section">
            <h1 className="section-title">Pictures</h1>
            <UploadSection category="pictures" />
            <ContentGallery category="pictures" />
          </div>
        );
      case 'live-streams':
        return (
          <div className="content-section">
            <h1 className="section-title">Live Streams</h1>
            <div className="coming-soon">
              <Upload size={64} />
              <h3>Live Streaming Coming Soon!</h3>
              <p>We're working on bringing you the best live streaming experience.</p>
            </div>
          </div>
        );
      case 'community':
        return <CommunitySection />;
      case 'subscriptions':
        return <SubscriptionPlans />;
      case 'store':
        return <StoreSection />;
      default:
        return <HeroSection />;
    }
  };

  return (
    <div className="App">
      <Navigation 
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
      />
      <main className="main-content">
        {renderContent()}
      </main>
    </div>
  );
}

export default App;