import React, { useState } from 'react';
import { X, Eye, EyeOff, Mail, Lock, Shield, Crown, CheckCircle, AlertTriangle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const ModelLogin = ({ isOpen, onClose }) => {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const { modelLogin } = useAuth();

  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError('');
  };

  const validateForm = () => {
    if (!formData.email || !formData.password) {
      setError('Please enter both email and password');
      return false;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('Please enter a valid email address');
      return false;
    }
    
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!validateForm()) return;

    setLoading(true);

    try {
      const result = await login(formData.email, formData.password);
      
      if (result.success) {
        // Check if user is actually a model
        if (result.user?.is_model) {
          setSuccess('Welcome back! Redirecting to your model dashboard...');
          setTimeout(() => {
            onClose();
          }, 1500);
        } else {
          setError('This account is not registered as a model. Please use viewer sign-in or apply to become a model.');
        }
      } else {
        setError(result.error || 'Invalid email or password');
      }
    } catch (err) {
      setError('Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      email: '',
      password: ''
    });
    setError('');
    setSuccess('');
  };

  if (!isOpen) return null;

  return (
    <div className="model-login-overlay" onClick={onClose}>
      <div className="model-login-modal" onClick={(e) => e.stopPropagation()}>
        <button className="login-close-btn" onClick={onClose}>
          <X size={24} />
        </button>

        <div className="model-login-content">
          {/* Header Section */}
          <div className="login-header">
            <div className="model-logo">
              <div className="logo-container">
                <Shield size={40} />
                <Crown size={24} className="crown-overlay" />
              </div>
              <h1>Model Portal</h1>
            </div>
            <p className="login-subtitle">
              Exclusive access for verified content creators
            </p>
          </div>

          {/* Status Badges */}
          <div className="access-level">
            <div className="badge verified">
              <CheckCircle size={16} />
              Verified Models Only
            </div>
            <div className="badge premium">
              <Crown size={16} />
              Premium Access
            </div>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="model-login-form">
            {error && (
              <div className="login-alert error">
                <AlertTriangle size={20} />
                <span>{error}</span>
              </div>
            )}
            
            {success && (
              <div className="login-alert success">
                <CheckCircle size={20} />
                <span>{success}</span>
              </div>
            )}

            <div className="login-field">
              <label htmlFor="model-email">
                <Mail size={20} />
                Model Email
              </label>
              <input
                type="email"
                id="model-email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="Enter your registered model email"
                required
                autoComplete="username"
              />
            </div>

            <div className="login-field">
              <label htmlFor="model-password">
                <Lock size={20} />
                Password
              </label>
              <div className="password-container">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="model-password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="Enter your password"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="password-visibility"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <div className="login-options">
              <label className="remember-me">
                <input type="checkbox" />
                <span>Keep me signed in</span>
              </label>
              <button type="button" className="forgot-password">
                Forgot password?
              </button>
            </div>

            <button 
              type="submit" 
              className="model-login-btn"
              disabled={loading}
            >
              {loading ? (
                <div className="login-loading">
                  <div className="spinner"></div>
                  Authenticating...
                </div>
              ) : (
                <>
                  <Shield size={20} />
                  Access Model Portal
                </>
              )}
            </button>
          </form>

          {/* Model Information */}
          <div className="model-info">
            <div className="info-section">
              <h3>Model Benefits</h3>
              <ul>
                <li>🎥 Create live streams</li>
                <li>💰 Receive tips and donations</li>
                <li>📊 Access detailed analytics</li>
                <li>⭐ Premium content features</li>
                <li>💎 Exclusive model tools</li>
              </ul>
            </div>

            <div className="application-notice">
              <AlertTriangle size={20} />
              <div>
                <h4>Not a model yet?</h4>
                <p>You need to apply and be verified before accessing this portal.</p>
                <button className="apply-link" onClick={onClose}>
                  Apply to become a model
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .model-login-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.9);
          backdrop-filter: blur(15px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 3000;
          padding: 20px;
        }

        .model-login-modal {
          background: linear-gradient(145deg, #1a1a2e, #16213e);
          border: 2px solid rgba(255, 215, 0, 0.3);
          border-radius: 20px;
          max-width: 500px;
          width: 100%;
          max-height: 90vh;
          overflow-y: auto;
          position: relative;
          box-shadow: 0 30px 60px rgba(0, 0, 0, 0.7);
        }

        .login-close-btn {
          position: absolute;
          top: 20px;
          right: 20px;
          background: none;
          border: none;
          color: #ffffff;
          cursor: pointer;
          z-index: 10;
          padding: 8px;
          border-radius: 50%;
          transition: background-color 0.2s;
        }

        .login-close-btn:hover {
          background-color: rgba(255, 215, 0, 0.2);
        }

        .model-login-content {
          padding: 40px;
        }

        .login-header {
          text-align: center;
          margin-bottom: 30px;
        }

        .model-logo {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
          margin-bottom: 16px;
        }

        .logo-container {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .logo-container .crown-overlay {
          position: absolute;
          top: -8px;
          right: -8px;
          color: #ffd700;
          background: rgba(0, 0, 0, 0.8);
          border-radius: 50%;
          padding: 4px;
        }

        .model-logo svg:first-child {
          color: #ffd700;
        }

        .model-logo h1 {
          font-size: 32px;
          font-weight: bold;
          background: linear-gradient(135deg, #ffd700, #ffed4e);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          margin: 0;
        }

        .login-subtitle {
          color: #cccccc;
          font-size: 16px;
          line-height: 1.5;
          margin: 0;
          font-style: italic;
        }

        .access-level {
          display: flex;
          gap: 12px;
          justify-content: center;
          margin-bottom: 30px;
        }

        .badge {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .badge.verified {
          background: rgba(76, 175, 80, 0.2);
          border: 1px solid rgba(76, 175, 80, 0.4);
          color: #4caf50;
        }

        .badge.premium {
          background: rgba(255, 215, 0, 0.2);
          border: 1px solid rgba(255, 215, 0, 0.4);
          color: #ffd700;
        }

        .model-login-form {
          display: flex;
          flex-direction: column;
          gap: 20px;
          margin-bottom: 30px;
        }

        .login-alert {
          padding: 16px;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 500;
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .login-alert.error {
          background: rgba(229, 62, 62, 0.1);
          border: 1px solid rgba(229, 62, 62, 0.3);
          color: #ff6b6b;
        }

        .login-alert.success {
          background: rgba(76, 175, 80, 0.1);
          border: 1px solid rgba(76, 175, 80, 0.3);
          color: #4caf50;
        }

        .login-field {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .login-field label {
          display: flex;
          align-items: center;
          gap: 10px;
          color: #ffffff;
          font-size: 14px;
          font-weight: 600;
        }

        .login-field label svg {
          color: #ffd700;
        }

        .login-field input {
          background: rgba(255, 255, 255, 0.05);
          border: 2px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          padding: 16px 18px;
          color: #ffffff;
          font-size: 16px;
          transition: all 0.3s;
        }

        .login-field input:focus {
          outline: none;
          border-color: #ffd700;
          background: rgba(255, 255, 255, 0.08);
          box-shadow: 0 0 0 4px rgba(255, 215, 0, 0.1);
        }

        .login-field input::placeholder {
          color: #888;
        }

        .password-container {
          position: relative;
        }

        .password-visibility {
          position: absolute;
          right: 16px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          color: #888;
          cursor: pointer;
          padding: 4px;
          transition: color 0.2s;
        }

        .password-visibility:hover {
          color: #ffd700;
        }

        .login-options {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin: 10px 0;
        }

        .remember-me {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #cccccc;
          font-size: 14px;
          cursor: pointer;
        }

        .remember-me input {
          margin: 0;
        }

        .forgot-password {
          background: none;
          border: none;
          color: #ffd700;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: color 0.2s;
        }

        .forgot-password:hover {
          color: #ffed4e;
        }

        .model-login-btn {
          background: linear-gradient(135deg, #ffd700, #ffb347);
          border: none;
          border-radius: 12px;
          padding: 18px 24px;
          color: #000000;
          font-size: 16px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.3s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-top: 10px;
        }

        .model-login-btn:hover:not(:disabled) {
          background: linear-gradient(135deg, #ffb347, #ffa500);
          transform: translateY(-2px);
          box-shadow: 0 15px 35px rgba(255, 215, 0, 0.4);
        }

        .model-login-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
          transform: none;
        }

        .login-loading {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .spinner {
          width: 18px;
          height: 18px;
          border: 2px solid rgba(0, 0, 0, 0.3);
          border-top: 2px solid #000000;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        .model-info {
          border-top: 1px solid rgba(255, 255, 255, 0.1);
          padding-top: 30px;
        }

        .info-section {
          margin-bottom: 25px;
        }

        .info-section h3 {
          color: #ffd700;
          font-size: 18px;
          font-weight: 600;
          margin: 0 0 15px 0;
        }

        .info-section ul {
          list-style: none;
          padding: 0;
          margin: 0;
          display: grid;
          gap: 8px;
        }

        .info-section li {
          color: #cccccc;
          font-size: 14px;
          padding: 8px 0;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }

        .application-notice {
          background: linear-gradient(135deg, rgba(255, 193, 7, 0.1), rgba(255, 152, 0, 0.05));
          border: 1px solid rgba(255, 193, 7, 0.3);
          border-radius: 12px;
          padding: 20px;
          display: flex;
          align-items: flex-start;
          gap: 15px;
        }

        .application-notice svg {
          color: #ffc107;
          flex-shrink: 0;
          margin-top: 2px;
        }

        .application-notice h4 {
          margin: 0 0 8px 0;
          color: #ffc107;
          font-size: 16px;
          font-weight: 600;
        }

        .application-notice p {
          margin: 0 0 12px 0;
          color: #cccccc;
          font-size: 14px;
          line-height: 1.5;
        }

        .apply-link {
          background: none;
          border: 1px solid #ffc107;
          border-radius: 8px;
          padding: 8px 16px;
          color: #ffc107;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .apply-link:hover {
          background: rgba(255, 193, 7, 0.1);
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        @media (max-width: 540px) {
          .model-login-modal {
            margin: 10px;
            max-width: none;
          }

          .model-login-content {
            padding: 30px 24px;
          }

          .access-level {
            flex-direction: column;
            align-items: center;
          }

          .login-options {
            flex-direction: column;
            gap: 12px;
            align-items: flex-start;
          }
        }
      `}</style>
    </div>
  );
};

export default ModelLogin;