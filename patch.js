
const fs = require('fs');
let code = fs.readFileSync('c:/Users/mirza/OneDrive/Desktop/admin portal/frontend/src/pages/RideDispatch.jsx', 'utf8');

// 1. Add state variables
code = code.replace(
  'const [scheduleStatusFilter, setScheduleStatusFilter] = useState(\'pending\'); // \'all\', \'pending\', \'assigned\'',
  'const [scheduleStatusFilter, setScheduleStatusFilter] = useState(\'pending\');\n  const [scheduledRides, setScheduledRides] = useState([]);\n  const [travelRequests, setTravelRequests] = useState([]);\n  const [travelSearchQuery, setTravelSearchQuery] = useState(\'\');\n  const [travelStatusFilter, setTravelStatusFilter] = useState(\'pending\');'
);

// 2. Add fetching functions
const fetchFns = \
  const loadScheduleRides = useCallback(async () => {
    try {
      const endpoints = [\\\\/api/schedule-rides\\\, \http://localhost:5000/api/schedule-rides\, \/api/schedule-rides\];
      for (const url of endpoints) {
        try {
          const res = await fetch(url);
          if (res.ok) {
            const json = await res.json();
            const list = Array.isArray(json) ? json : (json.data || []);
            if (Array.isArray(list)) { setScheduledRides(list); break; }
          }
        } catch(e){}
      }
    } catch(e){}
  }, []);

  const loadTravelRequests = useCallback(async () => {
    try {
      const endpoints = [\\\\/api/travel-requests\\\, \http://localhost:5000/api/travel-requests\, \/api/travel-requests\];
      for (const url of endpoints) {
        try {
          const res = await fetch(url);
          if (res.ok) {
            const json = await res.json();
            const list = Array.isArray(json) ? json : (json.data || []);
            if (Array.isArray(list)) { setTravelRequests(list); break; }
          }
        } catch(e){}
      }
    } catch(e){}
  }, []);
\;
code = code.replace('// Fetch Driver Hire requests', fetchFns + '\n  // Fetch Driver Hire requests');

// 3. Call fetching functions
code = code.replace(
  'if (typeof loadReplacements === \\'function\\') loadReplacements();',
  'if (typeof loadReplacements === \\'function\\') loadReplacements();\n    if (typeof loadScheduleRides === \\'function\\') loadScheduleRides();\n    if (typeof loadTravelRequests === \\'function\\') loadTravelRequests();'
);

// 4. Add socket events
const sockets = \
        s.on('new-schedule-ride', data => setScheduledRides(prev => [data, ...prev]));
        s.on('schedule-ride-dispatched', data => setScheduledRides(prev => prev.map(r => String(r._id) === String(data._id) ? {...r, ...data} : r)));
        s.on('schedule-ride-updated', data => setScheduledRides(prev => prev.map(r => String(r._id) === String(data._id) ? {...r, ...data} : r)));

        s.on('new-travel-request', data => setTravelRequests(prev => [data, ...prev]));
        s.on('travel-request-dispatched', data => setTravelRequests(prev => prev.map(r => String(r._id) === String(data._id) ? {...r, ...data} : r)));
        s.on('travel-request-updated', data => setTravelRequests(prev => prev.map(r => String(r._id) === String(data._id) ? {...r, ...data} : r)));
\;
code = code.replace('s.on(\\'new-driver-hire\\', data => {', sockets + '\\n        s.on(\\'new-driver-hire\\', data => {');

// 5. Remove useMemo for scheduledRides
code = code.replace(/const scheduledRides = useMemo\(\(\) => \{[\s\S]*?\}, \[rides\]\);/, '');

// 6. Handle dispatch submit endpoints
const dispatchCode = \
      } else if (activeMainTab === 'schedule-rides') {
        const dispatchBody = { driverId: selectedDriver.id, driverName: selectedDriver.name, fare: finalFareNum };
        await fetch(\\\\/api/schedule-rides/\/dispatch\\\, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dispatchBody) });
        if (typeof loadScheduleRides === 'function') loadScheduleRides();
      } else if (activeMainTab === 'travel-requests') {
        const dispatchBody = { driverId: selectedDriver.id, driverName: selectedDriver.name, fare: finalFareNum };
        await fetch(\\\\/api/travel-requests/\/dispatch\\\, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dispatchBody) });
        if (typeof loadTravelRequests === 'function') loadTravelRequests();
\;
code = code.replace('} else if (currentSelected.isDriverHire', dispatchCode + '\\n      } else if (currentSelected.isDriverHire');

// 7. Handle save fare endpoints
const fareCode = \
    } else if (activeMainTab === 'schedule-rides') {
      setScheduledRides(prev => prev.map(h => String(h._id) === String(targetMongoId) ? { ...h, fare: num, fareFormatted: formattedFare } : h));
      setToastMessage(\\\? Schedule Ride Fare updated!\\\);
      setTimeout(() => setToastMessage(''), 3500);
      try { await fetch(\\\\/api/schedule-rides/\\\\, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fare: num, fareFormatted: formattedFare }) }); } catch (err) {}
    } else if (activeMainTab === 'travel-requests') {
      setTravelRequests(prev => prev.map(h => String(h._id) === String(targetMongoId) ? { ...h, fare: num, fareFormatted: formattedFare } : h));
      setToastMessage(\\\? Travel & Tourism Fare updated!\\\);
      setTimeout(() => setToastMessage(''), 3500);
      try { await fetch(\\\\/api/travel-requests/\\\\, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fare: num, fareFormatted: formattedFare }) }); } catch (err) {}
\;
code = code.replace('} else if (fareModalRide.isDriverHire', fareCode + '\\n    } else if (fareModalRide.isDriverHire');


fs.writeFileSync('c:/Users/mirza/OneDrive/Desktop/admin portal/frontend/src/pages/RideDispatch.jsx', code, 'utf8');
console.log('Script executed');

