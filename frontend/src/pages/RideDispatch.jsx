import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import io from 'socket.io-client';
import { 
  MapPin, Clock, Car, Filter, Star, CheckCircle, Search, ChevronLeft, Wind, 
  User, Phone, Mail, Calendar, DollarSign, Sparkles, X, Eye, ThumbsUp, ShieldCheck, ArrowRight, RotateCcw,
  Smartphone, Navigation, RefreshCw, Send, CheckCircle2, AlertCircle, Radio, Edit2, Check,
  UserCheck, Briefcase, CreditCard, Users, Plus
} from 'lucide-react';
import LocationAutocomplete from '../components/LocationAutocomplete';
import { RideAPI, BACKEND_URL } from '../utils/api';

const MOBILE_URL = BACKEND_URL;
const LIVE_BACKEND_URL = BACKEND_URL;
const ADMIN_5000 = 'http://localhost:5000';
import './RideDispatch.css';


// Helper function to extract exact selected days from mobile app
const getDaysDisplay = (ride) => {
  if (!ride) return 'Mon - Fri';

  let customSchedule = ride.customSchedule;
  if (typeof customSchedule === 'string') {
    try {
      customSchedule = JSON.parse(customSchedule);
    } catch (e) {}
  }

  let selectedDays = ride.selectedDays;
  if (typeof selectedDays === 'string' && (selectedDays.startsWith('[') || selectedDays.startsWith('{'))) {
    try {
      selectedDays = JSON.parse(selectedDays);
    } catch (e) {}
  }

  // 1. If customized specific days were selected in customSchedule (e.g. ['Tue', 'Wed', 'Thu', 'Fri'])
  const custDays = customSchedule?.selectedDays || customSchedule?.days;
  if (Array.isArray(custDays) && custDays.length > 0) {
    return custDays.join(', ');
  }
  if (typeof custDays === 'string' && custDays.trim() && custDays.toLowerCase() !== 'customize') {
    return custDays.trim();
  }

  // 2. If selectedDays is an array
  if (Array.isArray(selectedDays) && selectedDays.length > 0) {
    return selectedDays.join(', ');
  }

  // 3. If selectedDays is a string and not literal 'Customize'
  if (selectedDays && typeof selectedDays === 'string' && selectedDays.trim() && selectedDays.toLowerCase() !== 'customize') {
    return selectedDays.trim();
  }

  // 4. Fallback to scheduleType (e.g., Mon - Fri, Mon - Sat)
  if (ride.scheduleType && typeof ride.scheduleType === 'string' && ride.scheduleType.trim() && ride.scheduleType.toLowerCase() !== 'customize') {
    return ride.scheduleType.trim();
  }

  return 'Mon - Fri';
};

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
  if (r.id && typeof r.id === 'string' && (r.id.startsWith('REQ-') || r.id.startsWith('SCH-') || r.id.startsWith('TT-') || r.id.startsWith('HIR-') || r.id.startsWith('HDR-'))) return String(r.id);
  if (r._id && String(r._id).length < 15) return String(r._id);
  if (r._id) return `REQ-${String(r._id).slice(-4).toUpperCase()}`;
  return 'REQ-8001';
};

const getRequestTypeBadge = (ride) => {
  const reqId = String(ride?.requestId || ride?.id || '').toUpperCase();
  const sType = String(ride?.scheduleType || '').toLowerCase();
  const rType = String(ride?.rideType || '').toLowerCase();

  if (reqId.startsWith('SCH') || sType.includes('schedule') || rType.includes('schedule')) {
    return (
      <span className="req-type-pill type-sch" title="Schedule Ride Request">
        <span className="type-dot"></span> SCH • Schedule
      </span>
    );
  }
  if (reqId.startsWith('TT') || sType.includes('travel') || rType.includes('travel') || sType.includes('tour')) {
    return (
      <span className="req-type-pill type-tt" title="Travel & Tour Request">
        <span className="type-dot"></span> TT • Travel
      </span>
    );
  }
  if (reqId.startsWith('HIR') || reqId.startsWith('HDR') || ride?.isDriverHire || sType.includes('hire')) {
    return (
      <span className="req-type-pill type-hir" title="Hire Driver Request">
        <span className="type-dot"></span> HIR • Hire
      </span>
    );
  }
  return (
    <span className="req-type-pill type-req" title="Monthly Ride Request">
      <span className="type-dot"></span> REQ • Monthly
    </span>
  );
};

const getStatusBadge = (ride) => {
  const s = String(ride?.status || '').trim();
  const assigned = isRideAssigned(ride);
  if (s === 'Driver Unavailable' || String(ride?.issueStatus).includes('Driver Unavailable')) {
    return (
      <span className="custom-status-badge status-unavailable">
        <span className="badge-dot red"></span>
        Driver Unavailable
      </span>
    );
  }
  if (s === 'Replacement Requested' || ride?.isReplacement) {
    return (
      <span className="custom-status-badge status-replacement">
        <span className="badge-dot orange"></span>
        Replacement Requested
      </span>
    );
  }
  if (assigned || s === 'ASSIGNED' || s.startsWith('Dispatched')) {
    return (
      <span className="custom-status-badge status-assigned">
        <span className="badge-dot green"></span>
        ASSIGNED
      </span>
    );
  }
  if (s.toUpperCase() === 'WAITING FOR CUSTOMER') {
    return (
      <span className="custom-status-badge status-waiting" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#d97706', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
        <span className="badge-dot" style={{ background: '#d97706' }}></span>
        WAITING FOR CUSTOMER
      </span>
    );
  }
  if (s === 'ACCEPTED') {
    return (
      <span className="custom-status-badge status-accepted">
        <span className="badge-dot blue"></span>
        ACCEPTED
      </span>
    );
  }
  return (
    <span className="custom-status-badge status-pending">
      <span className="badge-dot pulse-yellow"></span>
      Pending Dispatch
    </span>
  );
};

const formatCreatedAt = (dateStr) => {
  if (!dateStr) return 'Just now';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } catch (e) {
    return String(dateStr);
  }
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

// Customer Ride Preferences Extractor - 100% Comprehensive
export const getCustomerRidePreferences = (ride) => {
  if (!ride) return {
    tripType: 'One Way',
    serviceType: 'Combined',
    serviceTypeDisplay: 'Combined (Same vehicle for all passengers)',
    vehicleType: 'Sedan Executive',
    seatsCount: 1,
    genderPreference: 'Male Only',
    acPreference: 'AC',
    pickup: 'Pickup Location',
    dropoff: 'Drop-off Location',
    returnPickup: null,
    returnDropoff: null,
    returnDateTime: null,
    startingDate: null,
    morningPickup: 'Pickup Location',
    morningDropoff: 'Drop-off Location',
    morningTime: '08:30 AM',
    eveningPickup: null,
    eveningDropoff: null,
    eveningTime: null,
    fare: 'Rs. 9,500',
    additionalNotes: ''
  };

  const customSched = (ride.customSchedule && typeof ride.customSchedule === 'object') ? ride.customSchedule : {};
  const schedTypeStr = String(ride.scheduleType || '').toLowerCase();
  const rideTypeStr = String(ride.rideType || '').toLowerCase();
  const customRideType = String(customSched.rideType || '').toLowerCase();
  const customTripType = String(customSched.tripType || '').toLowerCase();

  // 1. Trip Type: One Way / Two Way (Database exact match)
  let tripType = 'One Way';
  const rawTripType = String(ride.tripType || customSched.tripType || ride.rideType || '').trim().toLowerCase();
  if (rawTripType.includes('one way') || rawTripType.includes('single')) {
    tripType = 'One Way';
  } else if (rawTripType.includes('two way') || rawTripType.includes('round trip')) {
    tripType = 'Two Way';
  } else if (
    schedTypeStr.includes('two way') || 
    schedTypeStr.includes('round trip') ||
    customRideType.includes('two way') || 
    customTripType.includes('two way') ||
    customSched.returnPickupLocation ||
    ride.returnPickupLocation
  ) {
    tripType = 'Two Way';
  } else {
    tripType = 'One Way';
  }

  // 2. Service Type: Combined (Same vehicle for all passengers) ya Separate (Different vehicles for male & female)
  let serviceType = 'Combined';
  const rawService = ride.vehicleTypeSelection || ride.serviceType || ride.preferences?.vehicleArrangement || ride.arrangement || customSched.serviceType || '';
  if (String(rawService).toLowerCase().includes('separate')) {
    serviceType = 'Separate';
  } else if (
    String(rawService).toLowerCase().includes('combined') || 
    String(rawService).toLowerCase().includes('sharing') || 
    String(rawService).toLowerCase().includes('shared') || 
    schedTypeStr.includes('combined')
  ) {
    serviceType = 'Combined';
  } else if (rawService && typeof rawService === 'string' && rawService.trim()) {
    serviceType = rawService.trim();
  }
  const serviceTypeDisplay = serviceType === 'Separate' 
    ? 'Separate (Different vehicles for male & female)' 
    : 'Combined (Same vehicle for all passengers)';

  // 3. Vehicle Type: Sedan / SUV / Sedan Executive
  let vehicleType = 'Sedan Executive';
  const rawVehicle = ride.seatingArrangement || ride.vehicleType || ride.vehiclePreference || ride.preferences?.vehicleCategory || ride.preferences?.vehicleType || customSched.vehicleType || '';
  const rawVehicleLower = String(rawVehicle).toLowerCase();
  if (rawVehicleLower.includes('suv')) {
    vehicleType = 'SUV';
  } else if (rawVehicleLower.includes('executive')) {
    vehicleType = 'Sedan Executive';
  } else if (rawVehicleLower.includes('sedan')) {
    vehicleType = 'Sedan';
  } else if (rawVehicle && typeof rawVehicle === 'string' && rawVehicle.trim()) {
    vehicleType = rawVehicle.trim();
  }

  // 4. Seats / Passengers Count: exact count from DB
  let seatsCount = 1;
  const rawSeats = ride.passengersCount ?? ride.passengerCount ?? ride.seatsNeeded ?? ride.seats ?? ride.noOfSeats ?? ride.numberOfSeats ?? customSched.passengersCount ?? customSched.seats ?? ride.seatsCount;
  if (typeof rawSeats === 'number' && rawSeats > 0) {
    seatsCount = rawSeats;
  } else if (typeof rawSeats === 'string') {
    const matched = rawSeats.match(/\d+/);
    if (matched) seatsCount = parseInt(matched[0], 10);
  }

  // 5. Gender Preference: Male Only / Female Only / Both
  let genderPreference = 'Male Only';
  const rawGender = ride.genderPreference || ride.gender || ride.passenger?.gender || ride.passengerGender || ride.preferences?.genderPreference || customSched.genderPreference || '';
  const gLower = String(rawGender).toLowerCase();
  if (gLower.includes('female') || gLower === 'f') {
    genderPreference = 'Female Only';
  } else if (gLower.includes('both') || gLower.includes('any') || gLower.includes('family') || gLower.includes('all')) {
    genderPreference = 'Both';
  } else if (gLower.includes('male') || gLower === 'm') {
    genderPreference = 'Male Only';
  } else if (rawGender && typeof rawGender === 'string' && rawGender.trim()) {
    genderPreference = rawGender.trim();
  }

  // 6. AC Preference: AC / Non-AC
  let acPreference = 'AC';
  if (
    ride.acPreference === 'Non-AC' || 
    ride.acPreference === 'Non AC' || 
    ride.acPreference === 'No' || 
    ride.acRequired === false ||
    ride.preferences?.acRequired === false ||
    ride.preferences?.acPreference === 'Non-AC' ||
    customSched.acPreference === 'Non-AC' ||
    customSched.acPreference === 'Non AC'
  ) {
    acPreference = 'Non-AC';
  }

  // 7. Pickup & Dropoff (Return Pickup/Dropoff ONLY for Two Way trips)
  const pickup = typeof ride.pickupLocation === 'object' 
    ? (ride.pickupLocation?.address || 'Pickup Location') 
    : (ride.pickupLocation || (ride.route?.summary ? ride.route.summary.split('->')[0]?.trim() : 'Pickup Location'));

  const dropoff = typeof ride.dropoffLocation === 'object' 
    ? (ride.dropoffLocation?.address || 'Drop-off Location')
    : (typeof ride.dropLocation === 'object'
        ? (ride.dropLocation?.address || 'Drop-off Location')
        : (ride.dropoffLocation || ride.dropLocation || (ride.route?.summary ? ride.route.summary.split('->')[1]?.trim() : 'Drop-off Location')));

  const returnPickup = tripType === 'Two Way'
    ? (customSched.returnPickupLocation || ride.returnPickupLocation || ride.returnPickup || dropoff)
    : null;
  const returnDropoff = tripType === 'Two Way'
    ? (customSched.returnDropoffLocation || ride.returnDropoffLocation || ride.returnDropoff || pickup)
    : null;
  const returnDateTime = tripType === 'Two Way'
    ? (customSched.returnDate ? `${customSched.returnDate}${customSched.returnTime ? ' ' + customSched.returnTime : ''}` : (ride.returnDate ? `${ride.returnDate}${ride.returnTime ? ' ' + ride.returnTime : ''}` : (ride.timeToLeave ? `Return: ${ride.timeToLeave}` : null)))
    : null;

  // Starting Date / Date
  const startingDate = ride.startingFrom || ride.startDate || customSched.startDate || ride.date || (ride.createdAt ? new Date(ride.createdAt).toLocaleDateString() : null);

  const morningPickup = pickup;
  const morningDropoff = dropoff;
  const morningTime = ride.timeToReach || customSched.fromTime || customSched.morningTime || ride.scheduleTime || '08:30 AM';

  const eveningPickup = returnPickup;
  const eveningDropoff = returnDropoff;
  const eveningTime = tripType === 'Two Way' ? (customSched.toTime || customSched.eveningTime || ride.timeToLeave || customSched.returnTime || ride.returnTime || '05:00 PM') : null;

  // 8. Proposed Fare & Special Instructions / Notes
  const fare = ride.fareFormatted || (ride.fare ? (String(ride.fare).startsWith('Rs.') ? ride.fare : `Rs. ${Number(ride.fare).toLocaleString()}`) : 'Rs. 9,500');
  const additionalNotes = ride.additionalNotes || ride.notes || ride.remarks || ride.specialInstructions || customSched.specialInstructions || customSched.notes || '';

  return {
    tripType,
    serviceType,
    serviceTypeDisplay,
    vehicleType,
    seatsCount,
    genderPreference,
    acPreference,
    pickup,
    dropoff,
    returnPickup,
    returnDropoff,
    returnDateTime,
    startingDate,
    morningPickup,
    morningDropoff,
    morningTime,
    eveningPickup,
    eveningDropoff,
    eveningTime,
    fare,
    additionalNotes
  };
};

// Customer Preferences Distinct Color Badges Component
const RenderPreferenceBadges = ({ ride }) => {
  const prefs = getCustomerRidePreferences(ride);
  return (
    <div className="pref-badge-group">
      {/* 1. Trip Type: Amber / Orange */}
      <span className="pref-badge pref-badge-trip" title={`Trip Type: ${prefs.tripType}`}>
        <Navigation size={11} />
        <span>{prefs.tripType === 'Two Way' ? 'Two Way' : 'One Way'}</span>
      </span>

      {/* 2. Service Type: Blue (Separate / Combined) */}
      <span className="pref-badge pref-badge-service" title={`Service Type: ${prefs.serviceTypeDisplay}`}>
        <Users size={11} />
        <span>{prefs.serviceType === 'Separate' ? 'Separate' : 'Combined'}</span>
      </span>

      {/* 3. Vehicle Type: Cyan (Sedan / SUV / Sedan Executive) */}
      <span className="pref-badge pref-badge-vehicle" title={`Vehicle Type: ${prefs.vehicleType}`}>
        <Car size={11} />
        <span>{prefs.vehicleType}</span>
      </span>

      {/* 4. Seats Count: 1, 2, 3, ya 4 Seats */}
      <span className="pref-badge pref-badge-seats" title={`Seats Count: ${prefs.seatsCount} Seat(s)`}>
        <Users size={11} />
        <span>{prefs.seatsCount} {prefs.seatsCount === 1 ? 'Seat' : 'Seats'}</span>
      </span>

      {/* 5. Gender Preference: Purple / Pink (Male Only / Female Only / Both) */}
      <span 
        className={`pref-badge ${prefs.genderPreference === 'Female Only' ? 'pref-badge-female' : prefs.genderPreference === 'Both' ? 'pref-badge-both' : 'pref-badge-gender'}`} 
        title={`Gender Preference: ${prefs.genderPreference}`}
      >
        <User size={11} />
        <span>{prefs.genderPreference}</span>
      </span>

      {/* 6. AC Preference: Green (AC / Non-AC) */}
      <span className={`pref-badge ${prefs.acPreference === 'AC' ? 'pref-badge-ac' : 'pref-badge-nonac'}`} title={`AC Preference: ${prefs.acPreference}`}>
        <Wind size={11} />
        <span>{prefs.acPreference}</span>
      </span>
    </div>
  );
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

  const prefs = getCustomerRidePreferences(r);
  const vCategory = prefs.vehicleType;
  const vAc = prefs.acPreference === 'AC';
  const vLabel = `${vCategory} • ${prefs.acPreference}`;

  const fareFmt = r.fareFormatted || (r.fare !== undefined && r.fare !== null ? (typeof r.fare === 'number' ? `Rs. ${r.fare.toLocaleString()}` : String(r.fare)) : 'Rs. 9,500');

  const sUpper = String(r.status || '').trim().toUpperCase();
  const rawSUpper = String(r.rawStatus || '').trim().toUpperCase();
  const isExplicitPending = sUpper === 'PENDING' || sUpper === 'PENDING DISPATCH' || sUpper === 'VISIBLE' || sUpper === 'DRAFT' ||
                            rawSUpper === 'PENDING' || rawSUpper === 'PENDING DISPATCH' || rawSUpper === 'VISIBLE' || rawSUpper === 'REJECTED' || rawSUpper === 'DRAFT';

  const isAssigned = !isExplicitPending && (
    sUpper === 'ASSIGNED' || sUpper.startsWith('DISPATCH') || sUpper === 'COMPLETED' || sUpper === 'ON TRIP' || sUpper === 'IN PROGRESS' ||
    Boolean(r.assignedDriverDetails?.name && (r.driverId || r.driver))
  );
  const statusStr = isAssigned ? 'ASSIGNED' : 'Pending Dispatch';

  const realId = getDisplayId(r);

  return {
    ...r,
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
    selectedDays: (Array.isArray(r.selectedDays) && r.selectedDays.length > 0)
      ? r.selectedDays 
      : ((Array.isArray(r.customSchedule?.selectedDays) && r.customSchedule.selectedDays.length > 0)
          ? r.customSchedule.selectedDays
          : (Array.isArray(r.customSchedule?.days) && r.customSchedule.days.length > 0
              ? r.customSchedule.days
              : (typeof r.selectedDays === 'string' && r.selectedDays !== 'Customize' ? r.selectedDays : []))),
    customSchedule: r.customSchedule,
    scheduleType: r.scheduleType || 'Mon - Fri',
    scheduleTime: r.scheduleTime || prefs.morningTime,
    timeToReach: r.timeToReach || r.customSchedule?.fromTime || prefs.morningTime,
    timeToLeave: r.timeToLeave || r.customSchedule?.toTime || '05:00 PM',
    startingFrom: r.startingFrom || r.customSchedule?.startDate || prefs.startingDate,
    mongoId: r.mongoId || r._id,
    vehicleType: prefs.vehicleType,
    seatingArrangement: r.seatingArrangement || prefs.vehicleType,
    vehicleTypeSelection: r.vehicleTypeSelection || prefs.serviceType,
    acPreference: prefs.acPreference,
    tripType: prefs.tripType,
    serviceType: prefs.serviceType,
    genderPreference: prefs.genderPreference,
    returnPickupLocation: prefs.returnPickup,
    returnDropoffLocation: prefs.returnDropoff,
    returnDateTime: prefs.returnDateTime,
    additionalNotes: prefs.additionalNotes,
    notes: prefs.additionalNotes,
    vehicle: {
      label: vLabel,
      category: vCategory,
      ac: vAc
    },
    preferences: {
      vehicleCategory: vCategory,
      acRequired: vAc,
      serviceType: prefs.serviceType,
      genderPreference: prefs.genderPreference,
      tripType: prefs.tripType
    },
    fareFormatted: fareFmt,
    fare: typeof r.fare === 'number' ? r.fare : (Number(String(r.fare).replace(/\D/g, '')) || 9500),
    seatsNeeded: prefs.seatsCount,
    passengersCount: prefs.seatsCount,
    status: statusStr,
    driverId: r.driverId || r.driver,
    driver: r.driver || r.driverId,
    assignedDriverDetails: r.assignedDriverDetails
  };
};

const initialCustomerRides = [
  {
    _id: '6aa1080ebe696f0cde1a41e1',
    id: 'REQ-8031',
    requestId: 'REQ-8031',
    rideId: 'REQ-8031',
    customerName: 'Arbab Khan',
    passengerName: 'Arbab Khan',
    passengerPhone: '+92 300 1234567',
    passengerEmail: 'arbab.khan@gmail.com',
    pickupLocation: 'Blue Area, Jinnah Avenue, Islamabad',
    dropoffLocation: 'F-10 Markaz, Islamabad',
    dropLocation: 'F-10 Markaz, Islamabad',
    returnPickupLocation: 'F-10 Markaz, Islamabad',
    returnDropoffLocation: 'Blue Area, Jinnah Avenue, Islamabad',
    route: { summary: 'Blue Area, Islamabad ➔ F-10 Markaz, Islamabad' },
    startingFrom: '2026-09-18',
    date: '2026-09-18',
    scheduledTime: '2026-09-18 08:30 AM',
    timeToReach: '08:30 AM',
    timeToLeave: '05:00 PM',
    tripType: 'Two Way',
    serviceType: 'Separate',
    vehicleType: 'Sedan Executive',
    seatsNeeded: 2,
    genderPreference: 'Male Only',
    acPreference: 'AC',
    fare: 9500,
    fareFormatted: 'Rs. 9,500',
    additionalNotes: 'Pickup at Gate 2 promptly at 08:00 AM. AC must be on.',
    specialInstructions: 'Pickup at Gate 2 promptly at 08:00 AM. AC must be on.',
    status: 'Pending Dispatch',
    createdAt: new Date().toISOString()
  },
  {
    _id: '6aa1080ebe696f0cde1a41e2',
    id: 'REQ-8032',
    requestId: 'REQ-8032',
    rideId: 'REQ-8032',
    customerName: 'Ayesha Malik',
    passengerName: 'Ayesha Malik',
    passengerPhone: '+92 333 9876543',
    passengerEmail: 'ayesha.malik@outlook.com',
    pickupLocation: 'G-11/3, Street 44, Islamabad',
    dropoffLocation: 'Saddar Metro Station, Rawalpindi',
    dropLocation: 'Saddar Metro Station, Rawalpindi',
    returnPickupLocation: 'Saddar Metro Station, Rawalpindi',
    returnDropoffLocation: 'G-11/3, Street 44, Islamabad',
    route: { summary: 'G-11/3, Islamabad ➔ Saddar, Rawalpindi' },
    startingFrom: '2026-09-18',
    date: '2026-09-18',
    scheduledTime: '2026-09-18 08:00 AM',
    timeToReach: '08:00 AM',
    timeToLeave: '04:30 PM',
    tripType: 'Two Way',
    serviceType: 'Combined',
    vehicleType: 'SUV',
    seatsNeeded: 4,
    genderPreference: 'Female Only',
    acPreference: 'AC',
    fare: 14000,
    fareFormatted: 'Rs. 14,000',
    additionalNotes: 'Female college group. Verified experienced driver required.',
    specialInstructions: 'Female college group. Verified experienced driver required.',
    status: 'Pending Dispatch',
    createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString()
  },
  {
    _id: '6aa1070ebe696f0cde1a41c9',
    id: 'REQ-8013',
    requestId: 'REQ-8013',
    rideId: 'REQ-8013',
    customerName: 'khawar',
    passengerName: 'khawar',
    passengerPhone: '3165572409',
    passengerEmail: 'riazkhawar66@gmail.com',
    pickupLocation: 'Habib Bank Ltd., F11 Markaz, Hilal Road, F-11 Markaz',
    dropLocation: 'F7 Food Court, Bhitai Road, F-7/2, F-7',
    dropoffLocation: 'F7 Food Court, Bhitai Road, F-7/2, F-7',
    route: { summary: 'Habib Bank Ltd., F11 Markaz ➔ F7 Food Court, Bhitai Road' },
    scheduledTime: '2026-09-09 08:30 AM',
    vehicleType: 'Sedan',
    acPreference: 'AC',
    fareFormatted: 'Rs. 9,500',
    fare: 9500,
    status: 'Pending Dispatch'
  },
  {
    _id: '6aa0ef08568b2e37a859c933',
    id: 'REQ-8012',
    requestId: 'REQ-8012',
    customerName: 'khawar',
    passengerName: 'khawar',
    passengerPhone: '3165572409',
    passengerEmail: 'riazkhawar66@gmail.com',
    pickupLocation: 'peshawar',
    dropLocation: 'sindh',
    dropoffLocation: 'sindh',
    route: { summary: 'peshawar ➔ sindh' },
    scheduledTime: '2026-09-09 08:30 AM',
    vehicleType: 'Sedan',
    acPreference: 'Non AC',
    fareFormatted: 'Rs. 9,500',
    fare: 9500,
    status: 'Pending Dispatch'
  },
  {
    _id: '6a9feb1a1e69d035472211f7',
    id: 'REQ-8011',
    requestId: 'REQ-8011',
    customerName: 'khawar',
    passengerName: 'khawar',
    passengerPhone: '3165572409',
    pickupLocation: 'karachi',
    dropLocation: 'rawalpindi',
    dropoffLocation: 'rawalpindi',
    route: { summary: 'karachi ➔ rawalpindi' },
    scheduledTime: '2026-09-08 08:30 AM',
    vehicleType: 'Sedan',
    acPreference: 'AC',
    fareFormatted: 'Rs. 9,500',
    status: 'Pending Dispatch'
  },
  {
    _id: '6a9fe9231e69d035472211f6',
    id: 'REQ-8010',
    requestId: 'REQ-8010',
    customerName: 'khawar',
    passengerName: 'khawar',
    passengerPhone: '3165572409',
    pickupLocation: 'islamabad',
    dropLocation: 'lahore',
    dropoffLocation: 'lahore',
    route: { summary: 'islamabad ➔ lahore' },
    scheduledTime: '2026-09-08 08:30 AM',
    vehicleType: 'Sedan',
    acPreference: 'AC',
    fareFormatted: 'Rs. 9,500',
    status: 'Pending Dispatch'
  },
  {
    _id: '6a9fe7801e69d035472211f5',
    id: 'REQ-8009',
    requestId: 'REQ-8009',
    customerName: 'khawar',
    passengerName: 'khawar',
    passengerPhone: '3165572409',
    pickupLocation: 'lahore',
    dropLocation: 'islamabad',
    dropoffLocation: 'islamabad',
    route: { summary: 'lahore ➔ islamabad' },
    scheduledTime: '2026-09-08 08:30 AM',
    vehicleType: 'Sedan',
    acPreference: 'AC',
    fareFormatted: 'Rs. 9,500',
    status: 'Pending Dispatch'
  },
  {
    _id: '6a9fe3e31e69d035472211f4',
    id: 'REQ-8008',
    requestId: 'REQ-8008',
    customerName: 'khawar',
    passengerName: 'khawar',
    passengerPhone: '3165572409',
    pickupLocation: 'karachi',
    dropLocation: 'rawalpindi',
    dropoffLocation: 'rawalpindi',
    route: { summary: 'karachi ➔ rawalpindi' },
    scheduledTime: '2026-09-08 08:30 AM',
    vehicleType: 'Sedan',
    acPreference: 'AC',
    fareFormatted: 'Rs. 9,500',
    status: 'Pending Dispatch'
  },
  {
    _id: '6a9fe00ef5bc8b5739f389e7',
    id: 'REQ-8007',
    requestId: 'REQ-8007',
    customerName: 'khawar',
    passengerName: 'khawar',
    passengerPhone: '3165572409',
    pickupLocation: 'lahore',
    dropLocation: 'islamabad',
    dropoffLocation: 'islamabad',
    route: { summary: 'lahore ➔ islamabad' },
    scheduledTime: '2026-09-08 08:30 AM',
    vehicleType: 'Sedan',
    acPreference: 'AC',
    fareFormatted: 'Rs. 9,500',
    status: 'Pending Dispatch'
  },
  {
    _id: '6a9fd742f5bc8b5739f389e6',
    id: 'REQ-8006',
    requestId: 'REQ-8006',
    customerName: 'khawar',
    passengerName: 'khawar',
    passengerPhone: '3165572409',
    pickupLocation: 'islamabad',
    dropLocation: 'rawalpindi',
    dropoffLocation: 'rawalpindi',
    route: { summary: 'islamabad ➔ rawalpindi' },
    scheduledTime: '2026-09-08 08:30 AM',
    vehicleType: 'Sedan',
    acPreference: 'AC',
    fareFormatted: 'Rs. 9,500',
    status: 'Pending Dispatch'
  },
  {
    _id: '6a9fd321f5bc8b5739f389e5',
    id: 'REQ-8005',
    requestId: 'REQ-8005',
    customerName: 'khawar',
    passengerName: 'khawar',
    passengerPhone: '3165572409',
    pickupLocation: 'islamabad',
    dropLocation: 'rawalpindi',
    dropoffLocation: 'rawalpindi',
    route: { summary: 'islamabad ➔ rawalpindi' },
    scheduledTime: '2026-09-08 08:30 AM',
    vehicleType: 'Sedan',
    acPreference: 'AC',
    fareFormatted: 'Rs. 9,500',
    status: 'Pending Dispatch'
  },
  {
    _id: '6a9fc5414cc38e98c14bf8ec',
    id: 'REQ-8004',
    requestId: 'REQ-8004',
    customerName: 'abrar',
    passengerName: 'abrar',
    passengerPhone: '+92 300 1234567',
    pickupLocation: 'Rawalpindi',
    dropLocation: 'Islamabad',
    dropoffLocation: 'Islamabad',
    route: { summary: 'Rawalpindi ➔ Islamabad' },
    scheduledTime: '2026-09-01 08:00 AM',
    vehicleType: 'Executive',
    acPreference: 'AC',
    fareFormatted: 'Rs. 9,500',
    status: 'ASSIGNED'
  },
  {
    _id: '6a9fc5414cc38e98c14bf8eb',
    id: 'REQ-8003',
    requestId: 'REQ-8003',
    customerName: 'Khawar Riaz',
    passengerName: 'Khawar Riaz',
    passengerPhone: '+92 300 1234567',
    pickupLocation: 'Islamabad',
    dropLocation: 'Lahore',
    dropoffLocation: 'Lahore',
    route: { summary: 'Islamabad ➔ Lahore' },
    scheduledTime: '2026-09-01 08:00 AM',
    vehicleType: 'Sedan',
    acPreference: 'AC',
    fareFormatted: 'Rs. 9,500',
    status: 'ASSIGNED'
  },
  {
    _id: '6a9fc5414cc38e98c14bf8ea',
    id: 'REQ-8002',
    requestId: 'REQ-8002',
    customerName: 'Husnain Ahmed',
    passengerName: 'Husnain Ahmed',
    passengerPhone: '+92 300 1234567',
    pickupLocation: 'Islamabad',
    dropLocation: 'Rawalpindi',
    dropoffLocation: 'Rawalpindi',
    route: { summary: 'Islamabad ➔ Rawalpindi' },
    scheduledTime: '2026-09-01 08:00 AM',
    vehicleType: 'Sedan',
    acPreference: 'AC',
    fareFormatted: 'Rs. 9,500',
    status: 'Pending Dispatch'
  },
  {
    _id: '6a9fc5414cc38e98c14bf8e9',
    id: 'REQ-8001',
    requestId: 'REQ-8001',
    customerName: 'Sohaib baig',
    passengerName: 'Sohaib baig',
    passengerPhone: '+92 300 1234567',
    pickupLocation: 'Faisalabad',
    dropLocation: 'Sargodha',
    dropoffLocation: 'Sargodha',
    route: { summary: 'Faisalabad ➔ Sargodha' },
    scheduledTime: '2026-09-01 08:00 AM',
    vehicleType: 'Sedan',
    acPreference: 'AC',
    fareFormatted: 'Rs. 9,500',
    status: 'Pending Dispatch'
  }
];

const LOCAL_STORAGE_ASSIGNMENTS_KEY = 'rr_persistent_assigned_rides';
const RIDES_CACHE_KEY = 'rr_rides_cache_v7';

const getStoredAssignments = () => {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_ASSIGNMENTS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
};

const saveStoredAssignment = (rideId, assignmentData) => {
  try {
    const stored = getStoredAssignments();
    stored[String(rideId)] = { ...assignmentData, timestamp: Date.now() };
    localStorage.setItem(LOCAL_STORAGE_ASSIGNMENTS_KEY, JSON.stringify(stored));
  } catch (e) {}
};

const isRideAssigned = (r) => {
  if (!r) return false;

  const s = String(r.status || '').trim().toUpperCase();
  const rawS = String(r.rawStatus || '').trim().toUpperCase();

  // If explicitly pending, rejected, visible, or draft, it is NOT assigned!
  if (
    s === 'PENDING' || 
    s === 'PENDING DISPATCH' || 
    s === 'VISIBLE' || 
    s === 'DRAFT' ||
    rawS === 'PENDING' || 
    rawS === 'PENDING DISPATCH' || 
    rawS === 'VISIBLE' || 
    rawS === 'REJECTED' || 
    rawS === 'DRAFT'
  ) {
    return false;
  }
  
  // 1. Check local storage persistent assignments map
  const stored = getStoredAssignments();
  const rKey1 = r._id ? String(r._id) : null;
  const rKey2 = r.requestId ? String(r.requestId) : null;
  const rKey3 = r.id ? String(r.id) : null;
  const rKey4 = r.rideId ? String(r.rideId) : null;
  const rKey5 = r.mongoId ? String(r.mongoId) : null;

  if ((rKey1 && stored[rKey1]) || (rKey2 && stored[rKey2]) || (rKey3 && stored[rKey3]) || (rKey4 && stored[rKey4]) || (rKey5 && stored[rKey5])) {
    return true;
  }

  // 2. Check status flags
  if (s === 'ASSIGNED' || s.startsWith('DISPATCH') || s === 'COMPLETED' || s === 'ON TRIP' || s === 'IN PROGRESS') {
    return true;
  }

  // 3. Check driver assigned attributes
  if (r.driverId && String(r.driverId).trim() !== '' && String(r.driverId) !== 'null') {
    return true;
  }
  if (r.driver && String(r.driver).trim() !== '' && String(r.driver) !== 'null') {
    return true;
  }
  if (r.assignedDriverDetails?.driverCode || r.assignedDriverDetails?.name || r.assignedDriver) {
    return true;
  }

  return false;
};

const RideDispatch = () => {
  const [activeMainTab, setActiveMainTab] = useState('requests'); // 'requests' | 'driver-panel'
  const [rideRequests, setRideRequests] = useState(() => {
    try {
      ['rr_rides_cache', 'rr_rides_cache_v2', 'rr_rides_cache_v3', 'rr_rides_cache_v4', 'rr_rides_cache_v5', 'rr_rides_cache_v6'].forEach(k => {
        try { localStorage.removeItem(k); } catch (err) {}
      });
      const cached = localStorage.getItem(RIDES_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed.map(r => normalizeRide(r) || r);
      }
    } catch (e) {}
    return initialCustomerRides;
  });
  const rides = rideRequests;
  const setRides = setRideRequests;
  const [availableDriversLocal, setAvailableDriversLocal] = useState([]);
  const [selectedRide, setSelectedRide] = useState(null);
  const [viewPassengerModal, setViewPassengerModal] = useState(null);
  const [viewDriverModal, setViewDriverModal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('table'); // 'table' or 'grid'
  
  // Socket.IO real-time connection status (http://localhost:5000)
  const [socketConnected, setSocketConnected] = useState(false);
  const activeSocketsRef = useRef([]);

  // Filter tabs for Passenger Requests Console: 'all', 'pending', 'assigned'
  const [requestStatusFilter, setRequestStatusFilter] = useState('pending');
  const [requestSearchQuery, setRequestSearchQuery] = useState('');

  // Dedicated Dispatch Modal state
  const [dispatchModalRide, setDispatchModalRide] = useState(null);
  const [selectedDriverForDispatch, setSelectedDriverForDispatch] = useState(null);
  const [dispatchDriverSearch, setDispatchDriverSearch] = useState('');
  const [isSubmittingDispatch, setIsSubmittingDispatch] = useState(false);

  const openDispatchModal = (ride) => {
    setDispatchModalRide(ride);
    setSelectedDriverForDispatch(null);
    setDispatchDriverSearch('');
    if (ride?.assignedDriverId || ride?.driverId) {
      const existing = availableDriversLocal.find(d => String(d.id || d._id) === String(ride.assignedDriverId || ride.driverId));
      if (existing) setSelectedDriverForDispatch(existing);
    }
  };
  
  // Filtering state for Driver Selection
  const [driverSearchQuery, setDriverSearchQuery] = useState('');
  const [filterAC, setFilterAC] = useState('all'); // all, ac, non-ac
  const [filterCategory, setFilterCategory] = useState('all'); // all, Executive, Sedan, Mini, Van
  const [searchRoute, setSearchRoute] = useState('');
  
  // Driver Panel tab search & filter
  const [driverPanelSearch, setDriverPanelSearch] = useState('');
  const [driverPanelFilter, setDriverPanelFilter] = useState('all'); // 'all', 'assigned', 'available'

  // Schedule Ride tab search & filter
  const [scheduleSearchQuery, setScheduleSearchQuery] = useState('');
  const [scheduleStatusFilter, setScheduleStatusFilter] = useState('all'); // 'all', 'pending', 'assigned'
  const [scheduledRides, setScheduledRides] = useState([]);
  const [travelRequests, setTravelRequests] = useState([]);
  const [travelSearchQuery, setTravelSearchQuery] = useState('');
  const [travelStatusFilter, setTravelStatusFilter] = useState('all');

  // Hire Driver tab search & filter
  const [driverHireRequests, setDriverHireRequests] = useState([]);
  const [hireLoading, setHireLoading] = useState(false);
  const [hireSearchQuery, setHireSearchQuery] = useState('');
  const [hireStatusFilter, setHireStatusFilter] = useState('all'); // 'all', 'pending', 'assigned'

  // Driver Replacement tab search & filter
  const [replacementRequests, setReplacementRequests] = useState([]);
  const [replacementLoading, setReplacementLoading] = useState(false);
  const [replacementSearchQuery, setReplacementSearchQuery] = useState('');
  const [replacementStatusFilter, setReplacementStatusFilter] = useState('all'); // 'all', 'pending', 'assigned'

  // Dedicated Inline Fare Edit Modal state
  const [fareModalRide, setFareModalRide] = useState(null);
  const [fareModalAmount, setFareModalAmount] = useState('');
  const [isSavingFareModal, setIsSavingFareModal] = useState(false);

  const openFareEditModal = (ride) => {
    setFareModalRide(ride);
    const initial = typeof ride.fare === 'number' 
      ? ride.fare 
      : (Number(String(ride.fare || '').replace(/[^0-9.]/g, '')) || 9500);
    setFareModalAmount(String(initial));
  };

  const handleSaveFareModal = async (e) => {
    if (e) e.preventDefault();
    if (!fareModalRide) return;
    const num = Number(String(fareModalAmount).replace(/[^0-9.]/g, ''));
    if (isNaN(num) || num <= 0) {
      alert('Please enter a valid fare amount');
      return;
    }

    const rideId = fareModalRide.requestId || fareModalRide.mongoId || fareModalRide._id || fareModalRide.id;
    const targetMongoId = fareModalRide.mongoId || fareModalRide._id || rideId;
    const formattedFare = `Rs. ${num.toLocaleString()}`;
    setIsSavingFareModal(true);

    const payload = {
      fare: num,
      fareAmount: num,
      price: num,
      rawFare: num,
      fareFormatted: formattedFare,
      status: 'Waiting for Customer'
    };

    // Handle Schedule Rides fare update
    if (activeMainTab === 'schedule-rides') {
      setScheduledRides(prev => prev.map(h => String(h._id) === String(targetMongoId) ? { ...h, fare: num, fareFormatted: formattedFare, status: 'Waiting for Customer' } : h));
      setToastMessage(`✓ Schedule Ride Fare updated to ${formattedFare}!`);
      setTimeout(() => setToastMessage(''), 3500);
      try {
        await fetch(`${BACKEND_URL}/api/schedule-rides/${targetMongoId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fare: num, fareFormatted: formattedFare, status: 'Waiting for Customer' })
        });
      } catch (err) {}
      setIsSavingFareModal(false);
      setFareModalRide(null);
      return;
    }

    // Handle Travel & Tourism fare update
    if (activeMainTab === 'travel-requests') {
      setTravelRequests(prev => prev.map(h => String(h._id) === String(targetMongoId) ? { ...h, fare: num, fareFormatted: formattedFare, status: 'Waiting for Customer' } : h));
      setToastMessage(`✓ Travel & Tourism Fare updated to ${formattedFare}!`);
      setTimeout(() => setToastMessage(''), 3500);
      try {
        await fetch(`${BACKEND_URL}/api/travel-requests/${targetMongoId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fare: num, fareFormatted: formattedFare, status: 'Waiting for Customer' })
        });
      } catch (err) {}
      setIsSavingFareModal(false);
      setFareModalRide(null);
      return;
    }
    // If this is a Driver Hire request
    if (fareModalRide.isDriverHire || fareModalRide.requestId?.startsWith('HDR-') || fareModalRide._type === 'hire') {
      setDriverHireRequests(prev => prev.map(h => {
        const match = (h._id && fareModalRide._id && String(h._id) === String(fareModalRide._id)) ||
                      (h.requestId && fareModalRide.requestId && String(h.requestId) === String(fareModalRide.requestId)) ||
                      (h.mongoId && fareModalRide.mongoId && String(h.mongoId) === String(fareModalRide.mongoId));
        return match ? { ...h, fare: num, fareFormatted: formattedFare, status: 'Waiting for Customer' } : h;
      }));

      setToastMessage(`✓ Driver Hire Fare updated to ${formattedFare} for ${fareModalRide.requestId || rideId}!`);
      setTimeout(() => setToastMessage(''), 3500);

      const hireUrls = [
        `${BACKEND_URL}/api/driver-hire/${targetMongoId}`,
        `${BACKEND_URL}/api/driver-hire/${rideId}`,
        `http://localhost:5000/api/driver-hire/${targetMongoId}`,
        `http://localhost:5000/api/driver-hire/${rideId}`,
        `/api/driver-hire/${targetMongoId}`
      ];

      try {
        await Promise.allSettled(hireUrls.map(url =>
          fetch(url, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          })
        ));
      } catch (err) {
        console.warn('Driver hire fare update error:', err);
      }

      setIsSavingFareModal(false);
      setFareModalRide(null);
      if (typeof loadDriverHires === 'function') loadDriverHires();
      return;
    }

    setRideRequests(prev => {
      const updated = prev.map(r => {
        const match = (r._id && fareModalRide._id && String(r._id) === String(fareModalRide._id)) ||
                      (r.requestId && fareModalRide.requestId && String(r.requestId) === String(fareModalRide.requestId)) ||
                      (r.id && fareModalRide.id && String(r.id) === String(fareModalRide.id)) ||
                      (r.mongoId && fareModalRide.mongoId && String(r.mongoId) === String(fareModalRide.mongoId));
        if (match) {
          return { ...r, ...payload };
        }
        return r;
      });
      try {
        localStorage.setItem(RIDES_CACHE_KEY, JSON.stringify(updated));
      } catch (err) {}
      return updated;
    });

    setToastMessage(`✓ Scheduled Fare updated to ${formattedFare} for ${fareModalRide.requestId || rideId}!`);
    setTimeout(() => setToastMessage(''), 3500);

    const urls = [
      `${BACKEND_URL}/api/rides/${targetMongoId}`,
      `${BACKEND_URL}/api/rides/${rideId}`,
      `/api/rides/${targetMongoId}`,
      `/api/rides/${rideId}`,
      `http://localhost:5000/api/rides/${targetMongoId}`,
      `http://localhost:5000/api/rides/${targetMongoId}`
    ];

    try {
      await Promise.allSettled(urls.map(url =>
        fetch(url, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
      ));
    } catch (err) {
      console.warn('Fare update API error:', err);
    }

    setIsSavingFareModal(false);
    setFareModalRide(null);
    loadRides();
  };

  const [toastMessage, setToastMessage] = useState('');

  // Inline Fare Editing state & handler
  const [editingFareId, setEditingFareId] = useState(null);
  const [editingFareValue, setEditingFareValue] = useState('');
  const [isSavingFare, setIsSavingFare] = useState(false);

  const handleSaveFare = async (ride, newFare) => {
    const num = Number(String(newFare).replace(/[^0-9.]/g, ''));
    if (isNaN(num) || num <= 0) {
      alert('Please enter a valid fare amount');
      return;
    }

    const rideId = ride.requestId || ride._id || ride.mongoId || ride.id;
    const formattedFare = `Rs. ${num.toLocaleString()}`;
    setIsSavingFare(true);

    const payload = {
      fare: num,
      fareAmount: num,
      price: num,
      rawFare: num,
      fareFormatted: formattedFare
    };

    // Update local UI state immediately (optimistic update)
    setRideRequests(prev => {
      const updated = prev.map(r => {
        const match = (r._id && ride._id && String(r._id) === String(ride._id)) ||
                      (r.requestId && ride.requestId && String(r.requestId) === String(ride.requestId)) ||
                      (r.id && ride.id && String(r.id) === String(ride.id)) ||
                      (r.mongoId && ride.mongoId && String(r.mongoId) === String(ride.mongoId));
        if (match) {
          return {
            ...r,
            fare: num,
            fareAmount: num,
            price: num,
            rawFare: num,
            fareFormatted: formattedFare
          };
        }
        return r;
      });
      try {
        localStorage.setItem(RIDES_CACHE_KEY, JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });

    if (selectedRide) {
      const match = (selectedRide._id && ride._id && String(selectedRide._id) === String(ride._id)) ||
                    (selectedRide.requestId && ride.requestId && String(selectedRide.requestId) === String(ride.requestId)) ||
                    (selectedRide.id && ride.id && String(selectedRide.id) === String(ride.id));
      if (match) {
        setSelectedRide(prev => ({
          ...prev,
          fare: num,
          fareAmount: num,
          price: num,
          rawFare: num,
          fareFormatted: formattedFare
        }));
      }
    }

    setEditingFareId(null);
    setToastMessage(`✓ Fare updated to ${formattedFare} for ${ride.requestId || ride.id || 'ride'}`);
    setTimeout(() => setToastMessage(''), 3000);

    // Call all endpoints in parallel with fast 2500ms timeout
    const targetId = ride._id || ride.mongoId || rideId;
    const urls = [
      `${BACKEND_URL}/api/rides/${targetId}`,
      `${BACKEND_URL}/api/rides/${rideId}`,
      `/api/rides/${targetId}`,
      `/api/rides/${rideId}`,
      `http://localhost:5000/api/rides/${targetId}`,
      `http://localhost:5000/api/rides/${rideId}`,
      `http://localhost:5000/api/rides/${targetId}`,
      `http://localhost:5000/api/rides/${rideId}`
    ];
    const uniqueUrls = Array.from(new Set(urls.filter(Boolean)));

    const fetchPromises = [];
    for (const url of uniqueUrls) {
      const ctrlPatch = new AbortController();
      const tidPatch = setTimeout(() => ctrlPatch.abort(), 2500);
      fetchPromises.push(
        fetch(url, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: ctrlPatch.signal
        }).finally(() => clearTimeout(tidPatch)).catch(() => null)
      );

      const ctrlPut = new AbortController();
      const tidPut = setTimeout(() => ctrlPut.abort(), 2500);
      fetchPromises.push(
        fetch(url, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: ctrlPut.signal
        }).finally(() => clearTimeout(tidPut)).catch(() => null)
      );
    }

    try {
      await Promise.allSettled(fetchPromises);
    } catch (e) {}

    setIsSavingFare(false);
    loadRides();
  };
  const [toastActionDriver, setToastActionDriver] = useState(null);

  // 1. Live data fetching from backend ${BACKEND_URL}/api/rides with real-time sync
  const loadRides = useCallback(async () => {
    try {
      let list = [];
      const timestamp = Date.now();
      const endpoints = [
        `${BACKEND_URL}/api/rides?_t=${timestamp}`,
        `${BACKEND_URL}/api/rides`,
        `${BACKEND_URL}/api/rides?status=pending`,
        `/api/rides?_t=${timestamp}`,
        `/api/rides`,
        `http://localhost:5000/api/rides?_t=${timestamp}`,
        `http://localhost:5000/api/rides`,
        `http://localhost:5000/api/rides`
      ];

      for (const url of endpoints) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 1500);
          const res = await fetch(url, { signal: controller.signal });
          clearTimeout(timeoutId);
          if (res.ok) {
            const data = await res.json();
            const rawList = Array.isArray(data.data) 
              ? data.data 
              : (Array.isArray(data.rides) 
                  ? data.rides 
                  : (Array.isArray(data) 
                      ? data 
                      : (data.data?.rides || [])));
            if (Array.isArray(rawList) && rawList.length > 0) {
              list = rawList;
              break;
            }
          }
        } catch (e) {}
      }

      // Also fetch assigned rides so Driver Panel stays updated
      let assignedList = [];
      try {
        const assignedRes = await fetch(`${BACKEND_URL}/api/rides/assigned`, { signal: AbortSignal.timeout(1500) }).catch(() => null);
        if (assignedRes && assignedRes.ok) {
          const aData = await assignedRes.json();
          assignedList = aData.data?.rides || aData.data || aData.rides || [];
        }
      } catch (e) {}

      const combined = [...list, ...(Array.isArray(assignedList) ? assignedList : [])];

      if (Array.isArray(combined) && combined.length > 0) {
        const idMap = new Map();
        combined.forEach(r => {
          if (!r) return;
          const normalized = normalizeRide(r) || r;
          const key = String(normalized.requestId || normalized.id || normalized._id || normalized.rideId);
          if (!idMap.has(key)) {
            idMap.set(key, normalized);
          }
        });

        const uniqueRides = Array.from(idMap.values());
        if (uniqueRides.length > 0) {
          setRideRequests(prev => {
            // Keep any real-time socket rides in prev that haven't synced to backend GET /api/rides yet
            const prevPendingNotYetInBackend = prev.filter(pr => {
              const pKey = String(pr.requestId || pr.id || pr._id || pr.rideId);
              return !idMap.has(pKey);
            });
            const merged = [...prevPendingNotYetInBackend, ...uniqueRides];
            try {
              localStorage.setItem(RIDES_CACHE_KEY, JSON.stringify(merged));
            } catch (e) {}
            return merged;
          });
        }
      }
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch Drivers from Admin Backend (Primary: http://localhost:5000/admin/drivers/verified)
  const fetchDrivers = useCallback(async () => {
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('admin_token');
      const authHeader = token ? { Authorization: `Bearer ${token}` } : {};

      let drvRes = await fetch(`${BACKEND_URL}/admin/driver/verified`, {
        headers: { ...authHeader, 'Content-Type': 'application/json' }
      }).catch(() => null);

      if (!drvRes || !drvRes.ok) {
        drvRes = await fetch(`${ADMIN_5000}/admin/driver`, {
          headers: authHeader
        }).catch(() => null);
      }
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
            name: d.Name || d.name || 'Driver',
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

  // Fetch Driver Hire requests from ${BACKEND_URL}/api/driver-hire
  
  const loadScheduleRides = useCallback(async () => {
    try {
      const endpoints = [`${BACKEND_URL}/api/schedule-rides`, `http://localhost:5000/api/schedule-rides`, `/api/schedule-rides`];
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
      const endpoints = [`${BACKEND_URL}/api/travel-requests`, `http://localhost:5000/api/travel-requests`, `/api/travel-requests`];
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

  const loadDriverHires = useCallback(async () => {
    try {
      const endpoints = [
        `${BACKEND_URL}/api/driver-hire`,
        `http://localhost:5000/api/driver-hire`,
        `/api/driver-hire`
      ];
      for (const url of endpoints) {
        try {
          const res = await fetch(url);
          if (res.ok) {
            const json = await res.json();
            const list = Array.isArray(json) ? json : (json.data || []);
            if (Array.isArray(list)) {
              setDriverHireRequests(list);
              break;
            }
          }
        } catch (e) {}
      }
    } catch (err) {
      console.warn('Error fetching driver hire requests:', err);
    }
  }, []);

  // Fetch Replacement requests from ${BACKEND_URL}/api/replacement-requests
  const loadReplacements = useCallback(async () => {
    try {
      const endpoints = [
        `${BACKEND_URL}/api/replacement-requests`,
        `http://localhost:5000/api/replacement-requests`,
        `/api/replacement-requests`
      ];
      for (const url of endpoints) {
        try {
          const res = await fetch(url);
          if (res.ok) {
            const json = await res.json();
            const list = Array.isArray(json) ? json : (json.data || []);
            if (Array.isArray(list)) {
              setReplacementRequests(list);
              break;
            }
          }
        } catch (e) {}
      }
    } catch (err) {
      console.warn('Error fetching replacement requests:', err);
    }
  }, []);

  // Reject Replacement Request
  const handleRejectReplacement = async (item) => {
    const id = item.mongoId || item._id || item.requestId;
    if (!id) return;
    if (!window.confirm(`Are you sure you want to reject the replacement request for ${item.clientName || 'Client'}?`)) return;

    setReplacementRequests(prev => prev.map(r => {
      const match = (r.mongoId && String(r.mongoId) === String(id)) ||
                    (r._id && String(r._id) === String(id)) ||
                    (r.requestId && String(r.requestId) === String(id));
      return match ? { ...r, status: 'Rejected' } : r;
    }));

    setToastMessage(`✓ Replacement request ${item.requestId || id} marked as Rejected`);
    setTimeout(() => setToastMessage(''), 3500);

    try {
      await Promise.allSettled([
        fetch(`${BACKEND_URL}/api/replacement-requests/${id}/reject`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: 'Declined by Admin' })
        }),
        fetch(`http://localhost:5000/api/replacement-requests/${id}/reject`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: 'Declined by Admin' })
        })
      ]);
      if (typeof loadReplacements === 'function') loadReplacements();
    } catch (e) {}
  };

  // 3. Live Socket.IO Connectivity (listening to 'new-ride', 'ride-updated', 'new-driver-hire', 'new-replacement-request') & 2-second fast auto-fetch fallback
  useEffect(() => {
    loadRides();
    loadDriverHires();
    loadReplacements();
    loadScheduleRides();
    loadTravelRequests();
    fetchDrivers();

    const sockets = [];
    const socketUrls = Array.from(new Set([
      BACKEND_URL || 'http://localhost:5000',
      'http://localhost:5000',
      'http://localhost:5000'
    ].filter(Boolean)));

    const handleIncomingRide = (incoming) => {
      if (incoming) {
        const raw = incoming.ride || incoming.data || incoming;
        const norm = normalizeRide(raw) || raw;
        
        const reqType = String(norm.requestType || norm.category || norm.rideType || '').trim();
        const reqId = String(norm.requestId || '');

        if (reqType === 'Schedule Ride' || reqId.startsWith('SCH-')) {
          setScheduledRides(prev => {
            if (prev.some(r => r.requestId === norm.requestId || r._id === norm._id)) return prev;
            return [norm, ...prev];
          });
          return;
        }

        if (reqType === 'Travel & Tourism' || reqId.startsWith('TT-')) {
          setTravelRequests(prev => {
            if (prev.some(r => r.requestId === norm.requestId || r._id === norm._id)) return prev;
            return [norm, ...prev];
          });
          return;
        }

        if (reqType === 'Hire Driver' || reqId.startsWith('HDR-')) {
          setDriverHireRequests(prev => {
            if (prev.some(r => r.requestId === norm.requestId || r._id === norm._id)) return prev;
            return [norm, ...prev];
          });
          return;
        }

        setRideRequests(prev => {
          const key = String(norm.mongoId || norm._id || norm.requestId || norm.id || norm.rideId);
          const filtered = prev.filter(r => String(r.mongoId || r._id || r.requestId || r.id || r.rideId) !== key);
          const updated = [norm, ...filtered];
          try {
            localStorage.setItem(RIDES_CACHE_KEY, JSON.stringify(updated));
          } catch (e) {}
          return updated;
        });
      }
    };

    socketUrls.forEach(url => {
      try {
        const s = io(url, {
          transports: ['websocket', 'polling'],
          reconnection: true,
          reconnectionAttempts: 30,
          reconnectionDelay: 1000,
          timeout: 3000
        });

        s.on('connect', () => {
          setSocketConnected(true);
          s.emit('join-admin');
        });
        s.on('disconnect', () => {
          setSocketConnected(false);
        });
        s.on('connect_error', () => {
          setSocketConnected(false);
        });

        // 1. Listen to 'new-ride' and 'newRide' -> immediately prepend new ride to Passenger Request Queue in real-time (within 1-2s)
        s.on('new-ride', (incoming) => {
          handleIncomingRide(incoming);
          const raw = incoming?.ride || incoming?.data || incoming;
          const name = raw?.passengerName || raw?.customerName || 'Customer';
          const rId = raw?.requestId || raw?.id || 'REQ';
          setToastMessage(`🔔 New Monthly Ride Request: ${rId} from ${name}!`);
          setTimeout(() => setToastMessage(''), 5000);
        });
        s.on('newRide', (incoming) => {
          handleIncomingRide(incoming);
        });

        // 2. Listen to 'ride-update' and 'ride-updated' -> update matching request item in queue or remove if dispatched
        s.on('ride-update', (data) => {
          if (data) {
            const raw = data.ride || data.data || data;
            const norm = normalizeRide(raw) || raw;
            const key = String(norm.mongoId || norm._id || norm.requestId || norm.id || norm.rideId);
            setRideRequests(prev => {
              const updated = prev.map(r => {
                const rKey = String(r.mongoId || r._id || r.requestId || r.id || r.rideId);
                return rKey === key ? { ...r, ...norm } : r;
              });
              try {
                localStorage.setItem(RIDES_CACHE_KEY, JSON.stringify(updated));
              } catch (e) {}
              return updated;
            });
          }
        });
        s.on('ride-updated', (data) => {
          if (data) {
            const raw = data.ride || data.data || data;
            const norm = normalizeRide(raw) || raw;
            const key = String(norm.mongoId || norm._id || norm.requestId || norm.id || norm.rideId);
            setRideRequests(prev => {
              const updated = prev.map(r => {
                const rKey = String(r.mongoId || r._id || r.requestId || r.id || r.rideId);
                return rKey === key ? { ...r, ...norm } : r;
              });
              try {
                localStorage.setItem(RIDES_CACHE_KEY, JSON.stringify(updated));
              } catch (e) {}
              return updated;
            });
          }
        });
        s.on('new-hire-request', handleIncomingRide);
        s.on('ride-created', handleIncomingRide);

        // 3. Listen to 'ride-dispatched' -> move ride from Pending to Assigned
        s.on('ride-dispatched', (data) => {
          if (data?.rideId || data?.requestId) {
            const rId = String(data.requestId || data.rideId);
            setRideRequests(prev => prev.map(r => {
              const match = String(r.requestId) === rId || String(r._id) === rId || String(r.mongoId) === rId;
              if (match) {
                return {
                  ...r,
                  status: 'ASSIGNED',
                  assignedDriverName: data.driverName || r.assignedDriverName,
                  assignedDriverId: data.driverId || r.assignedDriverId
                };
              }
              return r;
            }));
          }
          loadRides();
          loadDriverHires();
          loadReplacements();
        });
        s.on('ride-assigned', (data) => { 
          if (data?.rideId || data?.requestId || data?._id) {
            const rId = String(data.requestId || data.rideId || data._id);
            setRideRequests(prev => prev.map(r => {
              const match = String(r.requestId) === rId || String(r._id) === rId || String(r.mongoId) === rId;
              if (match) {
                return {
                  ...r,
                  status: 'ASSIGNED',
                  assignedDriverName: data.driverName || r.assignedDriverName,
                  assignedDriverId: data.driverId || r.assignedDriverId
                };
              }
              return r;
            }));
          }
        });

        // 4. Listen to 'replacement-requested' -> show replacement request notification
        s.on('replacement-requested', (data) => {
          loadReplacements();
          loadRides();
          setToastMessage(`⚠️ Replacement Driver Requested for ride ${data?.requestId || data?.rideId || ''}!`);
          setTimeout(() => setToastMessage(''), 5000);
        });

        // TAB 2: SCHEDULE RIDES
        s.on('new-schedule-ride', (data) => {
          if (data) {
            setScheduledRides(prev => {
              const exists = prev.some(r => r._id === data._id || (data.requestId && r.requestId === data.requestId));
              return exists ? prev : [data, ...prev];
            });
          }
        });
        s.on('schedule-ride-dispatched', (data) => {
          if (data) {
            setScheduledRides(prev => prev.map(r => 
              (r._id === data._id || (data.requestId && r.requestId === data.requestId)) 
                ? { ...r, ...data, status: 'ASSIGNED' } : r
            ));
          }
        });
        s.on('schedule-ride-updated', (data) => {
          if (data) {
            const updated = data.scheduleRide || data;
            setScheduledRides(prev => prev.map(r => 
              (r._id === updated._id || (updated.requestId && r.requestId === updated.requestId)) 
                ? { ...r, ...updated } : r
            ));
          }
        });

        // TAB 3: TRAVEL & TOURISM
        s.on('new-travel-request', (data) => {
          if (data) {
            setTravelRequests(prev => {
              const exists = prev.some(r => r._id === data._id || (data.requestId && r.requestId === data.requestId));
              return exists ? prev : [data, ...prev];
            });
          }
        });
        s.on('travel-request-dispatched', (data) => {
          if (data) {
            setTravelRequests(prev => prev.map(r => 
              (r._id === data._id || (data.requestId && r.requestId === data.requestId)) 
                ? { ...r, ...data, status: 'ASSIGNED' } : r
            ));
          }
        });
        s.on('travel-request-updated', (data) => {
          if (data) {
            const updated = data.travelRequest || data;
            setTravelRequests(prev => prev.map(r => 
              (r._id === updated._id || (updated.requestId && r.requestId === updated.requestId)) 
                ? { ...r, ...updated } : r
            ));
          }
        });

        // TAB 4: HIRE DRIVER
        s.on('new-driver-hire', (data) => {
          if (data) {
            setDriverHireRequests(prev => {
              const exists = prev.some(r => r._id === data._id || (data.requestId && r.requestId === data.requestId));
              return exists ? prev : [data, ...prev];
            });
            if (data.customerName) {
              setToastMessage(`? New Driver Hire Request received from ${data.customerName}!`);
              setTimeout(() => setToastMessage(''), 5000);
            }
          }
        });
        s.on('driver-hire-dispatched', (data) => {
          if (data) {
            setDriverHireRequests(prev => prev.map(r => 
              (r._id === data._id || (data.requestId && r.requestId === data.requestId)) 
                ? { ...r, ...data, status: 'ASSIGNED' } : r
            ));
          }
        });
        s.on('driver-hire-updated', (data) => {
          if (data) {
            const updated = data.hireRequest || data;
            setDriverHireRequests(prev => prev.map(r => 
              (r._id === updated._id || (updated.requestId && r.requestId === updated.requestId)) 
                ? { ...r, ...updated } : r
            ));
          }
        });
        s.on('driver-hire-update', (data) => {
          if (data) {
            const updated = data.hireRequest || data;
            setDriverHireRequests(prev => prev.map(r => 
              (r._id === updated._id || (updated.requestId && r.requestId === updated.requestId)) 
                ? { ...r, ...updated } : r
            ));
          }
        });

        // Replacement request events
        s.on('new-replacement-request', (data) => {
          loadReplacements();
          if (data?.clientName) {
            setToastMessage(`✓ New Replacement Driver Request from ${data.clientName}!`);
            setTimeout(() => setToastMessage(''), 5000);
          }
        });
        s.on('replacement-request-updated', () => loadReplacements());
        s.on('replacement-updated', () => loadReplacements());

        sockets.push(s);
      } catch (e) {
        console.warn(`Socket connection error for ${url}:`, e);
      }
    });

    activeSocketsRef.current = sockets;

    // Professional Approach: Socket.IO handles real-time updates.
    // Slow fallback polling (every 60 seconds) to ensure sync without overloading the server.
    const fallbackTimer = setInterval(() => {
      loadRides();
      loadScheduleRides();
      loadTravelRequests();
      loadDriverHires();
      loadReplacements();
      fetchDrivers();
    }, 60000);

    return () => {
      activeSocketsRef.current = [];
      sockets.forEach(s => {
        try { s.disconnect(); } catch (e) {}
      });
      clearInterval(fallbackTimer);
    };
  }, [loadRides, loadDriverHires, loadReplacements, fetchDrivers]);

  // Ensure the 'Passenger Request Queue' only loads customer requests with status 'Pending Dispatch' from ${BACKEND_URL}/api/rides?status=pending and updates in real-time via Socket.IO 'new-ride' event
  const pendingRides = useMemo(() => {
    return rides.filter(r => {
      const s = String(r.status || '').trim();
      const rawS = String(r.rawStatus || '').trim().toUpperCase();
      const isPendingDispatch = s === 'Pending Dispatch' || s.toUpperCase() === 'PENDING DISPATCH' || rawS === 'PENDING DISPATCH' || rawS === 'PENDING' || s.toUpperCase() === 'PENDING' || s === 'Fare Accepted' || s === 'Fare Rejected' || rawS === 'FARE ACCEPTED' || rawS === 'FARE REJECTED';
      return isPendingDispatch && !isRideAssigned(r);
    }).sort((a, b) => {
      const numA = parseInt(String(a.requestId || a.id || '').replace(/\D/g, ''), 10);
      const numB = parseInt(String(b.requestId || b.id || '').replace(/\D/g, ''), 10);
      if (!isNaN(numA) && !isNaN(numB) && numA !== numB) {
        return numB - numA;
      }
      const dateA = new Date(a.createdAt || a.date || 0).getTime();
      const dateB = new Date(b.createdAt || b.date || 0).getTime();
      return dateB - dateA;
    });
  }, [rides]);

  // Assigned rides ALWAYS and PERMANENTLY appear in Driver Panel & Live Assigned Rides
  const assignedRides = useMemo(() => {
    return rides.filter(r => isRideAssigned(r));
  }, [rides]);

  // Request Console Counts
  const totalRequestsCount = rides.length;
  const pendingRequestsCount = pendingRides.length;
  const assignedRequestsCount = assignedRides.length;

  // Filtered Console Rides: filter tabs ("All Requests", "Pending", "Assigned") & Search Bar
  const filteredConsoleRides = useMemo(() => {
    return rides.filter(r => {
      if (!r) return false;
      const assigned = isRideAssigned(r);
      const s = String(r.status || '').trim();

      if (requestStatusFilter === 'pending') {
        if (assigned || s === 'ASSIGNED' || s.startsWith('Dispatched') || s.toUpperCase() === 'WAITING FOR CUSTOMER') return false;
      } else if (requestStatusFilter === 'assigned') {
        if (!assigned && s !== 'ASSIGNED' && !s.startsWith('Dispatched')) return false;
      }

      if (requestSearchQuery.trim()) {
        const q = requestSearchQuery.toLowerCase().trim();
        const id = String(r.requestId || r.id || r.displayId || '').toLowerCase();
        const name = String(r.passengerName || r.customerName || r.passenger?.name || '').toLowerCase();
        const phone = String(r.passengerPhone || r.customerPhone || r.phone || r.passenger?.phone || '').toLowerCase();
        const email = String(r.passengerEmail || r.customerEmail || r.email || r.passenger?.email || '').toLowerCase();
        const pickup = String(typeof r.pickupLocation === 'object' ? r.pickupLocation?.address : (r.pickupLocation || '')).toLowerCase();
        const dropoff = String(typeof r.dropoffLocation === 'object' ? r.dropoffLocation?.address : (r.dropoffLocation || r.dropLocation || '')).toLowerCase();
        const cnic = String(r.cnic || '').toLowerCase();
        const notes = String(r.notes || r.additionalNotes || '').toLowerCase();

        const match = id.includes(q) || name.includes(q) || phone.includes(q) || email.includes(q) || pickup.includes(q) || dropoff.includes(q) || cnic.includes(q) || notes.includes(q);
        if (!match) return false;
      }

      return true;
    }).sort((a, b) => {
      const numA = parseInt(String(a.requestId || a.id || '').replace(/\D/g, ''), 10);
      const numB = parseInt(String(b.requestId || b.id || '').replace(/\D/g, ''), 10);
      if (!isNaN(numA) && !isNaN(numB) && numA !== numB) {
        return numB - numA;
      }
      const dateA = new Date(a.createdAt || a.date || 0).getTime();
      const dateB = new Date(b.createdAt || b.date || 0).getTime();
      return dateB - dateA;
    });
  }, [rides, requestStatusFilter, requestSearchQuery]);

  // Filter and display all customer schedule bookings (scheduleType containing 'Schedule Ride' or custom schedule dates/times)
  

  const filteredScheduledRides = useMemo(() => {
    return scheduledRides.filter(r => {
      const isAssigned = isRideAssigned(r);
      const s = String(r.status || '').toUpperCase();
      if (scheduleStatusFilter === 'pending') {
        if (isAssigned || s === 'ASSIGNED' || s === 'WAITING FOR CUSTOMER') return false;
      } else if (scheduleStatusFilter === 'assigned') {
        if (!isAssigned && s !== 'ASSIGNED') return false;
      }

      if (scheduleSearchQuery.trim()) {
        const q = scheduleSearchQuery.toLowerCase().trim();
        const name = (r.passengerName || r.customerName || '').toLowerCase();
        const phone = (r.passengerPhone || r.customerPhone || r.phone || '').toLowerCase();
        const pickup = typeof r.pickupLocation === 'object' ? (r.pickupLocation?.address || '').toLowerCase() : (r.pickupLocation || '').toLowerCase();
        const drop = typeof r.dropoffLocation === 'object' ? (r.dropoffLocation?.address || '').toLowerCase() : (r.dropoffLocation || r.dropLocation || '').toLowerCase();
        const id = (r.requestId || r.id || '').toLowerCase();
        return name.includes(q) || phone.includes(q) || pickup.includes(q) || drop.includes(q) || id.includes(q);
      }

      return true;
    });
  }, [scheduledRides, scheduleSearchQuery, scheduleStatusFilter]);

  const pendingCount = pendingRides.length;
  const assignedCount = assignedRides.length;
  const scheduledCount = scheduledRides.length;

  const hirePendingCount = useMemo(() => {
    return driverHireRequests.filter(h => {
      const s = String(h.status || '').toUpperCase();
      return s !== 'ASSIGNED' && s !== 'WAITING FOR CUSTOMER' && !h.assignedDriverId && !h.assignedDriverName;
    }).length;
  }, [driverHireRequests]);

  const hireAssignedCount = useMemo(() => {
    return driverHireRequests.filter(h => {
      const s = String(h.status || '').toUpperCase();
      return s === 'ASSIGNED' || !!h.assignedDriverId || !!h.assignedDriverName;
    }).length;
  }, [driverHireRequests]);

  const filteredDriverHires = useMemo(() => {
    return driverHireRequests.filter(hire => {
      const statusUpper = String(hire.status || '').toUpperCase();
      const isAssigned = statusUpper === 'ASSIGNED' || !!hire.assignedDriverId || !!hire.assignedDriverName;

      if (hireStatusFilter === 'pending' && (isAssigned || statusUpper === 'WAITING FOR CUSTOMER')) return false;
      if (hireStatusFilter === 'assigned' && !isAssigned) return false;

      if (hireSearchQuery.trim()) {
        const q = hireSearchQuery.toLowerCase().trim();
        const matchName = String(hire.customerName || '').toLowerCase().includes(q);
        const matchPhone = String(hire.customerPhone || hire.phone || '').toLowerCase().includes(q);
        const matchCnic = String(hire.cnic || '').toLowerCase().includes(q);
        const matchPickup = String(hire.pickupLocation || '').toLowerCase().includes(q);
        const matchDrop = String(hire.dropoffLocation || '').toLowerCase().includes(q);
        const matchId = String(hire.requestId || hire.displayId || hire.id || '').toLowerCase().includes(q);
        return matchName || matchPhone || matchCnic || matchPickup || matchDrop || matchId;
      }

      return true;
    });
  }, [driverHireRequests, hireSearchQuery, hireStatusFilter]);

  const replacementPendingCount = useMemo(() => {
    return replacementRequests.filter(h => String(h.status || '').toUpperCase() === 'PENDING').length;
  }, [replacementRequests]);

  const replacementAssignedCount = useMemo(() => {
    return replacementRequests.filter(h => String(h.status || '').toUpperCase() === 'ASSIGNED').length;
  }, [replacementRequests]);

  const filteredReplacementRequests = useMemo(() => {
    return replacementRequests.filter(r => {
      const s = String(r.status || '').toUpperCase();
      if (replacementStatusFilter === 'pending' && s !== 'PENDING') return false;
      if (replacementStatusFilter === 'assigned' && s !== 'ASSIGNED') return false;
      if (replacementStatusFilter === 'rejected' && s !== 'REJECTED') return false;

      if (replacementSearchQuery.trim()) {
        const q = replacementSearchQuery.toLowerCase().trim();
        const name = String(r.clientName || r.passengerName || '').toLowerCase();
        const phone = String(r.clientPhone || r.passengerPhone || '').toLowerCase();
        const reason = String(r.reason || '').toLowerCase();
        const id = String(r.requestId || r.displayId || r.id || '').toLowerCase();
        const veh = String(r.preferences?.vehicleType || '').toLowerCase();
        return name.includes(q) || phone.includes(q) || reason.includes(q) || id.includes(q) || veh.includes(q);
      }
      return true;
    });
  }, [replacementRequests, replacementSearchQuery, replacementStatusFilter]);

  // Helper to find assigned rides for a specific driver
  const getDriverAssignedTrips = useCallback((driver) => {
    if (!driver) return [];
    const drvId = String(driver._id || '').toLowerCase();
    const drvCode = String(driver.id || driver.driverReferenceId || driver.driverId || '').toLowerCase();
    const drvName = String(driver.personalInfo?.name || driver.name || driver.Name || '').toLowerCase().trim();

    return assignedRides.filter(r => {
      const rDrvId = String(r.driverId || r.driver || '').toLowerCase();
      const rDrvCode = String(r.assignedDriverDetails?.driverCode || '').toLowerCase();
      const rDrvName = String(r.assignedDriverDetails?.name || r.assignedDriver || '').toLowerCase().trim();

      const matchId = drvId && rDrvId && (rDrvId === drvId || drvId.endsWith(rDrvId) || rDrvId.endsWith(drvId));
      const matchCode = drvCode && (rDrvCode === drvCode || rDrvId === drvCode);
      const matchName = drvName && rDrvName && (rDrvName === drvName || rDrvName.includes(drvName) || drvName.includes(rDrvName));

      return matchId || matchCode || matchName;
    });
  }, [assignedRides]);

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

  const fetchRides = loadRides;

  // Handle Dispatch: assign driver, save to permanent storage, update UI, and switch to Driver Panel
  const handleDispatch = async (driver) => {
    if (!selectedRide) return;
    const currentSelected = selectedRide;
    let targetMongoId = null;
    const candidates = [currentSelected.mongoId, currentSelected._id, currentSelected.id, currentSelected.rawId];
    for (const c of candidates) {
      if (typeof c === 'string' && /^[0-9a-fA-F]{24}$/.test(c)) {
        targetMongoId = c;
        break;
      }
    }
    const mongoId = targetMongoId || currentSelected.mongoId || currentSelected._id || currentSelected.id || currentSelected.requestId;
    const selectedDriver = {
      id: driver.id || driver._id || driver.driverReferenceId || driver.driverId,
      name: driver.name || driver.personalInfo?.name || driver.Name || 'Driver'
    };
    const driverPhone = driver.personalInfo?.phone || driver.phone || driver.PhoneNumber || '+92 300 1234567';
    const driverVehicle = `${driver.vehicleInfo?.make || driver.vehicleDetails?.make || ''} ${driver.vehicleInfo?.model || driver.vehicleDetails?.model || ''}`.trim() || 'Toyota Corolla';
    const driverCode = selectedDriver.id;

    const finalFareNum = typeof currentSelected.fare === 'number' ? currentSelected.fare : (Number(String(currentSelected.fare).replace(/\D/g, '')) || 9500);
    const finalFareFmt = currentSelected.fareFormatted || `Rs. ${finalFareNum.toLocaleString()}`;

    // Persist to permanent localStorage assignment cache immediately!
    const assignData = {
      status: 'ASSIGNED',
      driverId: String(selectedDriver.id),
      driverName: selectedDriver.name,
      driverCode,
      driverPhone,
      driverVehicle,
      assignedDriver: selectedDriver.name,
      fare: finalFareNum,
      fareAmount: finalFareNum,
      price: finalFareNum,
      rawFare: finalFareNum,
      fareFormatted: finalFareFmt,
      assignedDriverDetails: {
        driverCode,
        name: selectedDriver.name,
        phone: driverPhone,
        vehicle: driverVehicle,
        rating: driver.performance?.rating || driver.rating || 4.9
      }
    };
    if (currentSelected._id) saveStoredAssignment(currentSelected._id, assignData);
    if (currentSelected.requestId) saveStoredAssignment(currentSelected.requestId, assignData);
    if (currentSelected.id) saveStoredAssignment(currentSelected.id, assignData);
    if (currentSelected.mongoId) saveStoredAssignment(currentSelected.mongoId, assignData);

    // 1. Instant Optimistic UI Update (0ms delay) - updates ride status to 'ASSIGNED' so it appears on the driver's screen, awaiting driver acceptance
    setRideRequests(prev => {
      const updated = prev.map(r => {
        const match = (r.mongoId && mongoId && String(r.mongoId) === String(mongoId)) ||
                      (r._id && currentSelected._id && String(r._id) === String(currentSelected._id)) ||
                      (r.requestId && currentSelected.requestId && String(r.requestId) === String(currentSelected.requestId)) ||
                      (r.id && currentSelected.id && String(r.id) === String(currentSelected.id));
        if (match) {
          return {
            ...r,
            status: 'ASSIGNED',
            driverId: selectedDriver.id,
            driver: selectedDriver.id,
            assignedDriver: selectedDriver.name,
            assignedDriverName: selectedDriver.name,
            assignedDriverDetails: assignData.assignedDriverDetails,
            fare: finalFareNum,
            fareAmount: finalFareNum,
            price: finalFareNum,
            rawFare: finalFareNum,
            fareFormatted: finalFareFmt
          };
        }
        return r;
      });
      try {
        localStorage.setItem(RIDES_CACHE_KEY, JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });

    // If this is a Driver Hire request, optimistically update driverHireRequests
    if (currentSelected.isDriverHire || currentSelected.requestId?.startsWith('HDR-') || currentSelected._type === 'hire') {
      setDriverHireRequests(prev => prev.map(h => {
        const match = (h.mongoId && mongoId && String(h.mongoId) === String(mongoId)) ||
                      (h._id && currentSelected._id && String(h._id) === String(currentSelected._id)) ||
                      (h.requestId && currentSelected.requestId && String(h.requestId) === String(currentSelected.requestId));
        if (match) {
          return {
            ...h,
            status: 'ASSIGNED',
            assignedDriverId: selectedDriver.id,
            assignedDriverName: selectedDriver.name,
            assignedDriverPhone: driverPhone,
            assignedDriverCode: driverCode,
            fare: finalFareNum,
            fareFormatted: finalFareFmt
          };
        }
        return h;
      }));
    }

    // If this is a Replacement Driver request, optimistically update replacementRequests
    if (currentSelected.isReplacement || currentSelected.requestId?.startsWith('RPL-') || currentSelected._type === 'replacement') {
      setReplacementRequests(prev => prev.map(r => {
        const match = (r.mongoId && mongoId && String(r.mongoId) === String(mongoId)) ||
                      (r._id && currentSelected._id && String(r._id) === String(currentSelected._id)) ||
                      (r.requestId && currentSelected.requestId && String(r.requestId) === String(currentSelected.requestId));
        if (match) {
          return {
            ...r,
            status: 'ASSIGNED',
            assignedDriver: {
              driverId: selectedDriver.id,
              driverCode: driverCode,
              name: selectedDriver.name,
              phone: driverPhone,
              vehicle: currentSelected.preferences?.vehicleType || driverVehicle,
              ac: true,
              assignedAt: new Date()
            }
          };
        }
        return r;
      }));
    }

    // Update driver in local state to "On Trip"
    setAvailableDriversLocal(prev => prev.map(d => {
      if (String(d._id) === String(selectedDriver.id) || String(d.id) === String(selectedDriver.id)) {
        return { ...d, availability: 'On Trip' };
      }
      return d;
    }));

    setToastMessage(`✓ Ride ${currentSelected.requestId || currentSelected.id || 'REQ'} dispatched to ${selectedDriver.name}!`);
    setToastActionDriver(driver);
    setSelectedRide(null);

    // Auto-switch tab: If replacement request, stay on replacement tab; otherwise stay on requests table to see ASSIGNED row
    if (currentSelected.isReplacement || currentSelected.requestId?.startsWith('RPL-') || currentSelected._type === 'replacement') {
      setActiveMainTab('replacement-requests');
      setReplacementStatusFilter('assigned');
    } else {
      setActiveMainTab('requests');
    }

    setTimeout(() => {
      setToastMessage('');
      setToastActionDriver(null);
    }, 6000);

    // 2. Dispatch request to backend
    try {
      const dispatchBody = {
        driverId: selectedDriver.id,
        driverName: selectedDriver.name,
        driverCode,
        driverPhone,
        assignedDriver: selectedDriver.name,
        assignedDriverName: selectedDriver.name,
        assignedDriverId: selectedDriver.id
      };

      // Broadcast immediately to active Socket.IO connection
      activeSocketsRef.current.forEach(sock => {
        try {
          if (sock && sock.connected) {
            sock.emit('ride-dispatched', {
              rideId: mongoId,
              requestId: currentSelected.requestId || currentSelected.id,
              driverId: selectedDriver.id,
              driverName: selectedDriver.name,
              driverCode,
              driverPhone,
              ride: { ...currentSelected, ...assignData }
            });
            sock.emit('admin_dispatch_ride', {
              rideId: mongoId,
              requestId: currentSelected.requestId || currentSelected.id,
              driverId: selectedDriver.id,
              driverName: selectedDriver.name,
              driverCode,
              driverPhone,
              ride: { ...currentSelected, ...assignData }
            });
          }
        } catch (e) {}
      });

      if (currentSelected.isReplacement || currentSelected.requestId?.startsWith('RPL-') || currentSelected._type === 'replacement') {
        const replDispatchBody = {
          driverId: selectedDriver.id,
          driverName: selectedDriver.name,
          vehicle: currentSelected.preferences?.vehicleType || driverVehicle
        };
        await Promise.allSettled([
          fetch(`${BACKEND_URL}/api/replacement-requests/${mongoId}/assign`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(replDispatchBody)
          }),
          fetch(`http://localhost:5000/api/replacement-requests/${mongoId}/assign`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(replDispatchBody)
          }),
          fetch(`/api/replacement-requests/${mongoId}/assign`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(replDispatchBody)
          })
        ]);
        if (typeof loadReplacements === 'function') loadReplacements();
      
      } else if (activeMainTab === 'schedule-rides') {
        const dispatchBody = { driverId: selectedDriver.id, driverName: selectedDriver.name, fare: finalFareNum };
        await fetch(`${BACKEND_URL}/api/schedule-rides/${mongoId}/dispatch`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dispatchBody) });
        if (typeof loadScheduleRides === 'function') loadScheduleRides();
      } else if (activeMainTab === 'travel-requests') {
        const dispatchBody = { driverId: selectedDriver.id, driverName: selectedDriver.name, fare: finalFareNum };
        await fetch(`${BACKEND_URL}/api/travel-requests/${mongoId}/dispatch`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dispatchBody) });
        if (typeof loadTravelRequests === 'function') loadTravelRequests();

      } else if (currentSelected.isDriverHire || currentSelected.requestId?.startsWith('HDR-') || currentSelected._type === 'hire') {
        const hireDispatchBody = {
          driverId: selectedDriver.id,
          driverName: selectedDriver.name,
          fare: finalFareNum
        };
        await Promise.allSettled([
          fetch(`${BACKEND_URL}/api/driver-hire/${mongoId}/dispatch`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(hireDispatchBody)
          }),
          fetch(`http://localhost:5000/api/driver-hire/${mongoId}/dispatch`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(hireDispatchBody)
          }),
          fetch(`/api/driver-hire/${mongoId}/dispatch`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(hireDispatchBody)
          })
        ]);
        if (typeof loadDriverHires === 'function') loadDriverHires();
      } else {
        const dispatchUrls = [
          `${BACKEND_URL}/api/rides/${mongoId}/dispatch`,
          ...(currentSelected.requestId ? [`${BACKEND_URL}/api/rides/${currentSelected.requestId}/dispatch`] : []),
          `http://localhost:5000/api/rides/${mongoId}/dispatch`,
          ...(currentSelected.requestId ? [`http://localhost:5000/api/rides/${currentSelected.requestId}/dispatch`] : []),
          `http://localhost:5000/api/rides/${mongoId}/dispatch`,
          `/api/rides/${mongoId}/dispatch`
        ];
        await Promise.allSettled([
          ...dispatchUrls.map(u =>
            fetch(u, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(dispatchBody)
            })
          ),
          RideAPI.dispatch(mongoId, selectedDriver.name, selectedDriver.id, {
            driverId: selectedDriver.id,
            driverName: selectedDriver.name,
            fare: finalFareNum,
            fareFormatted: finalFareFmt
          })
        ]);
      }
    } catch (err) {
      console.error('Dispatch API error:', err);
    }

    // 3. Silent sync
    loadRides();
    if (typeof loadDriverHires === 'function') loadDriverHires();
    if (typeof loadReplacements === 'function') loadReplacements();
  };

  // Handle Confirm Dispatch from Dedicated Modal (PATCH http://localhost:5000/api/rides/:mongoId/dispatch)
  const handleConfirmDispatchModal = async () => {
    if (!dispatchModalRide || !selectedDriverForDispatch) {
      alert('Please select a driver to dispatch');
      return;
    }

    const currentSelected = dispatchModalRide;
    let targetMongoId = null;
    const candidates = [currentSelected.mongoId, currentSelected._id, currentSelected.id, currentSelected.rawId];
    for (const c of candidates) {
      if (typeof c === 'string' && /^[0-9a-fA-F]{24}$/.test(c)) {
        targetMongoId = c;
        break;
      }
    }
    const mongoId = targetMongoId || currentSelected.mongoId || currentSelected._id || currentSelected.id || currentSelected.requestId;
    const driver = selectedDriverForDispatch;
    const driverId = String(driver.id || driver._id);
    const driverName = driver.name || driver.personalInfo?.name || 'Driver';
    const driverPhone = driver.personalInfo?.phone || driver.phone || '+92 300 1234567';
    const driverVehicle = `${driver.vehicleInfo?.make || ''} ${driver.vehicleInfo?.model || ''}`.trim() || 'Toyota Corolla';
    const driverCode = formatDriverCode(driverId);

    const finalFareNum = typeof currentSelected.fare === 'number' ? currentSelected.fare : (Number(String(currentSelected.fare).replace(/\D/g, '')) || 9500);
    const finalFareFmt = currentSelected.fareFormatted || `Rs. ${finalFareNum.toLocaleString()}`;

    setIsSubmittingDispatch(true);

    const assignData = {
      status: 'ASSIGNED',
      driverId,
      driverName,
      driverCode,
      driverPhone,
      driverVehicle,
      assignedDriver: driverName,
      assignedDriverName: driverName,
      assignedDriverId: driverId,
      fare: finalFareNum,
      fareFormatted: finalFareFmt,
      assignedDriverDetails: {
        driverCode,
        name: driverName,
        phone: driverPhone,
        vehicle: driverVehicle,
        rating: driver.performance?.rating || 4.9
      }
    };

    if (currentSelected._id) saveStoredAssignment(currentSelected._id, assignData);
    if (currentSelected.requestId) saveStoredAssignment(currentSelected.requestId, assignData);
    if (currentSelected.id) saveStoredAssignment(currentSelected.id, assignData);
    if (currentSelected.mongoId) saveStoredAssignment(currentSelected.mongoId, assignData);

    // Optimistic local state update (moves from Pending to Assigned immediately)
    setRideRequests(prev => {
      const updated = prev.map(r => {
        const match = (r.mongoId && mongoId && String(r.mongoId) === String(mongoId)) ||
                      (r._id && currentSelected._id && String(r._id) === String(currentSelected._id)) ||
                      (r.requestId && currentSelected.requestId && String(r.requestId) === String(currentSelected.requestId)) ||
                      (r.id && currentSelected.id && String(r.id) === String(currentSelected.id));
        if (match) {
          return {
            ...r,
            status: 'ASSIGNED',
            driverId,
            driver: driverId,
            assignedDriver: driverName,
            assignedDriverName: driverName,
            assignedDriverId: driverId,
            assignedDriverDetails: assignData.assignedDriverDetails
          };
        }
        return r;
      });
      try {
        localStorage.setItem(RIDES_CACHE_KEY, JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });

    setToastMessage(`✓ Ride ${currentSelected.requestId || currentSelected.id} dispatched to ${driverName}!`);
    setTimeout(() => setToastMessage(''), 4500);

    setDispatchModalRide(null);
    setSelectedDriverForDispatch(null);
    setIsSubmittingDispatch(false);

    // Broadcast immediately to active Socket.IO connection
    activeSocketsRef.current.forEach(sock => {
      try {
        if (sock && sock.connected) {
          sock.emit('ride-dispatched', {
            rideId: mongoId,
            requestId: currentSelected.requestId || currentSelected.id,
            driverId,
            driverName,
            driverCode,
            driverPhone,
            ride: { ...currentSelected, ...assignData }
          });
          sock.emit('admin_dispatch_ride', {
            rideId: mongoId,
            requestId: currentSelected.requestId || currentSelected.id,
            driverId,
            driverName,
            driverCode,
            driverPhone,
            ride: { ...currentSelected, ...assignData }
          });
        }
      } catch (e) {}
    });

    // Call PATCH /api/rides/:mongoId/dispatch with complete driver details
    try {
      const dispatchBody = {
        driverId,
        driverName,
        driverCode,
        driverPhone,
        assignedDriver: driverName,
        assignedDriverName: driverName,
        assignedDriverId: driverId
      };
      const dispatchUrls = [
        `${BACKEND_URL}/api/rides/${mongoId}/dispatch`,
        ...(currentSelected.requestId ? [`${BACKEND_URL}/api/rides/${currentSelected.requestId}/dispatch`] : []),
        `http://localhost:5000/api/rides/${mongoId}/dispatch`,
        ...(currentSelected.requestId ? [`http://localhost:5000/api/rides/${currentSelected.requestId}/dispatch`] : []),
        `http://localhost:5000/api/rides/${mongoId}/dispatch`,
        `/api/rides/${mongoId}/dispatch`
      ];
      await Promise.allSettled(dispatchUrls.map(u =>
        fetch(u, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(dispatchBody)
        })
      ));
    } catch (err) {
      console.warn('Dispatch API error:', err);
    }

    loadRides();
  };

  // Smart Recommendation Scoring Algorithm
  const scoredDrivers = useMemo(() => {
    let list = availableDriversLocal.filter(d => d.status === 'Approved');
    if (list.length === 0 && availableDriversLocal.length > 0) {
      list = [...availableDriversLocal];
    }

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

  // View 1: Passenger Requests List / Table - "Ride & Serve — Dispatch Console"
  const renderRideRequests = () => (
    <div className="ride-list-container fade-in">
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
                  <th style={{ minWidth: '190px' }}>CUSTOMER INFO</th>
                  <th style={{ minWidth: '240px' }}>PICKUP & DROP LOCATIONS</th>
                  <th style={{ minWidth: '220px' }}>DAYS & SCHEDULE</th>
                  <th style={{ minWidth: '240px' }}>CUSTOMER PREFERENCES</th>
                  <th style={{ minWidth: '130px' }}>OFFERED FARE</th>
                  <th style={{ minWidth: '160px' }}>STATUS</th>
                  <th className="actions-col" style={{ minWidth: '180px', textAlign: 'right' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filteredConsoleRides.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '3.5rem 1rem' }}>
                      <CheckCircle size={38} className="text-success mb-2" />
                      <h3 style={{ fontSize: '1.15rem', fontWeight: '700' }}>No ride requests found</h3>
                      <p className="text-secondary">
                        {requestSearchQuery ? `No requests matched "${requestSearchQuery}"` : 'Waiting for incoming customer requests...'}
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredConsoleRides.map(ride => {
                    const prefs = getCustomerRidePreferences(ride);
                    const isAssigned = isRideAssigned(ride);
                    const pName = getPassengerName(ride.passengerName || ride.customerName || ride.passenger);
                    const pPhone = ride.passengerPhone || ride.customerPhone || ride.phone || ride.passenger?.phone || '';
                    const assignedDrvName = ride.assignedDriverName || ride.assignedDriver || ride.assignedDriverDetails?.name;
                    const assignedDrvCode = ride.assignedDriverId || ride.assignedDriverDetails?.driverCode;

                    return (
                      <tr 
                        key={ride._id || ride.requestId || ride.id} 
                        className="clickable-row"
                        onClick={() => handleSelectRide(ride)}
                      >
                        {/* 1. CUSTOMER INFO: Passenger Name, Phone & Request ID */}
                        <td>
                          <div className="passenger-table-cell" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div className="avatar-circle" style={{ width: '38px', height: '38px', borderRadius: '50%', background: '#EEF2FF', color: '#4F46E5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '0.92rem', border: '1px solid #C7D2FE', flexShrink: 0 }}>
                              {getPassengerInitial(ride.passengerName || ride.customerName || ride.passenger)}
                            </div>
                            <div className="passenger-info-col" style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              <strong className="passenger-name-text" style={{ fontSize: '0.9rem', color: '#1E293B', fontWeight: 700 }}>
                                {pName}
                              </strong>
                              {pPhone && (
                                <div className="passenger-phone-text" style={{ fontSize: '0.76rem', color: '#64748B', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <Phone size={11} className="text-secondary flex-shrink-0" />
                                  <a 
                                    href={`tel:${pPhone}`}
                                    onClick={e => e.stopPropagation()}
                                    style={{ color: '#64748B', textDecoration: 'none' }}
                                    title="Call passenger"
                                  >
                                    {pPhone}
                                  </a>
                                </div>
                              )}
                              <span className="id-pill font-mono mt-0.5" style={{ fontSize: '0.72rem', padding: '1px 6px', borderRadius: '4px', background: '#F1F5F9', border: '1px solid #E2E8F0', color: '#475569', display: 'inline-block', width: 'fit-content' }}>
                                {ride.requestId || ride.id || ride.displayId || 'REQ'}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* 2. PICKUP & DROP LOCATIONS */}
                        <td>
                          <div className="route-cell-box">
                            {/* Morning Route */}
                            <div className="trip-stage-box">
                              <div className="route-line-row">
                                <span className="text-xs text-secondary font-medium">Pick: </span>
                                <span className="route-address-text" title={prefs.morningPickup}>
                                  {prefs.morningPickup}
                                </span>
                              </div>
                              <div className="route-line-row mt-1">
                                <span className="text-xs text-secondary font-medium">Drop: </span>
                                <span className="route-address-text font-semibold" title={prefs.morningDropoff}>
                                  {prefs.morningDropoff}
                                </span>
                              </div>
                            </div>

                            {/* Return Route (for Two Way) */}
                            {prefs.tripType === 'Two Way' && (prefs.eveningPickup || prefs.eveningDropoff) && (
                              <div className="trip-stage-box evening-stage-box mt-1.5 p-1.5 rounded" style={{ border: '1px dashed #CBD5E1', background: '#F8FAFC' }}>
                                <div className="route-line-row">
                                  <span className="text-xs text-secondary font-medium">Pick: </span>
                                  <span className="route-address-text text-xs" title={prefs.eveningPickup}>
                                    {prefs.eveningPickup}
                                  </span>
                                </div>
                                <div className="route-line-row mt-0.5">
                                  <span className="text-xs text-secondary font-medium">Drop: </span>
                                  <span className="route-address-text text-xs font-semibold" title={prefs.eveningDropoff}>
                                    {prefs.eveningDropoff}
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                        </td>

                        {/* 2. DAYS & SCHEDULE */}
                        <td>
                          <div className="schedule-cell-box">
                            {prefs.startingDate && (
                              <div className="d-flex align-items-center gap-1 mb-1 text-xs text-primary font-semibold">
                                <Calendar size={12} className="text-primary" />
                                <span>Date: {prefs.startingDate}</span>
                              </div>
                            )}
                            <div className="schedule-days-pill-box" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE', borderRadius: '6px', padding: '3px 8px', fontSize: '0.78rem', fontWeight: 600 }}>
                              <Calendar size={12} className="text-primary flex-shrink-0" />
                              <span>
                                {(() => {
                                  const sType = (ride.scheduleType || '').trim();
                                  const dDisp = getDaysDisplay(ride);
                                  if (!sType || sType.toLowerCase() === 'customize') return dDisp;
                                  if (dDisp && (sType.toLowerCase() === dDisp.toLowerCase() || dDisp.toLowerCase().includes(sType.toLowerCase()))) return sType;
                                  if (sType.toLowerCase() === 'mon - fri' && (!dDisp || (dDisp.includes('Mon') && dDisp.includes('Fri')))) return 'Mon - Fri';
                                  return `${sType} (${dDisp})`;
                                })()}
                              </span>
                            </div>
                            <div className="schedule-timing-row mt-1.5" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', color: '#475569' }}>
                              <Clock size={11} className="text-secondary flex-shrink-0" />
                              <span>Reach: <strong>{prefs.morningTime}</strong></span>
                            </div>
                            {prefs.tripType === 'Two Way' && prefs.eveningTime && (
                              <div className="schedule-timing-row mt-0.5" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', color: '#475569' }}>
                                <Clock size={11} className="text-secondary flex-shrink-0" />
                                <span>Leave: <strong>{prefs.eveningTime}</strong></span>
                              </div>
                            )}
                          </div>
                        </td>

                        {/* 3. CUSTOMER PREFERENCES */}
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                            <RenderPreferenceBadges ride={ride} />
                          </div>
                        </td>

                        {/* 4. OFFERED FARE */}
                        <td>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }} onClick={e => e.stopPropagation()}>
                            {editingFareId === (ride.mongoId || ride._id || ride.id || ride.requestId) ? (
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                <span style={{ fontSize: '0.78rem', color: '#64748B', fontWeight: 600 }}>Rs.</span>
                                <input
                                  type="number"
                                  className="fare-edit-input"
                                  value={editingFareValue}
                                  onChange={(e) => setEditingFareValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveFare(ride, editingFareValue);
                                    if (e.key === 'Escape') setEditingFareId(null);
                                  }}
                                  autoFocus
                                  style={{
                                    width: '75px',
                                    padding: '3px 6px',
                                    fontSize: '0.82rem',
                                    fontWeight: '700',
                                    borderRadius: '4px',
                                    border: '1px solid #2563EB',
                                    outline: 'none'
                                  }}
                                />
                                <button
                                  type="button"
                                  title="Save Fare"
                                  disabled={isSavingFare}
                                  onClick={() => handleSaveFare(ride, editingFareValue)}
                                  style={{
                                    background: '#16A34A',
                                    border: 'none',
                                    color: '#FFFFFF',
                                    borderRadius: '4px',
                                    padding: '4px 6px',
                                    cursor: isSavingFare ? 'not-allowed' : 'pointer',
                                    fontSize: '0.72rem',
                                    fontWeight: 600
                                  }}
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  title="Cancel"
                                  disabled={isSavingFare}
                                  onClick={() => setEditingFareId(null)}
                                  style={{
                                    background: '#64748B',
                                    border: 'none',
                                    color: '#FFFFFF',
                                    borderRadius: '4px',
                                    padding: '4px 6px',
                                    cursor: 'pointer',
                                    fontSize: '0.72rem',
                                    fontWeight: 600
                                  }}
                                >
                                  X
                                </button>
                              </div>
                            ) : (
                              <>
                                <span className="fare-badge">
                                  {ride.fareFormatted || `Rs. ${Number(ride.fare || 9500).toLocaleString()}`}
                                </span>
                                <button
                                  type="button"
                                  title="Edit Fare"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingFareId(ride.mongoId || ride._id || ride.id || ride.requestId);
                                    setEditingFareValue(String(ride.fare || 9500).replace(/\D/g, '') || '9500');
                                  }}
                                  style={{
                                    background: 'transparent',
                                    border: 'none',
                                    cursor: 'pointer',
                                    padding: '2px 4px',
                                    color: '#64748B',
                                    display: 'inline-flex',
                                    alignItems: 'center'
                                  }}
                                >
                                  <Edit2 size={12} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>

                        {/* 5. STATUS */}
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                            {isAssigned ? (
                              <>
                                <span className="status-badge approved">● ASSIGNED</span>
                                {assignedDrvName && (
                                  <div className="assigned-driver-pill mt-1" title={`Driver: ${assignedDrvName}`}>
                                    <Car size={11} />
                                    <span className="truncate max-w-[130px]">{assignedDrvName}</span>
                                  </div>
                                )}
                                {assignedDrvCode && (
                                  <span className="driver-code-text font-mono" style={{ fontSize: '0.72rem', color: '#64748B' }}>
                                    {assignedDrvCode}
                                  </span>
                                )}
                              </>
                            ) : (
                              <span className="status-badge pending">● Pending Dispatch</span>
                            )}
                          </div>
                        </td>

                        {/* 6. ACTIONS */}
                        <td className="actions-col" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <div 
                            className="dispatch-actions-cell" 
                            onClick={e => e.stopPropagation()}
                            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px', flexShrink: 0 }}
                          >
                            <button 
                              type="button"
                              className="icon-btn-secondary" 
                              title="View Trip Details"
                              onClick={(e) => {
                                e.stopPropagation();
                                setViewPassengerModal(ride);
                              }}
                              style={{ flexShrink: 0 }}
                            >
                              <Eye size={15} />
                            </button>

                            {isAssigned ? (
                              <button 
                                type="button"
                                className="reassign-action-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSelectRide(ride);
                                }}
                                style={{ flexShrink: 0, whiteSpace: 'nowrap' }}
                                title="Reassign driver"
                              >
                                <RotateCcw size={12} /> Reassign
                              </button>
                            ) : (
                              <button 
                                type="button"
                                className="dispatch-action-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSelectRide(ride);
                                }}
                                style={{ flexShrink: 0, whiteSpace: 'nowrap' }}
                                title="Dispatch verified driver to this ride"
                              >
                                <Sparkles size={13} /> Dispatch Driver
                              </button>
                            )}
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
      ) : (
        /* CARD VIEW */
        <div className="rides-grid">
          {filteredConsoleRides.length === 0 ? (
            <div className="glass-panel p-5 text-center w-100" style={{ gridColumn: '1 / -1' }}>
              <CheckCircle size={36} className="text-success mb-2" />
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>No requests found</h3>
              <p className="text-secondary">
                {requestSearchQuery ? `No requests matched "${requestSearchQuery}"` : 'No requests available for this filter.'}
              </p>
            </div>
          ) : (
            filteredConsoleRides.map(ride => {
              const prefs = getCustomerRidePreferences(ride);
              const isAssigned = isRideAssigned(ride);
              const pName = getPassengerName(ride.passengerName || ride.customerName || ride.passenger);
              const pPhone = ride.passengerPhone || ride.customerPhone || ride.phone || ride.passenger?.phone || '';
              const pEmail = ride.passengerEmail || ride.customerEmail || ride.email || ride.passenger?.email || '';
              const fareText = ride.fareFormatted || (ride.fare ? (String(ride.fare).startsWith('Rs.') ? ride.fare : `Rs. ${Number(ride.fare).toLocaleString()}`) : 'Rs. 9,500');
              const assignedDrvName = ride.assignedDriverName || ride.assignedDriver || ride.assignedDriverDetails?.name;

              return (
                <div 
                  key={ride._id || ride.requestId || ride.id} 
                  className="dispatch-card clickable-card"
                  onClick={() => setViewPassengerModal(ride)}
                >
                  {/* Card Header: Type, ID, Status */}
                  <div className="dispatch-card-header">
                    <div className="d-flex align-items-center gap-2">
                      {getRequestTypeBadge(ride)}
                      <span className="id-pill font-mono" title={ride.requestId || ride.id}>
                        {ride.requestId || ride.id}
                      </span>
                    </div>
                    {getStatusBadge(ride)}
                  </div>

                  {/* Passenger Information */}
                  <div className="dispatch-card-passenger">
                    <div className="avatar-circle">
                      {pName.charAt(0).toUpperCase()}
                    </div>
                    <div className="passenger-meta">
                      <strong className="passenger-name-text" title={pName}>{pName}</strong>
                      {pPhone && (
                        <div className="passenger-phone-text">
                          <Phone size={11} className="inline-icon" />
                          <a 
                            href={`tel:${pPhone}`}
                            onClick={e => e.stopPropagation()}
                          >
                            {pPhone}
                          </a>
                        </div>
                      )}
                      {pEmail && (
                        <div className="passenger-email-text text-xs text-secondary mt-0.5">
                          <Mail size={10} className="inline-icon" />
                          <span>{pEmail}</span>
                        </div>
                      )}
                      {ride.cnic && (
                        <div className="text-xs text-secondary font-mono mt-0.5">
                          CNIC: {ride.cnic}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Customer Preferences Badges */}
                  <div className="mb-2">
                    <RenderPreferenceBadges ride={ride} />
                  </div>

                  {/* Route Timeline Box */}
                  <div className="dispatch-card-route-box">
                    {prefs.startingDate && (
                      <div className="d-flex align-items-center gap-1 mb-2 text-xs text-primary font-semibold">
                        <Calendar size={11} />
                        <span>Date: {prefs.startingDate}</span>
                      </div>
                    )}
                    <div className="trip-stage-container">
                      <div className="route-stop pickup-stop">
                        <span className="route-stop-dot green-dot"></span>
                        <div className="route-stop-content">
                          <span className="route-stop-label">PICKUP</span>
                          <span className="route-stop-addr" title={prefs.morningPickup}>{prefs.morningPickup}</span>
                        </div>
                      </div>
                      <div className="route-connecting-line"></div>
                      <div className="route-stop dropoff-stop">
                        <span className="route-stop-dot red-dot"></span>
                        <div className="route-stop-content">
                          <span className="route-stop-label">DROP-OFF</span>
                          <span className="route-stop-addr font-semibold" title={prefs.morningDropoff}>{prefs.morningDropoff}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Meta Details Row: Schedule & Timings */}
                  <div className="dispatch-card-meta-row">
                    <div className="card-meta-chip days-chip" title="Schedule Days">
                      <Calendar size={12} className="text-primary flex-shrink-0" />
                      <span>
                        {(() => {
                          const sType = (ride.scheduleType || '').trim();
                          const dDisp = getDaysDisplay(ride);
                          if (!sType || sType.toLowerCase() === 'customize') return dDisp;
                          if (dDisp && (sType.toLowerCase() === dDisp.toLowerCase() || dDisp.toLowerCase().includes(sType.toLowerCase()))) return sType;
                          if (sType.toLowerCase() === 'mon - fri' && (!dDisp || (dDisp.includes('Mon') && dDisp.includes('Fri')))) return 'Mon - Fri';
                          return `${sType} (${dDisp})`;
                        })()}
                      </span>
                    </div>
                    <div className="card-meta-chip" title="Reach & Leave Time">
                      <Clock size={12} className="text-secondary flex-shrink-0" />
                      <span>Reach: {prefs.morningTime}{prefs.tripType === 'Two Way' && prefs.eveningTime ? ` | Leave: ${prefs.eveningTime}` : ''}</span>
                    </div>
                  </div>

                  {/* Assigned Driver Display if Assigned */}
                  {isAssigned && assignedDrvName && (
                    <div className="assigned-driver-pill mt-2 mb-1 w-100">
                      <UserCheck size={12} />
                      <span>Assigned Driver: <strong>{assignedDrvName}</strong></span>
                    </div>
                  )}

                  {/* Customer Notes */}
                  {(ride.notes || prefs.additionalNotes) && (
                    <div className="pref-notes-pill mb-2">
                      <AlertCircle size={12} className="flex-shrink-0" />
                      <span><strong>Note:</strong> {ride.notes || prefs.additionalNotes}</span>
                    </div>
                  )}

                  {/* Card Footer: Fare & Actions */}
                  <div className="dispatch-card-footer">
                    <div className="card-fare-col">
                      <span className="card-fare-label">OFFERED FARE</span>
                      <span className="card-fare-amount font-mono">{fareText}</span>
                    </div>
                    <div className="card-actions-group" onClick={e => e.stopPropagation()}>
                      <button 
                        type="button"
                        className="icon-btn-secondary" 
                        title="View Details"
                        onClick={() => setViewPassengerModal(ride)}
                      >
                        <Eye size={14} />
                      </button>
                      {isAssigned ? (
                        <button 
                          type="button"
                          className="reassign-action-btn"
                          onClick={() => openDispatchModal(ride)}
                          title="Reassign driver"
                        >
                          <RefreshCw size={12} /> Reassign
                        </button>
                      ) : (
                        <button 
                          type="button"
                          className="dispatch-action-btn"
                          onClick={() => openDispatchModal(ride)}
                          title="Dispatch driver"
                        >
                          <Sparkles size={12} /> Dispatch Driver
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
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

        <div className="trip-banner-fare ms-auto" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div>
            <span className="fare-label">Estimated Fare</span>
            <span className="fare-amount font-bold text-success">{selectedRide.fareFormatted || (typeof selectedRide.fare === 'number' ? `Rs. ${selectedRide.fare.toLocaleString()}` : selectedRide.fare)}</span>
          </div>
          <button
            type="button"
            className="icon-btn-secondary"
            title="Edit Fare before dispatch"
            onClick={(e) => {
              e.stopPropagation();
              const currentFareVal = String(selectedRide.fare || 9500).replace(/\D/g, '') || '9500';
              const newFarePrompt = prompt('Enter new fare for this ride (PKR):', currentFareVal);
              if (newFarePrompt !== null && newFarePrompt.trim() !== '') {
                handleSaveFare(selectedRide, newFarePrompt);
              }
            }}
            style={{
              padding: '4px 8px',
              borderRadius: '6px',
              fontSize: '0.78rem',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              cursor: 'pointer'
            }}
          >
            <Edit2 size={13} /> Edit Fare
          </button>
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
            <button className="primary-btn mt-3" style={{padding: '10px 24px', borderRadius: '8px', fontSize: '14px', fontWeight: '600'}} onClick={() => {
              setDriverSearchQuery('');
              setFilterAC('all');
              setFilterCategory('all');
              fetchDrivers();
            }}><RotateCcw size={14} style={{marginRight: '6px'}} /> Reset & Reload Drivers</button>
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

  // View 4: Customer Schedule Ride Bookings Tab
  
  const filteredTravelRequests = useMemo(() => {
    return travelRequests.filter(r => {
      const isAssigned = r.status === 'ASSIGNED' || r.driverId;
      const s = String(r.status || '').toUpperCase();
      if (travelStatusFilter === 'pending') {
        if (isAssigned || s === 'ASSIGNED' || s === 'WAITING FOR CUSTOMER') return false;
      } else if (travelStatusFilter === 'assigned') {
        if (!isAssigned && s !== 'ASSIGNED') return false;
      }
      if (travelSearchQuery) {
        const q = travelSearchQuery.toLowerCase();
        return (
          (r.passengerName && r.passengerName.toLowerCase().includes(q)) ||
          (r.passengerPhone && r.passengerPhone.toLowerCase().includes(q)) ||
          (r.pickupLocation && r.pickupLocation.toLowerCase().includes(q)) ||
          (r.dropoffLocation && r.dropoffLocation.toLowerCase().includes(q)) ||
          (r.requestId && r.requestId.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [travelRequests, travelSearchQuery, travelStatusFilter]);

  const renderTravelRequests = () => {
    return (
      <div className="schedule-rides-container fade-in">
        <div className="page-header d-flex justify-content-between align-items-center mb-3">
          <div>
            <h1 className="page-title">Travel & Tourism</h1>
            <p className="page-subtitle">Manage outstation travel and tourism bookings.</p>
          </div>
          <div className="d-flex align-items-center gap-2">
            <button 
              className="secondary-btn d-flex align-items-center gap-2"
              onClick={() => { setLoading(true); loadTravelRequests().finally(()=>setLoading(false)); fetchDrivers(); }}
              title="Refresh travel requests"
            >
              <RefreshCw size={14} className={loading ? 'spin' : ''} />
              Refresh
            </button>
          </div>
        </div>

        <div className="schedule-toolbar">
          <div className="schedule-search-box">
            <Search size={16} className="schedule-search-icon" />
            <input 
              type="text"
              placeholder="Search travel requests..."
              value={travelSearchQuery}
              onChange={(e) => setTravelSearchQuery(e.target.value)}
            />
          </div>
          <div className="radio-group toolbar-radios">
            <button type="button" className={`radio-btn ${travelStatusFilter === 'all' ? 'active' : ''}`} onClick={() => setTravelStatusFilter('all')}>All ({travelRequests.length})</button>
            <button type="button" className={`radio-btn ${travelStatusFilter === 'pending' ? 'active' : ''}`} onClick={() => setTravelStatusFilter('pending')}>Pending ({travelRequests.filter(r => String(r.status||'').toUpperCase() !== 'ASSIGNED' && String(r.status||'').toUpperCase() !== 'WAITING FOR CUSTOMER').length})</button>
            <button type="button" className={`radio-btn ${travelStatusFilter === 'assigned' ? 'active' : ''}`} onClick={() => setTravelStatusFilter('assigned')}>Assigned ({travelRequests.filter(r => String(r.status||'').toUpperCase() === 'ASSIGNED').length})</button>
          </div>
        </div>

        {filteredTravelRequests.length === 0 ? (
          <div className="empty-state mt-4">
            <p>No travel requests found.</p>
          </div>
        ) : (
          <div className="schedule-grid">
            {filteredTravelRequests.map(r => {
              const s = String(r.status || '').toUpperCase();
              let badgeClass = 'status-pending';
              if (s === 'ASSIGNED') badgeClass = 'status-assigned';
              else if (s === 'WAITING FOR CUSTOMER') badgeClass = 'status-waiting';

              return (
                <div key={r._id || r.requestId} className="schedule-card fade-in">
                  <div className="schedule-card-header">
                    <div className="d-flex justify-content-between align-items-center mb-2 w-100">
                      <span className="id-pill font-mono">{r.requestId}</span>
                      <span className={`schedule-status-pill ${s === 'ASSIGNED' ? 'assigned' : (s === 'WAITING FOR CUSTOMER' ? 'waiting' : 'pending')}`}>
                        {s === 'ASSIGNED' ? '? Assigned' : (s === 'WAITING FOR CUSTOMER' ? '? Waiting for Customer' : '? Pending Dispatch')}
                      </span>
                    </div>
                  </div>
                  <div className="schedule-card-body">
                    <h3 className="customer-name" style={{fontSize: '15px', fontWeight: 'bold'}}>{r.passengerName}</h3>
                    <div className="schedule-customer-row mb-3">
                      <div>
                        <Phone size={12} style={{marginRight: '5px'}}/>{r.passengerPhone}
                      </div>
                      {r.cnic && <div><User size={12} style={{marginRight: '5px'}}/>{r.cnic}</div>}
                    </div>
                    
                    <div className="route-info mb-3">
                      <div className="pickup-point"><strong>From:</strong> {r.pickupLocation}</div>
                      <div className="dropoff-point"><strong>To:</strong> {r.dropoffLocation}</div>
                    </div>
                    <div className="datetime-info mb-3">
                      <div><Calendar size={12} style={{marginRight:'5px'}}/><strong>Travel Date:</strong> {r.travelDate} {r.travelTime}</div>
                      {r.returnDate && <div><RotateCcw size={12} style={{marginRight:'5px'}}/><strong>Return:</strong> {r.returnDate} {r.returnTime}</div>}
                    </div>
                    <div className="vehicle-pref mb-3" style={{fontSize: '13px', color: '#64748b'}}>
                      <Car size={12} style={{marginRight:'5px'}}/>{r.vehicleType} | {r.passengersCount} Passengers
                    </div>
                    
                    <div className="schedule-action-row" style={{borderTop: '1px solid #e2e8f0', paddingTop: '12px', marginTop: '12px'}}>
                      <div className="schedule-fare">
                        <span className="fare-label" style={{fontSize: '12px', color: '#64748b'}}>Fare</span>
                        <span className="fare-amount" style={{fontWeight: 'bold', fontSize: '15px'}}>{r.fareFormatted || 'Not Set'}</span>
                      </div>
                      <button className="icon-btn-sm" onClick={() => openFareEditModal(r)} title="Edit Fare" style={{padding: '4px 8px', background: '#f1f5f9', border: 'none', borderRadius: '4px', cursor: 'pointer'}}>Edit</button>
                    </div>

                    {!r.driverId && s !== 'WAITING FOR CUSTOMER' && (
                      <button className="primary-btn w-100 mt-3" onClick={() => openDispatchModal(r)}>
                        Dispatch Driver
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };


  const renderScheduleRides = () => {
    return (
      <div className="schedule-rides-container fade-in">
        {/* Page Header */}
        <div className="page-header d-flex justify-content-between align-items-center mb-3">
          <div>
            <h1 className="page-title">Customer Schedule Ride Bookings</h1>
            <p className="page-subtitle">
              Live scheduled bookings with custom routine dates, recurring days, return timing, and driver dispatch.
            </p>
          </div>
          <div className="d-flex align-items-center gap-2">
            <button 
              className="secondary-btn d-flex align-items-center gap-2"
              onClick={() => { setLoading(true); loadScheduleRides().finally(()=>setLoading(false)); fetchDrivers(); }}
              title="Refresh scheduled rides"
            >
              <RefreshCw size={14} className={loading ? 'spin' : ''} />
              Refresh
            </button>
          </div>
        </div>

        {/* Toolbar: Search + Status Filter */}
        <div className="schedule-toolbar">
          <div className="schedule-search-box">
            <Search size={16} className="schedule-search-icon" />
            <input 
              type="text"
              placeholder="Search by customer, phone, pickup, dropoff, or REQ ID..."
              value={scheduleSearchQuery}
              onChange={(e) => setScheduleSearchQuery(e.target.value)}
            />
          </div>

          <div className="radio-group toolbar-radios">
            <button 
              type="button"
              className={`radio-btn ${scheduleStatusFilter === 'all' ? 'active' : ''}`}
              onClick={() => setScheduleStatusFilter('all')}
            >All ({scheduledRides.length})</button>
            <button 
              type="button"
              className={`radio-btn ${scheduleStatusFilter === 'pending' ? 'active' : ''}`}
              onClick={() => setScheduleStatusFilter('pending')}
            >Pending Dispatch ({scheduledRides.filter(r => !isRideAssigned(r) && String(r.status).toUpperCase() !== 'ASSIGNED').length})</button>
            <button 
              type="button"
              className={`radio-btn ${scheduleStatusFilter === 'assigned' ? 'active' : ''}`}
              onClick={() => setScheduleStatusFilter('assigned')}
            >Assigned ({scheduledRides.filter(r => isRideAssigned(r) || String(r.status).toUpperCase() === 'ASSIGNED').length})</button>
          </div>
        </div>

        {/* Scheduled Ride Cards Grid */}
        {loading ? (
          <div className="table-container-card p-5 text-center">
            <Car size={36} className="text-primary spin mb-2" />
            <p className="text-secondary">Loading live customer schedule bookings...</p>
          </div>
        ) : filteredScheduledRides.length === 0 ? (
          <div className="table-container-card p-5 text-center">
            <Calendar size={38} className="text-secondary mb-2" />
            <h3 style={{ fontSize: '1.15rem', fontWeight: '700' }}>No Scheduled Bookings Found</h3>
            <p className="text-secondary">
              {scheduleSearchQuery ? 'No bookings match your current search query.' : 'Waiting for incoming scheduled ride bookings from customers...'}
            </p>
          </div>
        ) : (
          <div className="schedule-cards-grid">
            {filteredScheduledRides.map(ride => {
              const prefs = getCustomerRidePreferences(ride);
              const isAssigned = isRideAssigned(ride);
              const rideId = ride.requestId || ride.id || ride.displayId || 'REQ';
              const pName = ride.passengerName || ride.customerName || 'Customer';
              const pPhone = ride.passengerPhone || ride.customerPhone || ride.phone || 'N/A';
              const pEmail = ride.passengerEmail || ride.customerEmail || ride.email || '';
              
              const startDate = ride.startingFrom || ride.customSchedule?.startDate || ride.date || 'Today';
              const returnDateTime = ride.customSchedule?.returnDate || ride.customSchedule?.toTime || ride.timeToLeave || ride.returnTime || (ride.customSchedule ? `${ride.customSchedule.endDate || ''} ${ride.customSchedule.toTime || ''}`.trim() : null) || 'Same Day';
              const seating = prefs.vehicleType;
              const fareDisplay = prefs.fare;
              const scheduleRoutine = getDaysDisplay(ride);

              return (
                <div key={ride._id || ride.requestId || ride.id} className="schedule-card">
                  {/* Card Header: Request ID + Schedule Type Tag + Status Badge */}
                  <div className="schedule-card-header">
                    <div className="schedule-card-tags">
                      <span className="id-pill font-mono">{rideId}</span>
                      <span className="schedule-type-badge">
                        <Calendar size={12} />
                        {ride.scheduleType || 'Schedule Ride'}
                      </span>
                    </div>

                    <span className={`schedule-status-pill ${isAssigned ? 'assigned' : (String(ride?.status || hire?.status || '').toUpperCase() === 'WAITING FOR CUSTOMER' ? 'waiting' : 'pending')}`}>
                      {isAssigned ? '● Assigned' : (String(ride?.status || hire?.status || '').toUpperCase() === 'WAITING FOR CUSTOMER' ? '⏳ Waiting for Customer' : '● Pending Dispatch')}
                    </span>
                  </div>

                  {/* Card Body */}
                  <div className="schedule-card-body">
                    {/* Customer Info */}
                    <div className="schedule-customer-row">
                      <div className="schedule-avatar">
                        {pName.charAt(0).toUpperCase()}
                      </div>
                      <div className="schedule-customer-meta">
                        <div className="schedule-customer-name" title={pName}>{pName}</div>
                        <div className="schedule-customer-contact">
                          <Phone size={11} className="text-secondary flex-shrink-0" />
                          <a href={`tel:${pPhone}`}>{pPhone}</a>
                          {pEmail && <span className="text-secondary text-xs truncate max-w-[130px]">• {pEmail}</span>}
                        </div>
                      </div>
                    </div>

                    {/* Customer Preference Badges */}
                    <div className="mb-2">
                      <RenderPreferenceBadges ride={ride} />
                    </div>

                    {/* Trip Route Box (Trip 1 Morning & Trip 2 Evening) */}
                    <div className="schedule-route-box">
                      {/* Trip 1 Morning */}
                      <div className="trip-stage-container mb-2">
                        <div className="d-flex align-items-center mb-1">
                          <span className="stage-badge morning">Trip 1 (Morning)</span>
                        </div>
                        <div className="schedule-route-point">
                          <span className="schedule-point-dot green"></span>
                          <span className="schedule-point-text" title={prefs.morningPickup}>
                            <strong className="text-secondary text-xs d-block">PICKUP</strong>
                            {prefs.morningPickup}
                          </span>
                        </div>
                        <div className="schedule-route-point mt-1">
                          <span className="schedule-point-dot red"></span>
                          <span className="schedule-point-text" title={prefs.morningDropoff}>
                            <strong className="text-secondary text-xs d-block">DROPOFF</strong>
                            {prefs.morningDropoff}
                          </span>
                        </div>
                      </div>

                      {/* Trip 2 Evening (for Two Way) */}
                      {prefs.tripType === 'Two Way' && (prefs.eveningPickup || prefs.eveningDropoff) && (
                        <div className="trip-stage-container evening-stage">
                          <div className="d-flex align-items-center mb-1">
                            <span className="stage-badge evening">Trip 2 (Evening)</span>
                          </div>
                          <div className="schedule-route-point">
                            <span className="schedule-point-dot purple"></span>
                            <span className="schedule-point-text" title={prefs.eveningPickup}>
                              <strong className="text-secondary text-xs d-block">RETURN PICKUP</strong>
                              {prefs.eveningPickup}
                            </span>
                          </div>
                          <div className="schedule-route-point mt-1">
                            <span className="schedule-point-dot amber"></span>
                            <span className="schedule-point-text" title={prefs.eveningDropoff}>
                              <strong className="text-secondary text-xs d-block">RETURN DROPOFF</strong>
                              {prefs.eveningDropoff}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Schedule Details Grid */}
                    <div className="schedule-details-grid">
                      <div className="schedule-detail-item">
                        <span className="schedule-detail-label">
                          <Calendar size={11} className="text-primary" /> Starting Date
                        </span>
                        <span className="schedule-detail-value" title={startDate}>{startDate}</span>
                      </div>

                      <div className="schedule-detail-item">
                        <span className="schedule-detail-label">
                          <Clock size={11} className="text-secondary" /> Return Date/Time
                        </span>
                        <span className="schedule-detail-value" title={returnDateTime}>{returnDateTime}</span>
                      </div>

                      <div className="schedule-detail-item">
                        <span className="schedule-detail-label">
                          <Wind size={11} className="text-secondary" /> Routine / Days
                        </span>
                        <span className="schedule-detail-value" title={scheduleRoutine}>{scheduleRoutine}</span>
                      </div>

                      <div className="schedule-detail-item">
                        <span className="schedule-detail-label">
                          <Car size={11} className="text-secondary" /> Seating & Car
                        </span>
                        <span className="schedule-detail-value" title={seating}>{seating}</span>
                      </div>
                    </div>

                    {/* Special Notes Alert */}
                    {prefs.additionalNotes ? (
                      <div className="pref-notes-pill mt-2">
                        <AlertCircle size={12} className="flex-shrink-0" />
                        <span><strong>Special Notes:</strong> {prefs.additionalNotes}</span>
                      </div>
                    ) : null}
                  </div>

                  {/* Card Footer: Fare & Action Buttons */}
                  <div className="schedule-card-footer">
                    <div className="schedule-fare-box">
                      <span className="schedule-fare-label">Customer Proposed Fare</span>
                      <span className="schedule-fare-amount">{fareDisplay}</span>
                    </div>

                    <div className="schedule-actions-row">
                      <button 
                        className="schedule-btn-edit-fare"
                        onClick={() => openFareEditModal(ride)}
                        title="Edit Fare via PATCH API"
                      >
                        <Edit2 size={13} /> Edit Fare
                      </button>

                      <button 
                        className="schedule-btn-dispatch"
                        onClick={() => handleSelectRide(ride)}
                        title="Select driver and dispatch ride"
                      >
                        <Sparkles size={13} /> Dispatch
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // View 5: Customer Hire Driver Requests Tab
  const renderHireDriver = () => {
    return (
      <div className="hire-driver-container fade-in">
        {/* Page Header */}
        <div className="page-header d-flex justify-content-between align-items-center mb-3">
          <div>
            <h1 className="page-title">Customer Driver Hire Requests</h1>
            <p className="page-subtitle">
              Live customer driver hire bookings with dedicated driver dispatch, CNIC verification, working hours, and custom fare management.
            </p>
          </div>
          <div className="d-flex align-items-center gap-2">
            <button 
              className="secondary-btn d-flex align-items-center gap-2"
              onClick={() => { setHireLoading(true); loadDriverHires().finally(() => setHireLoading(false)); fetchDrivers(); }}
              title="Refresh driver hire requests"
            >
              <RefreshCw size={14} className={hireLoading ? 'spin' : ''} />
              Refresh
            </button>
          </div>
        </div>

        {/* Toolbar: Search + Status Filter */}
        <div className="hire-toolbar">
          <div className="hire-search-box">
            <Search size={16} className="hire-search-icon" />
            <input 
              type="text"
              placeholder="Search by customer, phone, CNIC, pickup, or HDR ID..."
              value={hireSearchQuery}
              onChange={(e) => setHireSearchQuery(e.target.value)}
            />
          </div>

          <div className="radio-group toolbar-radios">
            <button 
              type="button"
              className={`radio-btn ${hireStatusFilter === 'all' ? 'active' : ''}`}
              onClick={() => setHireStatusFilter('all')}
            >All ({driverHireRequests.length})</button>
            <button 
              type="button"
              className={`radio-btn ${hireStatusFilter === 'pending' ? 'active' : ''}`}
              onClick={() => setHireStatusFilter('pending')}
            >Pending Dispatch ({hirePendingCount})</button>
            <button 
              type="button"
              className={`radio-btn ${hireStatusFilter === 'assigned' ? 'active' : ''}`}
              onClick={() => setHireStatusFilter('assigned')}
            >Assigned ({hireAssignedCount})</button>
          </div>
        </div>

        {/* Driver Hire Cards Grid */}
        {hireLoading ? (
          <div className="table-container-card p-5 text-center">
            <UserCheck size={36} className="text-primary spin mb-2" />
            <p className="text-secondary">Loading live driver hire requests...</p>
          </div>
        ) : filteredDriverHires.length === 0 ? (
          <div className="table-container-card p-5 text-center">
            <Briefcase size={38} className="text-secondary mb-2" />
            <h3 style={{ fontSize: '1.15rem', fontWeight: '700' }}>No Driver Hire Requests Found</h3>
            <p className="text-secondary">
              {hireSearchQuery ? 'No driver hire requests match your current search query.' : 'Waiting for incoming driver hire requests from customers...'}
            </p>
          </div>
        ) : (
          <div className="hire-cards-grid">
            {filteredDriverHires.map(hire => {
              const statusUpper = String(hire.status || '').toUpperCase();
              const isAssigned = statusUpper === 'ASSIGNED' || !!hire.assignedDriverId || !!hire.assignedDriverName;
              const reqId = hire.requestId || hire.displayId || hire.id || 'HDR';
              const cName = hire.customerName || hire.passengerName || 'Customer';
              const cPhone = hire.customerPhone || hire.passengerPhone || hire.phone || 'N/A';
              const cnicNum = hire.cnic || 'N/A';
              const bookDate = hire.bookingDate || (hire.createdAt ? new Date(hire.createdAt).toISOString().split('T')[0] : 'Today');
              const reachTime = hire.timeToReach || '08:30 AM';
              const offTime = hire.offTime || '05:00 PM';
              const pickup = typeof hire.pickupLocation === 'object' ? (hire.pickupLocation?.address || 'Pickup Location') : (hire.pickupLocation || 'Pickup Location');
              const drop = typeof hire.dropoffLocation === 'object' ? (hire.dropoffLocation?.address || 'Drop-off Location') : (hire.dropoffLocation || 'Drop-off Location');
              const fareDisplay = hire.fareFormatted || (typeof hire.fare === 'number' ? `Rs. ${hire.fare.toLocaleString()}` : (hire.fare || 'Rs. 3,500'));

              return (
                <div 
                  key={hire._id || hire.id || reqId}
                  className={`hire-card ${isAssigned ? 'border-assigned' : 'border-pending'}`}
                >
                  {/* Card Header */}
                  <div className="hire-card-header">
                    <div className="d-flex align-items-center gap-2">
                      <span className="id-pill font-mono">{reqId}</span>
                      <span className="hire-type-badge">
                        <Briefcase size={11} /> Driver Hire
                      </span>
                    </div>
                    <span className={`schedule-status-pill ${isAssigned ? 'assigned' : (String(hire?.status || '').toUpperCase() === 'WAITING FOR CUSTOMER' ? 'waiting' : 'pending')}`}>
                      {isAssigned ? '● ASSIGNED' : (String(hire?.status || '').toUpperCase() === 'WAITING FOR CUSTOMER' ? '⏳ Waiting for Customer' : '● Pending Dispatch')}
                    </span>
                  </div>

                  {/* Card Body */}
                  <div className="hire-card-body">
                    {/* Customer Row */}
                    <div className="hire-customer-strip">
                      <div className="hire-avatar">
                        {cName.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="hire-customer-name" title={cName}>{cName}</h4>
                        <div className="hire-customer-contact">
                          <a href={`tel:${cPhone}`} className="hire-phone-link" title="Call Customer">
                            <Phone size={12} /> {cPhone}
                          </a>
                        </div>
                      </div>
                      <span className="hire-cnic-badge" title="Customer CNIC Number">
                        <CreditCard size={12} /> {cnicNum}
                      </span>
                    </div>

                    {/* Booking Date & Working Hours Strip */}
                    <div className="hire-schedule-grid">
                      <div className="hire-schedule-item">
                        <span className="hire-schedule-label">Booking Date</span>
                        <span className="hire-schedule-val">{bookDate}</span>
                      </div>
                      <div className="hire-schedule-item">
                        <span className="hire-schedule-label">Time to Reach</span>
                        <span className="hire-schedule-val">{reachTime}</span>
                      </div>
                      <div className="hire-schedule-item">
                        <span className="hire-schedule-label">Off Time</span>
                        <span className="hire-schedule-val">{offTime}</span>
                      </div>
                    </div>

                    {/* Route Details */}
                    <div className="schedule-route-box">
                      <div className="route-stop">
                        <span className="route-stop-dot green-dot" />
                        <div className="route-stop-content">
                          <span className="route-stop-label">PICKUP ADDRESS</span>
                          <span className="route-stop-addr" title={pickup}>{pickup}</span>
                        </div>
                      </div>
                      {drop && drop !== 'Drop-off Location' && (
                        <>
                          <div className="route-connecting-line" />
                          <div className="route-stop">
                            <span className="route-stop-dot red-dot" />
                            <div className="route-stop-content">
                              <span className="route-stop-label">DESTINATION</span>
                              <span className="route-stop-addr" title={drop}>{drop}</span>
                            </div>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Assigned Driver Row if Assigned */}
                    {isAssigned && (
                      <div className="assigned-driver-summary-box">
                        <span className="assigned-driver-title">ASSIGNED DRIVER:</span>
                        <div className="d-flex align-items-center justify-content-between mt-1">
                          <div className="d-flex align-items-center gap-1.5">
                            <UserCheck size={13} className="text-success" />
                            <strong className="text-sm">{hire.assignedDriverName || 'Driver Assigned'}</strong>
                          </div>
                          {hire.assignedDriverPhone && (
                            <span className="text-xs text-secondary">{hire.assignedDriverPhone}</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Card Footer */}
                  <div className="hire-card-footer">
                    <div className="hire-fare-badge">
                      <span className="hire-fare-label">AGREED FARE</span>
                      <span className="hire-fare-amount">{fareDisplay}</span>
                    </div>

                    <div className="schedule-actions-row">
                      <button 
                        className="schedule-btn-edit-fare"
                        onClick={() => openFareEditModal({
                          ...hire,
                          isDriverHire: true,
                          _type: 'hire',
                          passengerName: cName,
                          scheduleType: 'Driver Hire Request'
                        })}
                        title="Edit agreed fare"
                      >
                        <Edit2 size={12} /> Edit Fare
                      </button>

                      <button 
                        className={`schedule-btn-dispatch ${isAssigned ? 'btn-reassign' : ''}`}
                        onClick={() => handleSelectRide({
                          ...hire,
                          isDriverHire: true,
                          _type: 'hire',
                          mongoId: hire.mongoId || hire._id || hire.id,
                          _id: hire._id || hire.mongoId || hire.id,
                          requestId: reqId,
                          id: reqId,
                          passengerName: cName,
                          passengerPhone: cPhone,
                          pickupLocation: pickup,
                          dropoffLocation: drop,
                          dropLocation: drop,
                          fare: hire.fare || 3500,
                          fareFormatted: fareDisplay
                        })}
                        title="Select driver and dispatch"
                      >
                        <Sparkles size={13} /> {isAssigned ? 'Reassign' : 'Dispatch'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // View 6: Replacement Driver Requests Tab (Prototype Screens)
  const renderReplacementRequests = () => {
    return (
      <div className="replacement-container fade-in">
        {/* Page Header */}
        <div className="page-header d-flex justify-content-between align-items-center mb-3">
          <div>
            <h1 className="page-title">Replacement Driver Requests</h1>
            <p className="page-subtitle">
              Manage urgent replacement driver requests when original drivers face vehicle issues or breakdowns.
            </p>
          </div>
          <div className="d-flex align-items-center gap-2">
            <button 
              className="secondary-btn d-flex align-items-center gap-2"
              onClick={() => { setReplacementLoading(true); loadReplacements().finally(() => setReplacementLoading(false)); fetchDrivers(); }}
              title="Refresh replacement requests"
            >
              <RefreshCw size={14} className={replacementLoading ? 'spin' : ''} />
              Refresh
            </button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="replacement-toolbar">
          <div className="replacement-search-box">
            <Search size={16} className="replacement-search-icon" />
            <input 
              type="text"
              placeholder="Search by client name, phone, reason, vehicle, or ID..."
              value={replacementSearchQuery}
              onChange={(e) => setReplacementSearchQuery(e.target.value)}
            />
          </div>

          <div className="radio-group toolbar-radios">
            <button 
              type="button"
              className={`radio-btn ${replacementStatusFilter === 'all' ? 'active' : ''}`}
              onClick={() => setReplacementStatusFilter('all')}
            >All ({replacementRequests.length})</button>
            <button 
              type="button"
              className={`radio-btn ${replacementStatusFilter === 'pending' ? 'active' : ''}`}
              onClick={() => setReplacementStatusFilter('pending')}
            >Pending ({replacementPendingCount})</button>
            <button 
              type="button"
              className={`radio-btn ${replacementStatusFilter === 'assigned' ? 'active' : ''}`}
              onClick={() => setReplacementStatusFilter('assigned')}
            >Assigned ({replacementAssignedCount})</button>
          </div>
        </div>

        {/* Replacement Cards Grid */}
        {replacementLoading ? (
          <div className="table-container-card p-5 text-center">
            <RefreshCw size={36} className="text-primary spin mb-2" />
            <p className="text-secondary">Loading live replacement driver requests...</p>
          </div>
        ) : filteredReplacementRequests.length === 0 ? (
          <div className="table-container-card p-5 text-center">
            <ShieldCheck size={38} className="text-secondary mb-2" />
            <h3 style={{ fontSize: '1.15rem', fontWeight: '700' }}>No Replacement Requests Found</h3>
            <p className="text-secondary">
              {replacementSearchQuery ? 'No requests match your current search query.' : 'Waiting for incoming replacement requests...'}
            </p>
          </div>
        ) : (
          <div className="replacement-cards-grid">
            {filteredReplacementRequests.map(item => {
              const isAssigned = String(item.status || '').toUpperCase() === 'ASSIGNED';
              const reqId = item.requestId || item.displayId || item.id || 'RPL';
              const cName = item.clientName || item.passengerName || 'Client';
              const cPhone = item.clientPhone || item.passengerPhone || '+92 300 1234567';
              const schedDate = item.scheduledDate || 'May 21, 2026';
              const slot = item.timeSlot || '06:00 AM - 10:00 AM';
              const rsn = item.reason || 'Vehicle Issue';
              const pref = item.preferences || {};
              const notes = item.additionalNotes || 'Driver is unavailable due to vehicle issue.';
              const drv = item.assignedDriver || {};

              // SCREEN 2: Replacement Driver Assigned (Success State Prototype)
              if (isAssigned) {
                return (
                  <div key={item._id || item.id || reqId} className="proto-assigned-card fade-in">
                    {/* Top Green Checkmark Banner */}
                    <div className="proto-assigned-header-badge">
                      <div className="proto-big-checkmark">
                        <CheckCircle size={32} />
                      </div>
                      <h3 className="proto-assigned-title">Replacement Driver Assigned</h3>
                      <p className="proto-assigned-sub">A new driver has been assigned for your scheduled ride.</p>
                    </div>

                    {/* Details Box */}
                    <div className="p-3 d-flex flex-column gap-3">
                      <div className="proto-details-card">
                        {/* Driver Details */}
                        <div className="proto-section-box">
                          <span className="proto-section-title">Driver Details</span>
                          <div className="proto-item-row">
                            <div className="proto-icon-circle">
                              <User size={16} />
                            </div>
                            <div className="proto-item-content">
                              <div className="proto-item-name">{drv.name || 'Ahmed Raza'}</div>
                              <div className="proto-item-sub">{drv.phone || '+92 312 9876543'}</div>
                            </div>
                          </div>
                        </div>

                        {/* Vehicle Details */}
                        <div className="proto-section-box pt-2 border-top">
                          <span className="proto-section-title">Vehicle Details</span>
                          <div className="proto-item-row">
                            <div className="proto-icon-circle">
                              <Car size={16} />
                            </div>
                            <div className="proto-item-content">
                              <div className="proto-item-name">{drv.vehicle || pref.vehicleType || 'Sedan Executive'}</div>
                              <div className="proto-item-sub">{pref.acPreference || 'AC'}</div>
                            </div>
                          </div>
                        </div>

                        {/* Ride Details */}
                        <div className="proto-section-box pt-2 border-top">
                          <span className="proto-section-title">Ride Details</span>
                          <div className="proto-item-row">
                            <div className="proto-icon-circle">
                              <Calendar size={16} />
                            </div>
                            <div className="proto-item-content">
                              <div className="proto-item-name">{schedDate} ({slot})</div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Action Button: View Booking Details / Reassign */}
                      <button 
                        className="proto-btn-view-booking"
                        onClick={() => {
                          setViewPassengerModal({
                            displayId: reqId,
                            passengerName: cName,
                            passengerPhone: cPhone,
                            passengerEmail: item.clientEmail,
                            pickupLocation: item.pickupLocation || 'Pickup Location',
                            dropoffLocation: item.dropoffLocation || 'Drop-off Location',
                            fareFormatted: item.fareFormatted || 'Rs. 4,500',
                            vehicleType: pref.vehicleType || 'Sedan Executive',
                            acPreference: pref.acPreference || 'AC',
                            seatsNeeded: 1,
                            ...item
                          });
                        }}
                      >
                        <Eye size={15} /> View Booking Details
                      </button>
                    </div>
                  </div>
                );
              }

              // SCREEN 1: Replacement Driver Request (Pending State Prototype)
              return (
                <div key={item._id || item.id || reqId} className="proto-replacement-card fade-in">
                  {/* Card Header */}
                  <div className="proto-card-header">
                    <h3 className="proto-header-title">Replacement Driver Request</h3>
                    <span className={`proto-status-pill ${item.status?.toLowerCase() || 'pending'}`}>
                      {item.status || 'Pending'}
                    </span>
                  </div>

                  {/* Card Body */}
                  <div className="proto-card-body">
                    {/* Client Details */}
                    <div className="proto-section-box">
                      <span className="proto-section-title">Client Details</span>
                      <div className="proto-item-row">
                        <div className="proto-icon-circle">
                          <User size={16} />
                        </div>
                        <div className="proto-item-content">
                          <div className="proto-item-name">{cName}</div>
                          <div className="proto-item-sub">{cPhone}</div>
                        </div>
                      </div>
                    </div>

                    {/* Ride Details & Reason */}
                    <div className="proto-section-box pt-2 border-top">
                      <span className="proto-section-title">Ride Details</span>
                      <div className="proto-item-row mb-2">
                        <div className="proto-icon-circle">
                          <Calendar size={16} />
                        </div>
                        <div className="proto-item-content">
                          <div className="proto-item-name">{schedDate} ({slot})</div>
                        </div>
                      </div>

                      <div className="proto-item-row">
                        <div className="proto-icon-circle" style={{ background: '#fef2f2', color: '#ef4444' }}>
                          <MapPin size={16} />
                        </div>
                        <div className="proto-item-content">
                          <span className="text-xs text-secondary d-block font-semibold">Reason</span>
                          <div className="proto-item-name text-danger">{rsn}</div>
                        </div>
                      </div>
                    </div>

                    {/* Request Preferences */}
                    <div className="proto-section-box pt-2 border-top">
                      <span className="proto-section-title">Request Preferences</span>
                      <div className="proto-pref-grid">
                        <div className="proto-pref-row">
                          <div className="d-flex align-items-center gap-2">
                            <Car size={14} className="text-primary" />
                            <span className="proto-pref-label">Vehicle Arrangement</span>
                          </div>
                          <span className="proto-pref-val">{pref.vehicleArrangement || 'Separate'}</span>
                        </div>

                        <div className="proto-pref-row">
                          <div className="d-flex align-items-center gap-2">
                            <Car size={14} className="text-primary" />
                            <span className="proto-pref-label">Vehicle Type</span>
                          </div>
                          <span className="proto-pref-val">{pref.vehicleType || 'Sedan Executive'}</span>
                        </div>

                        <div className="proto-pref-row">
                          <div className="d-flex align-items-center gap-2">
                            <Users size={14} className="text-primary" />
                            <span className="proto-pref-label">Gender Preference</span>
                          </div>
                          <span className="proto-pref-val">{pref.genderPreference || 'Male Only'}</span>
                        </div>

                        <div className="proto-pref-row">
                          <div className="d-flex align-items-center gap-2">
                            <Wind size={14} className="text-primary" />
                            <span className="proto-pref-label">AC Preference</span>
                          </div>
                          <span className="proto-pref-val">{pref.acPreference || 'AC'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Additional Notes */}
                    <div className="proto-section-box">
                      <span className="proto-section-title">Additional Notes</span>
                      <div className="proto-notes-box">
                        {notes}
                      </div>
                    </div>
                  </div>

                  {/* Card Footer Actions matching Prototype */}
                  <div className="proto-card-footer">
                    <button 
                      className="proto-btn-assign"
                      onClick={() => {
                        handleSelectRide({
                          ...item,
                          isReplacement: true,
                          _type: 'replacement',
                          mongoId: item.mongoId || item._id || item.requestId,
                          _id: item._id || item.mongoId || item.requestId,
                          requestId: reqId,
                          id: reqId,
                          passengerName: cName,
                          passengerPhone: cPhone,
                          pickupLocation: item.pickupLocation || 'Blue Area, Islamabad',
                          dropoffLocation: item.dropoffLocation || 'F-10 Markaz, Islamabad',
                          fare: item.fare || 4500,
                          fareFormatted: item.fareFormatted || 'Rs. 4,500',
                          preferences: {
                            acRequired: (pref.acPreference || 'AC').toUpperCase().includes('AC'),
                            vehicleType: pref.vehicleType || 'Sedan Executive'
                          },
                          acPreference: pref.acPreference || 'AC',
                          vehiclePreference: pref.vehicleType || 'Sedan Executive'
                        });
                      }}
                      title="Add in Pool & Assign Driver"
                    >
                      <Plus size={16} /> Add in Pool & Assign Driver
                    </button>

                    <button 
                      className="proto-btn-reject"
                      onClick={() => handleRejectReplacement(item)}
                      title="Reject replacement request"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

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
                onClick={() => setDriverPanelFilter('all')}
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
              const make = (driver.vehicleInfo?.make || 'Toyota').trim();
              const rawModel = (driver.vehicleInfo?.model || 'Corolla').trim();
              const plateNumber = (driver.vehicleInfo?.plateNumber || 'ISB-1234').trim();
              const cleanModel = (plateNumber && rawModel.endsWith(plateNumber)) 
                ? rawModel.slice(0, -plateNumber.length).trim() 
                : rawModel;
              const category = driver.vehicleInfo?.category || 'Sedan';
              const isAc = driver.vehicleInfo?.ac !== false;
              const seats = driver.vehicleInfo?.seats || 4;

              return (
                <div 
                  key={driver.id} 
                  className={`driver-panel-card glass-panel ${isOnTrip ? 'border-active-dispatch' : ''}`}
                >
                  {/* Card Header: Driver Profile + Status & Rating */}
                  <div className="driver-panel-card-header">
                    <div className="driver-header-profile">
                      <div className="driver-card-avatar-wrapper">
                        <div className="driver-card-avatar">
                          {(driver.personalInfo?.name || 'D').charAt(0).toUpperCase()}
                        </div>
                        <span 
                          className={`driver-live-dot ${isOnTrip ? 'busy' : 'online'}`} 
                          title={isOnTrip ? 'Dispatched / On Trip' : 'Online & Available'}
                        />
                      </div>
                      <div className="driver-header-info">
                        <div className="driver-name-code-row">
                          <h3 className="driver-name-text" title={driver.personalInfo?.name || 'Driver'}>
                            {driver.personalInfo?.name || 'Driver'}
                          </h3>
                          <span className="driver-id-badge">{formatDriverCode(driver.id)}</span>
                        </div>
                        <div className="driver-contact-row">
                          <Phone size={12} className="text-secondary flex-shrink-0" />
                          <span>{driver.personalInfo?.phone || 'No phone'}</span>
                          {driver.personalInfo?.city && (
                            <>
                              <span className="driver-meta-sep">•</span>
                              <MapPin size={11} className="text-secondary flex-shrink-0" />
                              <span>{driver.personalInfo?.city}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="driver-header-actions">
                      <span className={`driver-status-pill ${isOnTrip ? 'on-trip' : 'available'}`}>
                        {isOnTrip ? '● Dispatched' : '● Available'}
                      </span>
                      <div className="driver-rating-badge">
                        <Star size={12} fill="#F59E0B" color="#F59E0B" />
                        <span>{driver.performance?.rating || 4.9}</span>
                        <span className="driver-trips-subtext">({driver.performance?.totalRides || 142})</span>
                      </div>
                    </div>
                  </div>

                  {/* Vehicle Spec Box */}
                  <div className="driver-vehicle-box">
                    <div className="driver-vehicle-top">
                      <div className="driver-vehicle-model">
                        <Car size={15} className="text-primary flex-shrink-0" />
                        <span title={`${make} ${cleanModel}`}>{make} {cleanModel}</span>
                      </div>
                      <span className="driver-plate-pill" title="Vehicle Registration Plate">
                        {plateNumber}
                      </span>
                    </div>
                    <div className="driver-vehicle-specs">
                      <span className="spec-chip category">{category}</span>
                      <span className={`spec-chip ${isAc ? 'ac' : 'non-ac'}`}>
                        {isAc ? <><Wind size={10} className="me-1" /> AC Fitted</> : 'Non-AC'}
                      </span>
                      <span className="spec-chip seats">
                        <User size={10} className="me-1" /> {seats} Seats
                      </span>
                    </div>
                  </div>

                  {/* Active Assignments / Dispatches Section */}
                  <div className="driver-assignments-section">
                    <div className="driver-assignments-header">
                      <div className="assignments-title-wrap">
                        <span className="assignments-title-text">ACTIVE ASSIGNMENTS</span>
                        <span className={`assignments-count-chip ${assignedTrips.length > 0 ? 'active' : 'zero'}`}>
                          {assignedTrips.length}
                        </span>
                      </div>
                      <button 
                        type="button"
                        className="driver-app-link-btn"
                        onClick={() => setViewDriverModal(driver)}
                        title="Preview Flutter Driver App for this driver"
                      >
                        <Smartphone size={12} />
                        <span>Open Driver App View</span>
                      </button>
                    </div>

                    {assignedTrips.length === 0 ? (
                      <div className="assignments-empty-box">
                        <CheckCircle2 size={13} className="text-secondary flex-shrink-0" />
                        <span>No active rides assigned.</span>
                      </div>
                    ) : (
                      <div className="assigned-trips-container">
                        {assignedTrips.map(trip => (
                          <div key={trip._id || trip.requestId} className="assigned-trip-card">
                            <div className="assigned-trip-card-top">
                              <span className="assigned-trip-id">{trip.displayId || trip.requestId}</span>
                              <span className="assigned-trip-status">ASSIGNED</span>
                              <span className="assigned-trip-fare">{trip.fareFormatted || trip.fare}</span>
                            </div>
                            <div className="assigned-trip-passenger">
                              <User size={12} className="text-secondary flex-shrink-0" />
                              <strong>{trip.passengerName || trip.customerName || 'Customer'}</strong>
                              <span className="assigned-trip-phone">({trip.passengerPhone || trip.customerPhone || 'N/A'})</span>
                            </div>
                            <div className="assigned-trip-route">
                              <span className="dot green-dot flex-shrink-0" />
                              <span className="route-text-clip" title={trip.pickupLocation}>{trip.pickupLocation}</span>
                              <span className="route-arrow-icon">➔</span>
                              <span className="dot red-dot flex-shrink-0" />
                              <span className="route-text-clip" title={trip.dropoffLocation || trip.dropLocation}>{trip.dropoffLocation || trip.dropLocation}</span>
                            </div>
                          </div>
                        ))}
                      </div>
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
          <span>Monthly Pickup</span>
          <span className="dispatch-counter-pill">{pendingCount}</span>
        </button>

        <button 
          className={`dispatch-nav-btn ${activeMainTab === 'schedule-rides' ? 'active' : ''}`}
          onClick={() => {
            setActiveMainTab('schedule-rides');
            setSelectedRide(null);
          }}
        >
          <Calendar size={16} />
          <span>Schedule Rides</span>
          <span className="dispatch-counter-pill info-pill">{scheduledCount}</span>
        </button>

        <button 
          className={`dispatch-nav-btn ${activeMainTab === 'travel-requests' ? 'active' : ''}`}
          onClick={() => {
            setActiveMainTab('travel-requests');
            setSelectedRide(null);
          }}
        >
          <MapPin size={16} />
          <span>Travel & Tourism</span>
          <span className="dispatch-counter-pill info-pill">{travelRequests.length}</span>
        </button>

        <button 
          className={`dispatch-nav-btn ${activeMainTab === 'hire-driver' ? 'active' : ''}`}
          onClick={() => {
            setActiveMainTab('hire-driver');
            setSelectedRide(null);
          }}
        >
          <Briefcase size={16} />
          <span>Hire Driver</span>
          <span className="dispatch-counter-pill purple-pill">{hirePendingCount}</span>
        </button>

        <button 
          className={`dispatch-nav-btn ${activeMainTab === 'replacement-requests' ? 'active' : ''}`}
          onClick={() => {
            setActiveMainTab('replacement-requests');
            setSelectedRide(null);
          }}
        >
          <RefreshCw size={16} />
          <span>Driver Replacement</span>
          <span className="dispatch-counter-pill alert-pill">{replacementPendingCount}</span>
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
      ) : activeMainTab === 'schedule-rides' ? (
        selectedRide ? renderDriverSelection() : renderScheduleRides()
      ) : activeMainTab === 'travel-requests' ? (
          selectedRide ? renderDriverSelection() : renderTravelRequests()
        ) : activeMainTab === 'hire-driver' ? (
        selectedRide ? renderDriverSelection() : renderHireDriver()
      ) : activeMainTab === 'replacement-requests' ? (
        selectedRide ? renderDriverSelection() : renderReplacementRequests()
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

              {/* Customer Preferences Badges */}
              <div className="mb-3">
                <RenderPreferenceBadges ride={viewPassengerModal} />
              </div>

              <div className="detail-section mb-3">
                <div className="d-flex align-items-center justify-content-between mb-1">
                  <h5 className="section-subtitle m-0">Trip Route ({getCustomerRidePreferences(viewPassengerModal).tripType})</h5>
                  {getCustomerRidePreferences(viewPassengerModal).startingDate && (
                    <span className="text-xs font-semibold text-primary d-flex align-items-center gap-1">
                      <Calendar size={12} /> Starting: {getCustomerRidePreferences(viewPassengerModal).startingDate}
                    </span>
                  )}
                </div>
                <div className="route-detail-box p-3 rounded bg-surface">
                  {/* Trip 1 Morning / Route */}
                  <div className="mb-2 pb-2 border-bottom">
                    <div className="d-flex align-items-center justify-content-between mb-1">
                      <span className="stage-badge morning">{getCustomerRidePreferences(viewPassengerModal).tripType === 'Two Way' ? 'Trip 1 (Morning)' : 'Primary Route'}</span>
                      <span className="text-xs text-secondary"><Clock size={11} className="inline-icon" /> Reach: {getCustomerRidePreferences(viewPassengerModal).morningTime}</span>
                    </div>
                    <div className="d-flex align-items-start gap-2 mb-1">
                      <MapPin size={16} className="text-success mt-0.5 flex-shrink-0" />
                      <div>
                        <strong className="text-xs text-secondary">PICKUP</strong>
                        <div>{getCustomerRidePreferences(viewPassengerModal).morningPickup}</div>
                      </div>
                    </div>
                    <div className="d-flex align-items-start gap-2">
                      <MapPin size={16} className="text-danger mt-0.5 flex-shrink-0" />
                      <div>
                        <strong className="text-xs text-secondary">DROP-OFF</strong>
                        <div>{getCustomerRidePreferences(viewPassengerModal).morningDropoff}</div>
                      </div>
                    </div>
                  </div>

                  {/* Trip 2 Evening (if Two Way) */}
                  {getCustomerRidePreferences(viewPassengerModal).tripType === 'Two Way' && (getCustomerRidePreferences(viewPassengerModal).eveningPickup || getCustomerRidePreferences(viewPassengerModal).eveningDropoff) && (
                    <div className="pt-1">
                      <div className="d-flex align-items-center justify-content-between mb-1">
                        <span className="stage-badge evening">Trip 2 (Evening)</span>
                        <span className="text-xs text-secondary"><Clock size={11} className="inline-icon" /> Return: {getCustomerRidePreferences(viewPassengerModal).eveningTime}</span>
                      </div>
                      <div className="d-flex align-items-start gap-2 mb-1">
                        <MapPin size={16} className="text-primary mt-0.5 flex-shrink-0" />
                        <div>
                          <strong className="text-xs text-secondary">RETURN PICKUP</strong>
                          <div>{getCustomerRidePreferences(viewPassengerModal).eveningPickup}</div>
                        </div>
                      </div>
                      <div className="d-flex align-items-start gap-2">
                        <MapPin size={16} className="text-warning mt-0.5 flex-shrink-0" />
                        <div>
                          <strong className="text-xs text-secondary">RETURN DROP-OFF</strong>
                          <div>{getCustomerRidePreferences(viewPassengerModal).eveningDropoff}</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Special Notes if any */}
              {getCustomerRidePreferences(viewPassengerModal).additionalNotes && (
                <div className="detail-section mb-3">
                  <h5 className="section-subtitle">Customer Special Notes</h5>
                  <div className="pref-notes-pill w-100 p-2">
                    <AlertCircle size={14} className="flex-shrink-0" />
                    <span>{getCustomerRidePreferences(viewPassengerModal).additionalNotes}</span>
                  </div>
                </div>
              )}

              <div className="detail-section mb-3">
                <h5 className="section-subtitle">Vehicle & Comfort Requirements</h5>
                <div className="d-flex gap-3 flex-wrap">
                  <div className="pill-badge">{getCustomerRidePreferences(viewPassengerModal).vehicleType}</div>
                  <div className="pill-badge">{getCustomerRidePreferences(viewPassengerModal).acPreference} Required</div>
                  <div className="pill-badge">{getCustomerRidePreferences(viewPassengerModal).serviceTypeDisplay}</div>
                  <div className="pill-badge">{getCustomerRidePreferences(viewPassengerModal).genderPreference}</div>
                  <div className="pill-badge">{getCustomerRidePreferences(viewPassengerModal).seatsCount} Seat(s)</div>
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
                <Sparkles size={14} /> Dispatch & Assign Driver
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

      {/* Inline Fare Edit Modal */}
      {fareModalRide && (
        <div className="modal-backdrop fade-in" onClick={() => !isSavingFareModal && setFareModalRide(null)}>
          <div className="fare-modal-card glass-panel" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="d-flex align-items-center gap-2">
                <span className="id-pill font-mono">{fareModalRide.displayId || fareModalRide.requestId || 'SCHEDULE'}</span>
                <h3 className="modal-title">Edit Agreed Fare</h3>
              </div>
              <button className="close-btn" disabled={isSavingFareModal} onClick={() => setFareModalRide(null)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveFareModal}>
              <div className="modal-body">
                <div className="fare-modal-customer-info">
                  <div className="customer-avatar-sm">
                    {(fareModalRide.passengerName || 'C').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="m-0 font-bold">{fareModalRide.passengerName || 'Customer'}</h4>
                    <span className="text-secondary text-xs">{fareModalRide.scheduleType || 'Scheduled Booking'}</span>
                  </div>
                </div>

                <div className="fare-input-wrapper mt-3">
                  <label className="fare-input-label">Update Fare Amount (PKR / Rs.)</label>
                  <div className="fare-input-box">
                    <span className="fare-currency-prefix">Rs.</span>
                    <input
                      type="number"
                      min="0"
                      step="50"
                      className="fare-number-field"
                      value={fareModalAmount}
                      onChange={(e) => setFareModalAmount(e.target.value)}
                      placeholder="e.g. 8500"
                      autoFocus
                      required
                    />
                  </div>
                  <span className="text-xs text-secondary mt-1 d-block">
                    This updates the fare in the database via PATCH /api/rides/:id instantly.
                  </span>
                </div>

                <div className="quick-fare-suggestions mt-3">
                  <span className="text-xs text-secondary d-block mb-1">Quick Presets:</span>
                  <div className="d-flex flex-wrap gap-2">
                    {[1500, 3000, 5000, 8500, 10000, 15000].map(amt => (
                      <button
                        type="button"
                        key={amt}
                        className={`fare-preset-btn ${Number(fareModalAmount) === amt ? 'active' : ''}`}
                        onClick={() => setFareModalAmount(String(amt))}
                      >
                        Rs. {amt.toLocaleString()}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="secondary-btn"
                  disabled={isSavingFareModal}
                  onClick={() => setFareModalRide(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="primary-btn"
                  disabled={isSavingFareModal || !fareModalAmount}
                >
                  {isSavingFareModal ? (
                    <>
                      <RefreshCw size={14} className="spin-icon" /> Saving...
                    </>
                  ) : (
                    <>
                      <CheckCircle size={14} /> Update Fare
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dedicated Dispatch Modal: Assign verified driver from /admin/drivers/verified */}
      {dispatchModalRide && (
        <div className="modal-backdrop fade-in" onClick={() => setDispatchModalRide(null)}>
          <div className="modal-dialog-card glass-panel dispatch-modal-dialog" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="d-flex align-items-center gap-2">
                <span className="id-pill font-mono">{dispatchModalRide.requestId || dispatchModalRide.id}</span>
                <h3 className="modal-title">Dispatch Driver</h3>
              </div>
              <button className="close-btn" onClick={() => setDispatchModalRide(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              {/* Trip Summary Mini-Card */}
              <div className="dispatch-modal-summary mb-3 p-3 rounded bg-surface">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <div>
                    <strong className="passenger-name-text" style={{ fontSize: '1rem' }}>
                      {dispatchModalRide.passengerName || dispatchModalRide.customerName || 'Customer'}
                    </strong>
                    <span className="text-xs text-secondary ms-2">
                      ({dispatchModalRide.passengerPhone || dispatchModalRide.phone || 'N/A'})
                    </span>
                  </div>
                  <span className="fare-badge lg">
                    {dispatchModalRide.fareFormatted || (typeof dispatchModalRide.fare === 'number' ? `Rs. ${dispatchModalRide.fare.toLocaleString()}` : dispatchModalRide.fare || 'Rs. 9,500')}
                  </span>
                </div>
                <div className="modal-route-row d-flex align-items-center gap-2 text-xs">
                  <span className="dot green-dot"></span>
                  <span className="truncate max-w-[200px]" title={dispatchModalRide.pickupLocation}>
                    <strong>Pickup:</strong> {dispatchModalRide.pickupLocation}
                  </span>
                  <span>➔</span>
                  <span className="dot red-dot"></span>
                  <span className="truncate max-w-[200px]" title={dispatchModalRide.dropoffLocation || dispatchModalRide.dropLocation}>
                    <strong>Drop:</strong> {dispatchModalRide.dropoffLocation || dispatchModalRide.dropLocation}
                  </span>
                </div>
                <div className="d-flex gap-2 mt-2 flex-wrap">
                  <span className="tag category-tag">{dispatchModalRide.vehicleType || 'Sedan Executive'}</span>
                  <span className="tag ac-tag">{dispatchModalRide.acPreference || 'AC'}</span>
                  <span className="tag seats-tag">{dispatchModalRide.passengersCount || 1} Seat(s)</span>
                  <span className="tag gender-tag">{dispatchModalRide.genderPreference || 'Male Only'}</span>
                </div>
              </div>

              {/* Verified Driver Selection */}
              <div className="driver-select-section">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <label className="section-label m-0 font-bold text-sm">
                    Select Verified Driver ({availableDriversLocal.length} Available):
                  </label>
                  <span className="text-xs text-muted">Backend: /admin/drivers/verified</span>
                </div>

                <div className="dispatch-search-box w-100 mb-2" style={{ maxWidth: '100%' }}>
                  <Search size={14} className="search-icon" />
                  <input
                    type="text"
                    className="dispatch-search-input"
                    placeholder="Search verified drivers by name, phone, or plate..."
                    value={dispatchDriverSearch}
                    onChange={(e) => setDispatchDriverSearch(e.target.value)}
                  />
                  {dispatchDriverSearch && (
                    <button 
                      type="button" 
                      className="search-clear-btn" 
                      onClick={() => setDispatchDriverSearch('')}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                <div className="modal-driver-list" style={{ maxHeight: '260px', overflowY: 'auto' }}>
                  {availableDriversLocal
                    .filter(d => {
                      if (!dispatchDriverSearch.trim()) return true;
                      const q = dispatchDriverSearch.toLowerCase().trim();
                      const name = (d.personalInfo?.name || d.name || '').toLowerCase();
                      const phone = (d.personalInfo?.phone || d.phone || '').toLowerCase();
                      const car = `${d.vehicleInfo?.make || ''} ${d.vehicleInfo?.model || ''} ${d.vehicleInfo?.plateNumber || ''}`.toLowerCase();
                      return name.includes(q) || phone.includes(q) || car.includes(q);
                    })
                    .map(driver => {
                      const isSelected = selectedDriverForDispatch && String(selectedDriverForDispatch.id || selectedDriverForDispatch._id) === String(driver.id || driver._id);
                      const isOnTrip = driver.availability === 'On Trip';
                      return (
                        <div
                          key={driver.id || driver._id}
                          className={`driver-select-card p-2.5 mb-2 rounded border cursor-pointer ${isSelected ? 'selected' : ''}`}
                          onClick={() => setSelectedDriverForDispatch(driver)}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                        >
                          <div className="d-flex align-items-center gap-2.5">
                            <div className="avatar-circle">
                              {(driver.personalInfo?.name || driver.name || 'D').charAt(0)}
                            </div>
                            <div>
                              <div className="d-flex align-items-center gap-2">
                                <strong className="text-sm">{driver.personalInfo?.name || driver.name}</strong>
                                <span className="driver-id-pill font-mono">{formatDriverCode(driver.id || driver._id)}</span>
                              </div>
                              <div className="text-xs text-secondary mt-0.5">
                                <span>{driver.vehicleInfo?.make} {driver.vehicleInfo?.model} ({driver.vehicleInfo?.plateNumber})</span>
                                <span className="mx-1">•</span>
                                <span>{driver.personalInfo?.phone}</span>
                              </div>
                            </div>
                          </div>
                          <div className="text-end">
                            <div className="d-flex align-items-center gap-1 text-xs font-bold text-warning justify-content-end">
                              <Star size={12} fill="#F59E0B" color="#F59E0B" />
                              <span>{driver.performance?.rating || 4.9}</span>
                            </div>
                            <span className={`availability-pill ${isOnTrip ? 'on-trip' : 'available'} mt-1`}>
                              {isOnTrip ? '● On Trip' : '● Available'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button 
                type="button" 
                className="secondary-btn" 
                disabled={isSubmittingDispatch} 
                onClick={() => setDispatchModalRide(null)}
              >
                Cancel
              </button>
              <button 
                type="button" 
                className="primary-btn" 
                disabled={isSubmittingDispatch || !selectedDriverForDispatch} 
                onClick={handleConfirmDispatchModal}
              >
                {isSubmittingDispatch ? (
                  <>
                    <RefreshCw size={14} className="spin-icon" /> Dispatching...
                  </>
                ) : (
                  <>
                    <Sparkles size={14} /> Confirm Dispatch
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RideDispatch;
