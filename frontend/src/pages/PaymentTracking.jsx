import React, { useState } from 'react';
import { Search, Plus, X, DollarSign, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import './PaymentTracking.css';

// Mock Data
const MOCK_PAYMENTS = [
  { id: 1, transId: 'PT1001', user: 'user@rayhent', rideId: '1752', type: 'Rs. 500 Charge', amount: 500, date: '02/09/2026', status: 'Pending' },
  { id: 2, transId: 'PT1002', user: 'user@rayhent', rideId: '2368', type: 'Rs. 25,000 Charge', amount: 25000, date: '04/09/2026', status: 'Payment Submitted' },
  { id: 3, transId: 'PT1003', user: 'ustr@rayhent', rideId: '2714', type: 'Other Charge', amount: 1500, date: '02/09/2026', status: 'Verified/Paid' },
  { id: 4, transId: 'PT1004', user: 'user@ruthoch', rideId: '3069', type: 'Rs. 500 Charge', amount: 500, date: '26/08/2026', status: 'Rejected' },
  { id: 5, transId: 'PT1005', user: 'user@rayhent', rideId: '1679', type: 'Rs. 500 Charge', amount: 500, date: '27/08/2026', status: 'Payment Submitted' },
  { id: 6, transId: 'PT1006', user: 'ush@rayhent',  rideId: '3660', type: 'Rs. 25,000 Charge', amount: 25000, date: '26/08/2026', status: 'Pending' },
];

const PaymentTracking = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [actionStatus, setActionStatus] = useState('Keep Pending');
  const [rejectionReason, setRejectionReason] = useState('');

  // Filtering
  const filteredData = MOCK_PAYMENTS.filter(item => {
    const matchesSearch = item.user.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          item.rideId.includes(searchTerm) || 
                          item.transId.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'All' || item.type === filterType;
    const matchesStatus = filterStatus === 'All' || item.status === filterStatus;
    
    return matchesSearch && matchesType && matchesStatus;
  });

  const handleView = (payment) => {
    setSelectedPayment(payment);
    setActionStatus(payment.status === 'Verified/Paid' ? 'Verify/Paid' : 'Keep Pending');
    setRejectionReason('');
  };

  const closeModal = () => {
    setSelectedPayment(null);
  };

  const getStatusClass = (status) => {
    if (status.includes('Pending')) return 'pending';
    if (status.includes('Submitted')) return 'submitted';
    if (status.includes('Verified') || status.includes('Paid')) return 'verified';
    if (status.includes('Rejected')) return 'rejected';
    return '';
  };

  return (
    <div className="payment-tracking-container">
      
      <div className="payment-header">
        <div>
          <h1>Payment Tracking</h1>
          <p>Monitor and manage driver/user payments</p>
        </div>
        <button className="add-charge-btn">
          <Plus size={16} /> Add Other Charge
        </button>
      </div>

      {/* Main Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-info">
            <h3>Total Payments</h3>
            <div className="stat-value">450</div>
          </div>
          <div className="stat-icon total"><DollarSign size={20} /></div>
        </div>
        <div className="stat-card">
          <div className="stat-info">
            <h3>Pending</h3>
            <div className="stat-value">25</div>
          </div>
          <div className="stat-icon pending"><Clock size={20} /></div>
        </div>
        <div className="stat-card">
          <div className="stat-info">
            <h3>Submitted for Verification</h3>
            <div className="stat-value">10</div>
          </div>
          <div className="stat-icon submitted"><AlertCircle size={20} /></div>
        </div>
        <div className="stat-card">
          <div className="stat-info">
            <h3>Verified / Paid</h3>
            <div className="stat-value">415</div>
          </div>
          <div className="stat-icon verified"><CheckCircle size={20} /></div>
        </div>
      </div>

      {/* Sub Stats */}
      <div className="sub-stats-grid">
        <div className="sub-stat-card">
          <div className="sub-stat-title">Rs. 500 Charge</div>
          <div className="sub-stat-details">
            <span>Pending: <strong>15</strong></span>
            <span>Verified: <strong>200</strong></span>
          </div>
        </div>
        <div className="sub-stat-card">
          <div className="sub-stat-title">Rs. 25,000 Charge</div>
          <div className="sub-stat-details">
            <span>Pending: <strong>5</strong></span>
            <span>Verified: <strong>180</strong></span>
          </div>
        </div>
        <div className="sub-stat-card">
          <div className="sub-stat-title">Other Charges</div>
          <div className="sub-stat-details">
            <span>Pending: <strong>5</strong></span>
            <span>Verified: <strong>35</strong></span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="filters-section">
        <div className="search-box">
          <Search size={16} />
          <input 
            type="text" 
            placeholder="Search by User, Ride ID..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <select className="filter-select" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
          <option value="All">All Charge Types</option>
          <option value="Rs. 500 Charge">Rs. 500 Charge</option>
          <option value="Rs. 25,000 Charge">Rs. 25,000 Charge</option>
          <option value="Other Charge">Other Charge</option>
        </select>
        <select className="filter-select" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="All">All Statuses</option>
          <option value="Pending">Pending</option>
          <option value="Payment Submitted">Payment Submitted</option>
          <option value="Verified/Paid">Verified/Paid</option>
          <option value="Rejected">Rejected</option>
        </select>
      </div>

      {/* Table */}
      <div className="table-container">
        <table className="payment-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>User</th>
              <th>Ride ID</th>
              <th>Charge Type</th>
              <th>Amount</th>
              <th>Date</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.length > 0 ? (
              filteredData.map((row) => (
                <tr key={row.id}>
                  <td>{row.id}</td>
                  <td>
                    <div className="user-info">
                      <div className="user-avatar">{row.user.charAt(0).toUpperCase()}</div>
                      <div className="user-details">
                        <span className="user-name">{row.user}</span>
                      </div>
                    </div>
                  </td>
                  <td>{row.rideId}</td>
                  <td>{row.type}</td>
                  <td>Rs. {row.amount.toLocaleString()}</td>
                  <td>{row.date}</td>
                  <td>
                    <span className={`status-badge ${getStatusClass(row.status)}`}>
                      {row.status}
                    </span>
                  </td>
                  <td>
                    <button className="view-btn" onClick={() => handleView(row)}>View</button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', padding: '30px' }}>No payments found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Action Modal */}
      {selectedPayment && (
        <div className="payment-modal-overlay" onClick={closeModal}>
          <div className="payment-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Payment Details (ID: {selectedPayment.transId})</h2>
              <button className="close-btn" onClick={closeModal}><X size={20} /></button>
            </div>
            
            <div className="modal-body">
              <div className="modal-left">
                <div className="detail-row">
                  <span className="label">User:</span>
                  <span className="val">{selectedPayment.user}</span>
                </div>
                <div className="detail-row">
                  <span className="label">Ride ID:</span>
                  <span className="val">{selectedPayment.rideId}</span>
                </div>
                <div className="detail-row">
                  <span className="label">Charge Type:</span>
                  <span className="val">{selectedPayment.type}</span>
                </div>
                <div className="detail-row">
                  <span className="label">Amount:</span>
                  <span className="val" style={{ color: 'var(--primary-color)', fontSize: '16px' }}>
                    Rs. {selectedPayment.amount.toLocaleString()}
                  </span>
                </div>
                <div className="detail-row">
                  <span className="label">Date:</span>
                  <span className="val">{selectedPayment.date}</span>
                </div>

                <div className="proof-container">
                  <p style={{ color: 'var(--text-secondary)', marginBottom: '10px', fontSize: '13px' }}>Payment Proof Screenshot</p>
                  {selectedPayment.status === 'Pending' ? (
                    <div style={{ padding: '30px', color: '#9ca3af' }}>No proof uploaded yet.</div>
                  ) : (
                    <img 
                      src="https://via.placeholder.com/400x250.png?text=Bank+Receipt+Screenshot" 
                      alt="Proof" 
                      className="proof-img" 
                    />
                  )}
                </div>
              </div>

              <div className="modal-right">
                <div className="action-section">
                  <h3>Admin Actions</h3>
                  <div className="radio-group">
                    <label className="radio-label">
                      <input 
                        type="radio" 
                        name="actionStatus" 
                        value="Verify/Paid"
                        checked={actionStatus === 'Verify/Paid'}
                        onChange={(e) => setActionStatus(e.target.value)}
                      />
                      Verify / Paid
                    </label>
                    <label className="radio-label">
                      <input 
                        type="radio" 
                        name="actionStatus" 
                        value="Keep Pending"
                        checked={actionStatus === 'Keep Pending'}
                        onChange={(e) => setActionStatus(e.target.value)}
                      />
                      Keep Pending
                    </label>
                    <label className="radio-label">
                      <input 
                        type="radio" 
                        name="actionStatus" 
                        value="Reject"
                        checked={actionStatus === 'Reject'}
                        onChange={(e) => setActionStatus(e.target.value)}
                      />
                      Reject
                    </label>
                  </div>

                  {actionStatus === 'Reject' && (
                    <textarea 
                      className="rejection-input" 
                      placeholder="Enter rejection reason (e.g. Screenshot blurry, amount incorrect)..."
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                    ></textarea>
                  )}

                  <button 
                    className="submit-action-btn"
                    onClick={() => {
                      alert(`Submitted: ${actionStatus}`);
                      closeModal();
                    }}
                  >
                    Submit Action
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default PaymentTracking;
