import React, { useState } from 'react';
import { X, Eye, EyeOff, Mail, Lock, User, Shield } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const AuthModal = ({ isOpen, onClose, initialMode = 'login' }) => {
  const [mode, setMode] = useState(initialMode); // 'login', 'register', or 'model-register'
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const { login, register } = useAuth();

  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    is_model_application: false
  });

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError('');
  };

  const validateForm = () => {
    if (mode === 'login') {
      if (!formData.username || !formData.password) {
        setError('Please fill in all fields');
        return false;
      }
    } else {
      if (!formData.username || !formData.email || !formData.password) {
        setError('Please fill in all fields');
        return false;
      }
      
      if (formData.password.length < 8) {
        setError('Password must be at least 8 characters long');
        return false;
      }
      
      if (formData.password !== formData.confirmPassword) {
        setError('Passwords do not match');
        return false;
      }
      
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        setError('Please enter a valid email address');
        return false;
      }
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
      if (mode === 'login') {
        const result = await login(formData.username, formData.password);
        
        if (result.success) {
          setSuccess('Login successful!');
          setTimeout(() => {
            onClose();
          }, 1000);
        } else {
          setError(result.error);
        }
      } else {
        const registerData = {
          username: formData.username,
          email: formData.email,
          password: formData.password,
          is_model_application: mode === 'model-register'
        };

        const result = await register(registerData);
        
        if (result.success) {
          if (mode === 'model-register') {
            setSuccess('Model application submitted! Please complete your profile to start the verification process.');
          } else {
            setSuccess('Registration successful!');
          }
          setTimeout(() => {
            onClose();
          }, 2000);
        } else {
          setError(result.error);
        }
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      username: '',
      email: '',
      password: '',
      confirmPassword: '',
      is_model_application: false
    });
    setError('');
    setSuccess('');
  };

  const switchMode = (newMode) => {
    setMode(newMode);
    resetForm();
  };

  if (!isOpen) return null;

  return (
    <div className="auth-modal-overlay" onClick={onClose}>
      <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
        <button className="auth-modal-close" onClick={onClose}>
          <X size={24} />
        </button>

        <div className="auth-modal-content">
          <div className="auth-modal-header">
            <div className="auth-logo">
              <Shield size={32} />
              <h1>Gizzle TV</h1>
            </div>
            
            <div className="auth-mode-tabs">
              <button 
                className={`auth-tab ${mode === 'login' ? 'active' : ''}`}
                onClick={() => switchMode('login')}
              >
                Login
              </button>
              <button 
                className={`auth-tab ${mode === 'register' ? 'active' : ''}`}
                onClick={() => switchMode('register')}
              >
                Sign Up
              </button>
              <button 
                className={`auth-tab ${mode === 'model-register' ? 'active' : ''}`}
                onClick={() => switchMode('model-register')}
              >
                <Shield size={16} />
                Model Signup
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            {error && (
              <div className="auth-message error">
                {error}
              </div>
            )}
            
            {success && (
              <div className="auth-message success">
                {success}
              </div>
            )}

            {mode === 'model-register' && (
              <div className="model-info-banner">
                <Shield size={20} />
                <div>
                  <h4>Model Account</h4>
                  <p>Apply to become a verified model and start streaming</p>
                </div>
              </div>
            )}

            <div className="auth-input-group">
              <label htmlFor="username">
                <User size={20} />
                Username
              </label>
              <input
                type="text"
                id="username"
                name="username"
                value={formData.username}
                onChange={handleInputChange}
                placeholder="Enter your username"
                required
              />
            </div>

            {mode !== 'login' && (
              <div className="auth-input-group">
                <label htmlFor="email">
                  <Mail size={20} />
                  Email
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="Enter your email"
                  required
                />
              </div>
            )}

            <div className="auth-input-group">
              <label htmlFor="password">
                <Lock size={20} />
                Password
              </label>
              <div className="password-input">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="Enter your password"
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            {mode !== 'login' && (
              <div className="auth-input-group">
                <label htmlFor="confirmPassword">
                  <Lock size={20} />
                  Confirm Password
                </label>
                <input
                  type="password"
                  id="confirmPassword"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  placeholder="Confirm your password"
                  required
                />
              </div>
            )}

            <button 
              type="submit" 
              className="auth-submit-btn"
              disabled={loading}
            >
              {loading ? (
                <div className="loading-spinner small">
                  <div className="spinner"></div>
                </div>
              ) : (
                <>
                  {mode === 'login' && 'Sign In'}
                  {mode === 'register' && 'Create Account'}
                  {mode === 'model-register' && 'Apply as Model'}
                </>
              )}
            </button>
          </form>

          <div className="auth-footer">
            {mode === 'login' ? (
              <>
                <p>Don't have an account?</p>
                <button onClick={() => switchMode('register')} className="auth-link">
                  Sign up here
                </button>
                <span className="auth-separator">or</span>
                <button onClick={() => switchMode('model-register')} className="auth-link model-link">
                  <Shield size={16} />
                  Apply as Model
                </button>
              </>
            ) : (
              <>
                <p>Already have an account?</p>
                <button onClick={() => switchMode('login')} className="auth-link">
                  Sign in here
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        .auth-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.8);
          backdrop-filter: blur(10px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
        }

        .auth-modal {
          background: linear-gradient(145deg, #1a1a2e, #16213e);
          border: 1px solid rgba(229, 62, 62, 0.2);
          border-radius: 20px;
          max-width: 450px;
          width: 100%;
          max-height: 90vh;
          overflow-y: auto;
          position: relative;
          box-shadow: 0 25px 50px rgba(0, 0, 0, 0.5);
        }

        .auth-modal-close {
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

        .auth-modal-close:hover {
          background-color: rgba(229, 62, 62, 0.2);
        }

        .auth-modal-content {
          padding: 40px;
        }

        .auth-modal-header {
          text-align: center;
          margin-bottom: 30px;
        }

        .auth-logo {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          margin-bottom: 25px;
        }

        .auth-logo h1 {
          font-size: 28px;
          font-weight: bold;
          color: #ffffff;
          margin: 0;
        }

        .auth-logo svg {
          color: #e53e3e;
        }

        .auth-mode-tabs {
          display: flex;
          gap: 4px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          padding: 4px;
        }

        .auth-tab {
          flex: 1;
          padding: 12px 16px;
          border: none;
          background: none;
          color: #888;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }

        .auth-tab:hover {
          color: #ffffff;
        }

        .auth-tab.active {
          background: #e53e3e;
          color: #ffffff;
        }

        .auth-form {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .auth-message {
          padding: 12px 16px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
        }

        .auth-message.error {
          background: rgba(229, 62, 62, 0.1);
          border: 1px solid rgba(229, 62, 62, 0.3);
          color: #ff6b6b;
        }

        .auth-message.success {
          background: rgba(76, 175, 80, 0.1);
          border: 1px solid rgba(76, 175, 80, 0.3);
          color: #4caf50;
        }

        .model-info-banner {
          background: linear-gradient(135deg, rgba(229, 62, 62, 0.1), rgba(229, 62, 62, 0.05));
          border: 1px solid rgba(229, 62, 62, 0.3);
          border-radius: 12px;
          padding: 16px;
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .model-info-banner svg {
          color: #e53e3e;
          flex-shrink: 0;
        }

        .model-info-banner h4 {
          margin: 0 0 4px 0;
          color: #ffffff;
          font-size: 16px;
          font-weight: 600;
        }

        .model-info-banner p {
          margin: 0;
          color: #cccccc;
          font-size: 14px;
        }

        .auth-input-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .auth-input-group label {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #ffffff;
          font-size: 14px;
          font-weight: 500;
        }

        .auth-input-group label svg {
          color: #e53e3e;
        }

        .auth-input-group input {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          padding: 12px 16px;
          color: #ffffff;
          font-size: 16px;
          transition: all 0.2s;
        }

        .auth-input-group input:focus {
          outline: none;
          border-color: #e53e3e;
          background: rgba(255, 255, 255, 0.08);
        }

        .auth-input-group input::placeholder {
          color: #888;
        }

        .password-input {
          position: relative;
        }

        .password-toggle {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          color: #888;
          cursor: pointer;
          padding: 4px;
          transition: color 0.2s;
        }

        .password-toggle:hover {
          color: #ffffff;
        }

        .auth-submit-btn {
          background: linear-gradient(135deg, #e53e3e, #c53030);
          border: none;
          border-radius: 8px;
          padding: 14px 24px;
          color: #ffffff;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          margin-top: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }

        .auth-submit-btn:hover:not(:disabled) {
          background: linear-gradient(135deg, #c53030, #a02727);
          transform: translateY(-2px);
        }

        .auth-submit-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
          transform: none;
        }

        .auth-footer {
          text-align: center;
          margin-top: 24px;
          padding-top: 20px;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
        }

        .auth-footer p {
          color: #cccccc;
          margin: 0 0 8px 0;
          font-size: 14px;
        }

        .auth-link {
          background: none;
          border: none;
          color: #e53e3e;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: color 0.2s;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          margin: 0 4px;
        }

        .auth-link:hover {
          color: #ff6b6b;
        }

        .auth-separator {
          color: #888;
          font-size: 14px;
          margin: 0 8px;
        }

        .loading-spinner.small {
          width: 20px;
          height: 20px;
        }

        .loading-spinner.small .spinner {
          width: 20px;
          height: 20px;
          border-width: 2px;
        }

        @media (max-width: 480px) {
          .auth-modal {
            margin: 10px;
            max-width: none;
          }

          .auth-modal-content {
            padding: 30px 24px;
          }

          .auth-mode-tabs {
            flex-direction: column;
            gap: 2px;
          }
        }
      `}</style>
    </div>
  );
};

export default AuthModal;