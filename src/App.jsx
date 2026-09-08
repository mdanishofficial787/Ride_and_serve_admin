import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import AdminLayout from './layouts/AdminLayout';
import DriverApproval from './pages/DriverApproval';
import RideDispatch from './pages/RideDispatch';
import AdminRideDispatch from './pages/AdminRideDispatch';
import RidePool from './pages/RidePool';
import PendingRides from './pages/PendingRides';
import PasswordResetRequests from './pages/PasswordResetRequests';
import DriverRating from './pages/DriverRating';
import AuthPage from './pages/AuthPage';
import './App.css';

function App() {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('rr_current_user');
      const token = localStorage.getItem('admin_token');
      if (saved && token) {
        return JSON.parse(saved);
      }
      return null;
    } catch (e) {
      return null;
    }
  });

  const handleLogout = () => {
    localStorage.removeItem('rr_current_user');
    localStorage.removeItem('admin_token');
    setUser(null);
  };

  const handleUpdateUser = (updatedUser) => {
    setUser(updatedUser);
    localStorage.setItem('rr_current_user', JSON.stringify(updatedUser));
  };

  if (!user) {
    return <AuthPage onLogin={setUser} />;
  }

  return (
    <Router>
      <Routes>
        <Route path="/" element={<AdminLayout user={user} onLogout={handleLogout} onUpdateUser={handleUpdateUser} />}>
          <Route index element={<Navigate to="/pending-rides" replace />} />
          <Route path="driver-approval" element={<DriverApproval />} />
          <Route path="password-resets" element={<PasswordResetRequests />} />
          <Route path="driver-selection" element={<RideDispatch />} />
          <Route path="admin-dispatch" element={<AdminRideDispatch />} />
          <Route path="driver-rating" element={<DriverRating />} />
          <Route path="ride-pool" element={<RidePool />} />
          <Route path="pending-rides" element={<PendingRides />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
