import io from 'socket.io-client';

const DRIVER_ID = process.argv[2] || 'ALL';
const SERVER_URL = process.argv[3] || 'http://localhost:5000';

console.log('====================================================');
console.log('🚗 Driver App Real-Time Listener Running');
console.log(`📡 Server: ${SERVER_URL}`);
console.log(`👤 Target Driver: ${DRIVER_ID === 'ALL' ? 'ALL Drivers (Auto-Detect Mode)' : DRIVER_ID}`);
console.log('====================================================\n');

const socket = io(SERVER_URL, {
  transports: ['websocket', 'polling']
});

socket.on('connect', async () => {
  console.log(`✅ Connected to Socket.IO Server (ID: ${socket.id})`);

  if (DRIVER_ID === 'ALL') {
    socket.emit('join-admin');
    try {
      const res = await fetch(`${SERVER_URL}/api/drivers`).then(r => r.json()).catch(() => null);
      const drivers = res?.data?.drivers || res?.data || [];
      drivers.forEach(d => {
        const id1 = d._id;
        const id2 = d.driverId;
        const id3 = d.driverReferenceId;
        if (id1) socket.emit('join-driver', String(id1));
        if (id2) socket.emit('join-driver', String(id2));
        if (id3) socket.emit('join-driver', String(id3));
      });
      console.log(`🚪 Auto-subscribed to ${drivers.length} drivers`);
    } catch (e) {}
  } else {
    socket.emit('join-driver', DRIVER_ID);
    console.log(`🚪 Joined Room: driver-${DRIVER_ID}`);
  }

  console.log('⏳ Waiting for dispatch from Admin Portal...\n');
});

const handleIncomingAssignment = (data) => {
  if (!data) return;
  console.log('\n====================================================');
  console.log('🔔 [DRIVER APP] NEW RIDE DISPATCH RECEIVED!');
  console.log('====================================================');
  console.log(`🚗 Driver Name:    ${data.driverName || 'N/A'}`);
  console.log(`🆔 Driver Code:    ${data.driverCode || data.driverId || 'N/A'}`);
  console.log(`📋 Request ID:     ${data.requestId || data.rideId}`);
  console.log(`👤 Passenger Name: ${data.passengerName || data.customerName || 'N/A'}`);
  console.log(`📞 Customer Phone: ${data.passengerPhone || data.customerPhone || data.phone || 'N/A'}`);
  console.log(`📍 Pickup:         ${typeof data.pickupLocation === 'object' ? data.pickupLocation?.address : (data.pickupLocation || 'Pickup')}`);
  console.log(`🏁 Drop-off:       ${typeof data.dropoffLocation === 'object' ? data.dropoffLocation?.address : (data.dropoffLocation || 'Drop-off')}`);
  console.log(`💰 Fare Amount:    ${data.fareFormatted || ('Rs. ' + (data.fare || 9500))}`);
  console.log(`🚦 Ride Status:    ${data.status || 'ASSIGNED'}`);
  console.log('====================================================\n');
};

socket.on('new-assignment', handleIncomingAssignment);
socket.on('ride-assigned', handleIncomingAssignment);
socket.on('ride-dispatched', handleIncomingAssignment);

socket.on('disconnect', () => {
  console.log('⚠️ Disconnected from server. Reconnecting...');
});
