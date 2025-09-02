import React, { useState } from 'react';
import { User, Mail, Phone, FileText, Link, Upload, Shield, CheckCircle, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const ModelApplication = ({ isOpen, onClose }) => {
  const { user, token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [currentStep, setCurrentStep] = useState(1);

  const [formData, setFormData] = useState({
    stage_name: '',
    real_name: '',
    email: user?.email || '',
    phone: '',
    bio: '',
    social_links: {
      instagram: '',
      twitter: '',
      tiktok: '',
      onlyfans: '',
      website: ''
    },
    identity_document_ids: [],
    portfolio_file_ids: []
  });

  const [uploadProgress, setUploadProgress] = useState({});

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    if (name.startsWith('social_')) {
      const socialPlatform = name.replace('social_', '');
      setFormData(prev => ({
        ...prev,
        social_links: {
          ...prev.social_links,
          [socialPlatform]: value
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
    
    setError('');
  };

  const handleFileUpload = async (files, type) => {
    const uploadedIds = [];
    
    for (const file of files) {
      try {
        setUploadProgress(prev => ({
          ...prev,
          [file.name]: 0
        }));

        const formData = new FormData();
        formData.append('file', file);
        formData.append('category', 'pictures'); // For documents and portfolio
        formData.append('description', `${type} - ${file.name}`);

        const response = await axios.post(`${API}/content/upload`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
            'Authorization': `Bearer ${token}`
          },
          onUploadProgress: (progressEvent) => {
            const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(prev => ({
              ...prev,
              [file.name]: progress
            }));
          }
        });

        uploadedIds.push(response.data.content_id);
        
        setUploadProgress(prev => ({
          ...prev,
          [file.name]: 100
        }));
        
      } catch (error) {
        console.error('File upload error:', error);
        setError(`Failed to upload ${file.name}`);
      }
    }
    
    return uploadedIds;
  };

  const handleDocumentUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    
    const uploadedIds = await handleFileUpload(files, 'identity_document');
    
    setFormData(prev => ({
      ...prev,
      identity_document_ids: [...prev.identity_document_ids, ...uploadedIds]
    }));
  };

  const handlePortfolioUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    
    const uploadedIds = await handleFileUpload(files, 'portfolio');
    
    setFormData(prev => ({
      ...prev,
      portfolio_file_ids: [...prev.portfolio_file_ids, ...uploadedIds]
    }));
  };

  const validateStep = (step) => {
    switch (step) {
      case 1:
        return formData.stage_name && formData.real_name && formData.email && formData.bio;
      case 2:
        return Object.values(formData.social_links).some(link => link.trim() !== '');
      case 3:
        return formData.identity_document_ids.length > 0 && formData.portfolio_file_ids.length > 0;
      default:
        return true;
    }
  };

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, 4));
      setError('');
    } else {
      setError('Please complete all required fields in this step');
    }
  };

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await axios.post(`${API}/models/apply`, formData, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      setSuccess('Model application submitted successfully! You will be notified about the verification status.');
      setCurrentStep(5); // Success step
      
    } catch (error) {
      console.error('Application error:', error);
      setError(error.response?.data?.detail || 'Failed to submit application');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="model-application-overlay" onClick={onClose}>
      <div className="model-application-modal" onClick={(e) => e.stopPropagation()}>
        <div className="model-application-header">
          <div className="header-content">
            <Shield size={32} />
            <div>
              <h2>Model Verification Application</h2>
              <p>Step {currentStep} of 4</p>
            </div>
          </div>
          <button onClick={onClose} className="close-btn">
            ×
          </button>
        </div>

        <div className="progress-bar">
          <div 
            className="progress-fill" 
            style={{ width: `${(currentStep / 4) * 100}%` }}
          ></div>
        </div>

        <div className="model-application-content">
          {error && (
            <div className="alert error">
              <AlertCircle size={20} />
              {error}
            </div>
          )}

          {success && (
            <div className="alert success">
              <CheckCircle size={20} />
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Step 1: Basic Information */}
            {currentStep === 1 && (
              <div className="step-content">
                <h3>Basic Information</h3>
                <p>Provide your basic information for verification</p>
                
                <div className="form-grid">
                  <div className="form-group">
                    <label>
                      <User size={20} />
                      Stage Name *
                    </label>
                    <input
                      type="text"
                      name="stage_name"
                      value={formData.stage_name}
                      onChange={handleInputChange}
                      placeholder="Your stage/professional name"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>
                      <User size={20} />
                      Real Name *
                    </label>
                    <input
                      type="text"
                      name="real_name"
                      value={formData.real_name}
                      onChange={handleInputChange}
                      placeholder="Your legal name"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>
                      <Mail size={20} />
                      Email *
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      placeholder="your.email@example.com"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>
                      <Phone size={20} />
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      placeholder="+1 (555) 123-4567"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>
                    <FileText size={20} />
                    Bio *
                  </label>
                  <textarea
                    name="bio"
                    value={formData.bio}
                    onChange={handleInputChange}
                    placeholder="Tell us about yourself, your experience, and what makes you unique..."
                    rows="4"
                    required
                  />
                </div>
              </div>
            )}

            {/* Step 2: Social Media Links */}
            {currentStep === 2 && (
              <div className="step-content">
                <h3>Social Media Presence</h3>
                <p>Add your social media links to help us verify your identity and reach</p>
                
                <div className="form-grid">
                  <div className="form-group">
                    <label>
                      <Link size={20} />
                      Instagram
                    </label>
                    <input
                      type="url"
                      name="social_instagram"
                      value={formData.social_links.instagram}
                      onChange={handleInputChange}
                      placeholder="https://instagram.com/username"
                    />
                  </div>

                  <div className="form-group">
                    <label>
                      <Link size={20} />
                      Twitter/X
                    </label>
                    <input
                      type="url"
                      name="social_twitter"
                      value={formData.social_links.twitter}
                      onChange={handleInputChange}
                      placeholder="https://twitter.com/username"
                    />
                  </div>

                  <div className="form-group">
                    <label>
                      <Link size={20} />
                      TikTok
                    </label>
                    <input
                      type="url"
                      name="social_tiktok"
                      value={formData.social_links.tiktok}
                      onChange={handleInputChange}
                      placeholder="https://tiktok.com/@username"
                    />
                  </div>

                  <div className="form-group">
                    <label>
                      <Link size={20} />
                      OnlyFans
                    </label>
                    <input
                      type="url"
                      name="social_onlyfans"
                      value={formData.social_links.onlyfans}
                      onChange={handleInputChange}
                      placeholder="https://onlyfans.com/username"
                    />
                  </div>

                  <div className="form-group">
                    <label>
                      <Link size={20} />
                      Website
                    </label>
                    <input
                      type="url"
                      name="social_website"
                      value={formData.social_links.website}
                      onChange={handleInputChange}
                      placeholder="https://yourwebsite.com"
                    />
                  </div>
                </div>

                <div className="info-box">
                  <AlertCircle size={20} />
                  <p>At least one social media link is required for verification</p>
                </div>
              </div>
            )}

            {/* Step 3: Document Upload */}
            {currentStep === 3 && (
              <div className="step-content">
                <h3>Document Verification</h3>
                <p>Upload required documents and portfolio items</p>
                
                <div className="upload-section">
                  <h4>Identity Documents *</h4>
                  <div className="upload-area">
                    <input
                      type="file"
                      multiple
                      accept="image/*,.pdf"
                      onChange={handleDocumentUpload}
                      id="identity-upload"
                    />
                    <label htmlFor="identity-upload">
                      <Upload size={24} />
                      <span>Upload ID, Passport, or Driver's License</span>
                      <small>JPG, PNG, or PDF files</small>
                    </label>
                  </div>
                  
                  {formData.identity_document_ids.length > 0 && (
                    <div className="uploaded-files">
                      <p>{formData.identity_document_ids.length} document(s) uploaded ✓</p>
                    </div>
                  )}
                </div>

                <div className="upload-section">
                  <h4>Portfolio Images *</h4>
                  <div className="upload-area">
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handlePortfolioUpload}
                      id="portfolio-upload"
                    />
                    <label htmlFor="portfolio-upload">
                      <Upload size={24} />
                      <span>Upload Professional Photos</span>
                      <small>High-quality images showcasing your work</small>
                    </label>
                  </div>
                  
                  {formData.portfolio_file_ids.length > 0 && (
                    <div className="uploaded-files">
                      <p>{formData.portfolio_file_ids.length} portfolio item(s) uploaded ✓</p>
                    </div>
                  )}
                </div>

                {Object.keys(uploadProgress).length > 0 && (
                  <div className="upload-progress">
                    {Object.entries(uploadProgress).map(([filename, progress]) => (
                      <div key={filename} className="progress-item">
                        <span>{filename}</span>
                        <div className="progress-bar small">
                          <div 
                            className="progress-fill" 
                            style={{ width: `${progress}%` }}
                          ></div>
                        </div>
                        <span>{progress}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Step 4: Review and Submit */}
            {currentStep === 4 && (
              <div className="step-content">
                <h3>Review Your Application</h3>
                <p>Please review your information before submitting</p>
                
                <div className="review-section">
                  <div className="review-item">
                    <h4>Basic Information</h4>
                    <div className="review-grid">
                      <div><strong>Stage Name:</strong> {formData.stage_name}</div>
                      <div><strong>Real Name:</strong> {formData.real_name}</div>
                      <div><strong>Email:</strong> {formData.email}</div>
                      <div><strong>Phone:</strong> {formData.phone || 'Not provided'}</div>
                    </div>
                  </div>

                  <div className="review-item">
                    <h4>Social Media</h4>
                    <div className="review-grid">
                      {Object.entries(formData.social_links).map(([platform, url]) => 
                        url && (
                          <div key={platform}>
                            <strong>{platform}:</strong> {url}
                          </div>
                        )
                      )}
                    </div>
                  </div>

                  <div className="review-item">
                    <h4>Documents</h4>
                    <div className="review-grid">
                      <div><strong>Identity Documents:</strong> {formData.identity_document_ids.length} uploaded</div>
                      <div><strong>Portfolio Items:</strong> {formData.portfolio_file_ids.length} uploaded</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Success Step */}
            {currentStep === 5 && (
              <div className="step-content success-step">
                <CheckCircle size={64} />
                <h3>Application Submitted!</h3>
                <p>Your model verification application has been submitted successfully. Our team will review your application and notify you of the status within 2-3 business days.</p>
                
                <div className="next-steps">
                  <h4>What's Next?</h4>
                  <ul>
                    <li>Our verification team will review your documents</li>
                    <li>You'll receive an email notification about the status</li>
                    <li>Once approved, you'll be able to create live streams</li>
                    <li>You'll gain access to model-specific features</li>
                  </ul>
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="form-navigation">
              {currentStep > 1 && currentStep < 5 && (
                <button type="button" onClick={prevStep} className="btn secondary">
                  Previous
                </button>
              )}
              
              {currentStep < 4 && (
                <button type="button" onClick={nextStep} className="btn primary">
                  Next
                </button>
              )}
              
              {currentStep === 4 && (
                <button type="submit" disabled={loading} className="btn primary">
                  {loading ? 'Submitting...' : 'Submit Application'}
                </button>
              )}
              
              {currentStep === 5 && (
                <button type="button" onClick={onClose} className="btn primary">
                  Close
                </button>
              )}
            </div>
          </form>
        </div>
      </div>

      <style jsx>{`
        .model-application-overlay {
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

        .model-application-modal {
          background: linear-gradient(145deg, #1a1a2e, #16213e);
          border: 1px solid rgba(229, 62, 62, 0.2);
          border-radius: 20px;
          max-width: 800px;
          width: 100%;
          max-height: 90vh;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          box-shadow: 0 25px 50px rgba(0, 0, 0, 0.5);
        }

        .model-application-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 30px 40px 20px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .header-content {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .header-content svg {
          color: #e53e3e;
        }

        .header-content h2 {
          margin: 0;
          color: #ffffff;
          font-size: 24px;
          font-weight: 600;
        }

        .header-content p {
          margin: 4px 0 0 0;
          color: #888;
          font-size: 14px;
        }

        .close-btn {
          background: none;
          border: none;
          color: #888;
          font-size: 24px;
          cursor: pointer;
          padding: 8px;
          border-radius: 50%;
          transition: all 0.2s;
        }

        .close-btn:hover {
          color: #ffffff;
          background: rgba(255, 255, 255, 0.1);
        }

        .progress-bar {
          height: 4px;
          background: rgba(255, 255, 255, 0.1);
          position: relative;
        }

        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #e53e3e, #ff6b6b);
          transition: width 0.3s ease;
        }

        .model-application-content {
          flex: 1;
          padding: 40px;
          overflow-y: auto;
        }

        .alert {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px;
          border-radius: 12px;
          margin-bottom: 24px;
          font-weight: 500;
        }

        .alert.error {
          background: rgba(229, 62, 62, 0.1);
          border: 1px solid rgba(229, 62, 62, 0.3);
          color: #ff6b6b;
        }

        .alert.success {
          background: rgba(76, 175, 80, 0.1);
          border: 1px solid rgba(76, 175, 80, 0.3);
          color: #4caf50;
        }

        .step-content h3 {
          color: #ffffff;
          font-size: 20px;
          font-weight: 600;
          margin: 0 0 8px 0;
        }

        .step-content > p {
          color: #cccccc;
          margin: 0 0 32px 0;
        }

        .form-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 20px;
          margin-bottom: 24px;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .form-group label {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #ffffff;
          font-weight: 500;
          font-size: 14px;
        }

        .form-group label svg {
          color: #e53e3e;
        }

        .form-group input,
        .form-group textarea {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          padding: 12px 16px;
          color: #ffffff;
          font-size: 16px;
          transition: all 0.2s;
        }

        .form-group input:focus,
        .form-group textarea:focus {
          outline: none;
          border-color: #e53e3e;
          background: rgba(255, 255, 255, 0.08);
        }

        .form-group textarea {
          resize: vertical;
          min-height: 100px;
        }

        .info-box {
          background: rgba(74, 144, 226, 0.1);
          border: 1px solid rgba(74, 144, 226, 0.3);
          border-radius: 12px;
          padding: 16px;
          display: flex;
          align-items: center;
          gap: 12px;
          margin-top: 24px;
        }

        .info-box svg {
          color: #4a90e2;
          flex-shrink: 0;
        }

        .info-box p {
          margin: 0;
          color: #ffffff;
          font-size: 14px;
        }

        .upload-section {
          margin-bottom: 32px;
        }

        .upload-section h4 {
          color: #ffffff;
          margin: 0 0 16px 0;
          font-size: 16px;
          font-weight: 600;
        }

        .upload-area {
          border: 2px dashed rgba(229, 62, 62, 0.3);
          border-radius: 12px;
          padding: 40px 20px;
          text-align: center;
          transition: all 0.2s;
          position: relative;
        }

        .upload-area:hover {
          border-color: rgba(229, 62, 62, 0.5);
          background: rgba(229, 62, 62, 0.02);
        }

        .upload-area input {
          position: absolute;
          inset: 0;
          opacity: 0;
          cursor: pointer;
        }

        .upload-area label {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          cursor: pointer;
          color: #ffffff;
        }

        .upload-area label svg {
          color: #e53e3e;
        }

        .upload-area label span {
          font-weight: 500;
          font-size: 16px;
        }

        .upload-area label small {
          color: #888;
          font-size: 14px;
        }

        .uploaded-files {
          margin-top: 16px;
          padding: 12px;
          background: rgba(76, 175, 80, 0.1);
          border: 1px solid rgba(76, 175, 80, 0.3);
          border-radius: 8px;
        }

        .uploaded-files p {
          margin: 0;
          color: #4caf50;
          font-weight: 500;
        }

        .upload-progress {
          margin-top: 24px;
          padding: 20px;
          background: rgba(255, 255, 255, 0.02);
          border-radius: 12px;
        }

        .progress-item {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 12px;
        }

        .progress-item span:first-child {
          flex: 1;
          color: #ffffff;
          font-size: 14px;
        }

        .progress-item span:last-child {
          color: #888;
          font-size: 14px;
          min-width: 40px;
        }

        .progress-bar.small {
          flex: 1;
          height: 8px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 4px;
          overflow: hidden;
        }

        .review-section {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .review-item h4 {
          color: #ffffff;
          margin: 0 0 12px 0;
          font-size: 16px;
          font-weight: 600;
        }

        .review-grid {
          display: grid;
          gap: 8px;
        }

        .review-grid div {
          color: #cccccc;
          font-size: 14px;
          padding: 8px 0;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }

        .success-step {
          text-align: center;
          padding: 40px 20px;
        }

        .success-step svg {
          color: #4caf50;
          margin-bottom: 24px;
        }

        .success-step h3 {
          color: #4caf50;
          font-size: 24px;
          margin-bottom: 16px;
        }

        .success-step > p {
          font-size: 16px;
          line-height: 1.6;
          margin-bottom: 32px;
        }

        .next-steps {
          text-align: left;
          background: rgba(255, 255, 255, 0.02);
          border-radius: 12px;
          padding: 24px;
          margin-top: 24px;
        }

        .next-steps h4 {
          color: #ffffff;
          margin: 0 0 16px 0;
          font-size: 16px;
        }

        .next-steps ul {
          margin: 0;
          padding-left: 20px;
          color: #cccccc;
        }

        .next-steps li {
          margin-bottom: 8px;
          line-height: 1.5;
        }

        .form-navigation {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          margin-top: 40px;
          padding-top: 24px;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
        }

        .btn {
          padding: 14px 28px;
          border: none;
          border-radius: 8px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          min-width: 120px;
        }

        .btn.primary {
          background: linear-gradient(135deg, #e53e3e, #c53030);
          color: #ffffff;
        }

        .btn.primary:hover:not(:disabled) {
          background: linear-gradient(135deg, #c53030, #a02727);
          transform: translateY(-2px);
        }

        .btn.secondary {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: #ffffff;
        }

        .btn.secondary:hover {
          background: rgba(255, 255, 255, 0.1);
        }

        .btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
          transform: none;
        }

        @media (max-width: 768px) {
          .model-application-modal {
            margin: 10px;
            max-width: none;
          }

          .model-application-header {
            padding: 20px 24px 16px;
          }

          .model-application-content {
            padding: 24px;
          }

          .form-grid {
            grid-template-columns: 1fr;
          }

          .form-navigation {
            flex-direction: column;
          }
        }
      `}</style>
    </div>
  );
};

export default ModelApplication;