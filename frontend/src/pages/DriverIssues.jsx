import React, { useState, useEffect, useCallback, useMemo } from 'react';
import io from 'socket.io-client';
import { 
  AlertTriangle, CheckCircle, Clock, ShieldAlert, Car, User, Phone, 
  MapPin, RefreshCw, Search, Filter, ExternalLink, ArrowRight, X, 
  Check, MessageSquare, AlertCircle, Wrench, ShieldCheck, Send
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import './DriverIssues.css';

const ENDPOINTS = [
  'http://localhost:3000/admin/issues',
  'http://192.168.88.59:3000/admin/issues',
  'http://localhost:5000/admin/issues',
  'http://localhost:5000/api/issues'
];

const SOCKET_URLS = [
  'http://localhost:3000',
  'http://192.168.88.59:3000',
  'http://localhost:5000'
];

const DriverIssues = () => {
  const navigate = useNavigate();
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // ALL, Pending, Resolved
  const [severityFilter, setSeverityFilter] = useState('ALL'); // ALL, High, Medium, Low
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [isResolveModalOpen, setIsResolveModalOpen] = useState(false);
  const [isReplacementModalOpen, setIsReplacementModalOpen] = useState(false);
  const [availableDrivers, setAvailableDrivers] = useState([]);
  const [selectedReplacementDriver, setSelectedReplacementDriver] = useState(null);
  const [resolutionRemarks, setResolutionRemarks] = useState('');
  const [notifyCustomer, setNotifyCustomer] = useState(true);
  const [affectedDate, setAffectedDate] = useState('May 21, 2026');
  const [affectedTime, setAffectedTime] = useState('08:00 AM - 10:00 AM');
  const [reportedReason, setReportedReason] = useState('Vehicle Issue');
  const [detailsText, setDetailsText] = useState('Driver is unavailable due to a sudden mechanical issue with the vehicle. We apologize for the inconvenience and are working to find a replacement driver immediately. The issue is severe enough to prevent the ride.');
  const [canRequestReplacement, setCanRequestReplacement] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [activeEndpointUsed, setActiveEndpointUsed] = useState('');

  // 1. Fetch all driver reported issues for Admin Panel
  const fetchReportedIssues = useCallback(async () => {
    setLoading(true);
    const token = localStorage.getItem('adminToken') || localStorage.getItem('admin_token') || '';
    let fetched = false;

    for (const url of ENDPOINTS) {
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            console.log('Issues list from', url, ':', data.issues || data.data);
            setIssues(data.issues || data.data || []);
            setActiveEndpointUsed(url);
            fetched = true;
            break;
          }
        }
      } catch (err) {
        // Silent fallback to next available backend endpoint
      }
    }

    if (!fetched) {
      console.warn('Could not fetch issues from standard endpoints, trying port 5000 direct');
      try {
        const fallbackRes = await fetch('http://localhost:5000/admin/issues');
        if (fallbackRes.ok) {
          const fallbackData = await fallbackRes.json();
          if (fallbackData.issues) {
            setIssues(fallbackData.issues);
          }
        }
      } catch (e) {
        console.error('Error fetching fallback issues:', e);
      }
    }

    setLoading(false);
  }, []);

  // Fetch available drivers for replacement
  const fetchAvailableDrivers = useCallback(async () => {
    const driverUrls = [
      'http://localhost:5000/admin/driver/verified',
      'http://localhost:5000/api/drivers',
      'http://localhost:3000/api/drivers'
    ];

    for (const url of driverUrls) {
      try {
        const token = localStorage.getItem('adminToken') || localStorage.getItem('admin_token') || '';
        const res = await fetch(url, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          const list = data.drivers || data.data || [];
          if (list.length > 0) {
            const mapped = list.map(d => ({
              id: d._id || d.id,
              name: d.Name || d.name || d.driverName || 'Verified Driver',
              phone: d.PhoneNumber || d.phone || '+92 300 0000000',
              vehicle: d.vehicle || d.vehicleDetails?.model || d.vehicleModel || 'Sedan Executive',
              status: d.status || d.verificationStatus || 'Available'
            }));
            setAvailableDrivers(mapped);
            break;
          }
        }
      } catch (e) {}
    }
  }, []);

  useEffect(() => {
    fetchReportedIssues();
    fetchAvailableDrivers();
  }, [fetchReportedIssues, fetchAvailableDrivers]);

  // 2. Real-Time Socket Listeners for Driver Issues
  useEffect(() => {
    const sockets = [];

    SOCKET_URLS.forEach(url => {
      try {
        const socket = io(url, {
          transports: ['websocket', 'polling'],
          reconnectionAttempts: 5,
          timeout: 5000
        });

        socket.on('connect', () => {
          console.log(`[DriverIssues] Connected to Socket.IO at ${url}`);
          socket.emit('join-admin');
        });

        // Listen for new issue reported by any driver
        socket.on('new_issue_report', (newIssue) => {
          console.log('New Issue Reported by Driver:', newIssue);
          // Show alert or push to state
          alert(`⚠️ Driver ${newIssue.driverName || 'Driver'} reported: ${newIssue.reason || 'Issue'}\nLocation: ${newIssue.location || 'Current location'}\nRide: ${newIssue.rideId || newIssue.requestId || 'N/A'}`);
          // Update state to render immediately
          setIssues((prevIssues) => {
            const exists = prevIssues.some(i => (i.issueId && i.issueId === newIssue.issueId) || (i._id && i._id === newIssue._id));
            if (exists) return prevIssues;
            return [newIssue, ...prevIssues];
          });
        });

        socket.on('new-issue-report', (newIssue) => {
          setIssues((prevIssues) => {
            const exists = prevIssues.some(i => (i.issueId && i.issueId === newIssue.issueId) || (i._id && i._id === newIssue._id));
            if (exists) return prevIssues;
            return [newIssue, ...prevIssues];
          });
        });

        socket.on('issue_updated', (updated) => {
          if (!updated) return;
          setIssues(prev => prev.map(item => 
            (item._id === updated._id || item.issueId === updated.issueId) ? { ...item, ...updated } : item
          ));
        });

        sockets.push(socket);
      } catch (e) {
        console.warn(`Socket connection error for ${url}:`, e);
      }
    });

    return () => {
      sockets.forEach(s => s.disconnect());
    };
  }, []);

  // Open Resolve Modal and pre-populate Customer Notification details
  const openResolveModal = (issue) => {
    setSelectedIssue(issue);
    setResolutionRemarks('');
    setNotifyCustomer(true);

    let dateStr = 'May 21, 2026';
    if (issue.fromDate) {
      try {
        dateStr = new Date(issue.fromDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      } catch (e) {}
    } else {
      dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
    setAffectedDate(dateStr);

    let timeStr = '08:00 AM - 10:00 AM';
    if (issue.fromTime && issue.toTime) {
      timeStr = `${issue.fromTime} - ${issue.toTime}`;
    }
    setAffectedTime(timeStr);

    setReportedReason(issue.reason || 'Vehicle Issue');

    const defaultDetails = issue.description || issue.details || 'Driver is unavailable due to a sudden mechanical issue with the vehicle. We apologize for the inconvenience and are working to find a replacement driver immediately. The issue is severe enough to prevent the ride.';
    setDetailsText(defaultDetails);
    setCanRequestReplacement(true);
    setIsResolveModalOpen(true);
  };

  // Handle Mark Resolved with Customer Notification
  const handleResolveSubmit = async () => {
    if (!selectedIssue) return;
    setSubmitting(true);
    const token = localStorage.getItem('adminToken') || localStorage.getItem('admin_token') || '';
    const targetId = selectedIssue._id || selectedIssue.issueId;

    const payload = {
      status: 'Resolved',
      remarks: resolutionRemarks || 'Resolved by Dispatcher',
      notifyCustomer,
      affectedDate,
      affectedTime,
      reportedReason,
      reason: reportedReason,
      additionalDetails: detailsText,
      details: detailsText,
      canRequestReplacement,
      rideId: selectedIssue.rideId || selectedIssue.requestId || 'REQ-8031',
      requestId: selectedIssue.requestId || selectedIssue.rideId || 'REQ-8031'
    };

    const urls = [
      `http://localhost:5000/admin/issues/${targetId}/resolve`,
      `http://localhost:3000/admin/issues/${targetId}/resolve`,
      `http://localhost:5000/api/issues/${targetId}/resolve`
    ];

    let resolved = false;
    for (const url of urls) {
      try {
        const res = await fetch(url, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        if (res.ok) {
          resolved = true;
          break;
        }
      } catch (e) {}
    }

    // Update local state
    setIssues(prev => prev.map(iss => 
      (iss._id === targetId || iss.issueId === targetId)
        ? { 
            ...iss, 
            status: 'Resolved', 
            remarks: resolutionRemarks || 'Resolved by Dispatcher',
            customerNotified: notifyCustomer
          }
        : iss
    ));

    setSubmitting(false);
    setIsResolveModalOpen(false);
    setSelectedIssue(null);
    setResolutionRemarks('');
  };

  // Handle Assign Replacement Driver
  const handleAssignReplacement = async () => {
    if (!selectedIssue || !selectedReplacementDriver) {
      alert('Please select a replacement driver.');
      return;
    }

    setSubmitting(true);
    const token = localStorage.getItem('adminToken') || localStorage.getItem('admin_token') || '';
    const targetId = selectedIssue._id || selectedIssue.issueId;

    // 1. Update issue with replacement driver details
    const patchUrls = [
      `http://localhost:5000/admin/issues/${targetId}/resolve`,
      `http://localhost:3000/admin/issues/${targetId}/resolve`
    ];

    for (const url of patchUrls) {
      try {
        await fetch(url, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            status: 'Resolved',
            remarks: `Replacement driver assigned: ${selectedReplacementDriver.name} (${selectedReplacementDriver.phone})`,
            replacementDriverId: selectedReplacementDriver.id,
            replacementDriverName: selectedReplacementDriver.name
          })
        });
        break;
      } catch (e) {}
    }

    // 2. Dispatch ride if rideId exists
    const rideId = selectedIssue.rideId || selectedIssue.requestId;
    if (rideId) {
      const dispatchUrls = [
        `http://localhost:5000/api/rides/${rideId}/dispatch`,
        `http://localhost:3000/api/rides/${rideId}/dispatch`,
        'http://localhost:5000/api/ride/assign'
      ];

      for (const dUrl of dispatchUrls) {
        try {
          await fetch(dUrl, {
            method: 'PATCH',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              driverId: selectedReplacementDriver.id,
              driverName: selectedReplacementDriver.name,
              status: 'ASSIGNED',
              replacementNotes: `Replaced driver ${selectedIssue.driverName} due to ${selectedIssue.reason}`
            })
          });
          break;
        } catch (e) {}
      }
    }

    // Update local state
    setIssues(prev => prev.map(iss => 
      (iss._id === targetId || iss.issueId === targetId)
        ? { 
            ...iss, 
            status: 'Resolved', 
            remarks: `Replacement driver assigned: ${selectedReplacementDriver.name}`,
            replacementDriverName: selectedReplacementDriver.name 
          }
        : iss
    ));

    alert(`Replacement driver ${selectedReplacementDriver.name} has been assigned! Ride dispatched.`);
    setSubmitting(false);
    setIsReplacementModalOpen(false);
    setSelectedIssue(null);
    setSelectedReplacementDriver(null);
  };

  // Filtered Issues calculation
  const filteredIssues = useMemo(() => {
    return issues.filter(issue => {
      // Status filter
      if (statusFilter !== 'ALL' && (issue.status || 'Pending').toLowerCase() !== statusFilter.toLowerCase()) {
        return false;
      }

      // Severity filter
      if (severityFilter !== 'ALL' && (issue.severity || 'Medium').toLowerCase() !== severityFilter.toLowerCase()) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchName = String(issue.driverName || '').toLowerCase().includes(query);
        const matchReason = String(issue.reason || '').toLowerCase().includes(query);
        const matchIssueId = String(issue.issueId || '').toLowerCase().includes(query);
        const matchRideId = String(issue.rideId || issue.requestId || '').toLowerCase().includes(query);
        const matchPhone = String(issue.driverPhone || '').toLowerCase().includes(query);
        const matchVehicle = String(issue.vehicle || '').toLowerCase().includes(query);
        const matchLoc = String(issue.location || '').toLowerCase().includes(query);

        if (!matchName && !matchReason && !matchIssueId && !matchRideId && !matchPhone && !matchVehicle && !matchLoc) {
          return false;
        }
      }

      return true;
    });
  }, [issues, statusFilter, severityFilter, searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    const total = issues.length;
    const pending = issues.filter(i => (i.status || 'Pending') === 'Pending').length;
    const resolved = issues.filter(i => (i.status || '') === 'Resolved').length;
    const highSeverity = issues.filter(i => (i.severity || '') === 'High' && (i.status || 'Pending') === 'Pending').length;

    return { total, pending, resolved, highSeverity };
  }, [issues]);

  const formatTimeAgo = (dateStr) => {
    if (!dateStr) return 'Recently';
    const d = new Date(dateStr);
    const now = new Date();
    const diffMin = Math.floor((now - d) / (1000 * 60));
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHrs = Math.floor(diffMin / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    return d.toLocaleDateString();
  };

  return (
    <div className="driver-issues-container fade-in">
      {/* Page Header */}
      <div className="issues-header-card">
        <div className="header-left">
          <div className="icon-badge-pulse">
            <AlertTriangle size={24} className="pulse-icon text-warning" />
          </div>
          <div>
            <div className="header-title-row">
              <h1 className="issues-title">Driver Reported Issues</h1>
              <span className="live-pill">
                <span className="live-dot"></span> LIVE LISTENER ACTIVE
              </span>
            </div>
            <p className="issues-subtitle">
              Real-time driver road emergencies, mechanical breakdowns, and replacement dispatch requests
            </p>
          </div>
        </div>

        <div className="header-actions-group">
          <button 
            className="btn-refresh" 
            onClick={fetchReportedIssues} 
            disabled={loading}
            title="Refresh issues"
          >
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
            <span>Refresh</span>
          </button>
          <button 
            className="btn-dispatch-nav"
            onClick={() => navigate('/driver-selection')}
          >
            <Car size={16} />
            <span>Open Ride Dispatch</span>
          </button>
        </div>
      </div>

      {/* Stats Counter Bar */}
      <div className="stats-row">
        <div 
          className={`stat-card stat-total ${statusFilter === 'ALL' && severityFilter === 'ALL' ? 'active-kpi' : ''}`}
          onClick={() => {
            setStatusFilter('ALL');
            setSeverityFilter('ALL');
          }}
          title="Click to view Total Reports"
        >
          <div className="stat-content">
            <span className="stat-label">Total Reports</span>
            <h3 className="stat-value">{stats.total}</h3>
          </div>
          <div className="stat-icon-wrapper">
            <AlertCircle size={24} />
          </div>
        </div>

        <div 
          className={`stat-card stat-pending ${statusFilter === 'Pending' && severityFilter === 'ALL' ? 'active-kpi' : ''}`}
          onClick={() => {
            setStatusFilter('Pending');
            setSeverityFilter('ALL');
          }}
          title="Click to view Pending Action issues"
        >
          <div className="stat-content">
            <span className="stat-label">Pending Action</span>
            <h3 className="stat-value text-amber">{stats.pending}</h3>
          </div>
          <div className="stat-icon-wrapper amber">
            <Clock size={24} />
          </div>
        </div>

        <div 
          className={`stat-card stat-urgent ${severityFilter === 'High' ? 'active-kpi' : ''}`}
          onClick={() => {
            setSeverityFilter('High');
            setStatusFilter('ALL');
          }}
          title="Click to view Urgent / High Priority issues"
        >
          <div className="stat-content">
            <span className="stat-label">Urgent / High Priority</span>
            <h3 className="stat-value text-rose">{stats.highSeverity}</h3>
          </div>
          <div className="stat-icon-wrapper rose">
            <ShieldAlert size={24} />
          </div>
        </div>

        <div 
          className={`stat-card stat-resolved ${statusFilter === 'Resolved' ? 'active-kpi' : ''}`}
          onClick={() => {
            setStatusFilter('Resolved');
            setSeverityFilter('ALL');
          }}
          title="Click to view Resolved issues"
        >
          <div className="stat-content">
            <span className="stat-label">Resolved</span>
            <h3 className="stat-value text-emerald">{stats.resolved}</h3>
          </div>
          <div className="stat-icon-wrapper emerald">
            <CheckCircle size={24} />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="controls-bar glass-panel">
        <div className="search-input-wrapper">
          <Search size={18} className="search-icon" />
          <input 
            type="text" 
            placeholder="Search by Driver Name, Issue ID (ISS-1001), Ride ID, Reason, Location..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-field"
          />
          {searchQuery && (
            <button className="clear-search" onClick={() => setSearchQuery('')}>
              <X size={16} />
            </button>
          )}
        </div>

        <div className="filter-group">
          <div className="filter-pill-selector">
            <button 
              className={`pill-btn ${statusFilter === 'ALL' ? 'active' : ''}`}
              onClick={() => setStatusFilter('ALL')}
            >
              All Status
            </button>
            <button 
              className={`pill-btn ${statusFilter === 'Pending' ? 'active' : ''}`}
              onClick={() => setStatusFilter('Pending')}
            >
              Pending ({stats.pending})
            </button>
            <button 
              className={`pill-btn ${statusFilter === 'Resolved' ? 'active' : ''}`}
              onClick={() => setStatusFilter('Resolved')}
            >
              Resolved ({stats.resolved})
            </button>
          </div>

          <div className="severity-selector">
            <Filter size={15} />
            <select 
              value={severityFilter} 
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="select-severity"
            >
              <option value="ALL">All Severities</option>
              <option value="High">High Severity</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>
        </div>
      </div>

      {/* Issues List Table / Cards */}
      <div className="issues-table-container glass-panel">
        {loading && issues.length === 0 ? (
          <div className="empty-state">
            <RefreshCw size={36} className="spin text-secondary mb-3" />
            <p>Fetching driver reported issues from backend...</p>
          </div>
        ) : filteredIssues.length === 0 ? (
          <div className="empty-state">
            <ShieldCheck size={48} className="text-muted mb-3" />
            <h3>No Driver Issues Found</h3>
            <p className="text-secondary">
              {searchQuery || statusFilter !== 'ALL' || severityFilter !== 'ALL' 
                ? 'Try adjusting your filters or search keywords.' 
                : 'All drivers are on route smoothly with no reported road issues.'}
            </p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="issues-table">
              <thead>
                <tr>
                  <th>ISSUE ID</th>
                  <th>DRIVER & VEHICLE</th>
                  <th>REASON & DESCRIPTION</th>
                  <th>LOCATION</th>
                  <th>RIDE / REQ ID</th>
                  <th>SEVERITY</th>
                  <th>STATUS</th>
                  <th>TIME</th>
                  <th className="text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filteredIssues.map((issue) => {
                  const isPending = (issue.status || 'Pending') === 'Pending';
                  const sevLower = (issue.severity || 'medium').toLowerCase();

                  return (
                    <tr key={issue._id || issue.issueId} className={`issue-row ${isPending ? 'row-pending' : 'row-resolved'}`}>
                      <td>
                        <span className="issue-id-tag">
                          {issue.issueId || `ISS-${String(issue._id || '').slice(-4).toUpperCase()}`}
                        </span>
                      </td>
                      
                      <td>
                        <div className="driver-info-cell">
                          <div className="driver-avatar-circle">
                            {(issue.driverName || 'D').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="driver-name-text font-bold">
                              {issue.driverName || 'Unknown Driver'}
                              {issue.driverCode && <span className="code-pill ml-1">({issue.driverCode})</span>}
                            </div>
                            <div className="driver-sub-info">
                              <a 
                                href={`tel:${issue.driverPhone}`} 
                                className="driver-phone-link" 
                                title="Call Driver"
                              >
                                <Phone size={12} className="mr-1" />
                                {issue.driverPhone || 'No Phone'}
                              </a>
                            </div>
                            <div className="vehicle-text">
                              <Car size={12} className="mr-1" />
                              {issue.vehicle || 'Sedan Executive'}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="reason-cell">
                        <div className="reason-badge">
                          <Wrench size={13} className="mr-1" />
                          <span>{issue.reason || 'Road Issue'}</span>
                        </div>
                        {(issue.details || issue.description) && (
                          <div className="issue-desc-text" title={issue.details || issue.description}>
                            "{issue.details || issue.description}"
                          </div>
                        )}
                        {issue.remarks && (
                          <div className="issue-remarks-text">
                            <span className="text-success font-medium">Remarks:</span> {issue.remarks}
                          </div>
                        )}
                      </td>

                      <td>
                        <div className="location-cell">
                          {issue.fromTime && issue.toTime ? (
                            <div className="timing-chip" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: 'rgba(59, 130, 246, 0.15)', color: '#93c5fd', padding: '4px 8px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600 }}>
                              <Clock size={13} className="text-primary" />
                              <span>{issue.fromTime} - {issue.toTime}</span>
                            </div>
                          ) : (
                            <>
                              <MapPin size={14} className="pin-icon" />
                              <span className="loc-text" title={issue.location}>
                                {issue.location || 'Current location'}
                              </span>
                              <a 
                                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(issue.location || 'Islamabad')}`}
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="maps-link"
                                title="Open in Google Maps"
                              >
                                <ExternalLink size={12} />
                              </a>
                            </>
                          )}
                        </div>
                      </td>

                      <td>
                        {issue.rideId || issue.requestId ? (
                          <span className="ride-id-badge">
                            {issue.rideId || issue.requestId}
                          </span>
                        ) : issue.fromDate ? (
                          <span className="text-secondary text-xs" style={{ whiteSpace: 'nowrap' }}>
                            📅 {new Date(issue.fromDate).toLocaleDateString()}
                          </span>
                        ) : (
                          <span className="text-muted text-sm">—</span>
                        )}
                      </td>

                      <td>
                        <span className={`severity-badge sev-${sevLower}`}>
                          {issue.severity || 'Medium'}
                        </span>
                      </td>

                      <td>
                        <span className={`status-badge status-${(issue.status || 'Pending').toLowerCase()}`}>
                          {issue.status === 'Resolved' ? (
                            <><Check size={12} className="mr-1" /> Resolved</>
                          ) : (
                            <><Clock size={12} className="mr-1" /> Pending</>
                          )}
                        </span>
                      </td>

                      <td>
                        <span className="time-text" title={new Date(issue.createdAt || Date.now()).toLocaleString()}>
                          {formatTimeAgo(issue.createdAt)}
                        </span>
                      </td>

                      <td className="text-right">
                        <div className="actions-cell">
                          {isPending ? (
                            <>
                              <button 
                                className="action-btn-replace"
                                onClick={() => {
                                  setSelectedIssue(issue);
                                  setSelectedReplacementDriver(null);
                                  setIsReplacementModalOpen(true);
                                }}
                                title="Assign replacement driver and re-dispatch"
                              >
                                <Car size={13} />
                                <span>Assign Replacement</span>
                              </button>

                              <button 
                                className="action-btn-resolve"
                                onClick={() => openResolveModal(issue)}
                                title="Mark as resolved and notify customer"
                              >
                                <Check size={13} />
                                <span>Resolve</span>
                              </button>
                            </>
                          ) : (
                            <span className="resolved-check-indicator">
                              <CheckCircle size={16} className="text-success" />
                              <span className="text-success text-sm ml-1">Handled</span>
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL 1: Assign Replacement Driver */}
      {isReplacementModalOpen && selectedIssue && (
        <div className="modal-overlay fade-in">
          <div className="glass-panel modal-card modal-lg">
            <div className="modal-header">
              <div className="modal-title-row">
                <Car size={22} className="text-primary mr-2" />
                <div>
                  <h3 className="m-0">Assign Replacement Driver</h3>
                  <span className="text-sm text-secondary">
                    Incident: {selectedIssue.issueId} • Current Driver: {selectedIssue.driverName} ({selectedIssue.reason})
                  </span>
                </div>
              </div>
              <button className="icon-close-btn" onClick={() => setIsReplacementModalOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              <div className="incident-summary-box mb-4">
                <div className="summary-item">
                  <span className="label">Affected Driver:</span>
                  <span className="val font-bold">{selectedIssue.driverName} ({selectedIssue.driverPhone})</span>
                </div>
                <div className="summary-item">
                  <span className="label">Issue:</span>
                  <span className="val text-danger font-semibold">{selectedIssue.reason}</span>
                </div>
                <div className="summary-item">
                  <span className="label">Location:</span>
                  <span className="val">{selectedIssue.location}</span>
                </div>
                {selectedIssue.rideId && (
                  <div className="summary-item">
                    <span className="label">Ride / Request ID:</span>
                    <span className="val font-mono">{selectedIssue.rideId}</span>
                  </div>
                )}
              </div>

              <h4 className="section-subheading mb-3">Select Standby / Available Driver:</h4>
              <div className="replacement-drivers-list">
                {availableDrivers.length === 0 ? (
                  <div className="p-3 text-center text-muted">
                    Loading verified drivers from database...
                  </div>
                ) : (
                  availableDrivers.map(driver => (
                    <div 
                      key={driver.id} 
                      className={`driver-select-card ${selectedReplacementDriver?.id === driver.id ? 'selected' : ''}`}
                      onClick={() => setSelectedReplacementDriver(driver)}
                    >
                      <div className="d-flex items-center">
                        <div className="driver-radio">
                          {selectedReplacementDriver?.id === driver.id && <div className="radio-inner" />}
                        </div>
                        <div className="ml-3">
                          <div className="driver-name font-bold">{driver.name}</div>
                          <div className="text-xs text-secondary">{driver.phone} • {driver.vehicle}</div>
                        </div>
                      </div>
                      <span className="avail-badge">Ready for Dispatch</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button 
                className="btn-secondary" 
                onClick={() => setIsReplacementModalOpen(false)}
                disabled={submitting}
              >
                Cancel
              </button>
              <button 
                className="btn-primary btn-assign-confirm"
                onClick={handleAssignReplacement}
                disabled={!selectedReplacementDriver || submitting}
              >
                {submitting ? (
                  <><RefreshCw size={16} className="spin mr-2" /> Assigning...</>
                ) : (
                  <><Send size={16} className="mr-2" /> Dispatch Replacement</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Mark Issue Resolved & Notify Customer */}
      {isResolveModalOpen && selectedIssue && (
        <div className="modal-overlay fade-in">
          <div className="glass-panel modal-card modal-xl">
            <div className="modal-header">
              <div className="modal-title-row">
                <CheckCircle size={22} className="text-success mr-2" />
                <div>
                  <h3 className="m-0">Resolve Driver Issue</h3>
                  <span className="text-sm text-secondary">
                    Incident: {selectedIssue.issueId} • Driver: {selectedIssue.driverName} ({selectedIssue.reason})
                  </span>
                </div>
              </div>
              <button className="icon-close-btn" onClick={() => setIsResolveModalOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              <div className="resolve-modal-layout">
                {/* Left Column: Admin Controls */}
                <div className="resolve-form-col">
                  <div className="incident-summary-box mb-3">
                    <div className="summary-item">
                      <span className="label">Driver:</span>
                      <span className="val font-bold">{selectedIssue.driverName} ({selectedIssue.driverPhone || 'N/A'})</span>
                    </div>
                    <div className="summary-item">
                      <span className="label">Issue Reported:</span>
                      <span className="val text-danger font-semibold">{selectedIssue.reason}</span>
                    </div>
                    {selectedIssue.rideId && (
                      <div className="summary-item">
                        <span className="label">Ride ID:</span>
                        <span className="val font-mono">{selectedIssue.rideId}</span>
                      </div>
                    )}
                  </div>

                  <div className="form-group mb-3">
                    <label className="form-label">Internal Resolution Remarks / Notes:</label>
                    <textarea 
                      rows={2}
                      className="form-textarea"
                      placeholder="e.g. Mechanic dispatched, replacement driver arranged, ride updated..."
                      value={resolutionRemarks}
                      onChange={(e) => setResolutionRemarks(e.target.value)}
                    />
                  </div>

                  {/* Customer Notification Configuration Box */}
                  <div className="customer-notif-box">
                    <label className="notif-checkbox-label">
                      <input 
                        type="checkbox" 
                        checked={notifyCustomer} 
                        onChange={(e) => setNotifyCustomer(e.target.checked)} 
                        style={{ width: '16px', height: '16px', accentColor: '#2563eb' }}
                      />
                      <span>🔔 Send "Driver Unavailable" Notification to Customer App</span>
                    </label>

                    {notifyCustomer && (
                      <div className="notif-fields fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div className="form-row-2">
                          <div>
                            <label className="text-xs font-semibold text-secondary">Affected Date:</label>
                            <input 
                              type="text" 
                              className="form-input"
                              value={affectedDate}
                              onChange={(e) => setAffectedDate(e.target.value)}
                              placeholder="e.g. May 21, 2026"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-secondary">Affected Time Slot:</label>
                            <input 
                              type="text" 
                              className="form-input"
                              value={affectedTime}
                              onChange={(e) => setAffectedTime(e.target.value)}
                              placeholder="e.g. 08:00 AM - 10:00 AM"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="text-xs font-semibold text-secondary">Reported Reason:</label>
                          <input 
                            type="text" 
                            className="form-input"
                            value={reportedReason}
                            onChange={(e) => setReportedReason(e.target.value)}
                            placeholder="e.g. Vehicle Issue"
                          />
                        </div>

                        <div>
                          <label className="text-xs font-semibold text-secondary">Additional Details from Driver (Visible to Customer):</label>
                          <textarea 
                            rows={3}
                            className="form-textarea"
                            value={detailsText}
                            onChange={(e) => setDetailsText(e.target.value)}
                            placeholder="Explanation of vehicle issue or driver unavailability..."
                          />
                        </div>

                        <label className="text-xs font-medium text-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                          <input 
                            type="checkbox" 
                            checked={canRequestReplacement} 
                            onChange={(e) => setCanRequestReplacement(e.target.checked)}
                            style={{ accentColor: '#2563eb' }}
                          />
                          <span>Allow customer to tap <strong>"Request Replacement"</strong> button</span>
                        </label>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Column: Customer Mobile Screen Preview */}
                <div className="phone-mockup-wrapper">
                  <div className="phone-mockup-frame">
                    <div className="phone-notch">
                      <div className="notch-camera"></div>
                    </div>

                    <div className="phone-screen">
                      {/* Top Header */}
                      <div className="phone-top-bar">
                        <span className="phone-back-arrow">←</span>
                        <div>
                          <div className="phone-top-title">Driver Unavailable</div>
                          <div className="phone-top-sub">Your assigned driver is unavailable for this ride.</div>
                        </div>
                      </div>

                      {/* Screen Content */}
                      <div className="phone-content">
                        {/* Red Warning Banner */}
                        <div className="phone-danger-banner">
                          <div className="phone-danger-icon-circle">!</div>
                          <h4 className="phone-danger-title">Driver Unavailable</h4>
                        </div>

                        {/* Affected Date & Time */}
                        <div>
                          <div className="phone-section-label">Affected Date & Time</div>
                          <div className="phone-detail-card">
                            <span style={{ fontSize: '16px' }}>📅</span>
                            <div>
                              <div className="phone-detail-card-text-primary">{affectedDate || 'May 21, 2026'}</div>
                              <div className="phone-detail-card-text-sub">{affectedTime || '08:00 AM - 10:00 AM'}</div>
                            </div>
                          </div>
                        </div>

                        {/* Reported Reason */}
                        <div className="phone-detail-card">
                          <span style={{ fontSize: '16px' }}>📄</span>
                          <div className="phone-detail-card-text-primary">
                            Reported Reason: {reportedReason || 'Vehicle Issue'}
                          </div>
                        </div>

                        {/* Additional Details from Driver */}
                        <div>
                          <div className="phone-section-label">Additional Details from Driver:</div>
                          <div className="phone-notes-box">
                            {detailsText || 'Driver is unavailable due to a sudden mechanical issue with the vehicle. We apologize for the inconvenience and are working to find a replacement driver immediately. The issue is severe enough to prevent the ride.'}
                          </div>
                        </div>

                        {/* Info Callout */}
                        {canRequestReplacement && (
                          <div className="phone-info-callout">
                            <span>ℹ️</span>
                            <span>You can request a replacement driver for this ride.</span>
                          </div>
                        )}

                        {/* Action Button */}
                        {canRequestReplacement && (
                          <button className="phone-action-btn" type="button" onClick={() => alert('Customer tap simulated: Requesting replacement driver...')}>
                            Request Replacement
                          </button>
                        )}
                      </div>

                      <div className="phone-chin">
                        <div className="phone-home-indicator"></div>
                      </div>
                    </div>
                  </div>
                  <div className="phone-caption">Customer View - Ride Status Update</div>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button 
                className="btn-secondary" 
                onClick={() => setIsResolveModalOpen(false)}
                disabled={submitting}
              >
                Cancel
              </button>
              <button 
                className="btn-success"
                onClick={handleResolveSubmit}
                disabled={submitting}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                {submitting ? (
                  <><RefreshCw size={14} className="spin" /> Updating...</>
                ) : (
                  <><CheckCircle size={15} /> Confirm Resolution {notifyCustomer ? '& Notify Customer' : ''}</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DriverIssues;
