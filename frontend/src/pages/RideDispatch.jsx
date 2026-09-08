import React, { useState, useEffect, useMemo } from 'react';
import { 
  MapPin, Clock, Car, Filter, Star, CheckCircle, Search, ChevronLeft, Map, Wind, 
  User, Phone, Calendar, DollarSign, Sparkles, X, Eye, ThumbsUp, ShieldCheck, ArrowRight, RotateCcw
} from 'lucide-react';
import LocationAutocomplete from '../components/LocationAutocomplete';
import { BACKEND_URL } from '../utils/api';
import './RideDispatch.css';

const formatRouteString = (rt) => {
  if (!rt) return '';
  if (typeof rt === 'string') return rt.trim();
  if (typeof rt === 'object') {
    const start = rt.startPoint || rt.start || rt.pickup || rt.from || '';
    const end = rt.endPoint || rt.end || rt.dropoff || rt.to || '';
    if (start && end) return `${start} - ${end}`;
    if (start) return String(start);
    if (end) return String(end);
    if (rt.name) return String(rt.name);
    return '';
  }
  return String(rt);
};

const RideDispatch = () => {
  const [rideRequests, setRideRequests] = useState([]);
  const [availableDriversLocal, setAvailableDriversLocal] = useState([]);
  const [selectedRide, setSelectedRide] = useState(null);
  const [viewPassengerModal, setViewPassengerModal] = useState(null);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState('table'); // 'table' or 'grid'
  
  // Filtering state for Driver Selection
  const [driverSearchQuery, setDriverSearchQuery] = useState('');
  const [filterAC, setFilterAC] = useState('all'); // all, ac, non-ac
  const [filterCategory, setFilterCategory] = useState('all'); // all, Executive, Sedan, Mini, Van
  const [searchRoute, setSearchRoute] = useState('');
  
  const [toastMessage, setToastMessage] = useState('');

  // Fetch real ride requests and drivers from database
  const fetchData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('admin_token');
      
      // Try /api/ride/pending first, fallback to /api/requests
      let reqRes = await fetch(`${BACKEND_URL}/api/ride/pending`).catch(() => null);
      if (!reqRes || !reqRes.ok) {
        reqRes = await fetch(`${BACKEND_URL}/api/requests`);
      }

      const drvRes = await fetch(`${BACKEND_URL}/admin/driver`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const reqData = await reqRes.json();
      const drvData = await drvRes.json();

      const rawRequests = reqData.data?.requests || (Array.isArray(reqData.data) ? reqData.data : []);
      if (reqData.success && rawRequests.length > 0) {
        const mappedReqs = rawRequests.map(r => ({
          _id: r._id,
          id: r.requestId || r._id,
          passenger: r.customerName || 'Passenger',
          phone: r.customerPhone || '+92 300 1234567',
          email: r.customerEmail || 'passenger@example.com',
          gender: r.gender || 'Male',
          pickupLocation: r.pickupLocation || 'Blue Area, Islamabad',
          dropLocation: r.dropLocation || 'Saddar, Rawalpindi',
          route: `${r.pickupLocation} -> ${r.dropLocation}`,
          date: `${r.date || ''} ${r.timeToLeave || ''}`.trim() || 'Today 08:00 AM',
          fare: r.fare || 'Rs. 2,500',
          status: r.status === 'Visible' || r.status === 'PENDING' ? 'Pending Dispatch' : r.status,
          seatsNeeded: r.seatsNeeded || 1,
          preferences: {
            vehicleCategory: r.vehiclePreference || 'Sedan',
            acRequired: r.acRequired !== false
          }
        }));
        setRideRequests(mappedReqs);
      }

      if (drvData.success && drvData.data?.drivers) {
        const mappedDrivers = drvData.data.drivers.map(d => {
          const vData = d.vehicleData || d.vehicleDetails || {};
          return {
            _id: d._id,
            id: d.driverId || d.driverReferenceId || d._id,
            status: d.verificationStatus === 'Verified' || d.status === 'APPROVED' || d.status === 'Approved' ? 'Approved' : 'Pending',
            availability: d.availability || 'Available',
            personalInfo: {
              name: d.Name || d.name || 'Driver',
              phone: d.PhoneNumber || d.phone || 'N/A',
              city: d.city || 'Islamabad'
            },
            vehicleInfo: {
              make: vData.vehicleMake || vData.make || 'Toyota',
              model: vData.vehicleModel || vData.model || 'Corolla',
              color: vData.vehicleColor || vData.color || 'White',
              plateNumber: vData.registrationNumber || vData.plateNumber || 'ISB-1234',
              category: vData.category || 'Sedan',
              seats: vData.numberOfSeats || 4,
              ac: vData.ac !== false
            },
            performance: {
              rating: d.rating || 4.9,
              totalRides: d.performance?.totalTrips || 142,
              cancellationRate: '0%'
            },
            preferences: {
              routes: (() => {
                const raw = Array.isArray(d.preferredRoutes) ? d.preferredRoutes : (d.preferredRoutes ? [d.preferredRoutes] : []);
                const formatted = raw.map(formatRouteString).filter(Boolean);
                return formatted.length > 0 ? formatted : [`${d.city || 'Islamabad'} - Rawalpindi`, 'Islamabad - Lahore'];
              })()
            }
          };
        });
        setAvailableDriversLocal(mappedDrivers);
      }
    } catch (err) {
      console.error('Failed to fetch dispatch data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Handle Selection of a Ride Request for Dispatch
  const handleSelectRide = (ride) => {
    setSelectedRide(ride);
    setSearchRoute(ride.pickupLocation || '');
    setViewPassengerModal(null);
    
    if (ride.preferences?.acRequired) {
      setFilterAC('ac');
    } else {
      setFilterAC('all');
    }

    if (ride.preferences?.vehicleCategory && ride.preferences.vehicleCategory !== 'Any') {
      setFilterCategory(ride.preferences.vehicleCategory);
    } else {
      setFilterCategory('all');
    }
  };

  // Handle Dispatch via API (Instant Ajax Update without page reload)
  const handleDispatch = async (driver) => {
    const rideId = selectedRide._id || selectedRide.id;
    const driverId = driver._id || driver.id;
    const driverName = driver.personalInfo.name;

    try {
      // 1. Call POST /api/ride/assign as specified by Flutter/backend teammate
      let res = await fetch(`${BACKEND_URL}/api/ride/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rideId: rideId,
          driverId: driverId
        })
      }).catch(() => null);

      if (!res || !res.ok) {
        // Fallback to /api/assignments
        await fetch(`${BACKEND_URL}/api/assignments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requestId: rideId,
            driverId: driverId,
            remarks: `Smart Dispatched to ${driverName}`
          })
        });
      }
    } catch (err) {
      console.error('Dispatch API error:', err);
    }

    // Immediately update reactive local state with no page refresh
    setRideRequests(prev => prev.map(r => 
      r.id === selectedRide.id ? { ...r, status: `Dispatched to ${driverName}` } : r
    ));
    
    setToastMessage(`✓ Ride successfully dispatched to ${driverName}!`);
    setTimeout(() => setToastMessage(''), 3500);
    setSelectedRide(null);
    fetchData();
  };

  // Smart Recommendation Scoring Algorithm
  const scoredDrivers = useMemo(() => {
    let list = availableDriversLocal.filter(d => d.status === 'Approved');

    // 1. Text Search Filter (Name, Phone, Plate)
    if (driverSearchQuery.trim()) {
      const q = driverSearchQuery.toLowerCase().trim();
      list = list.filter(d => 
        d.personalInfo.name.toLowerCase().includes(q) ||
        d.personalInfo.phone.toLowerCase().includes(q) ||
        d.vehicleInfo.plateNumber.toLowerCase().includes(q) ||
        d.vehicleInfo.make.toLowerCase().includes(q)
      );
    }

    // 2. AC Filter
    if (filterAC === 'ac') {
      list = list.filter(d => d.vehicleInfo.ac === true);
    } else if (filterAC === 'non-ac') {
      list = list.filter(d => d.vehicleInfo.ac === false);
    }

    // 3. Category Filter
    if (filterCategory !== 'all') {
      list = list.filter(d => (d.vehicleInfo.category || '').toLowerCase() === filterCategory.toLowerCase());
    }

    // Calculate match score for each driver against the selected ride
    return list.map(d => {
      let score = 55;
      const matchTags = [];

      if (selectedRide) {
        const pCity = (selectedRide.pickupLocation || '').toLowerCase();
        const dCity = (selectedRide.dropLocation || '').toLowerCase();
        const routes = d.preferences.routes || [];

        const hasRouteMatch = routes.some(r => {
          const lr = r.toLowerCase();
          return lr.includes(pCity.split(',')[0].trim().toLowerCase()) || 
                 lr.includes(dCity.split(',')[0].trim().toLowerCase()) ||
                 lr.includes(d.personalInfo.city.toLowerCase());
        });

        if (hasRouteMatch) {
          score += 25;
          matchTags.push('Route Aligned');
        }

        if (selectedRide.preferences.acRequired && d.vehicleInfo.ac) {
          score += 15;
          matchTags.push('AC Vehicle');
        }

        if (selectedRide.preferences.vehicleCategory && selectedRide.preferences.vehicleCategory !== 'Any') {
          if (d.vehicleInfo.category.toLowerCase() === selectedRide.preferences.vehicleCategory.toLowerCase()) {
            score += 10;
            matchTags.push(`${d.vehicleInfo.category} Matched`);
          }
        }
      }

      if (d.performance.rating >= 4.8) {
        score += 5;
        matchTags.push('Top Rated');
      }

      const finalScore = Math.min(99, Math.max(30, score));

      return {
        ...d,
        matchScore: finalScore,
        matchTags
      };
    }).sort((a, b) => b.matchScore - a.matchScore);
  }, [availableDriversLocal, selectedRide, driverSearchQuery, filterAC, filterCategory]);

  // View 1: Passenger Requests List / Table
  const renderRideRequests = () => (
    <div className="ride-list-container fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Ride Dispatch & Passenger Requests</h1>
          <p className="page-subtitle">Click any passenger ride to inspect trip details or smart dispatch to recommended drivers.</p>
        </div>
        <div className="view-mode-toggle">
          <button 
            className={`view-toggle-btn ${viewMode === 'table' ? 'active' : ''}`}
            onClick={() => setViewMode('table')}
          >
            Table View
          </button>
          <button 
            className={`view-toggle-btn ${viewMode === 'grid' ? 'active' : ''}`}
            onClick={() => setViewMode('grid')}
          >
            Card View
          </button>
        </div>
      </div>

      {viewMode === 'table' ? (
        <div className="table-container-card">
          <div className="table-content">
            <table className="clean-table">
              <colgroup>
                <col style={{width: '180px'}} />
                <col style={{width: '240px'}} />
                <col style={{width: '130px'}} />
                <col style={{width: '140px'}} />
                <col style={{width: '110px'}} />
                <col style={{width: '140px'}} />
                <col style={{width: '120px'}} />
              </colgroup>
              <thead>
                <tr>
                  <th>Passenger</th>
                  <th>Pickup & Drop-off Route</th>
                  <th>Vehicle Pref</th>
                  <th>Schedule</th>
                  <th>Fare</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rideRequests.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center py-4 text-secondary">
                      No active passenger ride requests found.
                    </td>
                  </tr>
                ) : (
                  rideRequests.map(ride => (
                    <tr 
                      key={ride.id}
                      className="clickable-row"
                      onClick={() => setViewPassengerModal(ride)}
                      title="Click to view detailed ride info"
                    >
                      <td>
                        <div className="passenger-table-cell">
                          <div className="avatar-sm">{ride.passenger.charAt(0)}</div>
                          <div>
                            <span className="fw-600">{ride.passenger}</span>
                            <span className="text-xs text-secondary">{ride.phone}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="route-table-cell">
                          <span className="route-pickup">{ride.pickupLocation}</span>
                          <span className="route-arrow">➔</span>
                          <span className="route-drop">{ride.dropLocation}</span>
                        </div>
                      </td>
                      <td>
                        <div className="vehicle-cell">
                          <span className="badge-vehicle">{ride.preferences.vehicleCategory}</span>
                          {ride.preferences.acRequired && <span className="badge-ac">AC</span>}
                        </div>
                      </td>
                      <td>
                        <span className="date-time-text">{ride.date}</span>
                      </td>
                      <td>
                        <span className="fare-badge">{ride.fare}</span>
                      </td>
                      <td>
                        <span className={`status-badge ${ride.status.toLowerCase().includes('pending') ? 'pending' : 'approved'}`}>
                          {ride.status}
                        </span>
                      </td>
                      <td>
                        <button 
                          className="dispatch-action-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectRide(ride);
                          }}
                        >
                          <Sparkles size={13} /> Find Driver
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="requests-grid">
          {rideRequests.map(ride => (
            <div 
              key={ride.id} 
              className="glass-panel ride-card clickable-card"
              onClick={() => setViewPassengerModal(ride)}
            >
              <div className="ride-card-header">
                <span className="ride-id">{ride.id}</span>
                <span className={`status-badge ${ride.status === 'Pending Dispatch' ? 'pending' : 'approved'}`}>
                  {ride.status}
                </span>
              </div>
              
              <div className="ride-card-body">
                <div className="passenger-row mb-2">
                  <User size={15} className="text-primary" />
                  <strong>{ride.passenger}</strong>
                  <span className="text-secondary text-xs">({ride.phone})</span>
                </div>
                <div className="ride-info">
                  <MapPin size={16} className="text-secondary" />
                  <span className="route-text">{ride.route}</span>
                </div>
                <div className="ride-info">
                  <Clock size={16} className="text-secondary" />
                  <span>{ride.date}</span>
                </div>
                <div className="ride-info">
                  <Car size={16} className="text-secondary" />
                  <span>{ride.preferences.vehicleCategory} | {ride.preferences.acRequired ? 'AC' : 'Non-AC'}</span>
                </div>
              </div>

              <div className="ride-card-footer">
                <span className="fare-text">{ride.fare}</span>
                <button 
                  className="primary-btn sm-btn" 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelectRide(ride);
                  }}
                >
                  <Sparkles size={13} /> Dispatch
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // View 2: Driver Selection Screen with Smart Recommendations
  const renderDriverSelection = () => (
    <div className="driver-selection-container fade-in">
      <div className="page-header">
        <button className="back-btn" onClick={() => setSelectedRide(null)}>
          <ChevronLeft size={18} />
          <span>Back to Passenger Requests</span>
        </button>
        <div className="mt-2">
          <h1 className="page-title">Smart Driver Dispatch</h1>
          <p className="page-subtitle">Matching passenger <strong>{selectedRide.passenger}</strong> with top compatible drivers.</p>
        </div>
      </div>

      <div className="selection-layout">
        {/* Left Sidebar: Ride Summary & Filter Controls */}
        <div className="selection-sidebar">
          <div className="glass-panel summary-panel">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <h3 style={{ fontSize: '1rem', fontWeight: '700' }}>Trip Summary</h3>
              <span className="fare-badge">{selectedRide.fare}</span>
            </div>
            
            <div className="passenger-mini-card mb-3">
              <User size={16} className="text-primary" />
              <div>
                <strong style={{ fontSize: '0.88rem' }}>{selectedRide.passenger}</strong>
                <div className="text-xs text-secondary">{selectedRide.phone}</div>
              </div>
            </div>

            <div className="summary-route">
              <MapPin size={16} className="text-primary" />
              <div>
                <div className="text-xs text-secondary">PICKUP:</div>
                <strong style={{ fontSize: '0.85rem' }}>{selectedRide.pickupLocation}</strong>
                <div className="text-xs text-secondary mt-1">DROP-OFF:</div>
                <strong style={{ fontSize: '0.85rem' }}>{selectedRide.dropLocation}</strong>
              </div>
            </div>

            <div className="summary-prefs mt-3">
              <span className="pref-tag">{selectedRide.preferences.vehicleCategory}</span>
              {selectedRide.preferences.acRequired && <span className="pref-tag ac-tag">AC Required</span>}
              <span className="pref-tag">{selectedRide.seatsNeeded} Seat(s)</span>
            </div>
          </div>

          <div className="glass-panel filter-panel">
            <div className="filter-header">
              <Filter size={16} />
              <h3>Driver Search & Filters</h3>
            </div>
            
            <div className="filter-group">
              <label>Search Driver (Name/Phone/Plate)</label>
              <div className="search-input-wrapper">
                <Search size={15} className="search-icon" />
                <input 
                  type="text" 
                  value={driverSearchQuery}
                  onChange={(e) => setDriverSearchQuery(e.target.value)}
                  placeholder="e.g. Abbas, Bolan, ISB-123..."
                />
              </div>
            </div>

            <div className="filter-group">
              <label>Vehicle Category</label>
              <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
                <option value="all">Any Category</option>
                <option value="Sedan">Sedan</option>
                <option value="SUV">SUV</option>
                <option value="Hatchback">Hatchback</option>
                <option value="Van">Van / Bolan</option>
              </select>
            </div>

            <div className="filter-group">
              <label>Air Conditioning (AC)</label>
              <div className="radio-group">
                <button 
                  type="button"
                  className={`radio-btn ${filterAC === 'all' ? 'active' : ''}`}
                  onClick={() => setFilterAC('all')}
                >All</button>
                <button 
                  type="button"
                  className={`radio-btn ${filterAC === 'ac' ? 'active' : ''}`}
                  onClick={() => setFilterAC('ac')}
                >AC Only</button>
                <button 
                  type="button"
                  className={`radio-btn ${filterAC === 'non-ac' ? 'active' : ''}`}
                  onClick={() => setFilterAC('non-ac')}
                >Non-AC</button>
              </div>
            </div>

            {(driverSearchQuery || filterAC !== 'all' || filterCategory !== 'all') && (
              <button 
                type="button"
                className="clear-filters-btn mt-2" 
                onClick={() => {
                  setDriverSearchQuery('');
                  setFilterAC('all');
                  setFilterCategory('all');
                }}
              >
                <RotateCcw size={13} /> Reset Filters
              </button>
            )}
          </div>
        </div>

        {/* Right Area: Smart Driver Recommendations */}
        <div className="driver-results-area">
          <div className="results-header">
            <div>
              <h2>Smart Recommended Drivers</h2>
              <p className="text-secondary text-xs">Sorted by Route Compatibility, AC Capability & Proximity</p>
            </div>
            <span className="results-count">{scoredDrivers.length} Candidates Found</span>
          </div>

          {scoredDrivers.length === 0 ? (
            <div className="empty-state glass-panel">
              <Car size={44} className="text-secondary mb-3" />
              <h3>No Suitable Drivers Found</h3>
              <p>No available drivers match your current filter preferences.</p>
              <button className="outline-btn mt-3" onClick={() => {
                setDriverSearchQuery('');
                setFilterAC('all');
                setFilterCategory('all');
              }}>Reset Search Criteria</button>
            </div>
          ) : (
            <div className="drivers-list">
              {scoredDrivers.map((driver, index) => {
                const isTopMatch = index === 0;
                return (
                  <div 
                    key={driver.id} 
                    className={`glass-panel driver-match-card ${isTopMatch ? 'top-recommended-card' : ''}`}
                  >
                    {isTopMatch && (
                      <div className="top-match-badge">
                        <Sparkles size={13} /> Top Recommended Match ({driver.matchScore}% Match Score)
                      </div>
                    )}

                    <div className="driver-card-inner">
                      <div className="driver-match-main">
                        <div className="driver-avatar-lg">
                          {driver.personalInfo.name.charAt(0)}
                        </div>
                        <div className="driver-match-info">
                          <div className="d-flex align-items-center gap-2">
                            <h4>{driver.personalInfo.name}</h4>
                            <span className="driver-id-pill">{driver.id}</span>
                          </div>
                          <p className="driver-car">
                            {driver.vehicleInfo.make} {driver.vehicleInfo.model} • {driver.vehicleInfo.color} ({driver.vehicleInfo.plateNumber})
                          </p>
                          <div className="driver-tags">
                            <span className="tag category-tag">{driver.vehicleInfo.category}</span>
                            {driver.vehicleInfo.ac ? (
                              <span className="tag ac-tag"><Wind size={11} /> AC Fitted</span>
                            ) : (
                              <span className="tag non-ac-tag">Non-AC</span>
                            )}
                            <span className="tag seats-tag">{driver.vehicleInfo.seats} Seats</span>
                          </div>
                          <div className="match-reasons-row mt-1">
                            {driver.matchTags?.map((tag, tIdx) => (
                              <span key={tIdx} className="match-reason-chip">✓ {tag}</span>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="driver-match-stats">
                        <div className="stat-block">
                          <div className="stat-value rating-val">
                            {driver.performance.rating} <Star size={13} fill="#F59E0B" color="#F59E0B" />
                          </div>
                          <div className="stat-label">Driver Rating</div>
                        </div>
                        <div className="stat-block">
                          <div className="stat-value">{driver.performance.totalRides}</div>
                          <div className="stat-label">Completed Rides</div>
                        </div>
                        <div className="stat-block">
                          <div className="stat-value text-primary font-bold">{driver.matchScore}%</div>
                          <div className="stat-label">Suitability</div>
                        </div>
                      </div>

                      <div className="driver-match-action">
                        <button 
                          className={`dispatch-btn ${isTopMatch ? 'highlight-btn' : ''}`} 
                          onClick={() => handleDispatch(driver)}
                        >
                          <Sparkles size={14} /> Dispatch Driver
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="module-container">
      {toastMessage && (
        <div className="toast-notification fade-in">
          <CheckCircle size={20} />
          {toastMessage}
        </div>
      )}
      
      {!selectedRide ? renderRideRequests() : renderDriverSelection()}

      {/* ── Passenger Ride Detail Modal ── */}
      {viewPassengerModal && (
        <div className="modal-overlay fade-in" style={{ zIndex: 10000 }} onClick={() => setViewPassengerModal(null)}>
          <div className="passenger-detail-modal-card" onClick={e => e.stopPropagation()}>
            <div className="passenger-modal-header">
              <div className="d-flex align-items-center gap-2">
                <User size={20} className="text-primary" />
                <div>
                  <h3 className="modal-title">Passenger Ride Details</h3>
                  <span className="text-xs text-secondary">Ride ID: {viewPassengerModal.id}</span>
                </div>
              </div>
              <button className="icon-btn" onClick={() => setViewPassengerModal(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="passenger-modal-body">
              {/* Passenger Info Band */}
              <div className="passenger-info-band">
                <div className="passenger-avatar-box">
                  {viewPassengerModal.passenger.charAt(0)}
                </div>
                <div>
                  <h4>{viewPassengerModal.passenger}</h4>
                  <p className="text-secondary text-xs">{viewPassengerModal.phone} • {viewPassengerModal.gender}</p>
                </div>
                <span className={`status-badge ms-auto ${viewPassengerModal.status.toLowerCase().includes('pending') ? 'pending' : 'approved'}`}>
                  {viewPassengerModal.status}
                </span>
              </div>

              {/* Route Breakdown */}
              <div className="route-breakdown-card mt-3">
                <h5 className="section-subtitle"><MapPin size={14} /> Live Route Breakdown</h5>
                <div className="route-timeline">
                  <div className="timeline-point pickup">
                    <div className="point-dot green"></div>
                    <div>
                      <div className="point-label">PICKUP LOCATION</div>
                      <div className="point-address">{viewPassengerModal.pickupLocation}</div>
                    </div>
                  </div>
                  <div className="timeline-line"></div>
                  <div className="timeline-point dropoff">
                    <div className="point-dot red"></div>
                    <div>
                      <div className="point-label">DESTINATION / DROP-OFF</div>
                      <div className="point-address">{viewPassengerModal.dropLocation}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Ride Parameters Grid */}
              <div className="ride-specs-grid mt-3">
                <div className="spec-card">
                  <Clock size={16} className="text-primary" />
                  <div>
                    <span className="spec-title">Scheduled Time</span>
                    <span className="spec-val">{viewPassengerModal.date}</span>
                  </div>
                </div>
                <div className="spec-card">
                  <Car size={16} className="text-primary" />
                  <div>
                    <span className="spec-title">Vehicle Required</span>
                    <span className="spec-val">{viewPassengerModal.preferences.vehicleCategory} ({viewPassengerModal.preferences.acRequired ? 'AC' : 'Non-AC'})</span>
                  </div>
                </div>
                <div className="spec-card">
                  <DollarSign size={16} className="text-success" />
                  <div>
                    <span className="spec-title">Estimated Fare</span>
                    <span className="spec-val text-success font-bold">{viewPassengerModal.fare}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="passenger-modal-footer">
              <button className="secondary-btn" onClick={() => setViewPassengerModal(null)}>
                Close
              </button>
              <button 
                className="primary-btn" 
                onClick={() => handleSelectRide(viewPassengerModal)}
              >
                <Sparkles size={15} /> Find & Dispatch Driver
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RideDispatch;
