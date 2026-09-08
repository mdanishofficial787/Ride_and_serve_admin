import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Sparkles, CheckCircle, Car, User, Phone, MapPin, Clock, 
  ArrowRight, ShieldCheck, RefreshCw, AlertCircle 
} from 'lucide-react';
import io from 'socket.io-client';
import { BACKEND_URL } from '../utils/api';
import './RideDispatch.css';

// Base URL: prioritizes http://192.168.88.132:3000, fallback to current backend URL
const BASE_URL = 'http://192.168.88.132:3000';

export default function AdminRideDispatch() {
  const [pendingRides, setPendingRides] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [selectedDriverMap, setSelectedDriverMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState('');
  const [actionLoadingMap, setActionLoadingMap] = useState({});

  useEffect(() => {
    fetchPendingRides();
    fetchDrivers();

    const socket = io(BASE_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true
    });

    socket.on('connect', () => {
      socket.emit('join-admin');
    });

    socket.on('new-ride', (newRide) => {
      fetchPendingRides();
    });

    socket.on('ride-dispatched', (updated) => {
      fetchPendingRides();
    });

    socket.on('ride-update', () => {
      fetchPendingRides();
    });

    const interval = setInterval(fetchPendingRides, 3000); // 3s live polling
    return () => {
      socket.disconnect();
      clearInterval(interval);
    };
  }, []);



  // 1. Fetch pending customer requests
  const fetchPendingRides = async () => {
    try {
      // Try BASE_URL first, fallback to BACKEND_URL/api/ride/pending or /api/requests
      let response = await axios.get(`${BASE_URL}/api/ride/pending`, { timeout: 1500 }).catch(() => null);
      
      if (!response || !response.data?.success) {
        response = await axios.get(`${BACKEND_URL}/api/ride/pending`).catch(() => null);
      }
      if (!response || !response.data?.success) {
        response = await axios.get(`${BACKEND_URL}/api/requests`).catch(() => null);
      }

      if (response && response.data) {
        const rawList = response.data.data?.rides || response.data.data?.requests || (Array.isArray(response.data.data) ? response.data.data : (Array.isArray(response.data) ? response.data : []));
        
        // Filter only unassigned pending rides
        const unassigned = rawList.filter(r => r.status !== 'ASSIGNED' && !String(r.status).startsWith('Dispatched'));
        setPendingRides(unassigned);
      }
    } catch (error) {
      console.error("Error fetching pending rides:", error);
    } finally {
      setLoading(false);
    }
  };

  // 2. Fetch available drivers to populate the dropdown
  const fetchDrivers = async () => {
    try {
      const token = localStorage.getItem('admin_token');
      let response = await axios.get(`${BASE_URL}/driver`, { timeout: 1500 }).catch(() => null);
      
      if (!response || !response.data) {
        response = await axios.get(`${BACKEND_URL}/admin/driver`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        }).catch(() => null);
      }
      if (!response || !response.data) {
        response = await axios.get(`${BACKEND_URL}/api/drivers`).catch(() => null);
      }

      if (response && response.data) {
        const driverList = response.data.drivers || response.data.data?.drivers || (Array.isArray(response.data.data) ? response.data.data : []);
        setDrivers(driverList);
      }
    } catch (error) {
      console.error("Error fetching drivers:", error);
    }
  };

  // 3. Assign the driver to the ride
  const handleAssignDriver = async (rideId) => {
    const driverId = selectedDriverMap[rideId];
    if (!driverId) {
      alert("Please select a driver from the dropdown first!");
      return;
    }

    try {
      setActionLoadingMap(prev => ({ ...prev, [rideId]: true }));

      // Call POST /api/ride/assign
      let response = await axios.post(`${BASE_URL}/api/ride/assign`, {
        rideId: rideId,
        driverId: driverId
      }, { timeout: 2000 }).catch(() => null);

      if (!response || !response.data?.success) {
        response = await axios.post(`${BACKEND_URL}/api/ride/assign`, {
          rideId: rideId,
          driverId: driverId
        }).catch(() => null);
      }

      if (response && response.data?.success) {
        setToastMessage(`✓ Driver assigned successfully to ride! Real-time Flutter dispatch triggered.`);
        setTimeout(() => setToastMessage(''), 4000);
        
        // Remove the assigned ride from the pending list
        setPendingRides(prev => prev.filter(ride => (ride._id !== rideId && ride.requestId !== rideId)));
      } else {
        alert("Failed to assign driver. Please check backend connection.");
      }
    } catch (error) {
      console.error("Error assigning driver:", error);
      alert("Failed to assign driver.");
    } finally {
      setActionLoadingMap(prev => ({ ...prev, [rideId]: false }));
    }
  };

  return (
    <div className="module-container fade-in">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="toast-notification fade-in">
          <CheckCircle size={20} className="text-success" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="page-header mb-4">
        <div>
          <h1 className="page-title">Admin Ride Dispatch Console</h1>
          <p className="page-subtitle">Real-time unassigned customer requests with instant 1-click driver dropdown dispatch.</p>
        </div>
        <button 
          className="secondary-btn d-flex align-items-center gap-2"
          onClick={() => { setLoading(true); fetchPendingRides(); fetchDrivers(); }}
        >
          <RefreshCw size={14} className={loading ? 'spin' : ''} />
          Refresh Requests
        </button>
      </div>

      {loading ? (
        <div className="table-container-card p-5 text-center">
          <Car size={36} className="text-primary spin mb-2" />
          <p className="text-secondary">Loading pending customer rides...</p>
        </div>
      ) : pendingRides.length === 0 ? (
        <div className="table-container-card p-5 text-center">
          <CheckCircle size={40} className="text-success mb-2" />
          <h3>All Caught Up!</h3>
          <p className="text-secondary">No pending unassigned customer requests right now.</p>
        </div>
      ) : (
        <div className="table-container-card">
          <div className="table-content">
            <table className="clean-table">
              <thead>
                <tr>
                  <th>REQUEST ID</th>
                  <th>CUSTOMER</th>
                  <th>PICKUP</th>
                  <th>DROPOFF</th>
                  <th>DATE & TIME</th>
                  <th>FARE</th>
                  <th style={{ textAlign: 'right' }}>ASSIGN DRIVER</th>
                </tr>
              </thead>
              <tbody>
                {pendingRides.map((ride) => (
                  <tr key={ride._id || ride.requestId}>
                    <td>
                      <span className="id-pill font-mono">{ride.requestId || ride._id}</span>
                    </td>
                    <td>
                      <div className="passenger-table-cell">
                        <div className="avatar-circle">
                          {(ride.customerName || ride.passenger?.name || 'C').charAt(0)}
                        </div>
                        <div>
                          <strong>{ride.customerName || ride.passenger?.name || 'Customer'}</strong>
                          <div className="text-xs text-secondary">{ride.customerPhone || ride.passenger?.phone || '+92 300 1234567'}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="d-flex align-items-center gap-1">
                        <MapPin size={13} className="text-success" />
                        <span className="font-semibold">{ride.pickupLocation}</span>
                      </div>
                    </td>
                    <td>
                      <div className="d-flex align-items-center gap-1">
                        <MapPin size={13} className="text-danger" />
                        <span className="font-semibold">{ride.dropLocation}</span>
                      </div>
                    </td>
                    <td>
                      <div className="d-flex align-items-center gap-1 text-sm">
                        <Clock size={13} className="text-secondary" />
                        <span>{ride.date} {ride.timeToLeave}</span>
                      </div>
                    </td>
                    <td>
                      <span className="fare-badge">{ride.fare}</span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="d-flex justify-content-end align-items-center gap-2">
                        {/* Dropdown to select a driver */}
                        <select 
                          value={selectedDriverMap[ride._id] || ""} 
                          onChange={(e) => setSelectedDriverMap({
                            ...selectedDriverMap, 
                            [ride._id]: e.target.value
                          })}
                          className="toolbar-select"
                          style={{ maxWidth: '220px', padding: '0.45rem 0.75rem', fontSize: '0.82rem' }}
                        >
                          <option value="" disabled>Select a driver...</option>
                          {drivers.map(driver => (
                            <option key={driver._id} value={driver._id}>
                              {driver.Name || driver.name || 'Driver'} ({driver.PhoneNumber || driver.phone || driver.driverId})
                            </option>
                          ))}
                        </select>

                        <button 
                          onClick={() => handleAssignDriver(ride._id)}
                          disabled={actionLoadingMap[ride._id]}
                          className="dispatch-action-btn"
                          style={{ background: '#15803D', color: '#FFFFFF', borderColor: '#15803D', whiteSpace: 'nowrap' }}
                        >
                          <Sparkles size={13} /> 
                          {actionLoadingMap[ride._id] ? 'Assigning...' : 'Confirm Assign'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
