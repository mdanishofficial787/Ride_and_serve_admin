import React, { useState, useEffect } from 'react';
import { 
  Plus, Edit2, Trash2, Eye, EyeOff, Users, CheckCircle, XCircle, X, Search, Filter, Car, User, MapPin, Clock, Calendar, ChevronLeft, Sparkles
} from 'lucide-react';
import LocationAutocomplete from '../components/LocationAutocomplete';
import { BACKEND_URL } from '../utils/api';
import './RidePool.css';

const VEHICLE_MAX_SEATS = {
  'Hatchback': 3,
  'Sedan': 4,
  'Executive': 4,
  'SUV': 6,
  'Van': 7,
  'Bolan': 7,
  'Standard': 4,
  'Any': 4
};

const RidePool = () => {
  const [rides, setRides] = useState([]);
  const [activeTab, setActiveTab] = useState('Visible');
  const [searchQuery, setSearchQuery] = useState('');
  const [toastMessage, setToastMessage] = useState('');
  
  // Modals & Inline Page state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [editingRide, setEditingRide] = useState(null);
  const [viewRequestsRide, setViewRequestsRide] = useState(null);

  // Watch / Clock Picker Popover state
  const [clockPickerTarget, setClockPickerTarget] = useState(null);
  const [selectedClockHour, setSelectedClockHour] = useState('08');
  const [selectedClockMinute, setSelectedClockMinute] = useState('00');
  const [selectedClockPeriod, setSelectedClockPeriod] = useState('AM');

  const defaultManualRideForm = {
    poolName: '',
    passengerName: '',
    gender: 'Male',
    pickupLocation: 'Blue Area, Islamabad',
    dropoffLocation: 'Saddar, Rawalpindi',
    rideDate: new Date().toISOString().split('T')[0],
    leaveTimeValue: '08:00',
    leavePeriod: 'AM',
    reachTimeValue: '09:00',
    reachPeriod: 'AM',
    seatsNeeded: 1,
    vehiclePreference: 'Sedan',
    maxSeats: 4,
    acRequired: true,
    oneWay: true,
    publishToPool: true
  };

  const [manualFormData, setManualFormData] = useState(defaultManualRideForm);

  const fetchRides = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/requests`);
      const data = await res.json();
      if (data.success && data.data?.requests) {
        const mapped = data.data.requests.map(r => {
          const vCat = r.vehiclePreference || 'Sedan';
          const maxCap = r.maxSeats || VEHICLE_MAX_SEATS[vCat] || 4;
          // Dynamic Seat Capacity Control: cap bookings at physical vehicle seat limit
          const booked = Math.min(r.seatsNeeded || r.bookedSeats || 1, maxCap);
          const available = Math.max(0, maxCap - booked);
          const isFull = available === 0;

          const poolName = r.poolName || r.rideName || `${r.pickupLocation?.split(',')[0] || 'Islamabad'} - ${r.dropLocation?.split(',')[0] || 'Rawalpindi'} Pool`;

          return {
            _id: r._id,
            id: r.requestId || r._id,
            poolName,
            passenger: r.customerName || 'Passenger',
            route: `${r.pickupLocation} -> ${r.dropLocation}`,
            pickupLocation: r.pickupLocation,
            dropLocation: r.dropLocation,
            date: `${r.date || ''} ${r.timeToLeave || ''}`.trim() || 'Today',
            fare: r.fare || 'Rs. 9,500',
            vehicleCategory: vCat,
            maxSeats: maxCap,
            bookedSeats: booked,
            availableSeats: available,
            isFull,
            acRequired: r.acRequired !== false,
            status: isFull && r.status !== 'Draft' ? 'Full' : (r.status || (r.visibility === 'VISIBLE' ? 'Visible' : 'Draft')),
            assignedTo: r.assignedDriverDetails?.name || null,
            driverRequests: r.driverRequests || []
          };
        });
        setRides(mapped);
      }
    } catch (err) {
      console.error('Failed to fetch ride pool:', err);
    }
  };

  useEffect(() => {
    fetchRides();
  }, []);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  const handleToggleVisibility = async (id, currentStatus) => {
    const newStatus = currentStatus === 'Visible' ? 'Draft' : 'Visible';
    const newVisibility = newStatus === 'Visible' ? 'VISIBLE' : 'HIDDEN';

    try {
      await fetch(`${BACKEND_URL}/api/requests/${id}/visibility`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visibility: newVisibility })
      });
      fetchRides();
    } catch (err) {
      console.error(err);
    }

    setRides(prev => prev.map(r => r.id === id ? { ...r, status: newStatus } : r));
    showToast(`Ride moved to ${newStatus === 'Visible' ? 'Active Pool' : 'Drafts'}`);
  };

  const handleDelete = async (id, _id) => {
    if (!window.confirm('Are you sure you want to remove this ride from the pool?')) return;
    try {
      const targetId = _id || id;
      await fetch(`${BACKEND_URL}/api/requests/${targetId}`, {
        method: 'DELETE'
      });
      showToast('✓ Ride successfully removed from pool');
      fetchRides();
    } catch (err) {
      console.error('Failed to delete ride:', err);
      setRides(prev => prev.filter(r => r.id !== id && r._id !== id));
      showToast('Ride removed from pool');
    }
  };

  const openForm = (ride = null) => {
    if (ride) {
      setEditingRide(ride);
      const parts = (ride.route || '').split(' -> ');
      let timeVal = '08:00';
      let period = 'AM';
      if (ride.date && ride.date.includes(' ')) {
        const timePart = ride.date.substring(ride.date.indexOf(' ') + 1);
        const sub = timePart.split(' ');
        if (sub[0]) timeVal = sub[0];
        if (sub[1]) period = sub[1];
      }
      const vCat = ride.vehicleCategory || 'Sedan';
      const maxCap = ride.maxSeats || VEHICLE_MAX_SEATS[vCat] || 4;
      setManualFormData({
        poolName: ride.poolName || '',
        passengerName: ride.passenger || 'Guest Passenger',
        gender: 'Male',
        pickupLocation: parts[0] || 'Blue Area, Islamabad',
        dropoffLocation: parts[1] || 'Saddar, Rawalpindi',
        rideDate: ride.date ? ride.date.split(' ')[0] : new Date().toISOString().split('T')[0],
        leaveTimeValue: timeVal,
        leavePeriod: period,
        reachTimeValue: '09:00',
        reachPeriod: 'AM',
        seatsNeeded: Math.min(ride.bookedSeats || 1, maxCap),
        vehiclePreference: vCat,
        maxSeats: maxCap,
        acRequired: ride.acRequired !== false,
        oneWay: true,
        publishToPool: ride.status === 'Visible'
      });
    } else {
      setEditingRide(null);
      setManualFormData(defaultManualRideForm);
    }
    setIsFormOpen(true);
  };

  const saveRide = async (e) => {
    e.preventDefault();
    const routeStr = `${manualFormData.pickupLocation} -> ${manualFormData.dropoffLocation}`;
    const leaveTimeStr = `${manualFormData.leaveTimeValue || '08:00'} ${manualFormData.leavePeriod || 'AM'}`;
    const reachTimeStr = `${manualFormData.reachTimeValue || '09:00'} ${manualFormData.reachPeriod || 'AM'}`;
    const initialStatus = manualFormData.publishToPool ? 'Visible' : 'Draft';
    const maxCap = VEHICLE_MAX_SEATS[manualFormData.vehiclePreference] || 4;
    // Strict clamp: bookings cannot exceed physical available seats
    const clampedSeats = Math.min(Math.max(1, parseInt(manualFormData.seatsNeeded, 10) || 1), maxCap);
    const finalPoolName = manualFormData.poolName.trim() || `${manualFormData.pickupLocation.split(',')[0]} - ${manualFormData.dropoffLocation.split(',')[0]} Express Pool`;

    try {
      if (editingRide) {
        await fetch(`${BACKEND_URL}/api/requests/${editingRide._id || editingRide.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            poolName: finalPoolName,
            customerName: manualFormData.passengerName,
            pickupLocation: manualFormData.pickupLocation,
            dropLocation: manualFormData.dropoffLocation,
            vehiclePreference: manualFormData.vehiclePreference,
            seatsNeeded: clampedSeats,
            maxSeats: maxCap,
            status: initialStatus
          })
        });
        showToast(`✓ Pool "${finalPoolName}" updated successfully!`);
      } else {
        await fetch(`${BACKEND_URL}/api/requests`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            poolName: finalPoolName,
            customerName: manualFormData.passengerName,
            pickupLocation: manualFormData.pickupLocation,
            dropLocation: manualFormData.dropoffLocation,
            date: manualFormData.rideDate,
            timeToLeave: leaveTimeStr,
            timeToReach: reachTimeStr,
            seatsNeeded: clampedSeats,
            maxSeats: maxCap,
            vehiclePreference: manualFormData.vehiclePreference,
            acRequired: manualFormData.acRequired,
            oneWay: manualFormData.oneWay,
            publishToPool: manualFormData.publishToPool
          })
        });
        showToast(`✓ Pool "${finalPoolName}" added to Active Ride Pool!`);
      }
      fetchRides();
    } catch (err) {
      console.error('Failed to save ride:', err);
    }

    setActiveTab(initialStatus === 'Visible' ? 'Visible' : 'All');
    setIsFormOpen(false);
  };

  const acceptDriver = async (driverReq) => {
    if (!viewRequestsRide) return;
    try {
      const targetReqId = viewRequestsRide._id || viewRequestsRide.id;
      // 1. Hit backend assignment API
      const res = await fetch(`${BACKEND_URL}/api/assignments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: targetReqId,
          driverId: driverReq.driverId,
          fare: driverReq.proposedFare || viewRequestsRide.fare,
          notes: `Assigned via Ride Pool driver bid request (${driverReq.driverName}).`
        })
      });

      const data = await res.json();
      if (data.success) {
        showToast(`✓ Driver ${driverReq.driverName} successfully assigned to ride!`);
      } else {
        // Fallback update direct to request
        await fetch(`${BACKEND_URL}/api/requests/${targetReqId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: 'Assigned',
            assignedDriverDetails: {
              driverCode: driverReq.driverId,
              name: driverReq.driverName,
              vehicle: driverReq.vehicle,
              rating: driverReq.rating
            }
          })
        });
        showToast(`✓ ${driverReq.driverName} assigned to ride`);
      }
      fetchRides();
    } catch (err) {
      console.error('Failed to assign driver:', err);
      setRides(prev => prev.map(r => r.id === viewRequestsRide.id ? { ...r, status: 'Assigned', assignedTo: `${driverReq.driverName} (${driverReq.driverId})` } : r));
      showToast(`✓ ${driverReq.driverName} assigned to ride`);
    }
    setViewRequestsRide(null);
  };

  const filteredRides = (() => {
    let result = rides;
    if (activeTab === 'DriverRequests') {
      result = result.filter(r => r.driverRequests && r.driverRequests.length > 0);
    } else if (activeTab !== 'All') {
      result = result.filter(r => r.status === activeTab);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(r => 
        (r.id && r.id.toLowerCase().includes(q)) ||
        (r.route && r.route.toLowerCase().includes(q)) ||
        (r.passenger && r.passenger.toLowerCase().includes(q))
      );
    }

    return result;
  })();


  // KPI Data
  const totalRides = rides.length;
  const availableRides = rides.filter(r => r.status === 'Visible').length;
  const driverRequestsCount = rides.reduce((acc, ride) => acc + ride.driverRequests.length, 0);
  const assignedRides = rides.filter(r => r.status === 'Assigned').length;
  const cancelledRides = 0; // Mock

  const renderDashboard = () => (
    <div className="ride-pool-container fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Ride Pool</h1>
          <p className="page-subtitle">Manage unassigned rides, toggle visibility, and monitor driver bids.</p>
        </div>
        <div className="header-actions-group">
          <div className="search-input-wrap">
            <Search size={16} />
            <input 
              type="text" 
              placeholder="Search rides..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="position-relative">
            <button className="secondary-btn" onClick={() => setIsFilterOpen(!isFilterOpen)}>
              <Filter size={16} />
              <span>Filter</span>
            </button>
            {isFilterOpen && (
              <div className="filter-dropdown">
                <div className="filter-dropdown-header">Filter by Status</div>
                <div className="filter-option" onClick={() => { setActiveTab('Visible'); setIsFilterOpen(false); }}>Available (Visible)</div>
                <div className="filter-option" onClick={() => { setActiveTab('Draft'); setIsFilterOpen(false); }}>Draft (Hidden)</div>
                <div className="filter-option" onClick={() => { setActiveTab('Assigned'); setIsFilterOpen(false); }}>Assigned</div>
                <div className="filter-dropdown-header mt-2">Filter by Category</div>
                <div className="filter-option" onClick={() => setIsFilterOpen(false)}>Executive</div>
                <div className="filter-option" onClick={() => setIsFilterOpen(false)}>Sedan</div>
              </div>
            )}
          </div>
          <button className="primary-btn" onClick={() => openForm()}>
            <Plus size={16} />
            <span>New Ride</span>
          </button>
        </div>
      </div>

      <div className="driver-kpi-grid">
        <div className="driver-kpi-card" onClick={() => setActiveTab('All')}>
          <div className="kpi-content">
            <div className="kpi-label">Total Rides</div>
            <div className="kpi-value text-primary">{totalRides}</div>
          </div>
          <div className="kpi-icon-soft bg-primary-light text-primary">
            <Car size={20} />
          </div>
        </div>

        <div className={`driver-kpi-card ${activeTab === 'Visible' ? 'active' : ''}`} onClick={() => setActiveTab('Visible')}>
          <div className="kpi-content">
            <div className="kpi-label">Available</div>
            <div className="kpi-value text-success">{availableRides}</div>
          </div>
          <div className="kpi-icon-soft bg-success-light text-success">
            <Eye size={20} />
          </div>
        </div>

        <div className={`driver-kpi-card ${activeTab === 'DriverRequests' ? 'active' : ''}`} onClick={() => setActiveTab('DriverRequests')}>
          <div className="kpi-content">
            <div className="kpi-label">Driver Requests</div>
            <div className="kpi-value text-warning">{driverRequestsCount}</div>
          </div>
          <div className="kpi-icon-soft bg-warning-light text-warning">
            <Users size={20} />
          </div>
        </div>

        <div className={`driver-kpi-card ${activeTab === 'Assigned' ? 'active' : ''}`} onClick={() => setActiveTab('Assigned')}>
          <div className="kpi-content">
            <div className="kpi-label">Assigned</div>
            <div className="kpi-value text-primary">{assignedRides}</div>
          </div>
          <div className="kpi-icon-soft bg-primary-light text-primary">
            <CheckCircle size={20} />
          </div>
        </div>

        <div className="driver-kpi-card">
          <div className="kpi-content">
            <div className="kpi-label">Cancelled</div>
            <div className="kpi-value text-danger">{cancelledRides}</div>
          </div>
          <div className="kpi-icon-soft bg-danger-light text-danger">
            <XCircle size={20} />
          </div>
        </div>
      </div>

      <div className="table-container-card mt-4">
        <div className="table-header-title">
          <h4>
            {activeTab === 'All' ? 'All Rides' :
             activeTab === 'Visible' ? 'Available Rides Queue' :
             activeTab === 'DriverRequests' ? 'Rides with Driver Requests' :
             `${activeTab} Rides Queue`}
          </h4>
        </div>
        
        <div className="table-content">
          <table className="clean-table">
            <colgroup>
              <col style={{width: '210px'}} />
              <col style={{width: '150px'}} />
              <col style={{width: '140px'}} />
              <col style={{width: '160px'}} />
              <col style={{width: '130px'}} />
              <col style={{width: '100px'}} />
              <col style={{width: '60px'}} />
              <col style={{width: '90px'}} />
            </colgroup>
            <thead>
              <tr>
                <th>Ride / Pool Name</th>
                <th>Passenger / Host</th>
                <th>Vehicle & AC</th>
                <th>Seat Capacity</th>
                <th>Date & Time</th>
                <th>Status</th>
                <th>Req</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRides.length === 0 ? (
                <tr>
                  <td colSpan="8" className="text-center py-4 text-secondary">
                    No rides in the {activeTab.toLowerCase()} pool.
                  </td>
                </tr>
              ) : (
                filteredRides.map(ride => {
                  const occupancyPercent = Math.min(100, Math.round((ride.bookedSeats / ride.maxSeats) * 100));
                  return (
                    <tr key={ride.id}>
                      <td>
                        <div className="pool-name-cell">
                          <span className="pool-title">{ride.poolName}</span>
                          <span className="pool-route-subtext">{ride.route}</span>
                        </div>
                      </td>
                      <td>
                        <div className="passenger-cell">
                          <span className="fw-600">{ride.passenger}</span>
                          <span className="text-xs text-secondary">{ride.id}</span>
                        </div>
                      </td>
                      <td>
                        <div className="vehicle-cell">
                          <span className="badge-vehicle">{ride.vehicleCategory}</span>
                          {ride.acRequired && <span className="badge-ac">AC</span>}
                        </div>
                      </td>
                      <td>
                        <div className="seat-capacity-cell">
                          <div className="seat-bar-wrapper">
                            <div 
                              className={`seat-bar-fill ${ride.isFull ? 'full' : ''}`}
                              style={{ width: `${occupancyPercent}%` }}
                            ></div>
                          </div>
                          <div className="seat-stats-text">
                            <strong className={ride.isFull ? 'text-danger' : 'text-primary'}>
                              {ride.bookedSeats}/{ride.maxSeats} Booked
                            </strong>
                            <span className="text-secondary text-xs">
                              ({ride.availableSeats === 0 ? 'Full' : `${ride.availableSeats} Left`})
                            </span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="date-time-text">{ride.date}</span>
                      </td>
                      <td>
                        {ride.status === 'Assigned' ? (
                          <span className="badge bg-success-light text-success">Assigned</span>
                        ) : ride.isFull ? (
                          <span className="badge bg-danger-light text-danger">Pool Full</span>
                        ) : (
                          <button 
                            className={`visibility-toggle-btn ${ride.status === 'Visible' ? 'active' : ''}`}
                            onClick={() => handleToggleVisibility(ride.id, ride.status)}
                            title="Toggle Visibility"
                          >
                            {ride.status === 'Visible' ? (
                              <><Eye size={14}/> <span>Visible</span></>
                            ) : (
                              <><EyeOff size={14}/> <span>Hidden</span></>
                            )}
                          </button>
                        )}
                      </td>
                      <td>
                        {ride.status === 'Visible' ? (
                          <button className="badge-btn" onClick={() => setViewRequestsRide(ride)}>
                            {ride.driverRequests.length}
                          </button>
                        ) : (
                          <span>-</span>
                        )}
                      </td>
                      <td>
                        <div className="table-actions">
                          {ride.status !== 'Assigned' && (
                            <button className="icon-btn-sm" onClick={() => openForm(ride)} title="Edit Pool">
                              <Edit2 size={16} />
                            </button>
                          )}
                          <button className="icon-btn-sm text-danger" onClick={() => handleDelete(ride.id, ride._id)} title="Delete Pool">
                            <Trash2 size={16} />
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
    </div>
  );

  const openClockPicker = (target) => {
    setClockPickerTarget(target);
    const currentTime = target === 'leave' ? manualFormData.leaveTimeValue : manualFormData.reachTimeValue;
    const currentPeriod = target === 'leave' ? manualFormData.leavePeriod : manualFormData.reachPeriod;
    if (currentTime && currentTime.includes(':')) {
      const [h, m] = currentTime.split(':');
      setSelectedClockHour(h.padStart(2, '0'));
      setSelectedClockMinute(m.padStart(2, '0'));
    }
    setSelectedClockPeriod(currentPeriod || 'AM');
  };

  const applyClockPicker = () => {
    const formattedTime = `${selectedClockHour}:${selectedClockMinute}`;
    if (clockPickerTarget === 'leave') {
      setManualFormData(prev => ({
        ...prev,
        leaveTimeValue: formattedTime,
        leavePeriod: selectedClockPeriod
      }));
    } else if (clockPickerTarget === 'reach') {
      setManualFormData(prev => ({
        ...prev,
        reachTimeValue: formattedTime,
        reachPeriod: selectedClockPeriod
      }));
    }
    setClockPickerTarget(null);
  };

  // Full-Width Dashboard View for Create Manual Ride
  const renderCreateManualRideView = () => (
    <div className="manual-ride-fullpage-view fade-in">
      {/* Top Header with Back Navigation */}
      <div className="manual-view-header">
        <button type="button" className="back-btn" onClick={() => setIsFormOpen(false)}>
          <ChevronLeft size={18} />
          Back to Ride Pool
        </button>
        <div className="mt-3">
          <h1 className="page-title">{editingRide ? 'Edit Manual Ride' : 'Create Manual Ride'}</h1>
          <p className="page-subtitle">Configure customer requirements, route schedule, and pool visibility parameters.</p>
        </div>
      </div>

      <form onSubmit={saveRide} className="manual-view-form-grid">
        {/* Left Column: Customer & Route */}
        <div className="manual-view-column">
          {/* Card 1: Pool & Customer Details */}
          <div className="manual-form-card">
            <div className="manual-card-header">
              <Sparkles size={18} className="manual-section-icon text-primary" />
              <span>Pool & Customer Details</span>
            </div>
            <div className="manual-card-content">
              <div className="form-group mb-3">
                <label>RIDE / POOL NAME <span className="text-danger">*</span></label>
                <input
                  type="text"
                  required
                  className="form-input"
                  placeholder="e.g. Twin Cities Commute Express, Blue Area Route Pool"
                  value={manualFormData.poolName}
                  onChange={e => setManualFormData({ ...manualFormData, poolName: e.target.value })}
                />
              </div>
              <div className="form-group mb-3">
                <label>PASSENGER / HOST NAME <span className="text-danger">*</span></label>
                <input
                  type="text"
                  required
                  className="form-input"
                  placeholder="e.g. Jane Doe"
                  value={manualFormData.passengerName}
                  onChange={e => setManualFormData({ ...manualFormData, passengerName: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>GENDER</label>
                <select
                  className="form-input"
                  value={manualFormData.gender}
                  onChange={e => setManualFormData({ ...manualFormData, gender: e.target.value })}
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>
          </div>

          {/* Card 2: Route Information (LocationIQ Autocomplete) */}
          <div className="manual-form-card">
            <div className="manual-card-header">
              <MapPin size={18} className="manual-section-icon" />
              <span>Route Information (Live Map Suggestions)</span>
            </div>
            <div className="manual-card-content">
              <div className="form-group mb-3">
                <label>PICKUP LOCATION <span className="text-danger">*</span></label>
                <LocationAutocomplete
                  value={manualFormData.pickupLocation}
                  onChange={val => setManualFormData({ ...manualFormData, pickupLocation: val })}
                  placeholder="Search pickup location (e.g. Blue Area, G-11, Islamabad)..."
                />
              </div>
              <div className="form-group">
                <label>DROP-OFF LOCATION <span className="text-danger">*</span></label>
                <LocationAutocomplete
                  value={manualFormData.dropoffLocation}
                  onChange={val => setManualFormData({ ...manualFormData, dropoffLocation: val })}
                  placeholder="Search drop-off location (e.g. Saddar, Rawalpindi, Lahore)..."
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Schedule & Requirements & Publish */}
        <div className="manual-view-column">
          {/* Card 3: Schedule with Interactive Watch Trigger */}
          <div className="manual-form-card">
            <div className="manual-card-header">
              <Clock size={18} className="manual-section-icon" />
              <span>Schedule</span>
            </div>
            <div className="manual-card-content">
              <div className="form-group mb-3">
                <label>RIDE DATE <span className="text-secondary text-xs">(LEAVE BLANK FOR MONTHLY)</span></label>
                <div className="manual-date-input-wrap">
                  <input
                    type="text"
                    className="form-input manual-date-field"
                    placeholder="30/08/2026"
                    value={manualFormData.rideDate}
                    onChange={e => setManualFormData({ ...manualFormData, rideDate: e.target.value })}
                  />
                  <Calendar size={18} className="manual-date-icon" />
                </div>
              </div>

              <div className="form-grid-2col">
                {/* Time to Leave */}
                <div className="form-group">
                  <label>TIME TO LEAVE <span className="text-danger">*</span></label>
                  <div className="manual-time-picker-box">
                    <button 
                      type="button" 
                      className="watch-clock-btn" 
                      title="Open Watch Clock Picker"
                      onClick={() => openClockPicker('leave')}
                    >
                      <Clock size={16} />
                    </button>
                    <input
                      type="text"
                      required
                      className="time-value-input"
                      placeholder="08:00"
                      value={manualFormData.leaveTimeValue}
                      onChange={e => setManualFormData({ ...manualFormData, leaveTimeValue: e.target.value })}
                    />
                    <div className="am-pm-segmented-switch">
                      <button
                        type="button"
                        className={`period-btn ${manualFormData.leavePeriod === 'AM' ? 'active' : ''}`}
                        onClick={() => setManualFormData({ ...manualFormData, leavePeriod: 'AM' })}
                      >
                        AM
                      </button>
                      <button
                        type="button"
                        className={`period-btn ${manualFormData.leavePeriod === 'PM' ? 'active' : ''}`}
                        onClick={() => setManualFormData({ ...manualFormData, leavePeriod: 'PM' })}
                      >
                        PM
                      </button>
                    </div>
                  </div>
                </div>

                {/* Time to Reach */}
                <div className="form-group">
                  <label>TIME TO REACH <span className="text-danger">*</span></label>
                  <div className="manual-time-picker-box">
                    <button 
                      type="button" 
                      className="watch-clock-btn" 
                      title="Open Watch Clock Picker"
                      onClick={() => openClockPicker('reach')}
                    >
                      <Clock size={16} />
                    </button>
                    <input
                      type="text"
                      required
                      className="time-value-input"
                      placeholder="09:00"
                      value={manualFormData.reachTimeValue}
                      onChange={e => setManualFormData({ ...manualFormData, reachTimeValue: e.target.value })}
                    />
                    <div className="am-pm-segmented-switch">
                      <button
                        type="button"
                        className={`period-btn ${manualFormData.reachPeriod === 'AM' ? 'active' : ''}`}
                        onClick={() => setManualFormData({ ...manualFormData, reachPeriod: 'AM' })}
                      >
                        AM
                      </button>
                      <button
                        type="button"
                        className={`period-btn ${manualFormData.reachPeriod === 'PM' ? 'active' : ''}`}
                        onClick={() => setManualFormData({ ...manualFormData, reachPeriod: 'PM' })}
                      >
                        PM
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Card 4: Ride Requirements & Dynamic Seat Capacity Control */}
          <div className="manual-form-card">
            <div className="manual-card-header">
              <Car size={18} className="manual-section-icon" />
              <span>Ride Requirements & Seat Capacity</span>
            </div>
            <div className="manual-card-content">
              <div className="form-grid-2col mb-3">
                <div className="form-group">
                  <label>VEHICLE PREFERENCE</label>
                  <select
                    className="form-input"
                    value={manualFormData.vehiclePreference}
                    onChange={e => {
                      const vPref = e.target.value;
                      const maxCap = VEHICLE_MAX_SEATS[vPref] || 4;
                      setManualFormData(prev => ({
                        ...prev,
                        vehiclePreference: vPref,
                        maxSeats: maxCap,
                        seatsNeeded: Math.min(prev.seatsNeeded, maxCap)
                      }));
                    }}
                  >
                    <option value="Sedan">Sedan (Max 4 Seats)</option>
                    <option value="Hatchback">Hatchback (Max 3 Seats)</option>
                    <option value="SUV">SUV (Max 6 Seats)</option>
                    <option value="Van">Van / Carry Bolan (Max 7 Seats)</option>
                    <option value="Executive">Executive (Max 4 Seats)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>SEATS BOOKED / NEEDED <span className="text-xs text-primary">(Max: {VEHICLE_MAX_SEATS[manualFormData.vehiclePreference] || 4})</span></label>
                  <input
                    type="number"
                    min="1"
                    max={VEHICLE_MAX_SEATS[manualFormData.vehiclePreference] || 4}
                    className="form-input"
                    value={manualFormData.seatsNeeded}
                    onChange={e => {
                      const maxCap = VEHICLE_MAX_SEATS[manualFormData.vehiclePreference] || 4;
                      const entered = parseInt(e.target.value, 10) || 1;
                      // Strictly cap bookings at physical vehicle seat limit
                      const clamped = Math.min(Math.max(1, entered), maxCap);
                      setManualFormData({ ...manualFormData, seatsNeeded: clamped });
                    }}
                  />
                </div>
              </div>

              {/* Dynamic Seat Bar Preview */}
              <div className="seat-preview-box mb-3">
                <div className="d-flex justify-content-between align-items-center mb-1">
                  <span className="text-xs font-semibold">Live Seat Availability Preview:</span>
                  <span className="text-xs font-bold text-primary">
                    {manualFormData.seatsNeeded} / {VEHICLE_MAX_SEATS[manualFormData.vehiclePreference] || 4} Seats ({Math.max(0, (VEHICLE_MAX_SEATS[manualFormData.vehiclePreference] || 4) - manualFormData.seatsNeeded)} Available)
                  </span>
                </div>
                <div className="seat-bar-wrapper">
                  <div 
                    className="seat-bar-fill" 
                    style={{ width: `${Math.min(100, Math.round((manualFormData.seatsNeeded / (VEHICLE_MAX_SEATS[manualFormData.vehiclePreference] || 4)) * 100))}%` }}
                  ></div>
                </div>
              </div>

              {/* Toggles Row */}
              <div className="form-grid-2col">
                <div 
                  className={`manual-toggle-pill ${manualFormData.acRequired ? 'active' : ''}`}
                  onClick={() => setManualFormData({ ...manualFormData, acRequired: !manualFormData.acRequired })}
                >
                  <div className={`switch-knob ${manualFormData.acRequired ? 'on' : ''}`}></div>
                  <span>AC Required</span>
                </div>

                <div 
                  className={`manual-toggle-pill ${manualFormData.oneWay ? 'active' : ''}`}
                  onClick={() => setManualFormData({ ...manualFormData, oneWay: !manualFormData.oneWay })}
                >
                  <div className={`switch-knob ${manualFormData.oneWay ? 'on' : ''}`}></div>
                  <span>One Way</span>
                </div>
              </div>
            </div>
          </div>

          {/* Card 5: Publish to Driver Pool */}
          <div className="manual-form-card publish-card">
            <div className="publish-card-left">
              <h4>Publish to Driver Pool</h4>
              <p>Allow verified drivers to review and bid on this ride</p>
            </div>
            <div 
              className={`main-toggle-switch ${manualFormData.publishToPool ? 'on' : ''}`}
              onClick={() => setManualFormData({ ...manualFormData, publishToPool: !manualFormData.publishToPool })}
            >
              <div className="toggle-slider"></div>
            </div>
          </div>
        </div>

        {/* Full-Width Footer Actions Bar */}
        <div className="manual-view-footer-bar">
          <button 
            type="button" 
            className="manual-cancel-btn" 
            onClick={() => setIsFormOpen(false)}
          >
            Cancel
          </button>
          <button 
            type="submit" 
            className="manual-submit-btn"
          >
            Create Ride Request
          </button>
        </div>
      </form>

      {/* =========================================================================
          INTERACTIVE WATCH / CLOCK TIME PICKER MODAL
          ========================================================================= */}
      {clockPickerTarget && (
        <div className="modal-overlay fade-in" style={{ zIndex: 1200 }} onClick={() => setClockPickerTarget(null)}>
          <div className="glass-panel modal-content watch-clock-modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="watch-header-title">
                <Clock size={20} className="text-primary" />
                <h3>Select Time ({clockPickerTarget === 'leave' ? 'Departure' : 'Arrival'})</h3>
              </div>
              <button type="button" className="icon-btn" onClick={() => setClockPickerTarget(null)}>
                <X size={20} />
              </button>
            </div>

            <div className="watch-clock-body">
              {/* Watch Display */}
              <div className="watch-display-badge">
                <span className="watch-digits">{selectedClockHour}:{selectedClockMinute}</span>
                <span className="watch-period-tag">{selectedClockPeriod}</span>
              </div>

              {/* AM / PM Segment */}
              <div className="watch-period-toggle">
                <button
                  type="button"
                  className={`watch-toggle-btn ${selectedClockPeriod === 'AM' ? 'active' : ''}`}
                  onClick={() => setSelectedClockPeriod('AM')}
                >
                  AM
                </button>
                <button
                  type="button"
                  className={`watch-toggle-btn ${selectedClockPeriod === 'PM' ? 'active' : ''}`}
                  onClick={() => setSelectedClockPeriod('PM')}
                >
                  PM
                </button>
              </div>

              {/* Hours Grid */}
              <div className="watch-section-block">
                <span className="watch-section-label">SELECT HOUR</span>
                <div className="watch-numbers-grid">
                  {['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'].map(h => (
                    <button
                      key={h}
                      type="button"
                      className={`watch-num-btn ${selectedClockHour === h ? 'active' : ''}`}
                      onClick={() => setSelectedClockHour(h)}
                    >
                      {h}
                    </button>
                  ))}
                </div>
              </div>

              {/* Minutes Grid */}
              <div className="watch-section-block mt-3">
                <span className="watch-section-label">SELECT MINUTE</span>
                <div className="watch-numbers-grid minutes">
                  {['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'].map(m => (
                    <button
                      key={m}
                      type="button"
                      className={`watch-num-btn ${selectedClockMinute === m ? 'active' : ''}`}
                      onClick={() => setSelectedClockMinute(m)}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="modal-footer watch-footer">
              <button type="button" className="cancel-btn" onClick={() => setClockPickerTarget(null)}>
                Cancel
              </button>
              <button type="button" className="primary-btn" onClick={applyClockPicker}>
                Set Time
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // View Requests Modal
  const renderRequestsModal = () => (
    <div className="modal-overlay fade-in">
      <div className="glass-panel modal-content lg">
        <div className="modal-header">
          <div>
            <h2>Driver Requests / Bids</h2>
            <p className="text-secondary">{viewRequestsRide.route} • ID: {viewRequestsRide.id}</p>
          </div>
          <button className="icon-btn" onClick={() => setViewRequestsRide(null)}><X size={20} /></button>
        </div>
        
        <div className="modal-body p-0">
          {viewRequestsRide.driverRequests.length === 0 ? (
            <div className="empty-state">
              <Users size={32} className="text-secondary mb-3 mx-auto" />
              <p>No drivers have requested this ride yet.</p>
            </div>
          ) : (
            <div className="requests-list">
              {viewRequestsRide.driverRequests.map(req => (
                <div key={req.driverId} className="request-card">
                  <div className="req-driver-info">
                    <div className="avatar-sm">{req.driverName?.charAt(0) || 'D'}</div>
                    <div>
                      <div className="d-flex align-items-center gap-2">
                        <h4>{req.driverName}</h4>
                        <span className="rating-badge">⭐ {req.rating || '4.9'}</span>
                        {req.matchScore && <span className="badge bg-success-light text-success font-semibold text-xs">{req.matchScore} Match</span>}
                      </div>
                      <p className="text-secondary text-xs">{req.vehicle || 'Standard Vehicle'}</p>
                      {req.routeMatch && <p className="text-xs text-primary mt-1">🛣️ {req.routeMatch}</p>}
                    </div>
                  </div>
                  <div className="req-bid text-right">
                    <p className="text-secondary sm">{req.timeRequested || 'Just now'}</p>
                    <p className="fw-600 text-primary">{req.proposedFare || viewRequestsRide.fare}</p>
                  </div>
                  <div className="req-action">
                    <button className="primary-btn sm px-3" onClick={() => acceptDriver(req)}>
                      <CheckCircle size={14} />
                      <span>Select & Assign</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="module-container fade-in">
      {toastMessage && (
        <div className="toast-notification fade-in">
          <CheckCircle size={20} />
          {toastMessage}
        </div>
      )}
      
      {isFormOpen ? (
        renderCreateManualRideView()
      ) : (
        renderDashboard()
      )}

      {viewRequestsRide && renderRequestsModal()}
    </div>
  );
};

export default RidePool;

