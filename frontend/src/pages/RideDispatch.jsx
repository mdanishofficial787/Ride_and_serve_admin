import React, { useState, useEffect, useMemo } from 'react';
import { 
  MapPin, Clock, Car, Filter, Star, CheckCircle, Search, ChevronLeft, Map, Wind, 
  User, Phone, Calendar, DollarSign, Sparkles, X, Eye, ThumbsUp, ShieldCheck, ArrowRight, RotateCcw,
  Smartphone, Navigation, RefreshCw, Send, CheckCircle2, AlertCircle, Radio
} from 'lucide-react';
import LocationAutocomplete from '../components/LocationAutocomplete';
import { BACKEND_URL, RideAPI } from '../utils/api';
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

const formatDriverCode = (id) => {
  if (!id) return 'DRV-1000';
  if (id.length > 14) {
    return `DRV-${id.slice(-6).toUpperCase()}`;
  }
  return id;
};

const getPassengerName = (p) => {
  if (!p) return 'Passenger';
  if (typeof p === 'string') return p;
  if (typeof p === 'object' && p.name) return p.name;
  if (typeof p === 'object' && p.customerName) return p.customerName;
  return 'Passenger';
};

const getPassengerInitial = (p) => {
  const name = getPassengerName(p);
  return (name && name.length > 0) ? name.charAt(0).toUpperCase() : 'P';
};


const RideDispatch = () => {
  const [activeMainTab, setActiveMainTab] = useState('requests'); // 'requests' | 'driver-panel'
  const [rideRequests, setRideRequests] = useState([]);
  const [availableDriversLocal, setAvailableDriversLocal] = useState([]);
  const [assignedRides, setAssignedRides] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [assignedCount, setAssignedCount] = useState(0);
  const [selectedRide, setSelectedRide] = useState(null);
  const [viewPassengerModal, setViewPassengerModal] = useState(null);
  const [viewDriverModal, setViewDriverModal] = useState(null);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState('table'); // 'table' or 'grid'
  
  // Filtering state for Driver Selection
  const [driverSearchQuery, setDriverSearchQuery] = useState('');
  const [filterAC, setFilterAC] = useState('all'); // all, ac, non-ac
  const [filterCategory, setFilterCategory] = useState('all'); // all, Executive, Sedan, Mini, Van
  const [searchRoute, setSearchRoute] = useState('');
  
  // Driver Panel tab search & filter
  const [driverPanelSearch, setDriverPanelSearch] = useState('');
  const [driverPanelFilter, setDriverPanelFilter] = useState('all'); // 'all', 'assigned', 'available'

  const [toastMessage, setToastMessage] = useState('');
  const [toastActionDriver, setToastActionDriver] = useState(null);

  // Fetch real ride requests (pending & assigned) and drivers from live backend
  const fetchData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('admin_token');
      
      // 1. Make GET /api/rides (or fallback to /api/requests)
      let ridesRes = await RideAPI.getAllRides().catch(() => null);

      let rawList = ridesRes?.rides || ridesRes?.data?.rides || ridesRes?.data?.requests || (Array.isArray(ridesRes?.data) ? ridesRes.data : (Array.isArray(ridesRes) ? ridesRes : []));

      if (!rawList || rawList.length === 0) {
        const fbRes = await fetch(`${BACKEND_URL}/api/requests`).catch(() => null);
        if (fbRes && fbRes.ok) {
          const fbData = await fbRes.json();
          rawList = fbData?.data?.requests || fbData?.data || [];
        }
      }

      // 2. Fetch Drivers
      const drvRes = await fetch(`${BACKEND_URL}/admin/driver`, {
        headers: { Authorization: `Bearer ${token}` }
      }).catch(() => null);

      const drvData = drvRes && drvRes.ok ? await drvRes.json() : { success: false };
      
      if (rawList && rawList.length > 0) {
        const mappedAll = rawList.map(r => {
          const pName = r.passenger?.name || r.customerName || r.passenger || 'Passenger';
          const pPhone = r.passenger?.phone || r.customerPhone || r.phone || '+92 300 1234567';
          const pEmail = r.passenger?.email || r.customerEmail || r.email || 'passenger@example.com';
          const pGender = r.passenger?.gender || r.gender || 'Male';
          const pickup = r.pickupLocation || r.route?.pickupLocation || (typeof r.route === 'string' ? r.route.split('->')[0]?.trim() : 'Islamabad');
          const drop = r.dropLocation || r.route?.dropLocation || (typeof r.route === 'string' ? r.route.split('->')[1]?.trim() : 'Rawalpindi');
          const routeSummary = r.route?.summary || `${pickup} ➔ ${drop}`;
          const routePassengers = r.route?.passengers || `${r.seatsNeeded || 1} Passenger(s)`;
          const schedTime = r.scheduledTime || `${r.date || ''} ${r.timeToLeave || ''}`.trim() || r.date || 'Today 08:00 AM';
          const vCategory = r.vehicle?.category || r.vehiclePreference || r.preferences?.vehicleCategory || 'Sedan';
          const vAc = r.vehicle?.ac !== undefined ? r.vehicle.ac : (r.acRequired !== false);
          const vLabel = r.vehicle?.label || `${vCategory}${vAc ? ' • AC' : ' • Non-AC'}`;
          const fareFmt = r.fareFormatted || r.fare || 'Rs. 2,500';
          
          const isAssigned = r.status === 'ASSIGNED' || (r.status && r.status.startsWith('Dispatched')) || !!r.assignedDriverDetails?.name;
          const statusStr = isAssigned ? 'ASSIGNED' : (r.status === 'Visible' || r.status === 'PENDING' ? 'Pending Dispatch' : (r.status || 'Pending Dispatch'));

          return {
            _id: r._id || r.id,
            id: r.requestId || r.id || (r._id ? `REQ-${String(r._id).slice(-4).toUpperCase()}` : 'REQ-8000'),
            requestId: r.requestId || r.id || (r._id ? `REQ-${String(r._id).slice(-4).toUpperCase()}` : 'REQ-8000'),
            passenger: pName,
            passengerName: pName,
            passengerObj: {
              name: pName,
              phone: pPhone,
              email: pEmail,
              gender: pGender
            },
            customerName: pName,
            customerPhone: pPhone,
            phone: pPhone,
            email: pEmail,
            gender: pGender,
            pickupLocation: pickup,
            dropLocation: drop,
            route: {
              summary: routeSummary,
              pickupLocation: pickup,
              dropLocation: drop,
              passengers: routePassengers
            },
            scheduledTime: schedTime,
            date: schedTime,
            vehicle: {
              label: vLabel,
              category: vCategory,
              ac: vAc
            },
            preferences: {
              vehicleCategory: vCategory,
              acRequired: vAc
            },
            fareFormatted: fareFmt,
            fare: fareFmt,
            seatsNeeded: r.seatsNeeded || 1,
            status: statusStr,
            driverId: r.driverId,
            assignedDriverDetails: r.assignedDriverDetails
          };
        });

        const pendingList = mappedAll.filter(r => r.status !== 'ASSIGNED' && !r.status.startsWith('Dispatched'));
        const assignedList = mappedAll.filter(r => r.status === 'ASSIGNED' || r.status.startsWith('Dispatched'));

        setRideRequests(pendingList);
        setAssignedRides(assignedList);

        const respPendingCount = ridesRes?.pendingCount ?? ridesRes?.data?.pendingCount ?? pendingList.length;
        const respAssignedCount = ridesRes?.assignedCount ?? ridesRes?.data?.assignedCount ?? assignedList.length;
        setPendingCount(respPendingCount);
        setAssignedCount(respAssignedCount);
      }

      if (drvData?.success && drvData?.data?.drivers) {
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

  // Helper to find assigned rides for a specific driver
  const getDriverAssignedTrips = (driver) => {
    if (!driver) return [];
    const drvId = driver._id;
    const drvCode = driver.id;
    const drvName = (driver.personalInfo?.name || '').toLowerCase();

    return assignedRides.filter(r => {
      const matchId = r.driverId === drvId || r.driverId === drvCode;
      const matchCode = r.assignedDriverDetails?.driverCode === drvCode;
      const matchName = drvName && (r.assignedDriverDetails?.name || '').toLowerCase() === drvName;
      return matchId || matchCode || matchName;
    });
  };

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

  // Handle Dispatch via PATCH /api/rides/:id/dispatch
  const handleDispatch = async (driver) => {
    const rideId = selectedRide._id || selectedRide.id;
    const driverId = driver._id || driver.id;
    const driverName = driver.personalInfo?.name || driver.name || 'Ali Khan';

    try {
      // Call live backend PATCH http://localhost:3000/api/rides/:id/dispatch with { "driverName": "Ali Khan" }
      await RideAPI.dispatch(rideId, driverName, driverId);
    } catch (err) {
      console.error('Dispatch API error:', err);
    }

    // Immediately update reactive local state with no page refresh
    setRideRequests(prev => prev.filter(r => (r._id || r.id) !== rideId));

    // Add newly assigned ride to local assigned list
    const newAssignedTrip = {
      _id: rideId,
      requestId: selectedRide.requestId || selectedRide.id,
      customerName: selectedRide.passenger?.name || selectedRide.customerName,
      customerPhone: selectedRide.passenger?.phone || selectedRide.customerPhone,
      pickupLocation: selectedRide.pickupLocation,
      dropLocation: selectedRide.dropLocation,
      scheduledTime: selectedRide.scheduledTime || selectedRide.date,
      date: selectedRide.scheduledTime || selectedRide.date,
      fare: selectedRide.fareFormatted || selectedRide.fare,
      status: 'ASSIGNED',
      driverId: driverId,
      assignedDriverDetails: {
        driverCode: driver.id,
        name: driverName,
        phone: driver.personalInfo?.phone || driver.phone,
        vehicle: `${driver.vehicleInfo.make} ${driver.vehicleInfo.model}`,
        rating: driver.performance.rating
      },
      updatedAt: new Date().toISOString()
    };

    setAssignedRides(prev => [newAssignedTrip, ...prev.filter(a => a._id !== newAssignedTrip._id && a.requestId !== newAssignedTrip.requestId)]);
    setPendingCount(prev => Math.max(0, prev - 1));
    setAssignedCount(prev => prev + 1);

    setToastMessage(`✓ Ride ${selectedRide.requestId || selectedRide.id} successfully dispatched to ${driverName}!`);
    setToastActionDriver(driver);
    setTimeout(() => {
      setToastMessage('');
      setToastActionDriver(null);
    }, 6000);

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

      const assignedTrips = getDriverAssignedTrips(d);
      if (assignedTrips.length > 0) {
        matchTags.push(`${assignedTrips.length} Active Assignment(s)`);
      }

      const finalScore = Math.min(99, Math.max(30, score));

      return {
        ...d,
        matchScore: finalScore,
        matchTags,
        assignedTripsCount: assignedTrips.length
      };
    }).sort((a, b) => b.matchScore - a.matchScore);
  }, [availableDriversLocal, selectedRide, driverSearchQuery, filterAC, filterCategory, assignedRides]);

  // Filter drivers for Driver Panel Tab
  const filteredDriversForPanel = useMemo(() => {
    return availableDriversLocal.filter(d => {
      const q = driverPanelSearch.toLowerCase().trim();
      const matchesSearch = !q || (
        d.personalInfo.name.toLowerCase().includes(q) ||
        d.personalInfo.phone.toLowerCase().includes(q) ||
        d.id.toLowerCase().includes(q) ||
        d.vehicleInfo.plateNumber.toLowerCase().includes(q)
      );

      const assignedTrips = getDriverAssignedTrips(d);
      const isAssigned = assignedTrips.length > 0 || d.availability === 'On Trip';

      if (driverPanelFilter === 'assigned') {
        return matchesSearch && isAssigned;
      } else if (driverPanelFilter === 'available') {
        return matchesSearch && !isAssigned;
      }
      return matchesSearch;
    });
  }, [availableDriversLocal, driverPanelSearch, driverPanelFilter, assignedRides]);

  // View 1: Passenger Requests List / Table
  const renderRideRequests = () => (
    <div className="ride-list-container fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Ride Dispatch & Passenger Requests</h1>
          <p className="page-subtitle">Select any incoming customer ride to view details and smart dispatch to compatible drivers.</p>
        </div>
        <div className="d-flex align-items-center gap-3">
          <button 
            className="secondary-btn d-flex align-items-center gap-2"
            onClick={fetchData}
            title="Refresh ride queue"
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            Refresh
          </button>
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
      </div>

      {viewMode === 'table' ? (
        <div className="table-container-card">
          <div className="table-content">
            <table className="clean-table">
              <thead>
                <tr>
                  <th>REQUEST ID</th>
                  <th>PASSENGER</th>
                  <th>ROUTE & DROP-OFF</th>
                  <th>SCHEDULED TIME</th>
                  <th>VEHICLE & AC</th>
                  <th>FARE</th>
                  <th>STATUS</th>
                  <th style={{ textAlign: 'right' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {rideRequests.length === 0 ? (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center', padding: '3rem 1rem' }}>
                      <Car size={32} className="text-secondary mb-2" />
                      <p className="text-secondary">No pending ride requests available right now.</p>
                    </td>
                  </tr>
                ) : (
                  rideRequests.map(ride => (
                    <tr 
                      key={ride.id} 
                      className="clickable-row"
                      onClick={() => handleSelectRide(ride)}
                    >
                      <td>
                        <span className="id-pill font-mono">{ride.requestId || ride.id}</span>
                      </td>
                      <td>
                        <div className="passenger-table-cell">
                          <div className="avatar-circle">
                            {(ride.passenger?.name || ride.customerName || 'P').charAt(0)}
                          </div>
                          <div>
                            <strong>{ride.passenger?.name || ride.customerName}</strong>
                            <div className="text-xs text-secondary">{ride.passenger?.phone || ride.customerPhone}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="route-table-cell">
                          <span className="route-pickup">{(ride.pickupLocation || '').split(',')[0]}</span>
                          <span className="route-arrow">➔</span>
                          <span className="route-drop">{(ride.dropLocation || '').split(',')[0]}</span>
                        </div>
                        <div className="text-xs text-secondary mt-1">{ride.route?.passengers || `${ride.seatsNeeded || 1} Passenger(s)`}</div>
                      </td>
                      <td>
                        <div className="d-flex align-items-center gap-1 text-sm">
                          <Clock size={13} className="text-secondary" />
                          <span>{ride.scheduledTime || ride.date}</span>
                        </div>
                      </td>
                      <td>
                        <div className="vehicle-pill">
                          <span>{ride.vehicle?.label || ride.preferences?.vehicleCategory}</span>
                          {ride.preferences?.acRequired && !ride.vehicle?.label?.includes('AC') && (
                            <span className="ac-chip"><Wind size={11} /> AC</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className="fare-badge">{ride.fareFormatted || ride.fare}</span>
                      </td>
                      <td>
                        <span className={`status-badge ${ride.status.toLowerCase().includes('pending') ? 'pending' : 'approved'}`}>
                          {ride.status}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div className="d-flex justify-content-end gap-2" onClick={e => e.stopPropagation()}>
                          <button 
                            className="icon-btn-secondary" 
                            title="View Full Trip Details"
                            onClick={() => setViewPassengerModal(ride)}
                          >
                            <Eye size={15} />
                          </button>
                          <button 
                            className="dispatch-action-btn"
                            onClick={() => handleSelectRide(ride)}
                          >
                            <Sparkles size={13} /> Dispatch
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="rides-grid">
          {rideRequests.map(ride => (
            <div 
              key={ride.id} 
              className="glass-panel ride-card"
              onClick={() => handleSelectRide(ride)}
            >
              <div className="ride-card-header">
                <span className="id-pill font-mono">{ride.id}</span>
                <span className={`status-badge ${ride.status.toLowerCase().includes('pending') ? 'pending' : 'approved'}`}>
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

  // View 2: Driver Selection Screen with Smart Recommendations (Full-width Top Search & Filters)
  const renderDriverSelection = () => (
    <div className="driver-selection-container fade-in">
      {/* Top Header */}
      <div className="page-header dispatch-selection-header mb-3">
        <div className="d-flex align-items-center gap-3">
          <button className="back-btn" onClick={() => setSelectedRide(null)}>
            <ChevronLeft size={18} />
            <span>Back to Requests</span>
          </button>
          <div>
            <h1 className="page-title">Smart Driver Dispatch Console</h1>
            <p className="page-subtitle">Matching passenger <strong>{getPassengerName(selectedRide.passenger)}</strong> with top compatible verified drivers</p>
          </div>
        </div>
      </div>

      {/* Top Horizontal Trip Summary Banner */}
      <div className="dispatch-trip-banner glass-panel mb-3">
        <div className="trip-banner-passenger">
          <div className="passenger-avatar-box">
            {getPassengerInitial(selectedRide.passenger)}
          </div>
          <div>
            <div className="text-xs text-secondary">PASSENGER</div>
            <strong className="passenger-name-text">{getPassengerName(selectedRide.passenger)}</strong>
            <div className="text-xs text-secondary mt-0.5">{selectedRide.phone || selectedRide.passengerObj?.phone || '+92 300 1234567'}</div>
          </div>
        </div>

        <div className="trip-banner-divider"></div>

        <div className="trip-banner-route">
          <div className="route-banner-step">
            <span className="dot green-dot"></span>
            <div>
              <span className="step-label">PICKUP</span>
              <strong className="step-val">{selectedRide.pickupLocation}</strong>
            </div>
          </div>
          <div className="route-banner-arrow">➔</div>
          <div className="route-banner-step">
            <span className="dot red-dot"></span>
            <div>
              <span className="step-label">DROP-OFF</span>
              <strong className="step-val">{selectedRide.dropLocation}</strong>
            </div>
          </div>
        </div>

        <div className="trip-banner-divider"></div>

        <div className="trip-banner-specs">
          <div className="d-flex align-items-center gap-2">
            <Clock size={15} className="text-primary" />
            <span>{selectedRide.date}</span>
          </div>
          <div className="d-flex align-items-center gap-2 mt-1">
            <Car size={15} className="text-primary" />
            <span>{selectedRide.preferences.vehicleCategory} • {selectedRide.preferences.acRequired ? 'AC Required' : 'Non-AC'}</span>
          </div>
        </div>

        <div className="trip-banner-fare ms-auto">
          <span className="fare-label">Estimated Fare</span>
          <span className="fare-amount font-bold text-success">{selectedRide.fare}</span>
        </div>
      </div>

      {/* Top Horizontal Search & Filters Toolbar */}
      <div className="dispatch-filters-toolbar glass-panel mb-4">
        <div className="search-input-wrapper flex-1">
          <Search size={16} className="search-icon" />
          <input 
            type="text" 
            value={driverSearchQuery}
            onChange={(e) => setDriverSearchQuery(e.target.value)}
            placeholder="Search recommended driver by name, phone, plate number, or vehicle model..."
          />
        </div>

        <div className="toolbar-filter-item">
          <select 
            value={filterCategory} 
            onChange={(e) => setFilterCategory(e.target.value)}
            className="toolbar-select"
          >
            <option value="all">All Vehicle Categories</option>
            <option value="Sedan">Sedan</option>
            <option value="SUV">SUV</option>
            <option value="Hatchback">Hatchback</option>
            <option value="Van">Van / Bolan</option>
          </select>
        </div>

        <div className="toolbar-filter-item">
          <div className="radio-group toolbar-radios">
            <button 
              type="button"
              className={`radio-btn ${filterAC === 'all' ? 'active' : ''}`}
              onClick={() => setFilterAC('all')}
            >All AC</button>
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
            className="clear-filters-btn" 
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

      {/* Recommended Drivers Section */}
      <div className="dispatch-results-container">
        <div className="results-header mb-3">
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: '700' }}>Smart Recommended Drivers</h2>
            <p className="text-secondary text-xs">Ranked by Route Compatibility, Vehicle Match, Rating & Proximity</p>
          </div>
          <span className="results-count">{scoredDrivers.length} Candidates Available</span>
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
              const assignedTrips = getDriverAssignedTrips(driver);
              const isOnTrip = assignedTrips.length > 0;

              return (
                <div 
                  key={driver.id} 
                  className={`driver-recommendation-card glass-panel ${isTopMatch ? 'top-recommended-card' : ''}`}
                >
                  {isTopMatch && (
                    <div className="top-match-badge">
                      <Sparkles size={13} /> Top Recommended Match ({driver.matchScore}% Match Score)
                    </div>
                  )}

                  {/* Card Main Body */}
                  <div className="rec-card-body">
                    {/* Left: Driver Avatar & Basic Info */}
                    <div className="rec-driver-profile">
                      <div className="rec-avatar-wrapper">
                        <div className="rec-driver-avatar">
                          {(driver.personalInfo?.name || 'D').charAt(0).toUpperCase()}
                        </div>
                        <span className={`live-status-indicator ${isOnTrip ? 'status-busy' : 'status-online'}`} title={isOnTrip ? 'On Trip' : 'Available'}></span>
                      </div>
                      <div className="rec-profile-text">
                        <div className="d-flex align-items-center gap-2 flex-wrap">
                          <h4 className="rec-driver-name">{driver.personalInfo?.name || 'Driver'}</h4>
                          <span className="driver-id-pill font-mono">{formatDriverCode(driver.id)}</span>
                          <span className={`availability-pill ${isOnTrip ? 'on-trip' : 'available'}`}>
                            {isOnTrip ? '● On Trip' : '● Available'}
                          </span>
                        </div>
                        <div className="rec-meta-line mt-1">
                          <span><Phone size={12} className="text-secondary me-1" />{driver.personalInfo?.phone || 'N/A'}</span>
                          <span className="meta-dot">•</span>
                          <span><MapPin size={12} className="text-secondary me-1" />{driver.personalInfo?.city || 'Islamabad'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Middle: Vehicle & Route Info */}
                    <div className="rec-vehicle-section">
                      <div className="rec-vehicle-name">
                        <Car size={15} className="text-primary" />
                        <strong>{driver.vehicleInfo.make} {driver.vehicleInfo.model}</strong>
                        <span className="rec-plate-badge">{driver.vehicleInfo.plateNumber}</span>
                      </div>
                      <div className="rec-tags-row mt-1.5">
                        <span className="tag category-tag">{driver.vehicleInfo.category}</span>
                        {driver.vehicleInfo.ac ? (
                          <span className="tag ac-tag"><Wind size={11} /> AC Fitted</span>
                        ) : (
                          <span className="tag non-ac-tag">Non-AC</span>
                        )}
                        <span className="tag seats-tag">{driver.vehicleInfo.seats} Seats</span>
                      </div>
                      <div className="rec-routes-list mt-1.5">
                        <span className="text-xs text-secondary">Routes: </span>
                        <span className="text-xs font-semibold">{driver.preferences.routes?.join(', ') || 'Islamabad - Rawalpindi'}</span>
                      </div>
                    </div>

                    {/* Right-Middle: Suitability & Stats */}
                    <div className="rec-stats-section">
                      <div className="match-score-display">
                        <div className="score-number font-bold text-primary">{driver.matchScore}%</div>
                        <div className="score-label">Match Score</div>
                      </div>

                      <div className="rec-kpis-column">
                        <div className="rec-kpi-item">
                          <div className="d-flex align-items-center gap-1 font-bold text-sm">
                            <Star size={13} fill="#F59E0B" color="#F59E0B" />
                            <span>{driver.performance.rating}</span>
                          </div>
                          <span className="text-xs text-secondary">Driver Rating</span>
                        </div>
                        <div className="rec-kpi-item">
                          <div className="font-bold text-sm">{driver.performance.totalRides}</div>
                          <span className="text-xs text-secondary">Completed Trips</span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Action Buttons */}
                    <div className="rec-actions-section">
                      <button 
                        className="rec-app-view-btn" 
                        onClick={() => setViewDriverModal(driver)}
                        title="Preview Flutter mobile app view"
                      >
                        <Smartphone size={14} /> App View
                      </button>
                      <button 
                        className={`dispatch-btn ${isTopMatch ? 'highlight-btn' : ''}`} 
                        onClick={() => handleDispatch(driver)}
                      >
                        <Sparkles size={14} /> Dispatch Driver
                      </button>
                    </div>
                  </div>

                  {/* Match Reasons Footer Strip */}
                  <div className="rec-card-footer">
                    <span className="rec-match-reasons-label">Match Highlights:</span>
                    <div className="match-reasons-row">
                      {driver.matchTags?.filter(t => !t.includes('Active Assignment')).map((tag, tIdx) => (
                        <span key={tIdx} className="match-reason-chip">✓ {tag}</span>
                      ))}
                    </div>
                    {assignedTrips.length > 0 && (
                      <span className="active-dispatch-tag ms-auto">
                        ⚡ {assignedTrips.length} Active Assignment(s)
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  // View 3: Driver Panel & Live Assigned Trips Tab
  const renderDriverPanel = () => {
    const totalAssignedTrips = assignedRides.length;
    const activeDriversCount = availableDriversLocal.filter(d => getDriverAssignedTrips(d).length > 0).length;

    return (
      <div className="driver-panel-section fade-in">
        <div className="page-header">
          <div>
            <h1 className="page-title">Driver Panel & Live Assigned Rides</h1>
            <p className="page-subtitle">
              Monitor drivers in real-time and inspect assigned customer rides synced with the mobile driver application.
            </p>
          </div>
          <div className="d-flex align-items-center gap-2">
            <button className="secondary-btn d-flex align-items-center gap-2" onClick={fetchData}>
              <RefreshCw size={14} className={loading ? 'spin' : ''} />
              Sync Live Status
            </button>
          </div>
        </div>

        {/* Top KPI Metrics Bar */}
        <div className="driver-panel-kpis">
          <div className="panel-kpi-card">
            <div className="kpi-icon-box bg-blue-light">
              <Car size={20} className="text-primary" />
            </div>
            <div>
              <div className="kpi-num">{availableDriversLocal.length}</div>
              <div className="kpi-label">Registered Drivers</div>
            </div>
          </div>
          <div className="panel-kpi-card">
            <div className="kpi-icon-box bg-green-light">
              <Radio size={20} className="text-success" />
            </div>
            <div>
              <div className="kpi-num">{activeDriversCount}</div>
              <div className="kpi-label">Active / On Trip Drivers</div>
            </div>
          </div>
          <div className="panel-kpi-card">
            <div className="kpi-icon-box bg-purple-light">
              <CheckCircle2 size={20} className="text-purple" />
            </div>
            <div>
              <div className="kpi-num">{totalAssignedTrips}</div>
              <div className="kpi-label">Total Assigned Rides</div>
            </div>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="driver-panel-controls glass-panel mb-4">
          <div className="search-input-wrapper flex-1">
            <Search size={16} className="search-icon" />
            <input 
              type="text" 
              placeholder="Search driver by name, phone, plate, or driver code..." 
              value={driverPanelSearch}
              onChange={(e) => setDriverPanelSearch(e.target.value)}
            />
          </div>

          <div className="driver-panel-filter-tabs">
            <button 
              className={`panel-tab-btn ${driverPanelFilter === 'all' ? 'active' : ''}`}
              onClick={() => setDriverPanelFilter('all')}
            >
              All Drivers ({availableDriversLocal.length})
            </button>
            <button 
              className={`panel-tab-btn ${driverPanelFilter === 'assigned' ? 'active' : ''}`}
              onClick={() => setDriverPanelFilter('assigned')}
            >
              ⚡ With Assigned Rides ({activeDriversCount})
            </button>
            <button 
              className={`panel-tab-btn ${driverPanelFilter === 'available' ? 'active' : ''}`}
              onClick={() => setDriverPanelFilter('available')}
            >
              Available Only ({availableDriversLocal.length - activeDriversCount})
            </button>
          </div>
        </div>

        {/* Driver List with Assigned Rides */}
        <div className="driver-panel-grid">
          {filteredDriversForPanel.length === 0 ? (
            <div className="empty-state glass-panel" style={{ gridColumn: '1 / -1' }}>
              <User size={40} className="text-secondary mb-2" />
              <h3>No Drivers Found</h3>
              <p>No drivers match your current search or status filter.</p>
            </div>
          ) : (
            filteredDriversForPanel.map(driver => {
              const assignedTrips = getDriverAssignedTrips(driver);
              const isOnTrip = assignedTrips.length > 0;

              return (
                <div key={driver.id} className={`driver-panel-card glass-panel ${isOnTrip ? 'border-active-dispatch' : ''}`}>
                  {/* Card Header */}
                  <div className="driver-panel-card-header">
                    <div className="driver-header-left">
                      <div className="driver-avatar-md">
                        {(driver.personalInfo?.name || 'D').charAt(0).toUpperCase()}
                      </div>
                      <div className="driver-title-col">
                        <div className="driver-name-row">
                          <h4 className="driver-name-heading" title={driver.personalInfo?.name}>
                            {driver.personalInfo?.name || 'Driver'}
                          </h4>
                          <span className="driver-id-pill font-mono" title={driver.id}>
                            {formatDriverCode(driver.id)}
                          </span>
                        </div>
                        <div className="driver-meta-subtext">
                          <span>{driver.personalInfo?.phone || 'N/A'}</span>
                          <span className="meta-sep">•</span>
                          <span>{driver.personalInfo?.city || 'Islamabad'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="driver-header-right">
                      <span className={`availability-pill ${isOnTrip ? 'on-trip' : 'available'}`}>
                        {isOnTrip ? '● On Trip' : '● Available'}
                      </span>
                      <div className="rating-mini">
                        <Star size={12} fill="#F59E0B" color="#F59E0B" />
                        <span>{driver.performance?.rating || 4.8}</span>
                      </div>
                    </div>
                  </div>

                  {/* Vehicle Info */}
                  <div className="driver-vehicle-row">
                    <Car size={15} className="text-primary" />
                    <span>{driver.vehicleInfo.make} {driver.vehicleInfo.model} ({driver.vehicleInfo.plateNumber})</span>
                    <span className="driver-vehicle-tag">{driver.vehicleInfo.category}</span>
                    {driver.vehicleInfo.ac && <span className="driver-ac-tag"><Wind size={10} /> AC</span>}
                  </div>

                  {/* Assigned Rides Container */}
                  <div className="assigned-rides-subcontainer">
                    <div className="assigned-rides-title">
                      <span>Assigned Trips in Driver Portal ({assignedTrips.length})</span>
                      {isOnTrip && <span className="live-sync-indicator">Live Sync Active</span>}
                    </div>

                    {assignedTrips.length === 0 ? (
                      <div className="no-trips-box">
                        <Clock size={16} className="text-secondary" />
                        <span>No active rides currently assigned to this driver.</span>
                      </div>
                    ) : (
                      <div className="assigned-trips-list">
                        {assignedTrips.map((trip, tIdx) => (
                          <div key={trip._id || tIdx} className="assigned-trip-item">
                            <div className="assigned-trip-top">
                              <span className="trip-id-badge font-mono">{trip.requestId || trip._id}</span>
                              <span className="trip-status-badge">ASSIGNED</span>
                              <span className="trip-fare font-bold text-success">{trip.fare || 'Rs. 2,500'}</span>
                            </div>

                            <div className="trip-route-info mt-1">
                              <div className="route-bullet pickup-bullet"></div>
                              <span className="route-loc">{trip.pickupLocation}</span>
                            </div>
                            <div className="trip-route-info">
                              <div className="route-bullet drop-bullet"></div>
                              <span className="route-loc">{trip.dropLocation}</span>
                            </div>

                            <div className="trip-footer-info mt-2">
                              <span className="text-xs text-secondary">Passenger: <strong>{trip.customerName}</strong> ({trip.customerPhone || 'N/A'})</span>
                              <span className="text-xs text-secondary">{trip.date || 'Today'}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Card Footer Actions */}
                  <div className="driver-panel-card-footer">
                    <button 
                      className="driver-app-preview-btn"
                      onClick={() => setViewDriverModal(driver)}
                    >
                      <Smartphone size={14} /> Open Driver App Simulation
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="module-container">
      {/* Top Header Navigation Tabs */}
      <div className="dispatch-nav-tabs mb-3">
        <button 
          className={`nav-tab-button ${activeMainTab === 'requests' ? 'active' : ''}`}
          onClick={() => {
            setActiveMainTab('requests');
            setSelectedRide(null);
          }}
        >
          <Sparkles size={16} />
          <span>Dispatch Console (Pending Rides)</span>
          {pendingCount > 0 && (
            <span className="tab-counter-badge">{pendingCount}</span>
          )}
        </button>

        <button 
          className={`nav-tab-button ${activeMainTab === 'driver-panel' ? 'active' : ''}`}
          onClick={() => setActiveMainTab('driver-panel')}
        >
          <Smartphone size={16} />
          <span>Driver Panel & Live Assigned Trips</span>
          {assignedCount > 0 && (
            <span className="tab-counter-badge green-badge">{assignedCount}</span>
          )}
        </button>
      </div>

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="toast-notification fade-in">
          <CheckCircle size={20} className="text-success" />
          <span>{toastMessage}</span>
          {toastActionDriver && (
            <button 
              className="toast-action-btn"
              onClick={() => {
                setActiveMainTab('driver-panel');
                setViewDriverModal(toastActionDriver);
                setToastMessage('');
              }}
            >
              View in Driver Panel ➔
            </button>
          )}
        </div>
      )}
      
      {activeMainTab === 'requests' ? (
        !selectedRide ? renderRideRequests() : renderDriverSelection()
      ) : (
        renderDriverPanel()
      )}

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
              <div className="passenger-info-band">
                <div className="passenger-avatar-box">
                  {getPassengerInitial(viewPassengerModal.passenger)}
                </div>
                <div>
                  <h4>{getPassengerName(viewPassengerModal.passenger)}</h4>
                  <p className="text-secondary text-xs">{viewPassengerModal.phone || viewPassengerModal.passengerObj?.phone || '+92 300 1234567'} • {viewPassengerModal.gender || 'Male'}</p>
                </div>
                <span className={`status-badge ms-auto ${viewPassengerModal.status.toLowerCase().includes('pending') ? 'pending' : 'approved'}`}>
                  {viewPassengerModal.status}
                </span>
              </div>

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

      {/* ── Driver Phone / App Simulation Modal ── */}
      {viewDriverModal && (
        <div className="modal-overlay fade-in" style={{ zIndex: 10000 }} onClick={() => setViewDriverModal(null)}>
          <div className="driver-phone-modal-card" onClick={e => e.stopPropagation()}>
            {/* Phone Bezel Top Notch */}
            <div className="phone-notch-bar">
              <span className="phone-time">09:41</span>
              <div className="phone-speaker"></div>
              <div className="phone-signals">5G 100%</div>
            </div>

            {/* Mobile App Header */}
            <div className="phone-app-header">
              <div>
                <div className="app-title-text">Ride & Serve Driver</div>
                <div className="driver-status-live">
                  <span className="live-dot"></span> Online • Ready for Pickups
                </div>
              </div>
              <button className="icon-btn close-phone-btn" onClick={() => setViewDriverModal(null)}>
                <X size={18} />
              </button>
            </div>

            {/* Driver Profile Bar in App */}
            <div className="phone-driver-profile">
              <div className="phone-driver-avatar">
                {viewDriverModal.personalInfo.name.charAt(0)}
              </div>
              <div className="flex-1">
                <div className="d-flex align-items-center justify-content-between">
                  <h4 className="phone-driver-name">{viewDriverModal.personalInfo.name}</h4>
                  <div className="phone-driver-rating">
                    <Star size={13} fill="#F59E0B" color="#F59E0B" />
                    <span>{viewDriverModal.performance.rating}</span>
                  </div>
                </div>
                <div className="text-xs text-secondary">
                  {viewDriverModal.vehicleInfo.make} {viewDriverModal.vehicleInfo.model} • {viewDriverModal.vehicleInfo.plateNumber}
                </div>
              </div>
            </div>

            {/* Phone App Body Content */}
            <div className="phone-app-body">
              <div className="section-heading-row">
                <h5>Assigned Customer Trips</h5>
                <span className="badge-count-pill">{getDriverAssignedTrips(viewDriverModal).length} Active</span>
              </div>

              {getDriverAssignedTrips(viewDriverModal).length === 0 ? (
                <div className="phone-empty-state">
                  <Clock size={32} className="text-secondary mb-2" />
                  <p>No active ride assigned right now.</p>
                  <span className="text-xs text-secondary">When admin dispatches a ride, it appears here instantly!</span>
                </div>
              ) : (
                <div className="phone-trips-list">
                  {getDriverAssignedTrips(viewDriverModal).map((trip, idx) => (
                    <div key={trip._id || idx} className="phone-trip-card">
                      <div className="phone-trip-header">
                        <span className="trip-badge-alert">NEW ASSIGNED RIDE</span>
                        <span className="phone-fare font-bold">{trip.fare || 'Rs. 2,500'}</span>
                      </div>

                      <div className="phone-passenger-strip mt-2">
                        <User size={14} className="text-primary" />
                        <strong>{trip.customerName}</strong>
                        <a href={`tel:${trip.customerPhone}`} className="phone-call-btn" title="Call Passenger">
                          <Phone size={12} /> Call
                        </a>
                      </div>

                      <div className="phone-route-box mt-2">
                        <div className="phone-route-step">
                          <div className="dot green-dot"></div>
                          <div>
                            <div className="step-label">PICKUP</div>
                            <div className="step-text">{trip.pickupLocation}</div>
                          </div>
                        </div>
                        <div className="phone-step-line"></div>
                        <div className="phone-route-step">
                          <div className="dot red-dot"></div>
                          <div>
                            <div className="step-label">DESTINATION</div>
                            <div className="step-text">{trip.dropLocation}</div>
                          </div>
                        </div>
                      </div>

                      <div className="phone-actions-row mt-3">
                        <button className="phone-nav-btn">
                          <Navigation size={13} /> Start Navigation
                        </button>
                        <button className="phone-accept-btn">
                          <CheckCircle size={13} /> Accept Trip
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Phone Bottom Navigation Simulation */}
            <div className="phone-bottom-nav">
              <div className="nav-item active"><Smartphone size={16} /><span>Trips</span></div>
              <div className="nav-item"><DollarSign size={16} /><span>Earnings</span></div>
              <div className="nav-item"><Star size={16} /><span>Rating</span></div>
              <div className="nav-item"><User size={16} /><span>Profile</span></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RideDispatch;
