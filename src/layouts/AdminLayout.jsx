import React, { useState, useEffect } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { 
  Users, Calendar, FileText, Settings, Bell, Search, Car, AlertCircle, LogOut, Sun, Moon, X, KeyRound, Star 
} from 'lucide-react';
import './AdminLayout.css';

const AdminLayout = ({ user, onLogout, onUpdateUser }) => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState('Profile');
  const [profileName, setProfileName] = useState(user?.name || '');
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmNewPw, setConfirmNewPw] = useState('');
  const [settingsMsg, setSettingsMsg] = useState('');

  useEffect(() => {
    if (user?.name) setProfileName(user.name);
  }, [user]);

  useEffect(() => {
    if (isDarkMode) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  }, [isDarkMode]);

  const toggleTheme = () => setIsDarkMode(!isDarkMode);

  const initial = user?.name ? user.name.charAt(0).toUpperCase() : 'A';

  const handleSaveProfile = () => {
    if (!profileName.trim()) {
      alert('Please enter a valid name.');
      return;
    }

    if (newPw) {
      if (newPw.length < 6) {
        alert('New password must be at least 6 characters.');
        return;
      }
      if (newPw !== confirmNewPw) {
        alert('New passwords do not match.');
        return;
      }
    }

    const updated = {
      ...user,
      name: profileName.trim(),
      password: newPw ? newPw : user.password
    };

    if (onUpdateUser) {
      onUpdateUser(updated);
    }

    // Also update in registered users list in localStorage
    try {
      const data = localStorage.getItem('rr_registered_users');
      if (data) {
        const users = JSON.parse(data);
        const idx = users.findIndex(u => u.email.toLowerCase() === user.email.toLowerCase());
        if (idx !== -1) {
          users[idx] = { ...users[idx], ...updated };
          localStorage.setItem('rr_registered_users', JSON.stringify(users));
        }
      }
    } catch (e) {
      console.error(e);
    }

    alert('Profile updated successfully!');
    setIsSettingsOpen(false);
    setCurrentPw('');
    setNewPw('');
    setConfirmNewPw('');
  };

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <h2 className="brand-logo">R&R Dispatcher</h2>
        </div>
        
        <nav className="sidebar-nav">
          <div className="nav-category">APPROVALS & SECURITY</div>
          <ul className="nav-list">
            <li className="nav-item">
              <NavLink to="/driver-approval" className={({isActive}) => isActive ? "nav-link active" : "nav-link"}>
                <Users size={18} />
                <span>Driver Approval</span>
              </NavLink>
            </li>
            <li className="nav-item">
              <NavLink to="/password-resets" className={({isActive}) => isActive ? "nav-link active" : "nav-link"}>
                <KeyRound size={18} />
                <span>Password Resets</span>
              </NavLink>
            </li>
          </ul>

          <div className="nav-category mt-4">OPERATIONS</div>
          <ul className="nav-list">
            <li className="nav-item">
              <NavLink to="/driver-selection" className={({isActive}) => isActive ? "nav-link active" : "nav-link"}>
                <Car size={18} />
                <span>Ride Dispatch</span>
              </NavLink>
            </li>
            <li className="nav-item">
              <NavLink to="/driver-rating" className={({isActive}) => isActive ? "nav-link active" : "nav-link"}>
                <Star size={18} />
                <span>Driver Rating</span>
              </NavLink>
            </li>
            <li className="nav-item">
              <NavLink to="/ride-pool" className={({isActive}) => isActive ? "nav-link active" : "nav-link"}>
                <FileText size={18} />
                <span>Ride Pool</span>
              </NavLink>
            </li>
          </ul>

          <div className="nav-category mt-4">MANAGEMENT</div>
          <ul className="nav-list">
            <li className="nav-item">
              <NavLink to="/pending-rides" className={({isActive}) => isActive ? "nav-link active" : "nav-link"}>
                <AlertCircle size={18} />
                <span>Pending Rides</span>
              </NavLink>
            </li>
          </ul>

          <div className="nav-category mt-4">SETTINGS</div>
          {/* Settings links can go here in the future */}
        </nav>

        <div className="sidebar-footer">
          <div className="profile-widget" onClick={() => setIsSettingsOpen(true)} style={{cursor: 'pointer'}}>
            <div className="avatar">{initial}</div>
            <div className="profile-info">
              <span className="name">{user?.name || 'sohaib'}</span>
              <span className="email">{user?.email || 'sohaib@rrdispatcher.com'}</span>
            </div>
            <button className="logout-btn" title="Logout" onClick={(e) => { e.stopPropagation(); onLogout(); }}>
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="modal-overlay fade-in" style={{zIndex: 1000}}>
          <div className="glass-panel modal-content" style={{maxWidth: '600px'}}>
            <div className="modal-header">
              <h2>Account Settings</h2>
              <button className="icon-btn" onClick={() => setIsSettingsOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="settings-tabs-row">
              <button 
                className={`settings-tab-btn ${settingsTab === 'Profile' ? 'active' : ''}`}
                onClick={() => setSettingsTab('Profile')}
              >
                Profile Settings
              </button>
              <button 
                className={`settings-tab-btn ${settingsTab === 'Privacy' ? 'active' : ''}`}
                onClick={() => setSettingsTab('Privacy')}
              >
                Privacy Policy
              </button>
            </div>
            
            <div className="modal-body">
              {settingsTab === 'Profile' && (
                <div className="fade-in">
                  <div className="settings-avatar-section">
                    <div className="avatar settings-avatar">{initial}</div>
                    <button className="settings-change-photo-btn">Change Profile Picture</button>
                  </div>

                  <div className="settings-form-grid">
                    <div className="form-group mb-3">
                      <label>Full Name</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        value={profileName} 
                        onChange={(e) => setProfileName(e.target.value)} 
                        placeholder="Update your name" 
                      />
                    </div>
                    <div className="form-group mb-3">
                      <label>Email Address</label>
                      <input 
                        type="email" 
                        className="form-input" 
                        value={user?.email || ''} 
                        readOnly 
                        style={{opacity: 0.7, cursor:'not-allowed'}} 
                      />
                    </div>
                  </div>

                  <div className="settings-form-grid">
                    <div className="form-group mb-3">
                      <label>Current Password</label>
                      <input 
                        type="password" 
                        className="form-input" 
                        placeholder="Enter current password" 
                        value={currentPw}
                        onChange={(e) => setCurrentPw(e.target.value)}
                      />
                    </div>
                    <div className="form-group mb-3">
                      <label>New Password</label>
                      <input 
                        type="password" 
                        className="form-input" 
                        placeholder="Enter new password" 
                        value={newPw}
                        onChange={(e) => setNewPw(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="form-group mb-4">
                    <label>Confirm New Password</label>
                    <input 
                      type="password" 
                      className="form-input" 
                      placeholder="Re-enter new password" 
                      value={confirmNewPw}
                      onChange={(e) => setConfirmNewPw(e.target.value)}
                    />
                  </div>

                  <button className="settings-save-btn" onClick={handleSaveProfile}>
                    Save Changes
                  </button>
                </div>
              )}

              {settingsTab === 'Privacy' && (
                <div className="fade-in" style={{maxHeight: '400px', overflowY: 'auto'}}>
                  <h4>R&R Dispatcher Privacy Policy</h4>
                  <p className="text-secondary mt-2">Last updated: August 2026</p>
                  <p className="mt-3">
                    This Privacy Policy describes Our policies and procedures on the collection, use and disclosure of Your information when You use the Service and tells You about Your privacy rights and how the law protects You.
                  </p>
                  <h5 className="mt-3">Information Collection and Use</h5>
                  <p>We collect several different types of information for various purposes to provide and improve our Service to you.</p>
                  <h5 className="mt-3">Types of Data Collected</h5>
                  <p><strong>Personal Data:</strong> While using Our Service, We may ask You to provide Us with certain personally identifiable information that can be used to contact or identify You.</p>
                  <button className="btn-primary w-100 mt-4 justify-content-center" onClick={() => setIsSettingsOpen(false)}>
                    Acknowledge & Close
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="main-content">
        {/* Header */}
        <header className="top-header">
          <div className="search-container">
            <Search size={18} className="search-icon" />
            <input type="text" placeholder="Search globally..." />
          </div>
          
          <div className="header-actions">
            <button className="icon-btn theme-toggle-btn" onClick={toggleTheme}>
              {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          </div>
        </header>

        {/* Page Content */}
        <div className="page-content">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;
