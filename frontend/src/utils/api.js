export const BACKEND_URL = (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'))
  ? 'http://localhost:3000'
  : (import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000');


const API_BASE_URL = `${BACKEND_URL}/api`;

/**
 * Standard fetch helper with error handling & JSON formatting
 */
async function request(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  };

  try {
    const res = await fetch(url, config);
    const result = await res.json();
    return result;
  } catch (err) {
    console.warn(`[API Client] Network request to ${url} failed:`, err.message);
    return {
      success: false,
      data: null,
      message: 'Failed to connect to backend server. Is it running on port 5000?',
      error: err.message
    };
  }
}

export const DriverAPI = {
  // GET /api/drivers?status=PENDING
  getDrivers: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/drivers${query ? `?${query}` : ''}`);
  },

  // GET /api/drivers/stats
  getStats: () => request('/drivers/stats'),

  // GET /api/drivers/available?rideLocation=...&vehicleType=...
  getAvailable: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/drivers/available${query ? `?${query}` : ''}`);
  },

  // GET /api/drivers/:id
  getById: (id) => request(`/drivers/${id}`),

  // POST /api/drivers
  create: (driverData) => request('/drivers', {
    method: 'POST',
    body: JSON.stringify(driverData)
  }),

  // PUT /api/drivers/:id/approve
  approve: (id) => request(`/drivers/${id}/approve`, {
    method: 'PUT'
  }),

  // PUT /api/drivers/:id/reject
  reject: (id, reason = '') => request(`/drivers/${id}/reject`, {
    method: 'PUT',
    body: JSON.stringify({ reason })
  })
};

export const RequestAPI = {
  // GET /api/requests?status=...
  getRequests: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/requests${query ? `?${query}` : ''}`);
  },

  // GET /api/requests/pending
  getPending: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/requests/pending${query ? `?${query}` : ''}`);
  },

  // GET /api/requests/stats
  getStats: () => request('/requests/stats'),

  // GET /api/requests/:id
  getById: (id) => request(`/requests/${id}`),

  // POST /api/requests
  create: (requestData) => request('/requests', {
    method: 'POST',
    body: JSON.stringify(requestData)
  }),

  // PUT /api/requests/:id
  update: (id, updateData) => request(`/requests/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updateData)
  }),

  // PUT /api/requests/:id/visibility
  toggleVisibility: (id, visibility) => request(`/requests/${id}/visibility`, {
    method: 'PUT',
    body: JSON.stringify({ visibility })
  }),

  // GET /api/requests/:id/driver-requests
  getDriverRequests: (id) => request(`/requests/${id}/driver-requests`)
};

export const AssignmentAPI = {
  // POST /api/assignments
  create: (assignmentData) => request('/assignments', {
    method: 'POST',
    body: JSON.stringify(assignmentData)
  }),

  // GET /api/assignments
  getAssignments: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/assignments${query ? `?${query}` : ''}`);
  }
};

export const RideAPI = {
  // GET /api/rides - Fetch all rides (pending & assigned with counts) from port 3000, port 5000 /api/rides, or /api/requests
  getAllRides: async () => {
    // 1. Try port 3000 with quick 800ms abort so it never hangs
    try {
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), 800);
      const res3000 = await fetch('http://localhost:3000/api/rides', { signal: ctrl.signal });
      clearTimeout(tid);
      if (res3000.ok) {
        const data3000 = await res3000.json();
        if (data3000 && (data3000.rides || data3000.data || Array.isArray(data3000))) {
          return data3000;
        }
      }
    } catch (e) {
      // Port 3000 offline
    }

    // 2. Try main backend /api/rides
    try {
      const resRides = await fetch(`${BACKEND_URL}/api/rides`);
      if (resRides.ok) {
        const dataRides = await resRides.json();
        if (dataRides?.success) return dataRides;
      }
    } catch (e) {}

    // 3. Fallback to /api/requests (database MongoDB requests)
    try {
      const resReq = await fetch(`${BACKEND_URL}/api/requests`);
      if (resReq.ok) {
        const dataReq = await resReq.json();
        return dataReq;
      }
    } catch (e) {}

    return request('/requests');
  },

  // PATCH /api/rides/:id/dispatch - Dispatch Driver to Ride (e.g. { driverName: "Ali Khan" })
  dispatch: async (rideId, driverName, driverId = null) => {
    const payload = { driverName, driverId };

    // 1. Try port 3000 with quick abort
    try {
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), 1000);
      const res3000 = await fetch(`http://localhost:3000/api/rides/${rideId}/dispatch`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: ctrl.signal
      });
      clearTimeout(tid);
      if (res3000.ok) {
        return await res3000.json();
      }
    } catch (e) {}

    // 2. Try main backend PATCH /api/rides/:id/dispatch
    try {
      const patchRes = await fetch(`${BACKEND_URL}/api/rides/${rideId}/dispatch`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (patchRes.ok) {
        return await patchRes.json();
      }
    } catch (e) {}

    // 3. Fallback to POST /api/ride/assign
    return request('/ride/assign', {
      method: 'POST',
      body: JSON.stringify({ rideId, driverId, remarks: `Dispatched to ${driverName}` })
    });
  },

  // GET /api/ride/pending - Fetch unassigned incoming customer rides
  getPending: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/ride/pending${query ? `?${query}` : ''}`);
  },

  // POST /api/ride/assign - Assign selected driver to ride (Flutter App Integration)
  assign: async (rideId, driverId, extraData = {}) => {
    const payload = { rideId, driverId, ...extraData };

    // 1. Try port 3000 POST /api/ride/assign with quick abort
    try {
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), 1200);
      const res3000 = await fetch('http://localhost:3000/api/ride/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: ctrl.signal
      });
      clearTimeout(tid);
      if (res3000.ok) {
        return await res3000.json();
      }
    } catch (e) {}

    // 2. Try main backend POST /api/ride/assign
    try {
      const res = await fetch(`${BACKEND_URL}/api/ride/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {}

    // 3. Fallback to POST /api/assignments
    return request('/assignments', {
      method: 'POST',
      body: JSON.stringify({ requestId: rideId, driverId, ...extraData })
    });
  },

  // GET /api/ride/assigned - Fetch all assigned rides
  getAssigned: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/ride/assigned${query ? `?${query}` : ''}`);
  },

  // GET /api/ride/driver/:driverId - Fetch assigned rides for driver (Flutter / Driver Panel)
  getDriverRides: (driverId) => request(`/ride/driver/${driverId}`)
};



