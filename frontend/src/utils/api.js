export const BACKEND_URL = (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'))
  ? 'http://localhost:5000'
  : (import.meta.env.VITE_BACKEND_URL || 'https://rr-admin-portal-backend.vercel.app');

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
  // GET /api/rides - Fetch all rides (pending & assigned with counts) from port 3000 or fallback 5000
  getAllRides: async () => {
    // 1. Try port 3000 first (as specified)
    try {
      const res3000 = await fetch('http://localhost:3000/api/rides');
      if (res3000.ok) {
        return await res3000.json();
      }
    } catch (e) {
      // Port 3000 offline, try main backend
    }

    // 2. Fallback to main BACKEND_URL /api/rides
    return request('/rides');
  },

  // PATCH /api/rides/:id/dispatch - Dispatch Driver to Ride (e.g. { driverName: "Ali Khan" })
  dispatch: async (rideId, driverName, driverId = null) => {
    const payload = { driverName, driverId };

    // 1. Try port 3000 first
    try {
      const res3000 = await fetch(`http://localhost:3000/api/rides/${rideId}/dispatch`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res3000.ok) {
        return await res3000.json();
      }
    } catch (e) {
      // Port 3000 offline, try main backend
    }

    // 2. Fallback to main BACKEND_URL
    const patchRes = await request(`/rides/${rideId}/dispatch`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });

    if (patchRes.success) return patchRes;

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

  // POST /api/ride/assign - Assign selected driver to ride
  assign: (rideId, driverId, extraData = {}) => request('/ride/assign', {
    method: 'POST',
    body: JSON.stringify({ rideId, driverId, ...extraData })
  }),

  // GET /api/ride/assigned - Fetch all assigned rides
  getAssigned: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/ride/assigned${query ? `?${query}` : ''}`);
  },

  // GET /api/ride/driver/:driverId - Fetch assigned rides for driver (Flutter / Driver Panel)
  getDriverRides: (driverId) => request(`/ride/driver/${driverId}`)
};



