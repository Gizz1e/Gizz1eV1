import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import Cookies from 'js-cookie';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Initialize authentication state
  useEffect(() => {
    const initAuth = () => {
      try {
        const storedToken = Cookies.get('auth_token');
        const storedUser = localStorage.getItem('user_data');
        
        if (storedToken && storedUser) {
          const userData = JSON.parse(storedUser);
          setToken(storedToken);
          setUser(userData);
          setIsAuthenticated(true);
          
          // Set axios default header
          axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
        logout();
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = async (usernameOrEmail, password, userType = 'viewer') => {
    try {
      const endpoint = userType === 'model' ? '/auth/model/login' : '/auth/viewer/login';
      const response = await axios.post(`${API}${endpoint}`, {
        username_or_email: usernameOrEmail,
        password: password
      });

      const { access_token, user: userData } = response.data;

      // Store token and user data
      Cookies.set('auth_token', access_token, { expires: 1, secure: true, sameSite: 'strict' });
      localStorage.setItem('user_data', JSON.stringify(userData));

      setToken(access_token);
      setUser(userData);
      setIsAuthenticated(true);

      // Set axios default header
      axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;

      return { success: true, user: userData };
    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        error: error.response?.data?.detail || 'Login failed'
      };
    }
  };

  const register = async (userData) => {
    try {
      // Always register as viewer through the viewer endpoint
      const response = await axios.post(`${API}/auth/viewer/register`, userData);

      const { access_token, user: newUser } = response.data;

      // Store token and user data
      Cookies.set('auth_token', access_token, { expires: 1, secure: true, sameSite: 'strict' });
      localStorage.setItem('user_data', JSON.stringify(newUser));

      setToken(access_token);
      setUser(newUser);
      setIsAuthenticated(true);

      // Set axios default header
      axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;

      return { success: true, user: newUser };
    } catch (error) {
      console.error('Registration error:', error);
      return {
        success: false,
        error: error.response?.data?.detail || 'Registration failed'
      };
    }
  };

  const modelLogin = async (email, password) => {
    try {
      const response = await axios.post(`${API}/auth/model/login`, {
        username_or_email: email,
        password: password
      });

      const { access_token, user: userData } = response.data;

      // Store token and user data
      Cookies.set('auth_token', access_token, { expires: 1, secure: true, sameSite: 'strict' });
      localStorage.setItem('user_data', JSON.stringify(userData));

      setToken(access_token);
      setUser(userData);
      setIsAuthenticated(true);

      // Set axios default header
      axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;

      return { success: true, user: userData };
    } catch (error) {
      console.error('Model login error:', error);
      return {
        success: false,
        error: error.response?.data?.detail || 'Model login failed'
      };
    }
  };

  const logout = () => {
    Cookies.remove('auth_token');
    localStorage.removeItem('user_data');
    delete axios.defaults.headers.common['Authorization'];
    
    setToken(null);
    setUser(null);
    setIsAuthenticated(false);
  };

  const updateUser = (userData) => {
    setUser(userData);
    localStorage.setItem('user_data', JSON.stringify(userData));
  };

  const hasRole = (role) => {
    return user?.roles?.includes(role) || false;
  };

  const hasPermission = (permission) => {
    const rolePermissions = {
      'admin': ['manage_users', 'verify_models', 'manage_streams', 'view_analytics', 'moderate_content', 'access_admin_panel'],
      'model': ['create_streams', 'receive_tips', 'access_private_streams', 'upload_premium_content', 'view_earnings'],
      'premium_user': ['access_premium_streams', 'send_tips', 'upload_large_files', 'priority_chat'],
      'user': ['view_public_streams', 'send_chat_messages', 'upload_basic_files']
    };

    if (!user?.roles) return false;

    for (const role of user.roles) {
      if (rolePermissions[role]?.includes(permission)) {
        return true;
      }
    }

    return false;
  };

  const canAccessStream = (streamType) => {
    if (!user) return streamType === 'public';
    
    if (hasRole('admin')) return true;
    
    switch (streamType) {
      case 'public':
        return true;
      case 'private':
        return user.subscription_tier === 'premium' || user.subscription_tier === 'vip' || hasRole('model');
      case 'premium':
        return user.subscription_tier === 'premium' || user.subscription_tier === 'vip';
      default:
        return false;
    }
  };

  const isVerifiedModel = () => {
    return hasRole('model') && user?.model_verification_status === 'approved';
  };

  const canCreateStreams = () => {
    return isVerifiedModel() || hasRole('admin');
  };

  const value = {
    user,
    token,
    loading,
    isAuthenticated,
    login,
    register,
    modelLogin,
    logout,
    updateUser,
    hasRole,
    hasPermission,
    canAccessStream,
    isVerifiedModel,
    canCreateStreams
  };

  if (loading) {
    return (
      <div className="auth-loading">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Initializing...</p>
        </div>
      </div>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthProvider;