
const fs = require('fs');
const lines = fs.readFileSync('c:/Users/mirza/OneDrive/Desktop/admin portal/frontend/src/pages/RideDispatch.jsx', 'utf8').split('\n');
lines.forEach((l, i) => {
  if (l.includes('schedule-status-pill')) console.log(i + 1, l.trim());
});

