import React, { useState, useEffect } from 'react';
import { Plus, Check, Edit, RefreshCw, X, Eye } from 'lucide-react';
import { BACKEND_URL } from '../utils/api';
import './TermsConditions.css';

const TermsConditions = () => {
  const [termsList, setTermsList] = useState([]);
  const [settings, setSettings] = useState({
    showDuringSignup: true,
    agreementRequired: true,
    checkboxLabel: "I agree to the Terms & Conditions and Privacy Policy"
  });
  const [logs, setLogs] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTerm, setEditingTerm] = useState(null);
  
  const [formData, setFormData] = useState({
    version: '',
    title: '',
    content: ''
  });

  const [isLoading, setIsLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  
  const currentTerm = termsList.find(t => t.status === 'Published') || termsList[0] || null;

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [termsRes, settingsRes, logsRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/terms`),
        fetch(`${BACKEND_URL}/api/terms/settings/all`),
        fetch(`${BACKEND_URL}/api/terms/logs/all`)
      ]);
      
      const termsData = await termsRes.json();
      const settingsData = await settingsRes.json();
      const logsData = await logsRes.json();
      
      if (termsData.success) setTermsList(termsData.data);
      if (settingsData.success && settingsData.data) setSettings(settingsData.data);
      if (logsData.success) setLogs(logsData.data);
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  };

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  const handleSettingsChange = (field, value) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  const saveSettings = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/terms/settings/all`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      const data = await res.json();
      if (data.success) {
        showToast('Settings saved successfully!');
      }
    } catch (error) {
      showToast('Error saving settings.');
    }
  };

  const openModal = (term = null) => {
    if (term) {
      setEditingTerm(term);
      setFormData({
        version: term.version,
        title: term.title,
        content: term.content
      });
    } else {
      setEditingTerm(null);
      setFormData({
        version: '',
        title: '',
        content: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleSaveTerm = async () => {
    if (!formData.version || !formData.title || !formData.content) {
      return showToast('Please fill all fields.');
    }
    setIsLoading(true);
    try {
      const url = editingTerm 
        ? `${BACKEND_URL}/api/terms/${editingTerm._id}` 
        : `${BACKEND_URL}/api/terms`;
      const method = editingTerm ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (data.success) {
        showToast(editingTerm ? 'Term updated successfully!' : 'Term created successfully!');
        setIsModalOpen(false);
        fetchData();
      }
    } catch (error) {
      showToast('Error saving term.');
    } finally {
      setIsLoading(false);
    }
  };

  const publishTerm = async (id) => {
    if(!window.confirm("Are you sure you want to publish this version? This will become the active agreement.")) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/terms/${id}/publish`, { method: 'PUT' });
      const data = await res.json();
      if (data.success) {
        showToast('Term published successfully!');
        fetchData();
      }
    } catch (error) {
      showToast('Error publishing term.');
    }
  };

  return (
    <div className="terms-conditions-container fade-in">
      {toastMessage && (
        <div className="toast-notification success" style={{position:'fixed', top:20, right:20, zIndex:9999}}>
          <Check size={16} /> {toastMessage}
        </div>
      )}

      <div className="terms-header">
        <div>
          <h1>Terms & Conditions</h1>
          <p>Manage current and historical legal agreements</p>
        </div>
        <button className="btn-primary" onClick={() => openModal()}>
          <Plus size={16} /> Add Terms & Conditions
        </button>
      </div>

      {/* Current Terms Section */}
      <div className="tc-card">
        <h2 className="tc-title">Current Terms</h2>
        {currentTerm ? (
          <div className="current-terms-grid">
            <div className="terms-details-panel">
              <p><strong>Version:</strong> {currentTerm.version}</p>
              <p><strong>Title:</strong> {currentTerm.title}</p>
              <p>
                <strong>Status:</strong> 
                <span className={currentTerm.status === 'Published' ? 'badge-published' : 'badge-draft'}>
                  {currentTerm.status}
                </span>
              </p>
              <p><strong>Effective Date:</strong> {currentTerm.publishedAt ? new Date(currentTerm.publishedAt).toLocaleDateString() : 'Not published yet'}</p>
              
              <div className="terms-actions">
                <button className="btn-secondary" onClick={() => openModal(currentTerm)}>Edit Details</button>
              </div>
            </div>
            <div className="terms-document-panel">
              <p style={{marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.875rem'}}>Actual Terms & Conditions Document</p>
              <div className="terms-document-view">
                {currentTerm.content.split('\n').map((para, idx) => (
                  <p key={idx} style={{marginBottom:'0.5rem'}}>{para}</p>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <p style={{color: '#6b7280', fontSize: '0.875rem'}}>No terms and conditions found. Please add one.</p>
        )}
      </div>

      {/* Signup Agreement Settings */}
      <div className="tc-card">
        <h2 className="tc-title">Signup Agreement Settings</h2>
        
        <div className="settings-grid">
          <div className="toggle-group">
            <label className="toggle-switch">
              <input 
                type="checkbox" 
                checked={settings.showDuringSignup} 
                onChange={(e) => handleSettingsChange('showDuringSignup', e.target.checked)} 
              />
              <span className="toggle-slider"></span>
            </label>
            <span style={{fontSize:'0.875rem', fontWeight:500}}>Show During Signup (Active)</span>
          </div>

          <div className="toggle-group">
            <label className="toggle-switch">
              <input 
                type="checkbox" 
                checked={settings.agreementRequired} 
                onChange={(e) => handleSettingsChange('agreementRequired', e.target.checked)} 
              />
              <span className="toggle-slider"></span>
            </label>
            <span style={{fontSize:'0.875rem', fontWeight:500}}>Agreement Required (Active)</span>
          </div>
        </div>

        <div className="form-group" style={{maxWidth: '800px', marginTop: '1rem'}}>
          <label>Agreement Checkbox Label</label>
          <div style={{display:'flex', gap:'1rem'}}>
            <input 
              type="text" 
              className="form-input" 
              value={settings.checkboxLabel} 
              onChange={(e) => handleSettingsChange('checkboxLabel', e.target.value)}
            />
            <button className="btn-primary" onClick={saveSettings}>Save</button>
          </div>
        </div>
      </div>

      {/* Version History */}
      <div className="tc-card">
        <h2 className="tc-title">Version History</h2>
        <div style={{overflowX: 'auto'}}>
          <table className="tc-table">
            <thead>
              <tr>
                <th>Version</th>
                <th>Title</th>
                <th>Status</th>
                <th>Created Date</th>
                <th>Published Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {termsList.map(term => (
                <tr key={term._id}>
                  <td>{term.version}</td>
                  <td>{term.title}</td>
                  <td>
                    <span className={term.status === 'Published' ? 'badge-published' : 'badge-draft'}>
                      {term.status}
                    </span>
                  </td>
                  <td>{new Date(term.createdAt).toLocaleDateString()}</td>
                  <td>{term.publishedAt ? new Date(term.publishedAt).toLocaleDateString() : '-'}</td>
                  <td>
                    <button className="action-link" onClick={() => openModal(term)}>Edit</button>
                    {term.status !== 'Published' && (
                      <button className="action-link" onClick={() => publishTerm(term._id)}>Publish</button>
                    )}
                  </td>
                </tr>
              ))}
              {termsList.length === 0 && (
                <tr>
                  <td colSpan="6" style={{textAlign:'center', color:'#6b7280'}}>No version history found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* User Acceptance Records */}
      <div className="tc-card">
        <h2 className="tc-title">User Acceptance Records</h2>
        
        <div className="filters-bar">
          <input type="text" className="form-input" placeholder="Search Acceptance Logs" />
          <select className="form-input">
            <option value="">All User Types</option>
            <option value="Customer">Customer</option>
            <option value="Driver">Driver</option>
          </select>
          <select className="form-input">
            <option value="">All Versions</option>
            {termsList.map(t => <option key={t._id} value={t.version}>{t.version}</option>)}
          </select>
        </div>

        <div style={{overflowX: 'auto', maxHeight:'300px'}}>
          <table className="tc-table">
            <thead>
              <tr>
                <th>User ID</th>
                <th>Name</th>
                <th>Type</th>
                <th>Terms Version</th>
                <th>Status</th>
                <th>Date/Time</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => (
                <tr key={log._id}>
                  <td>{log.userId}</td>
                  <td>{log.userName || '-'}</td>
                  <td>{log.userType}</td>
                  <td>{log.termsVersion}</td>
                  <td>[{log.status}]</td>
                  <td>{new Date(log.acceptedAt).toLocaleString()}</td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan="6" style={{textAlign:'center', color:'#6b7280'}}>No acceptance logs found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>{editingTerm ? 'Edit Terms & Conditions' : 'Add Terms & Conditions'}</h2>
              <button className="icon-btn" onClick={() => setIsModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Version Number</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="e.g. v2.1" 
                  value={formData.version}
                  onChange={(e) => setFormData({...formData, version: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label>Document Title</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="e.g. Standard Terms of Service - Rev. Oct 2026" 
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label>Content</label>
                <textarea 
                  className="form-input" 
                  rows="10" 
                  placeholder="Enter the full terms and conditions text here..."
                  value={formData.content}
                  onChange={(e) => setFormData({...formData, content: e.target.value})}
                  style={{resize:'vertical'}}
                ></textarea>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleSaveTerm} disabled={isLoading}>
                {isLoading ? <RefreshCw size={16} className="spin" /> : <Check size={16} />}
                {editingTerm ? 'Update' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TermsConditions;
