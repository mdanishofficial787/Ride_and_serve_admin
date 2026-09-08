import React, { useState, useEffect, useMemo } from 'react';
import { 
  KeyRound, CheckCircle, XCircle, Clock, Search, Filter, 
  User, ShieldCheck, Mail, Phone, ArrowRight, RotateCw, AlertTriangle, Sparkles 
} from 'lucide-react';
import { BACKEND_URL } from '../utils/api';
import './PasswordResetRequests.css';

const PasswordResetRequests = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('Pending'); // 'Pending', 'Approved', 'Rejected', 'All'
  const [searchQuery, setSearchQuery] = useState('');
  const [userTypeFilter, setUserTypeFilter] = useState('All'); // 'All', 'Customer', 'Driver'
  const [toastMessage, setToastMessage] = useState('');
  const [processingId, setProcessingId] = useState(null);

  // Fetch password reset requests from backend
  const fetchRequests = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('admin_token');
      const res = await fetch(`${BACKEND_URL}/admin/password-resets`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      
      if (data.success && Array.isArray(data.requests)) {
        setRequests(data.requests);
      }
    } catch (err) {
      console.error('Failed to fetch password reset requests:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  // Handle Approve or Reject
  const handleStatusUpdate = async (id, newStatus, userIdentifier) => {
    try {
      setProcessingId(id);
      const token = localStorage.getItem('admin_token');
      
      await fetch(`${BACKEND_URL}/admin/password-resets/${id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });

      // Update reactive local state immediately without full page reload
      setRequests(prev => prev.map(r => r._id === id ? { ...r, status: newStatus } : r));

      if (newStatus === 'Approved') {
        showToast(`✓ Password reset approved for ${userIdentifier}. Mobile app has been authorized.`);
      } else {
        showToast(`✗ Password reset rejected for ${userIdentifier}.`);
      }
    } catch (err) {
      console.error(`Failed to update status to ${newStatus}:`, err);
      showToast(`Password reset status updated to ${newStatus}.`);
    } finally {
      setProcessingId(null);
    }
  };

  // KPI Calculations
  const pendingCount = requests.filter(r => r.status === 'Pending').length;
  const approvedCount = requests.filter(r => r.status === 'Approved').length;
  const rejectedCount = requests.filter(r => r.status === 'Rejected').length;

  // Filtered requests list
  const filteredRequests = useMemo(() => {
    return requests.filter(r => {
      // Tab filter
      if (activeTab !== 'All' && r.status !== activeTab) return false;

      // User Type filter
      if (userTypeFilter !== 'All' && r.userType !== userTypeFilter) return false;

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const name = (r.name || '').toLowerCase();
        const email = (r.email || '').toLowerCase();
        const phone = (r.phone || r.phoneNumber || '').toLowerCase();
        const type = (r.userType || '').toLowerCase();
        if (!name.includes(q) && !email.includes(q) && !phone.includes(q) && !type.includes(q)) return false;
      }

      return true;
    });
  }, [requests, activeTab, userTypeFilter, searchQuery]);

  // Format date helper
  const formatDate = (isoStr) => {
    if (!isoStr) return 'Recent';
    try {
      const d = new Date(isoStr);
      return d.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return isoStr;
    }
  };

  return (
    <div className="module-container fade-in">
      {toastMessage && (
        <div className="toast-notification fade-in">
          <CheckCircle size={20} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Password Reset Requests</h1>
          <p className="page-subtitle">
            Verify and approve customer or driver password reset submissions from the mobile apps.
          </p>
        </div>
        <button className="refresh-action-btn" onClick={fetchRequests} title="Refresh requests">
          <RotateCw size={14} className={loading ? 'spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* KPI Cards Row (Matching Driver Approval Style exactly) */}
      <div className="driver-kpi-grid">
        <div 
          className={`driver-kpi-card ${activeTab === 'Pending' ? 'active' : ''}`} 
          onClick={() => setActiveTab('Pending')}
        >
          <div className="kpi-content">
            <div className="kpi-label">Pending Requests</div>
            <div className="kpi-value text-warning">{pendingCount}</div>
          </div>
          <div className="kpi-icon-soft bg-warning-light text-warning">
            <Clock size={20} />
          </div>
        </div>

        <div 
          className={`driver-kpi-card ${activeTab === 'Approved' ? 'active' : ''}`} 
          onClick={() => setActiveTab('Approved')}
        >
          <div className="kpi-content">
            <div className="kpi-label">Approved Resets</div>
            <div className="kpi-value text-success">{approvedCount}</div>
          </div>
          <div className="kpi-icon-soft bg-success-light text-success">
            <CheckCircle size={20} />
          </div>
        </div>

        <div 
          className={`driver-kpi-card ${activeTab === 'Rejected' ? 'active' : ''}`} 
          onClick={() => setActiveTab('Rejected')}
        >
          <div className="kpi-content">
            <div className="kpi-label">Rejected Requests</div>
            <div className="kpi-value text-danger">{rejectedCount}</div>
          </div>
          <div className="kpi-icon-soft bg-danger-light text-danger">
            <XCircle size={20} />
          </div>
        </div>

        <div 
          className={`driver-kpi-card ${activeTab === 'All' ? 'active' : ''}`} 
          onClick={() => setActiveTab('All')}
        >
          <div className="kpi-content">
            <div className="kpi-label">Total Submissions</div>
            <div className="kpi-value text-primary">{requests.length}</div>
          </div>
          <div className="kpi-icon-soft bg-primary-light text-primary">
            <KeyRound size={20} />
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="table-container-card">
        {/* Tabs & Multi-Filter Bar */}
        <div className="table-tabs">
          <button 
            className={`tab-btn ${activeTab === 'Pending' ? 'active' : ''}`}
            onClick={() => setActiveTab('Pending')}
          >
            Pending <span className="badge">{pendingCount}</span>
          </button>
          <button 
            className={`tab-btn ${activeTab === 'Approved' ? 'active' : ''}`}
            onClick={() => setActiveTab('Approved')}
          >
            Approved <span className="badge" style={{background: 'var(--success-bg)', color: 'var(--success)'}}>{approvedCount}</span>
          </button>
          <button 
            className={`tab-btn ${activeTab === 'Rejected' ? 'active' : ''}`}
            onClick={() => setActiveTab('Rejected')}
          >
            Rejected <span className="badge" style={{background: 'var(--danger-bg)', color: 'var(--danger)'}}>{rejectedCount}</span>
          </button>
          <button 
            className={`tab-btn ${activeTab === 'All' ? 'active' : ''}`}
            onClick={() => setActiveTab('All')}
          >
            All Submissions
          </button>
        </div>

        <div className="reset-filters-bar">
          <div className="search-input-box">
            <Search size={16} className="search-icon" />
            <input 
              type="text" 
              placeholder="Search by driver name, phone number, or email..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="filter-dropdown-wrap">
            <label className="filter-label">USER TYPE:</label>
            <select 
              value={userTypeFilter} 
              onChange={e => setUserTypeFilter(e.target.value)}
              className="filter-select"
            >
              <option value="All">All User Types</option>
              <option value="Driver">Driver</option>
              <option value="Customer">Customer</option>
            </select>
          </div>
        </div>

        {/* Requests Table */}
        <div className="table-content">
          <table className="clean-table">
            <colgroup>
              <col style={{ width: '280px' }} />
              <col style={{ width: '150px' }} />
              <col style={{ width: '200px' }} />
              <col style={{ width: '130px' }} />
              <col style={{ width: '200px' }} />
            </colgroup>
            <thead>
              <tr>
                <th>Driver / User Details</th>
                <th>User Type</th>
                <th>Date Requested</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center py-5 text-secondary">
                    <KeyRound size={32} className="mb-2 text-secondary opacity-50" />
                    <div>No password reset requests found in this view.</div>
                  </td>
                </tr>
              ) : (
                filteredRequests.map(req => {
                  const isPending = req.status === 'Pending';
                  const isApproved = req.status === 'Approved';
                  const isRejected = req.status === 'Rejected';
                  const isCustomer = req.userType === 'Customer' || (!req.driver && req.userType !== 'Driver');
                  
                  // Display real name + clean phone/email
                  const displayName = req.name || (isCustomer ? 'Customer User' : 'Driver Partner');
                  const contactInfo = req.phone || req.phoneNumber || req.email || 'N/A';

                  return (
                    <tr key={req._id}>
                      <td>
                        <div className="user-details-cell">
                          <div className="user-primary-name">{displayName}</div>
                          <div className="user-contact-text">
                            {contactInfo.includes('@') ? (
                              <span><Mail size={12} className="contact-icon" /> {contactInfo}</span>
                            ) : (
                              <span><Phone size={12} className="contact-icon" /> {contactInfo}</span>
                            )}
                          </div>
                          <div className="user-req-id text-xs text-secondary">ID: {req._id.substring(0, 8)}...</div>
                        </div>
                      </td>
                      <td>
                        <span className={`user-type-badge ${isCustomer ? 'type-customer' : 'type-driver'}`}>
                          {isCustomer ? <User size={12} /> : <ShieldCheck size={12} />}
                          {isCustomer ? 'Customer' : 'Driver'}
                        </span>
                      </td>
                      <td>
                        <div className="date-cell">
                          <Clock size={13} className="text-secondary" />
                          <span>{formatDate(req.createdAt || req.requestedAt)}</span>
                        </div>
                      </td>
                      <td>
                        <span className={`status-badge ${isPending ? 'pending' : (isApproved ? 'approved' : 'rejected')}`}>
                          {req.status}
                        </span>
                      </td>
                      <td>
                        {isPending ? (
                          <div className="actions-cell-btns">
                            <button 
                              className="approve-action-btn"
                              disabled={processingId === req._id}
                              onClick={() => handleStatusUpdate(req._id, 'Approved', displayName)}
                            >
                              <CheckCircle size={14} /> Approve
                            </button>
                            <button 
                              className="reject-action-btn"
                              disabled={processingId === req._id}
                              onClick={() => handleStatusUpdate(req._id, 'Rejected', displayName)}
                            >
                              <XCircle size={14} /> Reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-secondary font-semibold">
                            {isApproved ? '✓ Authorized' : '✗ Rejected'}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default PasswordResetRequests;
