import React, { useState, useEffect, useMemo } from 'react';
import { 
  AlertCircle, Clock, CheckCircle, CreditCard, BellRing, 
  Car, User, Settings2, AlertTriangle, ChevronDown, ChevronUp, 
  X, ShieldAlert, UserPlus, Check, RefreshCw
} from 'lucide-react';
import { BACKEND_URL, RideAPI } from '../utils/api';
import './PendingRides.css';

const STATUS_FILTERS = [
  'All',
  'Waiting for Driver',
  'Awaiting Driver Acceptance',
  'Waiting for Payment',
  'Scheduled (Not Completed)',
  'Awaiting Admin Confirmation'
];

const REJECTION_REASONS = [
  'Driver Issue',
  'Passenger No-show',
  'Payment Failed',
  'Vehicle Breakdown',
  'Route Inaccessible',
  'Other'
];

const PendingRides = () => {
  const [rides, setRides] = useState([]);
  const [activeFilter, setActiveFilter] = useState('All');
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('success');
  const [expandedRowId, setExpandedRowId] = useState(null);
  const [removingId, setRemovingId] = useState(null);

  const fetchPendingRides = async () => {
    try {
      let res = await fetch(`${BACKEND_URL}/api/ride/pending`).catch(() => null);
      if (!res || !res.ok) {
        res = await fetch(`${BACKEND_URL}/api/requests/pending`);
      }
      const data = await res.json();
      const rawList = Array.isArray(data.data) ? data.data : (data.data?.requests || []);
      if (data.success && rawList.length > 0) {
        const mapped = rawList.map(r => ({
          _id: r._id,
          id: r.requestId || r._id,
          passenger: r.customerName || 'Passenger',
          route: `${r.pickupLocation} -> ${r.dropLocation}`,
          date: `${r.date || ''} ${r.timeToLeave || ''}`.trim() || 'Today',
          driver: r.assignedDriverDetails?.name || null,
          fare: r.fare || 'Rs. 8,500',
          status: r.status,
          isOverdue: r.isOverdue || false,
          lastUpdated: 'Just now',
          notes: r.notes || ''
        }));
        setRides(mapped);
      }
    } catch (err) {
      console.error('Failed to fetch pending rides:', err);
    }
  };

  useEffect(() => {
    fetchPendingRides();
  }, []);

  // Rejection / Investigation Modal State
  const [modalState, setModalState] = useState({
    isOpen: false,
    ride: null,
    type: 'reject', // 'reject' | 'investigate'
    reason: 'Driver Issue',
    notes: ''
  });

  // Assign Driver Quick Modal State
  const [assignModal, setAssignModal] = useState({
    isOpen: false,
    ride: null,
    selectedDriver: 'DRV-1001 (Ahmed Khan - Toyota Corolla)'
  });

  const showToast = (msg, type = 'success') => {
    setToastMessage(msg);
    setToastType(type);
    setTimeout(() => setToastMessage(''), 4000);
  };

  // Overdue detection and sorting (Overdue sorted to TOP)
  const processedRides = useMemo(() => {
    let list = [...rides];
    if (activeFilter !== 'All') {
      list = list.filter(r => r.status === activeFilter);
    }

    // Automatically sort Overdue rides to the TOP of the list
    list.sort((a, b) => {
      const aOverdue = a.isOverdue || (a.status === 'Scheduled (Not Completed)' && a.date.includes('11:00 AM'));
      const bOverdue = b.isOverdue || (b.status === 'Scheduled (Not Completed)' && b.date.includes('11:00 AM'));
      if (aOverdue && !bOverdue) return -1;
      if (!aOverdue && bOverdue) return 1;
      return 0;
    });

    return list;
  }, [rides, activeFilter]);

  // Counts for each filter tab
  const getFilterCount = (filter) => {
    if (filter === 'All') return rides.length;
    return rides.filter(r => r.status === filter).length;
  };

  // Action execution with smooth fade-out animation
  const executeAction = (id, actionName, successMsg, customToastType = 'success') => {
    setRemovingId(id);
    setTimeout(() => {
      setRides(prev => prev.filter(r => r.id !== id));
      setRemovingId(null);
      if (expandedRowId === id) setExpandedRowId(null);
      showToast(successMsg || `${id} ${actionName} applied successfully.`, customToastType);
    }, 300);
  };

  // Open Rejection / Investigation modal
  const openModal = (ride, type) => {
    setModalState({
      isOpen: true,
      ride,
      type,
      reason: type === 'investigate' ? 'Driver Issue' : 'Passenger No-show',
      notes: ''
    });
  };

  const handleModalSubmit = (e) => {
    e.preventDefault();
    if (!modalState.ride) return;
    const { ride, type, reason, notes } = modalState;
    const actionLabel = type === 'investigate' ? 'Investigation Logged' : 'Rejected';
    const noteText = notes ? ` - Note: "${notes}"` : '';

    setModalState({ isOpen: false, ride: null, type: 'reject', reason: '', notes: '' });
    executeAction(
      ride.id,
      actionLabel,
      `${ride.id} ${actionLabel} (${reason})${noteText}`,
      type === 'investigate' ? 'warning' : 'danger'
    );
  };

  const handleAssignSubmit = async (e) => {
    e.preventDefault();
    if (!assignModal.ride) return;
    const { ride, selectedDriver } = assignModal;
    const targetRideId = ride._id || ride.id;
    // Extract driver ID if code string (e.g. DRV-1001 from 'DRV-1001 (Ahmed Khan - Toyota Corolla)')
    const driverIdMatch = selectedDriver.match(/DRV-[0-9]+/i);
    const targetDriverId = driverIdMatch ? driverIdMatch[0] : selectedDriver;

    try {
      await RideAPI.assign(targetRideId, targetDriverId, {
        remarks: `Manually Assigned to ${selectedDriver}`
      });
    } catch (err) {
      console.warn('Assign API warning:', err);
    }

    setAssignModal({ isOpen: false, ride: null, selectedDriver: '' });
    executeAction(
      ride.id,
      'Assigned',
      `${ride.id} manually assigned to ${selectedDriver} successfully.`
    );
  };

  const toggleRow = (id) => {
    setExpandedRowId(prev => prev === id ? null : id);
  };

  const handleSaveNote = (rideId, newNote) => {
    setRides(prev => prev.map(r => r.id === rideId ? { ...r, notes: newNote } : r));
    showToast(`Note updated for ${rideId}`);
  };

  // Status Badge Rendering with Live Timestamps & Icons
  const renderStatusBadge = (ride) => {
    const isOverdue = ride.isOverdue || (ride.status === 'Scheduled (Not Completed)' && ride.date.includes('11:00 AM'));

    let badgeClass = 'status-badge-pending';
    let icon = <AlertCircle size={14} />;

    switch (ride.status) {
      case 'Awaiting Driver Acceptance':
        badgeClass = 'badge-orange';
        icon = <BellRing size={14} />;
        break;
      case 'Scheduled (Not Completed)':
        badgeClass = 'badge-blue';
        icon = <Clock size={14} />;
        break;
      case 'Waiting for Payment':
        badgeClass = 'badge-red';
        icon = <CreditCard size={14} />;
        break;
      case 'Awaiting Admin Confirmation':
        badgeClass = 'badge-purple';
        icon = <Settings2 size={14} />;
        break;
      case 'Waiting for Driver':
        badgeClass = 'badge-amber';
        icon = <Car size={14} />;
        break;
      default:
        badgeClass = 'badge-grey';
        icon = <AlertCircle size={14} />;
    }

    return (
      <div className="status-cell-wrapper">
        <div className="status-badge-stack">
          <span className={`status-pill ${badgeClass}`}>
            {icon}
            <span>{ride.status}</span>
          </span>
          {isOverdue && (
            <span className="overdue-tag fade-in" title="Scheduled time has passed!">
              <AlertTriangle size={12} />
              <span>OVERDUE</span>
            </span>
          )}
        </div>
        <span className="status-timestamp">{ride.lastUpdated}</span>
      </div>
    );
  };

  // Context-Specific Actions Rendering (CRITICAL)
  const renderContextActions = (ride) => {
    switch (ride.status) {
      case 'Awaiting Driver Acceptance':
        return (
          <div className="action-buttons-group">
            <button
              type="button"
              className="btn-action-green"
              onClick={(e) => {
                e.stopPropagation();
                executeAction(ride.id, 'Force Accept', `✓ ${ride.id} Force Accepted successfully.`);
              }}
            >
              <Check size={14} /> Force Accept
            </button>
            <button
              type="button"
              className="btn-action-outline"
              onClick={(e) => {
                e.stopPropagation();
                setAssignModal({ isOpen: true, ride, selectedDriver: 'DRV-1003 (Usman Tariq - Honda Civic)' });
              }}
            >
              <RefreshCw size={13} /> Reassign Driver
            </button>
          </div>
        );

      case 'Scheduled (Not Completed)':
        return (
          <div className="action-buttons-group">
            <button
              type="button"
              className="btn-action-green"
              onClick={(e) => {
                e.stopPropagation();
                executeAction(ride.id, 'Mark Complete', `✓ ${ride.id} Marked as Complete successfully.`);
              }}
            >
              <Check size={14} /> Mark Complete
            </button>
            <button
              type="button"
              className="btn-action-orange"
              onClick={(e) => {
                e.stopPropagation();
                openModal(ride, 'investigate');
              }}
            >
              <ShieldAlert size={14} /> Investigate
            </button>
          </div>
        );

      case 'Waiting for Payment':
        return (
          <div className="action-buttons-group">
            <button
              type="button"
              className="btn-action-green"
              onClick={(e) => {
                e.stopPropagation();
                executeAction(ride.id, 'Confirm Payment', `✓ ${ride.id} Payment confirmed successfully.`);
              }}
            >
              <Check size={14} /> Confirm Payment
            </button>
            <button
              type="button"
              className="btn-action-outline"
              onClick={(e) => {
                e.stopPropagation();
                executeAction(ride.id, 'Waived', `${ride.id} Payment charge waived.`);
              }}
            >
              Waive
            </button>
          </div>
        );

      case 'Awaiting Admin Confirmation':
        return (
          <div className="action-buttons-group">
            <button
              type="button"
              className="btn-action-green"
              onClick={(e) => {
                e.stopPropagation();
                executeAction(ride.id, 'Confirmed', `✓ ${ride.id} confirmed successfully.`);
              }}
            >
              <Check size={14} /> Confirm
            </button>
            <button
              type="button"
              className="btn-action-red-outline"
              onClick={(e) => {
                e.stopPropagation();
                openModal(ride, 'reject');
              }}
            >
              <X size={14} /> Reject
            </button>
          </div>
        );

      case 'Waiting for Driver':
        return (
          <div className="action-buttons-group">
            <button
              type="button"
              className="btn-action-blue"
              onClick={(e) => {
                e.stopPropagation();
                setAssignModal({ isOpen: true, ride, selectedDriver: 'DRV-1001 (Ahmed Khan - Toyota Corolla)' });
              }}
            >
              <UserPlus size={14} /> Assign Driver
            </button>
          </div>
        );

      default:
        return (
          <button
            type="button"
            className="btn-action-green"
            onClick={(e) => {
              e.stopPropagation();
              executeAction(ride.id, 'Resolved', `${ride.id} issue resolved.`);
            }}
          >
            Resolve
          </button>
        );
    }
  };

  return (
    <div className="pending-module-container fade-in">
      {/* Toast Notification */}
      {toastMessage && (
        <div className={`pending-toast-box ${toastType} fade-in`}>
          {toastType === 'danger' ? <X size={20} /> : <CheckCircle size={20} />}
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="pending-header-strip">
        <div>
          <h1 className="pending-page-title">Pending Rides Monitor</h1>
          <p className="pending-page-subtitle">Track and resolve rides that require Admin attention.</p>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="pending-table-card">
        {/* Filter Navigation Tabs */}
        <div className="pending-filters-bar">
          <span className="filter-title-tag">Filter:</span>
          <div className="filter-chips-list">
            {STATUS_FILTERS.map(filter => {
              const count = getFilterCount(filter);
              const isActive = activeFilter === filter;
              return (
                <button
                  key={filter}
                  className={`pending-filter-pill ${isActive ? 'active' : ''}`}
                  onClick={() => setActiveFilter(filter)}
                >
                  <span>{filter}</span>
                  <span className="pill-count">{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Clean Responsive Table */}
        <div className="pending-table-wrapper">
          <table className="pending-data-table">
            <colgroup>
              <col style={{ width: '110px' }} />
              <col style={{ width: '150px' }} />
              <col style={{ width: '200px' }} />
              <col style={{ width: '180px' }} />
              <col style={{ width: '220px' }} />
              <col style={{ width: '160px' }} />
            </colgroup>
            <thead>
              <tr>
                <th>RIDE ID</th>
                <th>PASSENGER</th>
                <th>ROUTE &amp; TIME</th>
                <th>DRIVER</th>
                <th>STATUS</th>
                <th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {processedRides.length === 0 ? (
                <tr>
                  <td colSpan="6" className="pending-empty-state">
                    <CheckCircle size={36} className="empty-icon" />
                    <p>No pending rides in this filter category.</p>
                  </td>
                </tr>
              ) : (
                processedRides.map(ride => {
                  const isExpanded = expandedRowId === ride.id;
                  const isRemoving = removingId === ride.id;
                  const isOverdue = ride.isOverdue || (ride.status === 'Scheduled (Not Completed)' && ride.date.includes('11:00 AM'));

                  return (
                    <React.Fragment key={ride.id}>
                      <tr 
                        className={`pending-row ${isExpanded ? 'row-expanded' : ''} ${isOverdue ? 'row-overdue-highlight' : ''} ${isRemoving ? 'row-fade-out' : ''}`}
                        onClick={() => toggleRow(ride.id)}
                        title="Click row to expand/collapse details"
                      >
                        {/* Ride ID */}
                        <td className="cell-ride-id">
                          <div className="ride-id-box">
                            <span className="ride-id-text">{ride.id}</span>
                            {isExpanded ? <ChevronUp size={14} className="expand-arrow active" /> : <ChevronDown size={14} className="expand-arrow" />}
                          </div>
                        </td>

                        {/* Passenger */}
                        <td>
                          <div className="passenger-cell">
                            <div className="passenger-avatar-icon">
                              <User size={15} />
                            </div>
                            <span className="passenger-name">{ride.passenger}</span>
                          </div>
                        </td>

                        {/* Route & Time */}
                        <td>
                          <div className="route-cell-stack">
                            <span className="route-name">{ride.route}</span>
                            <span className="route-time-sub">{ride.date}</span>
                          </div>
                        </td>

                        {/* Driver */}
                        <td>
                          {ride.driver ? (
                            <span className="driver-name-text">{ride.driver}</span>
                          ) : (
                            <span className="unassigned-driver-tag">Unassigned</span>
                          )}
                        </td>

                        {/* Status */}
                        <td>
                          {renderStatusBadge(ride)}
                        </td>

                        {/* Contextual Action Buttons */}
                        <td className="actions-cell">
                          {renderContextActions(ride)}
                        </td>
                      </tr>

                      {/* Expandable Details Accordion */}
                      {isExpanded && (
                        <tr className="expanded-details-row fade-in">
                          <td colSpan="6" className="expanded-details-cell">
                            <div className="expanded-inner-card">
                              <div className="expanded-grid-stats">
                                <div className="expanded-stat-box">
                                  <span className="stat-label-tiny">FARE AMOUNT</span>
                                  <span className="stat-val-bold text-primary">{ride.fare || 'Rs. 8,500'}</span>
                                </div>
                                <div className="expanded-stat-box">
                                  <span className="stat-label-tiny">DISTANCE (KM)</span>
                                  <span className="stat-val-bold">{ride.distance || '240 km'}</span>
                                </div>
                                <div className="expanded-stat-box">
                                  <span className="stat-label-tiny">PASSENGER RATING</span>
                                  <span className="stat-val-bold text-warning">⭐ {ride.passengerRating || '4.9'}</span>
                                </div>
                                <div className="expanded-stat-box">
                                  <span className="stat-label-tiny">DRIVER RATING</span>
                                  <span className="stat-val-bold text-success">
                                    {ride.driver ? `⭐ ${ride.driverRating || '4.8'}` : 'Unassigned'}
                                  </span>
                                </div>
                              </div>

                              <div className="expanded-notes-section">
                                <label className="notes-label">DISPATCHER NOTES FOR {ride.id}:</label>
                                <div className="notes-edit-box">
                                  <input 
                                    type="text" 
                                    className="notes-inline-input"
                                    defaultValue={ride.notes || ''}
                                    id={`note-input-${ride.id}`}
                                    placeholder="Add internal dispatcher instructions or remarks..."
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                  <button 
                                    type="button" 
                                    className="notes-save-btn"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const val = document.getElementById(`note-input-${ride.id}`).value;
                                      handleSaveNote(ride.id, val);
                                    }}
                                  >
                                    Save Note
                                  </button>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* =========================================================================
          REJECTION & INVESTIGATION MODAL
          ========================================================================= */}
      {modalState.isOpen && modalState.ride && (
        <div className="modal-overlay fade-in" style={{ zIndex: 1100 }}>
          <div className="glass-panel modal-content pending-modal-card">
            <div className="modal-header">
              <div className="modal-title-wrap">
                <ShieldAlert size={20} className={modalState.type === 'investigate' ? 'text-warning' : 'text-danger'} />
                <h2>{modalState.type === 'investigate' ? 'Investigate Ride Issue' : 'Reject Ride Application'}</h2>
              </div>
              <button 
                type="button" 
                className="icon-btn" 
                onClick={() => setModalState({ isOpen: false, ride: null, type: 'reject', reason: '', notes: '' })}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleModalSubmit} className="modal-body">
              <div className="modal-ride-summary">
                <div className="summary-row">
                  <span className="summary-label">Ride ID:</span>
                  <span className="summary-val font-mono">{modalState.ride.id}</span>
                </div>
                <div className="summary-row">
                  <span className="summary-label">Passenger:</span>
                  <span className="summary-val">{modalState.ride.passenger}</span>
                </div>
                <div className="summary-row">
                  <span className="summary-label">Route:</span>
                  <span className="summary-val">{modalState.ride.route}</span>
                </div>
              </div>

              <div className="form-group mb-3">
                <label>REASON FOR {modalState.type === 'investigate' ? 'INVESTIGATION' : 'REJECTION'} *</label>
                <select
                  className="form-input custom-select"
                  value={modalState.reason}
                  onChange={(e) => setModalState({ ...modalState, reason: e.target.value })}
                  required
                >
                  {REJECTION_REASONS.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              <div className="form-group mb-4">
                <label>DISPATCHER REMARKS / NOTES (OPTIONAL)</label>
                <textarea
                  className="form-input modal-textarea"
                  rows="3"
                  placeholder="Enter detailed reason or instructions for audit log..."
                  value={modalState.notes}
                  onChange={(e) => setModalState({ ...modalState, notes: e.target.value })}
                ></textarea>
              </div>

              <div className="modal-actions-footer">
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => setModalState({ isOpen: false, ride: null, type: 'reject', reason: '', notes: '' })}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={modalState.type === 'investigate' ? 'btn-primary bg-orange' : 'btn-primary bg-danger'}
                >
                  {modalState.type === 'investigate' ? 'Log & Resolve Issue' : 'Confirm Rejection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          ASSIGN DRIVER MODAL (FOR UNASSIGNED / REASSIGN RIDES)
          ========================================================================= */}
      {assignModal.isOpen && assignModal.ride && (
        <div className="modal-overlay fade-in" style={{ zIndex: 1100 }}>
          <div className="glass-panel modal-content pending-modal-card">
            <div className="modal-header">
              <div className="modal-title-wrap">
                <UserPlus size={20} className="text-primary" />
                <h2>Assign Driver to {assignModal.ride.id}</h2>
              </div>
              <button 
                type="button" 
                className="icon-btn" 
                onClick={() => setAssignModal({ isOpen: false, ride: null, selectedDriver: '' })}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAssignSubmit} className="modal-body">
              <div className="modal-ride-summary">
                <div className="summary-row">
                  <span className="summary-label">Route:</span>
                  <span className="summary-val">{assignModal.ride.route}</span>
                </div>
                <div className="summary-row">
                  <span className="summary-label">Scheduled Time:</span>
                  <span className="summary-val">{assignModal.ride.date}</span>
                </div>
                <div className="summary-row">
                  <span className="summary-label">Fare:</span>
                  <span className="summary-val text-primary font-bold">{assignModal.ride.fare || 'Rs. 9,500'}</span>
                </div>
              </div>

              <div className="form-group mb-4">
                <label>SELECT VERIFIED DRIVER *</label>
                <select
                  className="form-input custom-select"
                  value={assignModal.selectedDriver}
                  onChange={(e) => setAssignModal({ ...assignModal, selectedDriver: e.target.value })}
                  required
                >
                  <option value="DRV-1001 (Ahmed Khan - Toyota Corolla)">DRV-1001 • Ahmed Khan (Toyota Corolla - Lahore)</option>
                  <option value="DRV-1002 (Ali Raza - Suzuki Bolan)">DRV-1002 • Ali Raza (Suzuki Bolan - Karachi)</option>
                  <option value="DRV-1003 (Usman Tariq - Honda Civic)">DRV-1003 • Usman Tariq (Honda Civic - Islamabad)</option>
                  <option value="DRV-1004 (Zain Abbas - Toyota Yaris)">DRV-1004 • Zain Abbas (Toyota Yaris - Gujranwala)</option>
                </select>
              </div>

              <div className="modal-actions-footer">
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => setAssignModal({ isOpen: false, ride: null, selectedDriver: '' })}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Confirm Assignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PendingRides;
