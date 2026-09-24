import io from 'socket.io-client';
import readline from 'readline';

const RIDE_ID = process.argv[2] || 'ALL';
const SERVER_URL = process.argv[3] || 'http://localhost:5000';

console.clear();
console.log('================================================================');
console.log('📱 CUSTOMER APP - REAL-TIME NOTIFICATION LISTENER');
console.log(`📡 Server:         ${SERVER_URL}`);
console.log(`🎯 Target Ride ID: ${RIDE_ID === 'ALL' ? 'ALL Rides (Listening to All Customer Notifications)' : RIDE_ID}`);
console.log('================================================================\n');

let latestNotification = null;

const socket = io(SERVER_URL, {
  transports: ['websocket', 'polling'],
  reconnectionAttempts: 10,
  timeout: 5000
});

// Render the reference image view in terminal
function renderCustomerCard(notif) {
  const dateStr = notif.affectedDate || 'May 21, 2026';
  const timeStr = notif.affectedTime || '08:00 AM - 10:00 AM';
  const reasonStr = notif.reportedReason || `Reported Reason: ${notif.reason || 'Vehicle Issue'}`;
  const detailsStr = notif.additionalDetails || notif.details || 'Driver is unavailable due to a sudden mechanical issue with the vehicle. We apologize for the inconvenience and are working to find a replacement driver immediately. The issue is severe enough to prevent the ride.';
  const rideStr = notif.rideId || notif.requestId || 'REQ-8031';
  const driverStr = notif.driverName ? `${notif.driverName} (${notif.driverPhone || 'Driver'})` : 'Assigned Driver';

  console.log('\n');
  console.log('  \x1b[44m\x1b[37m\x1b[1m  ←  Driver Unavailable                                                    \x1b[0m');
  console.log('  \x1b[44m\x1b[37m     Your assigned driver is unavailable for this ride.                    \x1b[0m');
  console.log('  ┌────────────────────────────────────────────────────────────────────────┐');
  console.log('  │                                                                        │');
  console.log('  │  \x1b[41m\x1b[37m\x1b[1m   !   Driver Unavailable                                            \x1b[0m  │');
  console.log('  │                                                                        │');
  console.log('  │  \x1b[1m\x1b[36mAffected Date & Time\x1b[0m                                                  │');
  console.log(`  │  📅  \x1b[1m${dateStr.padEnd(66)}\x1b[0m│`);
  console.log(`  │      \x1b[90m${timeStr.padEnd(66)}\x1b[0m│`);
  console.log('  │                                                                        │');
  console.log(`  │  📄  \x1b[1m\x1b[33m${reasonStr.padEnd(66)}\x1b[0m│`);
  console.log(`  │      \x1b[90mDriver: ${driverStr.padEnd(60)}\x1b[0m│`);
  console.log('  │                                                                        │');
  console.log('  │  \x1b[1mAdditional Details from Driver:\x1b[0m                                       │');
  
  // Word wrap details text cleanly
  const words = detailsStr.split(' ');
  let line = '';
  for (const word of words) {
    if ((line + ' ' + word).length > 68) {
      console.log(`  │  \x1b[37m${line.padEnd(70)}\x1b[0m│`);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) {
    console.log(`  │  \x1b[37m${line.padEnd(70)}\x1b[0m│`);
  }

  console.log('  │                                                                        │');
  console.log('  │  \x1b[34mℹ️  You can request a replacement driver for this ride.\x1b[0m                │');
  console.log('  │                                                                        │');
  console.log('  │  \x1b[44m\x1b[37m\x1b[1m                     [ Request Replacement ]                              \x1b[0m  │');
  console.log('  │                                                                        │');
  console.log(`  │  \x1b[90mRide ID: ${rideStr.padEnd(30)} Status: DRIVER_UNAVAILABLE          \x1b[0m│`);
  console.log('  └────────────────────────────────────────────────────────────────────────┘');
  console.log('\n  👉 \x1b[32m\x1b[1mAction:\x1b[0m Press \x1b[1m[R]\x1b[0m + Enter to simulate Customer tapping \x1b[34m"Request Replacement"\x1b[0m\n');
}

socket.on('connect', () => {
  console.log(`✅ Connected to Socket.IO Server (Socket ID: ${socket.id})`);
  
  // Join customer notification rooms
  socket.emit('join-customer');
  if (RIDE_ID !== 'ALL') {
    socket.emit('join-ride', RIDE_ID);
    console.log(`🚪 Joined Ride Room: ride-${RIDE_ID}`);
  }
  socket.emit('join-admin');

  console.log('⏳ Waiting for Admin to click [Resolve] on Driver Issue in Admin Portal...\n');
});

const handleDriverUnavailable = (payload) => {
  if (!payload) return;
  if (RIDE_ID !== 'ALL' && payload.rideId && payload.rideId !== RIDE_ID && payload.requestId !== RIDE_ID) {
    return;
  }
  latestNotification = payload;
  renderCustomerCard(payload);
};

socket.on('driver-unavailable', handleDriverUnavailable);
socket.on('customer-notification', handleDriverUnavailable);
socket.on('ride-status-updated', (data) => {
  if (data?.status === 'DRIVER_UNAVAILABLE' && data?.notification) {
    handleDriverUnavailable(data.notification);
  }
});

socket.on('disconnect', () => {
  console.log('⚠️ Disconnected from server. Reconnecting...');
});

// Interactive terminal input for customer tapping "Request Replacement"
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.on('line', async (line) => {
  const trimmed = line.trim().toLowerCase();
  if (trimmed === 'r' || trimmed === 'replace' || trimmed === 'request') {
    const targetRide = latestNotification?.rideId || latestNotification?.requestId || (RIDE_ID !== 'ALL' ? RIDE_ID : 'REQ-8031');
    console.log(`\n🔄 Customer sending [Request Replacement] for Ride: ${targetRide}...`);

    try {
      const res = await fetch(`${SERVER_URL}/api/customer/request-replacement`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rideId: targetRide,
          requestId: targetRide,
          clientName: latestNotification?.passengerName || 'Customer',
          clientPhone: latestNotification?.passengerPhone || '+92 300 1234567',
          scheduledDate: latestNotification?.affectedDate || 'May 21, 2026',
          timeSlot: latestNotification?.affectedTime || '08:00 AM - 10:00 AM',
          reason: latestNotification?.reason || 'Vehicle Issue',
          notes: 'Customer requested replacement driver via mobile app.'
        })
      });

      const data = await res.json();
      if (data.success) {
        console.log('\x1b[32m\x1b[1m✅ SUCCESS:\x1b[0m Replacement request submitted to Admin Dispatcher!');
        console.log(`📋 Replacement Request ID: \x1b[1m${data.data?.requestId || 'RPL-NEW'}\x1b[0m`);
        console.log('📢 Admin Portal has received real-time alert to assign replacement driver.\n');
      } else {
        console.log('⚠️ Failed to request replacement:', data.message);
      }
    } catch (e) {
      // Fallback via socket
      socket.emit('customer-request-replacement', {
        rideId: targetRide,
        clientName: latestNotification?.passengerName || 'Customer',
        timestamp: new Date()
      });
      console.log('✅ Replacement request emitted via Socket.IO fallback!');
    }
  } else if (trimmed === 'q' || trimmed === 'exit') {
    process.exit(0);
  }
});
