import React, { useState, useEffect, useCallback, useMemo } from 'react';
import io from 'socket.io-client';
import { 
  MapPin, Clock, Car, Filter, Star, CheckCircle, Search, ChevronLeft, Map, Wind, 
  User, Phone, Calendar, DollarSign, Sparkles, X, Eye, ThumbsUp, ShieldCheck, ArrowRight, RotateCcw,
  Smartphone, Navigation, RefreshCw, Send, CheckCircle2, AlertCircle, Radio
} from 'lucide-react';
import LocationAutocomplete from '../components/LocationAutocomplete';
import { BACKEND_URL, RideAPI } from '../utils/api';
import './RideDispatch.css';

const MOBILE_URL = 'http://192.168.88.132:3000';
const LOCAL_3000 = 'http://localhost:3000';
const ADMIN_5000 = BACKEND_URL || 'http://localhost:5000';

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

const getDisplayId = (r) => {
  if (!r) return 'REQ-8001';
  if (r.requestId) return String(r.requestId);
  if (r.rideId) return String(r.rideId);
  if (r.id && String(r.id).startsWith('REQ-')) return String(r.id);
  if (r._id) return `REQ-${String(r._id).slice(-4).toUpperCase()}`;
  return 'REQ-8001';
};

const getPassengerName = (p) => {
  if (!p) return 'Customer';
  if (typeof p === 'string') return p;
  if (typeof p === 'object' && p.name) return p.name;
  if (typeof p === 'object' && p.customerName) return p.customerName;
  if (typeof p === 'object' && p.fullName) return p.fullName;
  return 'Customer';
};

const getPassengerInitial = (p) => {
  const name = getPassengerName(p);
  return (name && name.length > 0) ? name.charAt(0).toUpperCase() : 'C';
};

const normalizeRide = (r) => {
  if (!r) return null;
  const pName = r.passengerName || r.customerName || r.passenger?.name || r.customer?.fullName || (typeof r.passenger === 'string' ? r.passenger : 'Customer');
  const pPhone = r.passengerPhone || r.customerPhone || r.passenger?.phone || r.customer?.PhoneNumber || r.phone || '+92 300 1234567';
  const pEmail = r.passengerEmail || r.customerEmail || r.passenger?.email || r.customer?.Email || r.email || '';
  const pGender = r.passengerGender || r.gender || r.passenger?.gender || 'Male';

  const pickup = typeof r.pickupLocation === 'object' && r.pickupLocation?.address
    ? r.pickupLocation.address
    : (r.pickupLocation || r.route?.pickup || r.route?.pickupLocation || 'Pickup Location');

  const drop = typeof r.dropoffLocation === 'object' && r.dropoffLocation?.address
    ? r.dropoffLocation.address
    : (typeof r.dropLocation === 'object' && r.dropLocation?.address
      ? r.dropLocation.address
      : (r.dropoffLocation || r.dropLocation || r.route?.dropoff || r.route?.dropLocation || 'Drop-off Location'));

  const routeSummary = r.route?.summary || `${pickup} ➔ ${drop}`;
  const routePassengers = r.route?.passengers || `${r.seatsNeeded || 1} Passenger(s)`;

  let schedTime = 'Today 08:00 AM';
  if (r.scheduledTime) {
    schedTime = r.scheduledTime;
  } else if (r.date && r.timeToLeave) {
    schedTime = `${r.date} ${r.timeToLeave}`;
  } else if (r.date) {
    schedTime = r.date;
  } else if (r.createdAt) {
    try {
      const d = new Date(r.createdAt);
      schedTime = `${d.toLocaleDateString()} • ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } catch (e) {
      schedTime = 'Today 08:00 AM';
    }
  }

  const vCategory = r.vehicleType || r.vehicle?.category || r.vehiclePreference || r.preferences?.vehicleCategory || 'Sedan';
  const vAc = r.acPreference === 'AC' || r.acPreference === 'Yes' || (r.vehicle?.ac !== undefined ? r.vehicle.ac : (r.acRequired !== false));
  const vLabel = r.vehicle?.label || `${vCategory}${vAc ? ' • AC' : ' • Non-AC'}`;

  const fareFmt = r.fareFormatted || (r.fare !== undefined && r.fare !== null ? (typeof r.fare === 'number' ? `AED ${r.fare}` : String(r.fare)) : 'Rs. 9,500');

  const isAssigned = r.status === 'ASSIGNED' || r.status === 'assigned' || (r.status && String(r.status).startsWith('Dispatched'));
  const statusStr = isAssigned ? 'ASSIGNED' : (r.status === 'Visible' || r.status === 'PENDING' || r.status === 'pending' ? 'Pending Dispatch' : (r.status || 'Pending Dispatch'));

  const realId = getDisplayId(r);

  return {
    _id: r._id || r.id,
    id: realId,
    requestId: realId,
    rideId: r.rideId || realId,
    rawId: r.requestId || r.rideId || r._id,
    displayId: realId,
    passengerName: pName,
    passengerPhone: pPhone,
    passengerEmail: pEmail,
    passenger: {
      name: pName,
      phone: pPhone,
      email: pEmail,
      gender: pGender
    },
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
    dropoffLocation: drop,
    dropLocation: drop,
    route: {
      summary: routeSummary,
      pickup: pickup,
      dropoff: drop,
      pickupLocation: pickup,
      dropLocation: drop,
      passengers: routePassengers
    },
    scheduledTime: schedTime,
    date: schedTime,
    createdAt: r.createdAt || new Date().toISOString(),
    vehicleType: vCategory,
    acPreference: vAc ? 'AC' : 'Non-AC',
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
    driverId: r.driverId || r.driver,
    driver: r.driver || r.driverId,
    assignedDriverDetails: r.assignedDriverDetails
  };
};

const RideDispatch = () => {
  const [activeMainTab, setActiveMainTab] = useState('requests'); // 'requests' | 'driver-panel'
  const [rides, setRides] = useState([]);
  const [availableDriversLocal, setAvailableDriversLocal] = useState([]);
  const [selectedRide, setSelectedRide] = useState(null);
  const [viewPassengerModal, setViewPassengerModal] = useState(null);
  const [viewDriverModal, setViewDriverModal] = useState(null);
  const [loading, setLoading] = useState(true);
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

  // 1. Fetch live rides from mobile endpoint http://192.168.88.132:3000/api/rides AND database backend
  const fetchRides = useCallback(async () => {
    try {
      const combined = [];

      // A) Primary: Fetch from http://192.168.88.132:3000/api/rides as requested
      try {
        const ctrl = new AbortController();
        const tid = setTimeout(() => ctrl.abort(), 1500);
        const mobRes = await fetch('http://192.168.88.132:3000/api/rides', { signal: ctrl.signal });
        clearTimeout(tid);
        if (mobRes.ok) {
          const mobData = await mobRes.json();
          const list = mobData.data?.rides || mobData.rides || (Array.isArray(mobData.data) ? mobData.data : (Array.isArray(mobData) ? mobData : []));
          if (Array.isArray(list) && list.length > 0) {
            combined.push(...list);
          }
        }
      } catch (e) {}

      // B) Database backend (port 5000)
      try {
        const dbRes = await fetch(`${ADMIN_5000}/api/rides`);
        if (dbRes.ok) {
          const dbData = await dbRes.json();
          const list = dbData.data?.rides || dbData.rides || (Array.isArray(dbData.data) ? dbData.data : (Array.isArray(dbData) ? dbData : []));
          if (Array.isArray(list) && list.length > 0) {
            combined.push(...list);
          }
        }
      } catch (e) {}

      // C) Local port 3000 fallback
      if (combined.length === 0) {
        try {
          const res3000 = await fetch(`${LOCAL_3000}/api/rides`);
          if (res3000.ok) {
            const data3000 = await res3000.json();
            const list = data3000.data?.rides || data3000.rides || (Array.isArray(data3000.data) ? data3000.data : (Array.isArray(data3000) ? data3000 : []));
            if (Array.isArray(list) && list.length > 0) {
              combined.push(...list);
            }
          }
        } catch (e) {}
      }

      // De-duplicate by ID
      const map = new Map();
      combined.forEach(r => {
        if (!r) return;
        const key = String(r._id || r.requestId || r.rideId || r.id);
        if (!map.has(key)) {
          map.set(key, r);
        }
      });

      const uniqueList = Array.from(map.values());
      const normalized = uniqueList.map(normalizeRide).filter(Boolean);

      // Sort newest requests first
      normalized.sort((a, b) => {
        const timeA = new Date(a.createdAt || a.date || 0).getTime();
        const timeB = new Date(b.createdAt || b.date || 0).getTime();
        return timeB - timeA;
      });

      setRides(normalized);
    } catch (err) {
      console.error('Fetch rides error:', err);
    } finally {
      setLoading(false);
    }
  }, []);


  // Fetch Drivers from Admin Backend (Port 5000)
  const fetchDrivers = useCallback(async () => {
    try {
      const token = localStorage.getItem('admin_token');
      let drvRes = await fetch(`${ADMIN_5000}/admin/driver`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      }).catch(() => null);

      if (!drvRes || !drvRes.ok) {
        drvRes = await fetch(`${ADMIN_5000}/api/drivers`).catch(() => null);
      }
      if (!drvRes || !drvRes.ok) {
        drvRes = await fetch(`${MOBILE_URL}/driver`).catch(() => null);
      }

      if (drvRes && drvRes.ok) {
        const drvData = await drvRes.json();
        const rawDrivers = drvData.data?.drivers || drvData.drivers || (Array.isArray(drvData.data) ? drvData.data : []);
        const mappedDrivers = rawDrivers.map(d => {
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
      console.error('Error fetching drivers:', err);
    }
  }, []);

  // 2. Real-time updates with Socket.IO and 3-second polling
  useEffect(() => {
    fetchRides();
    fetchDrivers();

    let socket = null;
    try {
      socket = io(MOBILE_URL, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 3,
        reconnectionDelay: 2000
      });

      socket.on('connect', () => {
        socket.emit('join-admin');
      });

      socket.on('new-ride', (newRide) => {
        const normalized = normalizeRide(newRide);
        if (!normalized) return;
        setRides(prev => {
          if (prev.some(r => r._id === normalized._id || r.requestId === normalized.requestId)) return prev;
          return [normalized, ...prev];
        });
      });

      socket.on('ride-dispatched', (updated) => {
        const normalized = normalizeRide(updated);
        if (!normalized) return;
        setRides(prev => prev.map(r => (r._id === normalized._id || r.requestId === normalized.requestId) ? { ...r, ...normalized } : r));
      });

      socket.on('ride-update', () => fetchRides());
    } catch (e) {}

    // 3-second live polling to automatically sync mobile customer ride requests
    const poll = setInterval(fetchRides, 3000);

    return () => {
      if (socket) socket.disconnect();
      clearInterval(poll);
    };
  }, [fetchRides, fetchDrivers]);

  // Split pending vs assigned rides
  const pendingRides = useMemo(() => {
    return rides.filter(r => r.status !== 'ASSIGNED' && !String(r.status).startsWith('Dispatched'));
  }, [rides]);

  const assignedRides = useMemo(() => {
    return rides.filter(r => r.status === 'ASSIGNED' || String(r.status).startsWith('Dispatched'));
  }, [rides]);

  const pendingCount = pendingRides.length;
  const assignedCount = assignedRides.length;

  // Helper to find assigned rides for a specific driver
  const getDriverAssignedTrips = (driver) => {
    if (!driver) return [];
    const drvId = driver._id;
    const drvCode = driver.id;
    const drvName = (driver.personalInfo?.name || '').toLowerCase();

    return assignedRides.filter(r => {
      const matchId = r.driverId === drvId || r.driverId === drvCode || r.driver === drvId;
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
    
    if (ride.preferences?.acRequired || ride.acPreference === 'AC') {
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

  // Handle Dispatch via POST /api/ride/assign (and PATCH /api/rides/:id/dispatch)
  const handleDispatch = async (driver) => {
    const rideId = selectedRide._id || selectedRide.requestId || selectedRide.id;
    const driverId = driver._id || driver.id;
    const driverName = driver.personalInfo?.name || driver.name || 'Ali Khan';

    try {
      await RideAPI.assign(rideId, driverId, { driverName });
      await RideAPI.dispatch(rideId, driverName, driverId);
    } catch (err) {
      console.error('Dispatch API error:', err);
    }

    // Immediately update reactive local state with no page refresh
    setRides(prev => prev.map(r => {
      if (r._id === selectedRide._id || r.requestId === selectedRide.requestId) {
        return {
          ...r,
          status: 'ASSIGNED',
          driverId: driverId,
          assignedDriverDetails: {
            driverCode: driver.id,
            name: driverName,
            phone: driver.personalInfo?.phone || driver.phone,
            vehicle: `${driver.vehicleInfo?.make || ''} ${driver.vehicleInfo?.model || ''}`.trim(),
            rating: driver.performance?.rating || 4.9
          }
        };
      }
      return r;
    }));

    setToastMessage(`✓ Ride ${selectedRide.displayId || selectedRide.requestId} successfully dispatched to ${driverName}!`);
    setToastActionDriver(driver);
    setTimeout(() => {
      setToastMessage('');
      setToastActionDriver(null);
    }, 6000);

    setSelectedRide(null);
    fetchRides();
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
        const dCity = (selectedRide.dropoffLocation || selectedRide.dropLocation || '').toLowerCase();
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

        if ((selectedRide.preferences?.acRequired || selectedRide.acPreference === 'AC') && d.vehicleInfo.ac) {
          score += 15;
          matchTags.push('AC Vehicle');
        }

        if (selectedRide.preferences?.vehicleCategory && selectedRide.preferences.vehicleCategory !== 'Any') {
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
      <div className="page-header d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 className="page-title">Ride Dispatch & Passenger Requests</h1>
          <p className="page-subtitle">Real-time incoming customer rides with live Socket.IO connection and smart driver dispatch.</p>
        </div>
        <div className="d-flex align-items-center gap-3">
          <button 
            className="secondary-btn d-flex align-items-center gap-2"
            onClick={() => { setLoading(true); fetchRides(); fetchDrivers(); }}
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

      {loading ? (
        <div className="table-container-card p-5 text-center">
          <Car size={36} className="text-primary spin mb-2" />
          <p className="text-secondary">Loading incoming customer rides in real-time...</p>
        </div>
      ) : viewMode === 'table' ? (
        <div className="table-container-card">
          <div className="table-content">
            <table className="clean-table dispatch-table">
              <thead>
                <tr>
                  <th style={{ width: '135px' }}>REQUEST ID</th>
                  <th style={{ width: '180px' }}>PASSENGER</th>
                  <th style={{ minWidth: '220px' }}>ROUTE & DROP-OFF</th>
                  <th style={{ width: '160px' }}>SCHEDULED TIME</th>
                  <th style={{ width: '140px' }}>VEHICLE & AC</th>
                  <th style={{ width: '100px' }}>FARE</th>
                  <th style={{ width: '130px' }}>STATUS</th>
                  <th style={{ width: '130px', textAlign: 'right' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {pendingRides.length === 0 ? (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center', padding: '3.5rem 1rem' }}>
                      <CheckCircle size={38} className="text-success mb-2" />
                      <h3 style={{ fontSize: '1.15rem', fontWeight: '700' }}>No rides found</h3>
                      <p className="text-secondary">All caught up! No pending unassigned customer requests right now.</p>
                    </td>
                  </tr>
                ) : (
                  pendingRides.map(ride => (
                    <tr 
                      key={ride._id || ride.requestId} 
                      className="clickable-row"
                      onClick={() => handleSelectRide(ride)}
                    >
                      {/* REQUEST ID */}
                      <td>
                        <span className="id-pill font-mono" title={ride.rawId}>
                          {ride.displayId}
                        </span>
                      </td>

                      {/* PASSENGER */}
                      <td>
                        <div className="passenger-table-cell">
                          <div className="avatar-circle">
                            {(ride.passengerName || 'C').charAt(0).toUpperCase()}
                          </div>
                          <div className="passenger-info-col">
                            <strong className="passenger-name-text">{ride.passengerName}</strong>
                            <div className="passenger-phone-text">{ride.passengerPhone}</div>
                          </div>
                        </div>
                      </td>

                      {/* ROUTE & DROP-OFF */}
                      <td>
                        <div className="route-cell-box">
                          <div className="route-line-row">
                            <span className="dot green-dot"></span>
                            <span className="route-address-text" title={ride.pickupLocation}>
                              {ride.pickupLocation}
                            </span>
                          </div>
                          <div className="route-line-row mt-1">
                            <span className="dot red-dot"></span>
                            <span className="route-address-text font-semibold" title={ride.dropoffLocation || ride.dropLocation}>
                              {ride.dropoffLocation || ride.dropLocation}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* SCHEDULED TIME */}
                      <td>
                        <div className="d-flex align-items-center gap-1.5 text-xs text-secondary">
                          <Clock size={13} className="text-primary flex-shrink-0" />
                          <span>{ride.scheduledTime}</span>
                        </div>
                      </td>

                      {/* VEHICLE & AC */}
                      <td>
                        <div className="vehicle-pill">
                          <span>{ride.vehicle?.label || `${ride.vehicleType || 'Sedan'} • ${ride.acPreference || 'AC'}`}</span>
                        </div>
                      </td>

                      {/* FARE */}
                      <td>
                        <span className="fare-badge">{ride.fareFormatted || ride.fare}</span>
                      </td>

                      {/* STATUS */}
                      <td>
                        <span className={`status-badge ${String(ride.status).toLowerCase().includes('pending') ? 'pending' : 'approved'}`}>
                          {ride.status}
                        </span>
                      </td>

                      {/* ACTIONS */}
                      <td style={{ textAlign: 'right' }}>
                        <div className="d-flex justify-content-end align-items-center gap-1.5" onClick={e => e.stopPropagation()}>
                          <button 
                            className="icon-btn-secondary" 
                            title="View Trip Details"
                            onClick={() => setViewPassengerModal(ride)}
                          >
                            <Eye size={14} />
                          </button>
                          <button 
                            className="dispatch-action-btn"
                            onClick={() => handleSelectRide(ride)}
                          >
                            <Sparkles size={12} /> Dispatch
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
          {pendingRides.length === 0 ? (
            <div className="glass-panel p-5 text-center w-100" style={{ gridColumn: '1 / -1' }}>
              <CheckCircle size={36} className="text-success mb-2" />
              <h3>No rides found</h3>
              <p className="text-secondary">No pending unassigned customer requests right now.</p>
            </div>
          ) : (
            pendingRides.map(ride => (
              <div 
                key={ride._id || ride.requestId} 
                className="glass-panel ride-card"
                onClick={() => handleSelectRide(ride)}
              >
                <div className="ride-card-header">
                  <span className="id-pill font-mono">{ride.displayId}</span>
                  <span className={`status-badge ${String(ride.status).toLowerCase().includes('pending') ? 'pending' : 'approved'}`}>
                    {ride.status}
                  </span>
                </div>
                
                <div className="ride-card-body">
                  <div className="passenger-row mb-2">
                    <User size={15} className="text-primary" />
                    <strong>{ride.passengerName}</strong>
                    <span className="text-secondary text-xs">({ride.passengerPhone})</span>
                  </div>
                  <div className="ride-info">
                    <MapPin size={15} className="text-success" />
                    <span className="text-xs font-semibold">{ride.pickupLocation}</span>
                  </div>
                  <div className="ride-info">
                    <MapPin size={15} className="text-danger" />
                    <span className="text-xs font-semibold">{ride.dropoffLocation || ride.dropLocation}</span>
                  </div>
                  <div className="ride-info">
                    <Clock size={15} className="text-secondary" />
                    <span className="text-xs">{ride.scheduledTime}</span>
                  </div>
                  <div className="ride-info">
                    <Car size={15} className="text-secondary" />
                    <span className="text-xs">{ride.vehicle?.label || `${ride.vehicleType || 'Sedan'} • ${ride.acPreference || 'AC'}`}</span>
                  </div>
                </div>

                <div className="ride-card-footer">
                  <span className="fare-text">{ride.fareFormatted || ride.fare}</span>
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
            ))
          )}
        </div>
      )}
    </div>
  );

  // View 2: Driver Selection Screen with Smart Recommendations
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
            <p className="page-subtitle">Matching passenger <strong>{getPassengerName(selectedRide.passengerName || selectedRide.passenger)}</strong> with top compatible verified drivers</p>
          </div>
        </div>
      </div>

      {/* Top Horizontal Trip Summary Banner */}
      <div className="dispatch-trip-banner glass-panel mb-3">
        <div className="trip-banner-passenger">
          <div className="passenger-avatar-box">
            {getPassengerInitial(selectedRide.passengerName || selectedRide.passenger)}
          </div>
          <div>
            <div className="text-xs text-secondary">PASSENGER</div>
            <strong className="passenger-name-text">{getPassengerName(selectedRide.passengerName || selectedRide.passenger)}</strong>
            <div className="text-xs text-secondary mt-0.5">{selectedRide.passengerPhone || selectedRide.phone || selectedRide.passengerObj?.phone || '+92 300 1234567'}</div>
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
              <strong className="step-val">{selectedRide.dropoffLocation || selectedRide.dropLocation}</strong>
            </div>
          </div>
        </div>

        <div className="trip-banner-divider"></div>

        <div className="trip-banner-specs">
          <div className="d-flex align-items-center gap-2">
            <Clock size={15} className="text-primary" />
            <span>{selectedRide.scheduledTime || selectedRide.date}</span>
          </div>
          <div className="d-flex align-items-center gap-2 mt-1">
            <Car size={15} className="text-primary" />
            <span>{selectedRide.vehicle?.label || `${selectedRide.vehicleType || 'Sedan'} • ${selectedRide.acPreference || 'AC'}`}</span>
          </div>
        </div>

        <div className="trip-banner-fare ms-auto">
          <span className="fare-label">Estimated Fare</span>
          <span className="fare-amount font-bold text-success">{selectedRide.fareFormatted || selectedRide.fare}</span>
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
                        <Sparkles size={14} /> Confirm Assignment
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
        <div className="page-header d-flex justify-content-between align-items-center mb-4">
          <div>
            <h1 className="page-title">Driver Panel & Live Assigned Rides</h1>
            <p className="page-subtitle">
              Monitor drivers with active dispatches and view live Flutter Driver App sync.
            </p>
          </div>
          <div className="d-flex align-items-center gap-2">
            <span className="badge-pill bg-success-subtle text-success font-bold">
              ⚡ {totalAssignedTrips} Assigned Rides
            </span>
            <span className="badge-pill bg-primary-subtle text-primary font-bold">
              🚗 {activeDriversCount} Active Drivers
            </span>
          </div>
        </div>

        {/* Toolbar Filter */}
        <div className="dispatch-filters-toolbar glass-panel mb-4">
          <div className="search-input-wrapper flex-1">
            <Search size={16} className="search-icon" />
            <input 
              type="text" 
              value={driverPanelSearch}
              onChange={(e) => setDriverPanelSearch(e.target.value)}
              placeholder="Search driver by name, phone, driver code or vehicle plate..."
            />
          </div>

          <div className="toolbar-filter-item">
            <div className="radio-group toolbar-radios">
              <button 
                type="button"
                className={`radio-btn ${driverPanelFilter === 'all' ? 'active' : ''}`}
                onClick={() => setDriverPanelFilter === 'all'}
              >All ({availableDriversLocal.length})</button>
              <button 
                type="button"
                className={`radio-btn ${driverPanelFilter === 'assigned' ? 'active' : ''}`}
                onClick={() => setDriverPanelFilter('assigned')}
              >With Assigned Rides ({activeDriversCount})</button>
              <button 
                type="button"
                className={`radio-btn ${driverPanelFilter === 'available' ? 'active' : ''}`}
                onClick={() => setDriverPanelFilter('available')}
              >Available Only</button>
            </div>
          </div>
        </div>

        {/* Drivers Grid in Driver Panel */}
        <div className="driver-panel-grid">
          {filteredDriversForPanel.length === 0 ? (
            <div className="glass-panel p-5 text-center w-100">
              <Car size={36} className="text-secondary mb-2" />
              <h3>No Drivers Found</h3>
              <p className="text-secondary">No drivers match your current filter search.</p>
            </div>
          ) : (
            filteredDriversForPanel.map(driver => {
              const assignedTrips = getDriverAssignedTrips(driver);
              const isOnTrip = assignedTrips.length > 0 || driver.availability === 'On Trip';

              return (
                <div key={driver.id} className="driver-panel-card glass-panel">
                  <div className="driver-panel-card-header">
                    <div className="d-flex align-items-center gap-2.5">
                      <div className="rec-avatar-wrapper">
                        <div className="rec-driver-avatar">
                          {(driver.personalInfo?.name || 'D').charAt(0)}
                        </div>
                        <span className={`live-status-indicator ${isOnTrip ? 'status-busy' : 'status-online'}`}></span>
                      </div>
                      <div>
                        <div className="d-flex align-items-center gap-1.5">
                          <strong>{driver.personalInfo?.name}</strong>
                          <span className="driver-id-pill font-mono">{formatDriverCode(driver.id)}</span>
                        </div>
                        <div className="text-xs text-secondary mt-0.5">{driver.personalInfo?.phone}</div>
                      </div>
                    </div>

                    <span className={`availability-pill ${isOnTrip ? 'on-trip' : 'available'}`}>
                      {isOnTrip ? '● Dispatched' : '● Available'}
                    </span>
                  </div>

                  {/* Vehicle Spec */}
                  <div className="driver-panel-vehicle-info mt-3 p-2.5 rounded bg-surface">
                    <div className="d-flex justify-content-between text-xs">
                      <span><Car size={13} className="text-primary me-1" /> {driver.vehicleInfo.make} {driver.vehicleInfo.model}</span>
                      <span className="font-mono font-bold">{driver.vehicleInfo.plateNumber}</span>
                    </div>
                    <div className="d-flex gap-2 text-xs text-secondary mt-1">
                      <span>{driver.vehicleInfo.category}</span>
                      <span>•</span>
                      <span>{driver.vehicleInfo.ac ? 'AC Fitted' : 'Non-AC'}</span>
                      <span>•</span>
                      <span>{driver.vehicleInfo.seats} Seats</span>
                    </div>
                  </div>

                  {/* Active Trips for this driver */}
                  <div className="assigned-trips-section mt-3">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <span className="text-xs font-bold text-secondary">ACTIVE ASSIGNMENTS ({assignedTrips.length})</span>
                      <button 
                        className="text-xs text-primary font-bold btn-link"
                        onClick={() => setViewDriverModal(driver)}
                      >
                        <Smartphone size={12} className="me-1" /> Open Driver App View
                      </button>
                    </div>

                    {assignedTrips.length === 0 ? (
                      <div className="text-xs text-secondary p-2 text-center rounded border-dashed">
                        No active rides assigned.
                      </div>
                    ) : (
                      assignedTrips.map(trip => (
                        <div key={trip._id || trip.requestId} className="assigned-trip-pill mb-2">
                          <div className="d-flex justify-content-between align-items-center">
                            <span className="id-pill font-mono">{trip.displayId || trip.requestId}</span>
                            <span className="fare-badge sm">{trip.fareFormatted || trip.fare}</span>
                          </div>
                          <div className="text-xs font-semibold mt-1">
                            {trip.passengerName || trip.customerName} ({trip.passengerPhone || trip.customerPhone})
                          </div>
                          <div className="text-xs text-secondary mt-0.5 d-flex align-items-center gap-1">
                            <MapPin size={11} className="text-success" />
                            <span>{trip.pickupLocation} ➔ {trip.dropoffLocation || trip.dropLocation}</span>
                          </div>
                        </div>
                      ))
                    )}
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
    <div className="module-container fade-in">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="toast-notification fade-in">
          <CheckCircle size={20} className="text-success" />
          <div className="flex-1">
            <span>{toastMessage}</span>
          </div>
          {toastActionDriver && (
            <button 
              className="toast-preview-btn"
              onClick={() => setViewDriverModal(toastActionDriver)}
            >
              <Smartphone size={13} /> View in Driver App
            </button>
          )}
          <button className="toast-close" onClick={() => setToastMessage('')}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* Main Navigation Sub-Header Tabs */}
      <div className="dispatch-nav-container mb-4">
        <button 
          className={`dispatch-nav-btn ${activeMainTab === 'requests' ? 'active' : ''}`}
          onClick={() => {
            setActiveMainTab('requests');
            setSelectedRide(null);
          }}
        >
          <Car size={16} />
          <span>Passenger Requests Queue</span>
          <span className="dispatch-counter-pill">{pendingCount}</span>
        </button>

        <button 
          className={`dispatch-nav-btn ${activeMainTab === 'driver-panel' ? 'active' : ''}`}
          onClick={() => {
            setActiveMainTab('driver-panel');
            setSelectedRide(null);
          }}
        >
          <Smartphone size={16} />
          <span>Driver Panel & Live Assigned Rides</span>
          <span className="dispatch-counter-pill success-pill">{assignedCount}</span>
        </button>
      </div>

      {/* Main View Switcher */}
      {activeMainTab === 'requests' ? (
        selectedRide ? renderDriverSelection() : renderRideRequests()
      ) : (
        renderDriverPanel()
      )}

      {/* Passenger / Ride Details Modal */}
      {viewPassengerModal && (
        <div className="modal-backdrop fade-in" onClick={() => setViewPassengerModal(null)}>
          <div className="modal-dialog-card glass-panel" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="d-flex align-items-center gap-2">
                <span className="id-pill font-mono">{viewPassengerModal.displayId || viewPassengerModal.requestId}</span>
                <h3 className="modal-title">Passenger Request Details</h3>
              </div>
              <button className="close-btn" onClick={() => setViewPassengerModal(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <div className="passenger-summary-row mb-3">
                <div className="avatar-circle lg">
                  {(viewPassengerModal.passengerName || 'P').charAt(0).toUpperCase()}
                </div>
                <div>
                  <h4>{viewPassengerModal.passengerName}</h4>
                  <div className="text-secondary text-sm">{viewPassengerModal.passengerPhone}</div>
                  <div className="text-secondary text-xs">{viewPassengerModal.passengerEmail || 'Email not provided'}</div>
                </div>
                <div className="ms-auto">
                  <span className="fare-badge lg">{viewPassengerModal.fareFormatted || viewPassengerModal.fare}</span>
                </div>
              </div>

              <div className="detail-section mb-3">
                <h5 className="section-subtitle">Trip Route</h5>
                <div className="route-detail-box p-3 rounded bg-surface">
                  <div className="d-flex align-items-start gap-2 mb-2">
                    <MapPin size={16} className="text-success mt-0.5" />
                    <div>
                      <strong className="text-xs text-secondary">PICKUP</strong>
                      <div>{viewPassengerModal.pickupLocation}</div>
                    </div>
                  </div>
                  <div className="d-flex align-items-start gap-2">
                    <MapPin size={16} className="text-danger mt-0.5" />
                    <div>
                      <strong className="text-xs text-secondary">DROP-OFF</strong>
                      <div>{viewPassengerModal.dropoffLocation || viewPassengerModal.dropLocation}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="detail-section mb-3">
                <h5 className="section-subtitle">Vehicle & Comfort Requirements</h5>
                <div className="d-flex gap-3">
                  <div className="pill-badge">{viewPassengerModal.vehicleType || 'Sedan'}</div>
                  <div className="pill-badge">{viewPassengerModal.acPreference || 'AC Required'}</div>
                  <div className="pill-badge">{viewPassengerModal.seatsNeeded || 1} Passenger(s)</div>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="secondary-btn" onClick={() => setViewPassengerModal(null)}>Close</button>
              <button className="primary-btn" onClick={() => {
                const r = viewPassengerModal;
                setViewPassengerModal(null);
                handleSelectRide(r);
              }}>
                <Sparkles size={14} /> Proceed to Dispatch
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Flutter Driver Mobile App Preview Simulation Modal */}
      {viewDriverModal && (
        <div className="modal-backdrop fade-in" onClick={() => setViewDriverModal(null)}>
          <div className="phone-preview-shell" onClick={e => e.stopPropagation()}>
            <div className="phone-top-bar">
              <span className="phone-time">09:41</span>
              <div className="phone-notch"></div>
              <button className="phone-close-btn" onClick={() => setViewDriverModal(null)}>
                <X size={14} />
              </button>
            </div>

            <div className="phone-app-header">
              <div className="d-flex align-items-center gap-2">
                <div className="phone-driver-avatar">
                  {(viewDriverModal.personalInfo?.name || 'D').charAt(0)}
                </div>
                <div>
                  <h4 className="phone-driver-name">{viewDriverModal.personalInfo?.name}</h4>
                  <div className="phone-driver-status">● Live Flutter Driver App Connected</div>
                </div>
              </div>
            </div>

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
                        <span className="phone-fare font-bold">{trip.fareFormatted || trip.fare}</span>
                      </div>

                      <div className="phone-passenger-strip mt-2">
                        <User size={14} className="text-primary" />
                        <strong>{trip.passengerName || trip.customerName}</strong>
                        <a href={`tel:${trip.passengerPhone || trip.customerPhone}`} className="phone-call-btn" title="Call Passenger">
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
                            <div className="step-text">{trip.dropoffLocation || trip.dropLocation}</div>
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
