import React, { useState } from 'react';
import { X, Eye, EyeOff, Mail, Lock, User, UserPlus } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const ViewerAuth = ({ isOpen, onClose, initialMode = 'register' }) => {
  const [mode, setMode] = useState(initialMode); // 'register' or 'login'
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const { login, register } = useAuth();

  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: ''
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
      if (!formData.email || !formData.password) {
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
        const result = await login(formData.email, formData.password);
        
        if (result.success) {
          setSuccess('Login successful!');
          setTimeout(() => {
            onClose();
          }, 1000);
        } else {
          setError(result.error);
        }
      } else {
        // Register as regular viewer (not model)
        const registerData = {
          username: formData.username,
          email: formData.email,
          password: formData.password,
          is_model_application: false
        };

        const result = await register(registerData);
        
        if (result.success) {
          setSuccess('Account created successfully! Welcome to Gizzle TV!');
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
      confirmPassword: ''
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
    <div className="viewer-auth-overlay" onClick={onClose}>
      <div className="viewer-auth-modal" onClick={(e) => e.stopPropagation()}>
        <button className="auth-close-btn" onClick={onClose}>
          <X size={24} />
        </button>

        <div className="viewer-auth-content">
          <div className="auth-header">
            <div className="auth-logo">
              <UserPlus size={32} />
              <h1>Viewer Access</h1>
            </div>
            <p className="auth-subtitle">
              {mode === 'register' 
                ? 'Create your viewer account to enjoy exclusive content' 
                : 'Welcome back! Sign in to continue watching'
              }
            </p>
          </div>

          <div className="auth-mode-selector">
            <button 
              className={`mode-btn ${mode === 'register' ? 'active' : ''}`}
              onClick={() => switchMode('register')}
            >
              Create Account
            </button>
            <button 
              className={`mode-btn ${mode === 'login' ? 'active' : ''}`}
              onClick={() => switchMode('login')}
            >
              Sign In
            </button>
          </div>

          <form onSubmit={handleSubmit} className="viewer-auth-form">
            {error && (
              <div className="auth-alert error">
                <span>⚠️</span>
                {error}
              </div>
            )}
            
            {success && (
              <div className="auth-alert success">
                <span>✅</span>
                {success}
              </div>
            )}

            {mode === 'register' && (
              <div className="form-field">
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
                  placeholder="Choose a unique username"
                  required
                />
              </div>
            )}

            <div className="form-field">
              <label htmlFor="email">
                <Mail size={20} />
                Email Address
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="Enter your email address"
                required
              />
            </div>

            <div className="form-field">
              <label htmlFor="password">
                <Lock size={20} />
                Password
              </label>
              <div className="password-field">
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

            {mode === 'register' && (
              <div className="form-field">
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

            {mode === 'register' && (
              <div className="password-requirements">
                <h4>Password Requirements:</h4>
                <ul>
                  <li>At least 8 characters long</li>
                  <li>Include uppercase and lowercase letters</li>
                  <li>Include at least one number</li>
                  <li>Include at least one special character</li>
                </ul>
              </div>
            )}

            <button 
              type="submit" 
              className="viewer-auth-btn"
              disabled={loading}
            >
              {loading ? (
                <div className="btn-loading">
                  <div className="spinner"></div>
                  Processing...
                </div>
              ) : (
                <>
                  {mode === 'register' && (
                    <>
                      <UserPlus size={20} />
                      Create Viewer Account
                    </>
                  )}
                  {mode === 'login' && (
                    <>
                      <User size={20} />
                      Sign In
                    </>
                  )}
                </>
              )}
            </button>
          </form>

          <div className="auth-footer">
            {mode === 'register' ? (
              <p>
                Already have an account?{' '}
                <button onClick={() => switchMode('login')} className="link-btn">
                  Sign in here
                </button>
              </p>
            ) : (
              <p>
                Don't have an account?{' '}
                <button onClick={() => switchMode('register')} className="link-btn">
                  Create one here
                </button>
              </p>
            )}
            
            <div className="viewer-info">
              <p>🎭 Are you a content creator?</p>
              <p>Models have a separate sign-in process</p>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .viewer-auth-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.85);
          backdrop-filter: blur(10px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 2000;
          padding: 20px;
        }

        .viewer-auth-modal {
          background: linear-gradient(145deg, #1a1a2e, #16213e);
          border: 1px solid rgba(74, 144, 226, 0.3);
          border-radius: 20px;
          max-width: 480px;
          width: 100%;
          max-height: 90vh;
          overflow-y: auto;
          position: relative;
          box-shadow: 0 25px 50px rgba(0, 0, 0, 0.6);
        }

        .auth-close-btn {
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

        .auth-close-btn:hover {
          background-color: rgba(74, 144, 226, 0.2);
        }

        .viewer-auth-content {
          padding: 40px;
        }

        .auth-header {
          text-align: center;
          margin-bottom: 30px;
        }

        .auth-logo {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          margin-bottom: 16px;
        }

        .auth-logo svg {
          color: #4a90e2;
        }

        .auth-logo h1 {
          font-size: 28px;
          font-weight: bold;
          color: #ffffff;
          margin: 0;
        }

        .auth-subtitle {
          color: #cccccc;
          font-size: 16px;
          line-height: 1.5;
          margin: 0;
        }

        .auth-mode-selector {
          display: flex;
          gap: 4px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 12px;
          padding: 4px;
          margin-bottom: 30px;
        }

        .mode-btn {
          flex: 1;
          padding: 12px 20px;
          border: none;
          background: none;
          color: #888;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .mode-btn:hover {
          color: #ffffff;
        }

        .mode-btn.active {
          background: #4a90e2;
          color: #ffffff;
        }

        .viewer-auth-form {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .auth-alert {
          padding: 14px 16px;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 500;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .auth-alert.error {
          background: rgba(229, 62, 62, 0.1);
          border: 1px solid rgba(229, 62, 62, 0.3);
          color: #ff6b6b;
        }

        .auth-alert.success {
          background: rgba(76, 175, 80, 0.1);
          border: 1px solid rgba(76, 175, 80, 0.3);
          color: #4caf50;
        }

        .form-field {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .form-field label {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #ffffff;
          font-size: 14px;
          font-weight: 500;
        }

        .form-field label svg {
          color: #4a90e2;
        }

        .form-field input {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 10px;
          padding: 14px 16px;
          color: #ffffff;
          font-size: 16px;
          transition: all 0.2s;
        }

        .form-field input:focus {
          outline: none;
          border-color: #4a90e2;
          background: rgba(255, 255, 255, 0.08);
          box-shadow: 0 0 0 3px rgba(74, 144, 226, 0.1);
        }

        .form-field input::placeholder {
          color: #888;
        }

        .password-field {
          position: relative;
        }

        .password-toggle {
          position: absolute;
          right: 14px;
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

        .password-requirements {
          background: rgba(74, 144, 226, 0.05);
          border: 1px solid rgba(74, 144, 226, 0.2);
          border-radius: 10px;
          padding: 16px;
        }

        .password-requirements h4 {
          margin: 0 0 10px 0;
          color: #4a90e2;
          font-size: 14px;
          font-weight: 600;
        }

        .password-requirements ul {
          margin: 0;
          padding-left: 20px;
          color: #cccccc;
          font-size: 13px;
        }

        .password-requirements li {
          margin-bottom: 4px;
        }

        .viewer-auth-btn {
          background: linear-gradient(135deg, #4a90e2, #357abd);
          border: none;
          border-radius: 10px;
          padding: 16px 24px;
          color: #ffffff;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          margin-top: 10px;
        }

        .viewer-auth-btn:hover:not(:disabled) {
          background: linear-gradient(135deg, #357abd, #2968a3);
          transform: translateY(-2px);
          box-shadow: 0 10px 25px rgba(74, 144, 226, 0.3);
        }

        .viewer-auth-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
          transform: none;
        }

        .btn-loading {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .spinner {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-top: 2px solid #ffffff;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .auth-footer {
          text-align: center;
          margin-top: 30px;
          padding-top: 24px;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
        }

        .auth-footer p {
          color: #cccccc;
          margin: 0 0 16px 0;
          font-size: 14px;
        }

        .link-btn {
          background: none;
          border: none;
          color: #4a90e2;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: color 0.2s;
        }

        .link-btn:hover {
          color: #66a3ff;
        }

        .viewer-info {
          background: rgba(255, 215, 0, 0.05);
          border: 1px solid rgba(255, 215, 0, 0.2);
          border-radius: 10px;
          padding: 16px;
          margin-top: 20px;
        }

        .viewer-info p {
          margin: 0 0 4px 0 !important;
          color: #ffd700 !important;
          font-size: 13px;
          font-weight: 500;
        }

        .viewer-info p:last-child {
          margin: 0 !important;
          color: #cccccc !important;
        }

        @media (max-width: 520px) {
          .viewer-auth-modal {
            margin: 10px;
            max-width: none;
          }

          .viewer-auth-content {
            padding: 30px 24px;
          }

          .auth-mode-selector {
            flex-direction: column;
            gap: 2px;
          }
        }
      `}</style>
    </div>
  );
};

export default ViewerAuth;