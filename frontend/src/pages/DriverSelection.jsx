import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { 
  Search, MapPin, User, Car, Clock, Calendar, 
  CheckCircle, AlertCircle, Edit2, Check, X, RefreshCw 
} from 'lucide-react';
import './DriverSelection.css';

const BACKEND_URL = 'http://192.168.88.59:3000';

const DriverSelection = () => {
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [toastMessage, setToastMessage] = useState('');
  
  // Inline fare editing state
  const [editingFareId, setEditingFareId] = useState(null);
  const [editingFareValue, setEditingFareValue] = useState('');
  const [isSavingFare, setIsSavingFare] = useState(false);

  const socketRef = useRef(null);

  // Helper to extract formatted schedule days
  const getDaysDisplay = (ride) => {
    if (!ride) return 'Mon - Fri';

    // 1. If customized specific days were selected in customSchedule (e.g. ['Tue', 'Wed', 'Thu', 'Fri'])
    const custDays = ride.customSchedule?.selectedDays || ride.customSchedule?.days;
    if (Array.isArray(custDays) && custDays.length > 0) {
      return custDays.join(', ');
    }

    // 2. If selectedDays is an array
    if (Array.isArray(ride.selectedDays) && ride.selectedDays.length > 0) {
      return ride.selectedDays.join(', ');
    }

    // 3. If selectedDays is a string and not literal 'Customize'
    if (ride.selectedDays && typeof ride.selectedDays === 'string' && ride.selectedDays.trim() && ride.selectedDays.toLowerCase() !== 'customize') {
      return ride.selectedDays.trim();
    }

    // 4. Fallback to scheduleType (e.g., Mon - Fri, Mon - Sat)
    if (ride.scheduleType && typeof ride.scheduleType === 'string' && ride.scheduleType.trim() && ride.scheduleType.toLowerCase() !== 'customize') {
      return ride.scheduleType.trim();
    }

    return 'Mon - Fri';
  };

  // Helper to normalize ride format
  const normalizeRide = (item) => {
    const rawId = item._id || item.id || item.requestId;
    const mongoId = item._id || (typeof item.id === 'string' && item.id.length === 24 ? item.id : null);
    
    // Clean fare
    let numericFare = 9500;
    if (item.fare !== undefined && item.fare !== null) {
      const parsed = Number(String(item.fare).replace(/[^0-9.-]+/g, ''));
      if (!isNaN(parsed) && parsed > 0) numericFare = parsed;
    }

    return {
      ...item,
      _id: item._id || rawId,
      mongoId: mongoId,
      id: rawId,
      requestId: item.requestId || `REQ-${String(rawId).slice(-4).toUpperCase()}`,
      passengerName: item.customerName || item.passengerName || item.passenger?.name || item.name || 'Customer',
      passengerPhone: item.customerPhone || item.passengerPhone || item.passenger?.phone || item.phone || '-',
      pickupLocation: typeof item.pickupLocation === 'object' ? item.pickupLocation.address : (item.pickupLocation || item.pickup || 'Pickup Location'),
      dropoffLocation: typeof item.dropoffLocation === 'object' ? item.dropoffLocation.address : (item.dropoffLocation || item.dropLocation || item.dropoff || 'Drop Location'),
      selectedDays: (item.selectedDays && item.selectedDays !== 'Customize') 
        ? item.selectedDays 
        : (item.customSchedule?.selectedDays || item.customSchedule?.days || item.selectedDays || []),
      customSchedule: item.customSchedule,
      scheduleType: item.scheduleType || 'Mon - Fri',
      tripType: (function() {
        const raw = String(item.tripType || item.customSchedule?.tripType || '').trim().toLowerCase();
        if (raw.includes('one way') || raw.includes('single')) return 'One Way';
        if (raw.includes('two way') || raw.includes('round trip')) return 'Two Way';
        if (String(item.scheduleType || '').toLowerCase().includes('two way')) return 'Two Way';
        return 'One Way';
      })(),
      passengersCount: item.passengersCount ?? item.passengerCount ?? item.seatsNeeded ?? 1,
      seatsNeeded: item.passengersCount ?? item.passengerCount ?? item.seatsNeeded ?? 1,
      timeToReach: item.timeToReach || item.customSchedule?.fromTime || item.timing?.reach || item.scheduleTime || '08:30 AM',
      timeToLeave: item.timeToLeave || item.customSchedule?.toTime || item.timing?.leave || '05:00 PM',
      vehicleType: item.seatingArrangement || item.vehicleType || item.preferences?.vehicleCategory || item.vehicle?.category || 'Sedan Executive',
      acPreference: item.acPreference || (item.preferences?.acRequired ? 'AC' : 'Non-AC') || 'AC',
      fare: numericFare,
      fareFormatted: `Rs. ${numericFare.toLocaleString()}`,
      status: item.status || 'Pending Dispatch'
    };
  };

  // Fetch all rides from live backend
  const fetchRides = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const endpoints = ['/api/rides', `${BACKEND_URL}/api/rides`, 'http://localhost:5000/api/rides', 'http://192.168.88.59:3000/api/rides'];
      let data = null;
      for (const url of endpoints) {
        try {
          const controller = new AbortController();
          const tid = setTimeout(() => controller.abort(), 2500);
          const res = await fetch(url, { headers: { 'Accept': 'application/json' }, signal: controller.signal });
          clearTimeout(tid);
          if (res.ok) {
            data = await res.json();
            if (data) break;
          }
        } catch (e) {}
      }
      if (!data) throw new Error('Failed to connect to backend');
      const rawList = Array.isArray(data) ? data : (data.rides || data.data || []);
      const normalized = rawList.map(normalizeRide);
      setRides(normalized);
      setError(null);
    } catch (err) {
      console.error('[DriverSelection] Error fetching rides:', err);
      if (!silent) setError(err.message);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // Setup Socket.IO and 5-second polling
  useEffect(() => {
    fetchRides();

    const socket = io(BACKEND_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      timeout: 10000
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[DriverSelection] Connected to live backend Socket.IO');
    });

    socket.on('new-ride', (newRide) => {
      console.log('[DriverSelection] Received new-ride:', newRide);
      fetchRides(true);
    });

    socket.on('ride-update', (updatedRide) => {
      console.log('[DriverSelection] Received ride-update:', updatedRide);
      fetchRides(true);
    });

    // 5-second polling
    const interval = setInterval(() => {
      fetchRides(true);
    }, 5000);

    return () => {
      clearInterval(interval);
      socket.disconnect();
    };
  }, []);

  // Save fare via PATCH
  const handleSaveFare = async (ride, newFareValue) => {
    const cleanFare = Number(String(newFareValue).replace(/[^0-9.-]+/g, ''));
    if (isNaN(cleanFare) || cleanFare <= 0) {
      alert('Please enter a valid fare amount.');
      return;
    }

    setIsSavingFare(true);
    const targetId = ride.mongoId || ride._id || ride.id;

    try {
      const res = await fetch(`${BACKEND_URL}/api/rides/${targetId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ fare: cleanFare })
      });

      if (!res.ok) {
        throw new Error(`Failed to update fare (HTTP ${res.status})`);
      }

      // Optimistically update local state
      setRides(prev => prev.map(r => {
        if ((r.mongoId && r.mongoId === targetId) || r._id === targetId || r.id === targetId) {
          return {
            ...r,
            fare: cleanFare,
            fareFormatted: `Rs. ${cleanFare.toLocaleString()}`
          };
        }
        return r;
      }));

      setToastMessage(`Fare updated to Rs. ${cleanFare.toLocaleString()}`);
      setTimeout(() => setToastMessage(''), 3000);
      setEditingFareId(null);
    } catch (err) {
      console.error('[DriverSelection] Failed to save fare:', err);
      alert(`Could not save fare: ${err.message}`);
    } finally {
      setIsSavingFare(false);
    }
  };

  // Filter rides based on search term
  const filteredRides = rides.filter(ride => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      (ride.requestId && ride.requestId.toLowerCase().includes(term)) ||
      (ride.passengerName && ride.passengerName.toLowerCase().includes(term)) ||
      (ride.pickupLocation && ride.pickupLocation.toLowerCase().includes(term)) ||
      (ride.dropoffLocation && ride.dropoffLocation.toLowerCase().includes(term))
    );
  });

  return (
    <div className="module-container fade-in" style={{ padding: '1.5rem', minHeight: '100vh', background: '#F8FAFC' }}>
      {toastMessage && (
        <div className="toast-notification fade-in" style={{
          position: 'fixed', top: '1.5rem', right: '1.5rem', zIndex: 9999,
          background: '#10B981', color: '#FFF', padding: '0.75rem 1.25rem',
          borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)', fontWeight: 600
        }}>
          <CheckCircle size={18} />
          {toastMessage}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>Ride Dispatch & Customer Requests</h1>
          <p style={{ fontSize: '0.875rem', color: '#64748B', margin: '4px 0 0 0' }}>
            Live customer requests connected to <code style={{ color: '#2563EB', background: '#EFF6FF', padding: '2px 6px', borderRadius: '4px' }}>{BACKEND_URL}/api/rides</code>
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <div style={{ position: 'relative', minWidth: '260px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
            <input 
              type="text" 
              placeholder="Search customer, route, ID..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '0.55rem 0.75rem 0.55rem 2.25rem',
                border: '1px solid #CBD5E1',
                borderRadius: '8px',
                fontSize: '0.85rem',
                outline: 'none',
                background: '#FFFFFF'
              }}
            />
          </div>

          <button 
            type="button" 
            onClick={() => fetchRides()}
            disabled={loading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '0.55rem 1rem',
              background: '#2563EB',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Main Table Container */}
      <div style={{ background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                <th style={{ padding: '0.85rem 1rem' }}>REQ ID</th>
                <th style={{ padding: '0.85rem 1rem' }}>CUSTOMER</th>
                <th style={{ padding: '0.85rem 1rem' }}>PICKUP & DROP</th>
                <th style={{ padding: '0.85rem 1rem' }}>SELECTED DAYS & SCHEDULE</th>
                <th style={{ padding: '0.85rem 1rem' }}>VEHICLE & AC</th>
                <th style={{ padding: '0.85rem 1rem' }}>FARE (PKR)</th>
                <th style={{ padding: '0.85rem 1rem' }}>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {loading && rides.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '3rem 1rem', color: '#64748B' }}>
                    <RefreshCw size={24} className="spin mb-2" style={{ display: 'block', margin: '0 auto 8px' }} />
                    Loading live rides from backend...
                  </td>
                </tr>
              ) : error && rides.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '3rem 1rem', color: '#EF4444' }}>
                    <AlertCircle size={28} style={{ display: 'block', margin: '0 auto 8px' }} />
                    <p style={{ fontWeight: 600, margin: 0 }}>Failed to load rides from backend</p>
                    <p style={{ fontSize: '0.8rem', color: '#64748B', marginTop: '4px' }}>{error}</p>
                  </td>
                </tr>
              ) : filteredRides.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '3rem 1rem', color: '#64748B' }}>
                    <CheckCircle size={28} style={{ display: 'block', margin: '0 auto 8px', color: '#10B981' }} />
                    <p style={{ fontWeight: 600, margin: 0 }}>No customer requests found</p>
                  </td>
                </tr>
              ) : (
                filteredRides.map(ride => {
                  const isEditing = editingFareId === (ride.mongoId || ride._id || ride.id);
                  return (
                    <tr key={ride._id || ride.requestId} style={{ borderBottom: '1px solid #F1F5F9', transition: 'background 0.15s ease' }}>
                      {/* REQ ID */}
                      <td style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>
                        <span style={{ background: '#EFF6FF', color: '#1D4ED8', padding: '3px 8px', borderRadius: '6px', fontWeight: 700, fontFamily: 'monospace', fontSize: '0.78rem' }}>
                          {ride.requestId}
                        </span>
                      </td>

                      {/* CUSTOMER */}
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#E2E8F0', color: '#334155', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.85rem', flexShrink: 0 }}>
                            {ride.passengerName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <strong style={{ color: '#0F172A', display: 'block', fontSize: '0.88rem' }}>{ride.passengerName}</strong>
                            <span style={{ color: '#64748B', fontSize: '0.75rem' }}>{ride.passengerPhone}</span>
                          </div>
                        </div>
                      </td>

                      {/* PICKUP & DROP */}
                      <td style={{ padding: '0.85rem 1rem', maxWidth: '280px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#10B981', flexShrink: 0 }}></span>
                            <span style={{ color: '#334155', fontSize: '0.8rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ride.pickupLocation}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#EF4444', flexShrink: 0 }}></span>
                            <span style={{ color: '#0F172A', fontWeight: 600, fontSize: '0.8rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ride.dropoffLocation}</span>
                          </div>
                        </div>
                      </td>

                      {/* DAYS & SCHEDULE */}
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#EFF6FF', color: '#1D4ED8', padding: '2px 6px', borderRadius: '4px', fontSize: '0.76rem', fontWeight: 700, width: 'fit-content' }}>
                            <Calendar size={12} />
                            <span>{getDaysDisplay(ride)}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#64748B', fontSize: '0.73rem', whiteSpace: 'nowrap' }}>
                            <Clock size={11} />
                            <span>Reach: <strong>{ride.timeToReach}</strong>{ride.tripType === 'Two Way' && ride.timeToLeave ? <> | Leave: <strong>{ride.timeToLeave}</strong></> : ''}</span>
                          </div>
                        </div>
                      </td>

                      {/* VEHICLE & AC */}
                      <td style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>
                        <span style={{ background: '#F1F5F9', color: '#334155', padding: '4px 8px', borderRadius: '6px', fontSize: '0.76rem', fontWeight: 600 }}>
                          {ride.vehicleType} • {ride.acPreference}
                        </span>
                      </td>

                      {/* FARE (PKR) - Editable */}
                      <td style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>
                        {isEditing ? (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>Rs.</span>
                            <input 
                              type="number" 
                              value={editingFareValue}
                              onChange={(e) => setEditingFareValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveFare(ride, editingFareValue);
                                if (e.key === 'Escape') setEditingFareId(null);
                              }}
                              autoFocus
                              style={{
                                width: '75px',
                                padding: '2px 5px',
                                fontSize: '0.8rem',
                                fontWeight: 700,
                                borderRadius: '4px',
                                border: '1px solid #2563EB',
                                outline: 'none',
                                background: '#FFF'
                              }}
                            />
                            <button
                              type="button"
                              title="Save Fare"
                              disabled={isSavingFare}
                              onClick={() => handleSaveFare(ride, editingFareValue)}
                              style={{ background: '#10B981', border: 'none', color: '#FFF', borderRadius: '4px', padding: '3px 5px', cursor: 'pointer' }}
                            >
                              <Check size={12} />
                            </button>
                            <button
                              type="button"
                              title="Cancel"
                              disabled={isSavingFare}
                              onClick={() => setEditingFareId(null)}
                              style={{ background: '#F1F5F9', border: '1px solid #CBD5E1', color: '#64748B', borderRadius: '4px', padding: '3px 5px', cursor: 'pointer' }}
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ) : (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ background: '#ECFDF5', color: '#047857', border: '1px solid #A7F3D0', padding: '3px 8px', borderRadius: '6px', fontWeight: 700, fontSize: '0.8rem' }}>
                              {ride.fareFormatted}
                            </span>
                            <button
                              type="button"
                              title="Edit Fare"
                              onClick={() => {
                                setEditingFareId(ride.mongoId || ride._id || ride.id);
                                setEditingFareValue(String(ride.fare || 9500));
                              }}
                              style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px', color: '#64748B' }}
                            >
                              <Edit2 size={13} />
                            </button>
                          </div>
                        )}
                      </td>

                      {/* STATUS */}
                      <td style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>
                        <span style={{
                          background: String(ride.status).toLowerCase().includes('pending') ? '#FEF3C7' : '#DCFCE7',
                          color: String(ride.status).toLowerCase().includes('pending') ? '#92400E' : '#166534',
                          padding: '3px 8px',
                          borderRadius: '12px',
                          fontSize: '0.75rem',
                          fontWeight: 700
                        }}>
                          {ride.status}
                        </span>
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

export default DriverSelection;
