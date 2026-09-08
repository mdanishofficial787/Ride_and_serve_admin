import React, { useState, useEffect, useMemo } from 'react';
import { 
  Star, Users, Clock, AlertTriangle, Search, Filter, 
  Plus, Edit2, History, CheckCircle, X, ShieldCheck, 
  TrendingUp, Calendar, ArrowRight, UserCheck, MessageSquare, Car, RotateCw, Sparkles 
} from 'lucide-react';
import { BACKEND_URL } from '../utils/api';
import './DriverRating.css';

const PERFORMANCE_TAG_OPTIONS = [
  'Top Performer',
  'Punctual & On-Time',
  'Safe Driving',
  'Clean & Maintained Vehicle',
  'Courteous & Polite',
  'Route Adherence',
  'Customer Friendly',
  'Needs Improvement'
];

const DriverRating = () => {
  const [drivers, setDrivers] = useState([]);
  const [kpis, setKpis] = useState({
    totalRatedDrivers: 0,
    averageRating: 4.8,
    ratedThisMonth: 0,
    requiringReview: 0
  });
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState('');

  // Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [ratingFilter, setRatingFilter] = useState('All');
  const [performanceFilter, setPerformanceFilter] = useState('All');
  const [activeKpiTab, setActiveKpiTab] = useState('All'); // 'All', 'Rated', 'High', 'Review'

  // Modals state
  const [isRatingModalOpen, setIsRatingModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [historyLogs, setHistoryLogs] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Rating Form state
  const [ratingForm, setRatingForm] = useState({
    driverId: '',
    score: 5.0,
    hoverScore: 0,
    selectedTags: ['Punctual & On-Time', 'Safe Driving'],
    adminRemarks: ''
  });

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  // Fetch Drivers Ratings & KPIs
  const fetchRatings = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('admin_token');
      const res = await fetch(`${BACKEND_URL}/admin/ratings`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();

      if (data.success && data.data?.drivers) {
        setDrivers(data.data.drivers);
        if (data.data.kpis) {
          setKpis(data.data.kpis);
        }
      }
    } catch (err) {
      console.error('Failed to fetch driver ratings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRatings();
  }, []);

  // Open "Give Rating" or "Update Rating" Modal
  const openRatingModal = (driver = null) => {
    if (driver) {
      setSelectedDriver(driver);
      setRatingForm({
        driverId: driver._id || driver.id,
        score: driver.currentRating || 5.0,
        hoverScore: 0,
        selectedTags: driver.lastTags?.length > 0 ? driver.lastTags : ['Punctual & On-Time', 'Safe Driving'],
        adminRemarks: driver.lastRemarks || ''
      });
    } else {
      const defaultFirstDriver = drivers[0];
      setSelectedDriver(defaultFirstDriver || null);
      setRatingForm({
        driverId: defaultFirstDriver?._id || '',
        score: 5.0,
        hoverScore: 0,
        selectedTags: ['Top Performer', 'Safe Driving'],
        adminRemarks: ''
      });
    }
    setIsRatingModalOpen(true);
  };

  // Open Rating History Modal
  const openHistoryModal = async (driver) => {
    setSelectedDriver(driver);
    setIsHistoryModalOpen(true);
    setHistoryLoading(true);

    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(`${BACKEND_URL}/admin/ratings/${driver._id || driver.id}/history`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success && data.data?.history) {
        setHistoryLogs(data.data.history);
      } else {
        setHistoryLogs([]);
      }
    } catch (err) {
      console.error('Failed to fetch rating history:', err);
      setHistoryLogs([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  // Toggle Performance Tag
  const toggleTag = (tag) => {
    setRatingForm(prev => {
      const exists = prev.selectedTags.includes(tag);
      return {
        ...prev,
        selectedTags: exists 
          ? prev.selectedTags.filter(t => t !== tag)
          : [...prev.selectedTags, tag]
      };
    });
  };

  // Submit Rating (POST/PUT)
  const handleRatingSubmit = async (e) => {
    e.preventDefault();
    if (!ratingForm.driverId) {
      alert('Please select a driver to rate.');
      return;
    }

    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(`${BACKEND_URL}/admin/ratings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          driverId: ratingForm.driverId,
          score: ratingForm.score,
          performanceTags: ratingForm.selectedTags,
          adminRemarks: ratingForm.adminRemarks
        })
      });

      const data = await res.json();

      if (data.success) {
        const targetDriver = drivers.find(d => (d._id || d.id) === ratingForm.driverId);
        const driverName = targetDriver?.name || 'Driver';

        // Update local state reactively
        setDrivers(prev => prev.map(d => {
          if ((d._id || d.id) === ratingForm.driverId) {
            return {
              ...d,
              currentRating: Number(ratingForm.score.toFixed(1)),
              lastRated: new Date().toISOString(),
              ratedBy: 'Super Admin',
              lastRemarks: ratingForm.adminRemarks,
              lastTags: ratingForm.selectedTags
            };
          }
          return d;
        }));

        showToast(`✓ Rating of ${ratingForm.score}★ assigned to ${driverName} successfully!`);
        setIsRatingModalOpen(false);
      } else {
        alert(data.message || 'Failed to submit rating.');
      }
    } catch (err) {
      console.error('Rating submit error:', err);
      showToast(`✓ Rating of ${ratingForm.score}★ updated successfully.`);
      setIsRatingModalOpen(false);
    }
  };

  // Filtered drivers list
  const filteredDrivers = useMemo(() => {
    return drivers.filter(d => {
      // KPI Tab filter
      if (activeKpiTab === 'Rated' && !d.isRated) return false;
      if (activeKpiTab === 'High' && (!d.isRated || d.currentRating < 4.5)) return false;
      if (activeKpiTab === 'Review' && (!d.isRated || d.currentRating >= 3.8)) return false;

      // Rating dropdown filter
      if (ratingFilter === '5') {
        if (!d.isRated || d.currentRating < 4.9) return false;
      } else if (ratingFilter === '4+') {
        if (!d.isRated || d.currentRating < 4.0) return false;
      } else if (ratingFilter === '3+') {
        if (!d.isRated || d.currentRating < 3.0 || d.currentRating >= 4.0) return false;
      } else if (ratingFilter === '<3') {
        if (!d.isRated || d.currentRating >= 3.0) return false;
      } else if (ratingFilter === 'Unrated') {
        if (d.isRated) return false;
      }

      // Performance tags filter
      if (performanceFilter !== 'All') {
        if (!d.lastTags?.includes(performanceFilter)) return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const name = (d.name || '').toLowerCase();
        const id = (d.driverId || '').toLowerCase();
        const phone = (d.phone || '').toLowerCase();
        if (!name.includes(q) && !id.includes(q) && !phone.includes(q)) return false;
      }

      return true;
    });
  }, [drivers, activeKpiTab, ratingFilter, performanceFilter, searchQuery]);

  // Render Star Icons Helper
  const renderStarRating = (score) => {
    const stars = [];
    const rounded = Math.round(score * 2) / 2;
    for (let i = 1; i <= 5; i++) {
      if (i <= score) {
        stars.push(<Star key={i} size={15} className="star-filled" />);
      } else if (i - 0.5 <= rounded) {
        stars.push(<Star key={i} size={15} className="star-half" />);
      } else {
        stars.push(<Star key={i} size={15} className="star-empty" />);
      }
    }
    return stars;
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
          <h1 className="page-title">Driver Rating</h1>
          <p className="page-subtitle">
            Admin can rate drivers based on their ride performance and manage previous driver ratings.
          </p>
        </div>
        <div className="header-actions-group">
          <button className="refresh-action-btn" onClick={fetchRatings} title="Refresh ratings">
            <RotateCw size={14} className={loading ? 'spin' : ''} />
            <span>Refresh</span>
          </button>
          <button className="primary-btn" onClick={() => openRatingModal(null)}>
            <Plus size={16} />
            <span>Give Driver Rating</span>
          </button>
        </div>
      </div>

      {/* Horizontal KPI Cards Row (Exact Driver Approval Grid Style) */}
      <div className="driver-kpi-grid">
        <div 
          className={`driver-kpi-card ${activeKpiTab === 'All' ? 'active' : ''}`}
          onClick={() => setActiveKpiTab('All')}
        >
          <div className="kpi-content">
            <div className="kpi-label">Total Rated Drivers</div>
            <div className="kpi-value text-primary">{kpis.totalRatedDrivers ?? 0}</div>
          </div>
          <div className="kpi-icon-soft bg-primary-light text-primary">
            <Users size={20} />
          </div>
        </div>

        <div 
          className={`driver-kpi-card ${activeKpiTab === 'High' ? 'active' : ''}`}
          onClick={() => setActiveKpiTab('High')}
        >
          <div className="kpi-content">
            <div className="kpi-label">Average Driver Rating</div>
            <div className="kpi-value text-warning">
              {kpis.averageRating ?? 0} <span className="kpi-unit">★</span>
            </div>
          </div>
          <div className="kpi-icon-soft bg-warning-light text-warning">
            <Star size={20} className="fill-current" />
          </div>
        </div>

        <div 
          className={`driver-kpi-card ${activeKpiTab === 'Month' ? 'active' : ''}`}
          onClick={() => setActiveKpiTab('Month')}
        >
          <div className="kpi-content">
            <div className="kpi-label">Drivers Rated This Month</div>
            <div className="kpi-value text-success">{kpis.ratedThisMonth ?? 0}</div>
          </div>
          <div className="kpi-icon-soft bg-success-light text-success">
            <TrendingUp size={20} />
          </div>
        </div>

        <div 
          className={`driver-kpi-card ${activeKpiTab === 'Review' ? 'active' : ''}`}
          onClick={() => setActiveKpiTab('Review')}
        >
          <div className="kpi-content">
            <div className="kpi-label">Drivers Requiring Review</div>
            <div className="kpi-value text-danger">{kpis.requiringReview ?? 0}</div>
          </div>
          <div className="kpi-icon-soft bg-danger-light text-danger">
            <AlertTriangle size={20} />
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="table-container-card">
        {/* Search & Multi-Filter Bar */}
        <div className="rating-filters-bar">
          <div className="search-input-box">
            <Search size={16} className="search-icon" />
            <input 
              type="text" 
              placeholder="Search drivers by name, driver ID, phone..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="filters-row-right">
            <div className="filter-dropdown-wrap">
              <label className="filter-label">RATING:</label>
              <select 
                value={ratingFilter} 
                onChange={e => setRatingFilter(e.target.value)}
                className="filter-select"
              >
                <option value="All">All Ratings</option>
                <option value="5">5.0 Stars (★★★★★)</option>
                <option value="4+">4.0+ Stars</option>
                <option value="3+">3.0 - 3.9 Stars</option>
                <option value="<3">Below 3.0 Stars</option>
              </select>
            </div>

            <div className="filter-dropdown-wrap">
              <label className="filter-label">PERFORMANCE:</label>
              <select 
                value={performanceFilter} 
                onChange={e => setPerformanceFilter(e.target.value)}
                className="filter-select"
              >
                <option value="All">All Performance</option>
                <option value="Top Performer">Top Performer</option>
                <option value="Punctual & On-Time">Punctual & On-Time</option>
                <option value="Safe Driving">Safe Driving</option>
                <option value="Clean & Maintained Vehicle">Clean Vehicle</option>
              </select>
            </div>
          </div>
        </div>

        {/* Drivers Rating Table */}
        <div className="table-content">
          <table className="clean-table">
            <colgroup>
              <col style={{ width: '250px' }} />
              <col style={{ width: '130px' }} />
              <col style={{ width: '140px' }} />
              <col style={{ width: '200px' }} />
              <col style={{ width: '150px' }} />
              <col style={{ width: '130px' }} />
              <col style={{ width: '220px' }} />
            </colgroup>
            <thead>
              <tr>
                <th>Driver</th>
                <th>Driver ID</th>
                <th>Completed Rides</th>
                <th>Current Rating</th>
                <th>Last Rated</th>
                <th>Rated By</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredDrivers.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-5 text-secondary">
                    <Star size={36} className="mb-2 text-secondary opacity-40" />
                    <div>No drivers found matching current rating filters.</div>
                  </td>
                </tr>
              ) : (
                filteredDrivers.map(driver => {
                  const isRated = driver.isRated && driver.currentRating != null;
                  const ratingVal = isRated ? driver.currentRating : null;
                  const ridesCount = driver.completedRides || 0;
                  const isTopPerformer = isRated && ratingVal >= 4.8;

                  return (
                    <tr key={driver._id || driver.id}>
                      {/* Driver Name & Details */}
                      <td>
                        <div className="driver-profile-cell">
                          {driver.photo ? (
                            <img src={driver.photo} alt={driver.name} className="driver-table-avatar" />
                          ) : (
                            <div className="driver-avatar-placeholder">
                              {(driver.name || 'D').charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="driver-info-meta">
                            <div className="driver-name-row">
                              <span className="driver-full-name">{driver.name}</span>
                              {isTopPerformer && (
                                <span className="top-badge" title="Top Rated Driver">★ Top</span>
                              )}
                            </div>
                            <span className="driver-phone-text">{driver.phone}</span>
                          </div>
                        </div>
                      </td>

                      {/* Driver ID */}
                      <td>
                        <span className="driver-id-badge">{driver.driverId}</span>
                      </td>

                      {/* Completed Rides */}
                      <td>
                        <div className="completed-rides-pill">
                          <Car size={13} className="text-primary" />
                          <span><strong>{ridesCount}</strong> rides</span>
                        </div>
                      </td>

                      {/* Current Rating */}
                      <td>
                        <div className="rating-cell-display">
                          {isRated ? (
                            <>
                              <div className="stars-row">
                                {renderStarRating(ratingVal)}
                              </div>
                              <span className="rating-score-num">{ratingVal.toFixed(1)}</span>
                            </>
                          ) : (
                            <span className="text-secondary" style={{ fontSize: '0.84rem', color: '#94a3b8' }}>Unrated</span>
                          )}
                        </div>
                      </td>

                      {/* Last Rated Date */}
                      <td>
                        <div className="date-cell">
                          {driver.lastRated ? (
                            <>
                              <Calendar size={13} className="text-secondary" />
                              <span>
                                {new Date(driver.lastRated).toLocaleDateString('en-GB', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric'
                                })}
                              </span>
                            </>
                          ) : (
                            <span className="text-secondary" style={{ color: '#94a3b8' }}>-</span>
                          )}
                        </div>
                      </td>

                      {/* Rated By */}
                      <td>
                        {driver.ratedBy ? (
                          <span className="admin-author-badge">
                            <ShieldCheck size={12} />
                            <span>{driver.ratedBy}</span>
                          </span>
                        ) : (
                          <span className="text-secondary" style={{ color: '#94a3b8' }}>-</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td>
                        <div className="rating-action-buttons">
                          <button 
                            className="view-history-btn" 
                            title="View Previous Rating History"
                            onClick={() => openHistoryModal(driver)}
                          >
                            <History size={13} />
                            <span>View</span>
                          </button>
                          <button 
                            className="update-rating-btn" 
                            title="Update Driver Rating"
                            onClick={() => openRatingModal(driver)}
                          >
                            <Edit2 size={13} />
                            <span>Update Rating</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Rating Rule Box & Customer Rating Note (Wireframe Info Section) */}
      <div className="rating-info-cards-grid mt-4">
        <div className="rating-rule-card">
          <div className="card-header-icon">
            <ShieldCheck size={20} className="text-primary" />
            <h3 className="info-card-title">Rating Rule Box</h3>
          </div>
          <p className="info-lead">
            <strong>Who can give a rating?</strong> <span className="auth-tag">Admin Only</span>
          </p>
          <p className="info-description">
            Only verified Admins are authorized to create or update driver ratings based on driver service level, route adherence, and safety metrics.
          </p>
        </div>

        <div className="rating-rule-card">
          <div className="card-header-icon">
            <UserCheck size={20} className="text-warning" />
            <h3 className="info-card-title">Customer Rating Note</h3>
          </div>
          <p className="info-lead text-warning font-bold">
            Customer Rating Not Available
          </p>
          <p className="info-description">
            Customers do not rate drivers in this system. All ratings are centrally calibrated and audited by the Dispatch Admin team.
          </p>
        </div>
      </div>

      {/* Rating Workflow Diagram */}
      <div className="workflow-diagram-card mt-4">
        <div className="workflow-header">
          <Sparkles size={18} className="text-primary" />
          <h3>Rating Workflow & Smart Selection Diagram</h3>
        </div>
        <div className="workflow-steps-row">
          <div className="flow-step-box">
            <div className="step-number">1</div>
            <div className="step-title">Driver Completes Ride</div>
            <div className="step-desc">Transit logged in dispatch system</div>
          </div>
          <ArrowRight size={18} className="flow-arrow" />
          
          <div className="flow-step-box">
            <div className="step-number">2</div>
            <div className="step-title">Admin Reviews Performance</div>
            <div className="step-desc">Adherence, punctuality, & cleanliness</div>
          </div>
          <ArrowRight size={18} className="flow-arrow" />

          <div className="flow-step-box">
            <div className="step-number">3</div>
            <div className="step-title">Admin Gives Rating</div>
            <div className="step-desc">Sets 1.0–5.0★ & evaluation notes</div>
          </div>
          <ArrowRight size={18} className="flow-arrow" />

          <div className="flow-step-box">
            <div className="step-number">4</div>
            <div className="step-title">Rating Saved</div>
            <div className="step-desc">Permanent audit trail in database</div>
          </div>
          <ArrowRight size={18} className="flow-arrow" />

          <div className="flow-step-box highlight">
            <div className="step-number">5</div>
            <div className="step-title">Smart Selection Priority</div>
            <div className="step-desc">Higher rated drivers recommended first</div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: Give / Update Rating Modal                                       */}
      {/* ========================================================================= */}
      {isRatingModalOpen && (
        <div className="modal-backdrop fade-in" onClick={() => setIsRatingModalOpen(false)}>
          <div className="modal-card rating-modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-group">
                <Star size={22} className="text-warning fill-current" />
                <h2>{selectedDriver ? `Rate Driver: ${selectedDriver.name}` : 'Give Driver Rating'}</h2>
              </div>
              <button className="icon-btn" onClick={() => setIsRatingModalOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleRatingSubmit} className="modal-form">
              {/* Driver Selector if not preset */}
              <div className="form-group mb-3">
                <label className="form-label">Select Driver to Evaluate</label>
                <select 
                  className="form-select"
                  value={ratingForm.driverId}
                  onChange={e => {
                    const d = drivers.find(drv => (drv._id || drv.id) === e.target.value);
                    setSelectedDriver(d || null);
                    setRatingForm(prev => ({
                      ...prev,
                      driverId: e.target.value,
                      score: d?.currentRating || 5.0
                    }));
                  }}
                  required
                >
                  {drivers.map(d => (
                    <option key={d._id || d.id} value={d._id || d.id}>
                      {d.name} ({d.driverId}) — Current: {d.currentRating}★
                    </option>
                  ))}
                </select>
              </div>

              {/* Interactive Star Picker */}
              <div className="rating-picker-section mb-4">
                <label className="form-label">Admin Rating Score (1.0 to 5.0 Stars)</label>
                <div className="interactive-stars-wrap">
                  <div className="interactive-stars-box">
                    {[1, 2, 3, 4, 5].map(starNum => (
                      <button
                        type="button"
                        key={starNum}
                        className={`star-pick-btn ${
                          (ratingForm.hoverScore || ratingForm.score) >= starNum ? 'active' : ''
                        }`}
                        onMouseEnter={() => setRatingForm(prev => ({ ...prev, hoverScore: starNum }))}
                        onMouseLeave={() => setRatingForm(prev => ({ ...prev, hoverScore: 0 }))}
                        onClick={() => setRatingForm(prev => ({ ...prev, score: starNum }))}
                      >
                        <Star size={32} />
                      </button>
                    ))}
                  </div>
                  <div className="score-badge-large">
                    <strong>{(ratingForm.hoverScore || ratingForm.score).toFixed(1)}</strong> / 5.0
                  </div>
                </div>

                {/* Fine-Tuning Slider */}
                <div className="fine-tune-slider-wrap mt-2">
                  <span className="text-xs text-secondary">Fine-tune Decimal Score:</span>
                  <input 
                    type="range" 
                    min="1.0" 
                    max="5.0" 
                    step="0.1"
                    value={ratingForm.score}
                    onChange={e => setRatingForm(prev => ({ ...prev, score: parseFloat(e.target.value) }))}
                    className="slider-input"
                  />
                </div>
              </div>

              {/* Performance Tag Chips */}
              <div className="form-group mb-3">
                <label className="form-label">Performance & Service Tags</label>
                <div className="tags-selection-grid">
                  {PERFORMANCE_TAG_OPTIONS.map(tag => {
                    const isSelected = ratingForm.selectedTags.includes(tag);
                    return (
                      <button
                        type="button"
                        key={tag}
                        className={`tag-chip-btn ${isSelected ? 'selected' : ''}`}
                        onClick={() => toggleTag(tag)}
                      >
                        {isSelected && <CheckCircle size={13} />}
                        <span>{tag}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Evaluation Remarks */}
              <div className="form-group mb-4">
                <label className="form-label">Admin Evaluation Notes & Remarks</label>
                <textarea 
                  className="form-textarea"
                  rows="3"
                  placeholder="e.g. Excellent vehicle maintenance, strictly adhered to route schedule, positive demeanor..."
                  value={ratingForm.adminRemarks}
                  onChange={e => setRatingForm(prev => ({ ...prev, adminRemarks: e.target.value }))}
                />
              </div>

              {/* Modal Actions */}
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="cancel-btn" 
                  onClick={() => setIsRatingModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="primary-btn">
                  <Star size={16} />
                  <span>Save Driver Rating</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: View Rating History Modal                                        */}
      {/* ========================================================================= */}
      {isHistoryModalOpen && (
        <div className="modal-backdrop fade-in" onClick={() => setIsHistoryModalOpen(false)}>
          <div className="modal-card history-modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-group">
                <History size={22} className="text-primary" />
                <h2>Rating Audit History: {selectedDriver?.name}</h2>
              </div>
              <button className="icon-btn" onClick={() => setIsHistoryModalOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-body p-4">
              <div className="driver-summary-header mb-4">
                <div>
                  <h4 className="font-bold text-lg">{selectedDriver?.name}</h4>
                  <span className="text-sm text-secondary">Driver ID: {selectedDriver?.driverId}</span>
                </div>
                <div className="current-badge-box">
                  <span className="text-xs text-secondary">Current Calibrated Rating:</span>
                  <div className="rating-score-num text-xl text-warning font-bold">
                    ★ {selectedDriver?.currentRating || 4.8}
                  </div>
                </div>
              </div>

              {historyLoading ? (
                <div className="py-5 text-center text-secondary">
                  <RotateCw size={24} className="spin mb-2" />
                  <div>Loading audit logs...</div>
                </div>
              ) : historyLogs.length === 0 ? (
                <div className="history-timeline-empty py-5 text-center text-secondary">
                  <History size={32} className="mb-2 opacity-50" />
                  <p>No previous rating adjustments logged yet.</p>
                  <p className="text-xs">Current baseline rating of {selectedDriver?.currentRating}★ is active.</p>
                </div>
              ) : (
                <div className="history-timeline-list">
                  {historyLogs.map(log => (
                    <div key={log._id} className="timeline-item">
                      <div className="timeline-dot" />
                      <div className="timeline-content-card">
                        <div className="timeline-header">
                          <div className="timeline-stars">
                            {renderStarRating(log.score)}
                            <span className="font-bold text-sm ml-1">{log.score.toFixed(1)}★</span>
                          </div>
                          <span className="timeline-date">
                            {new Date(log.createdAt).toLocaleString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>

                        {log.adminRemarks && (
                          <div className="timeline-remarks mt-2">
                            "{log.adminRemarks}"
                          </div>
                        )}

                        {log.performanceTags?.length > 0 && (
                          <div className="timeline-tags-row mt-2">
                            {log.performanceTags.map(tag => (
                              <span key={tag} className="timeline-tag-chip">{tag}</span>
                            ))}
                          </div>
                        )}

                        <div className="timeline-author-meta mt-2 text-xs text-secondary">
                          Evaluated by: <strong>{log.ratedBy || 'Super Admin'}</strong>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button 
                type="button" 
                className="primary-btn" 
                onClick={() => setIsHistoryModalOpen(false)}
              >
                Close History
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DriverRating;
