import React, { useState, useEffect, useRef } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import io from 'socket.io-client';
import { 
  Users, Calendar, FileText, Settings, Bell, Search, Car, AlertCircle, AlertTriangle, LogOut, Sun, Moon, X, KeyRound, Star 
} from 'lucide-react';
import './AdminLayout.css';

const AdminLayout = ({ user, onLogout, onUpdateUser }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const notifDropdownRef = useRef(null);

  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState('Profile');
  const [profileName, setProfileName] = useState(user?.name || '');
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmNewPw, setConfirmNewPw] = useState('');
  const [settingsMsg, setSettingsMsg] = useState('');
  
  // Unread badge and notification states
  const [unreadIssuesCount, setUnreadIssuesCount] = useState(0);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [recentNotifications, setRecentNotifications] = useState([]);

  // Mark issues as seen/read so badge disappears immediately
  const markIssuesAsSeen = () => {
    localStorage.setItem('admin_issues_last_seen_time', Date.now().toString());
    setUnreadIssuesCount(0);
  };

  // When admin navigates to /driver-issues, automatically clear badge
  useEffect(() => {
    if (location.pathname === '/driver-issues') {
      markIssuesAsSeen();
    }
  }, [location.pathname]);

  // Click outside to close notification dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notifDropdownRef.current && !notifDropdownRef.current.contains(event.target)) {
        setIsNotificationOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Real-time listener and fetch for driver reported issues
  useEffect(() => {
    const fetchCount = async () => {
      const urls = [
        'http://localhost:5000/admin/issues',
        'http://localhost:5000/admin/issues',
        'http://localhost:5000/admin/issues',
        'http://localhost:5000/api/issues'
      ];
      const token = localStorage.getItem('adminToken') || localStorage.getItem('admin_token') || '';
      for (const url of urls) {
        try {
          const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) {
            const data = await res.json();
            const list = data.issues || data.data || [];
            setRecentNotifications(list.slice(0, 6));

            // If user is currently looking at Reported Issues, badge stays 0
            if (window.location.pathname === '/driver-issues') {
              setUnreadIssuesCount(0);
              break;
            }

            const lastSeenStr = localStorage.getItem('admin_issues_last_seen_time');
            if (!lastSeenStr) {
              const pending = list.filter(i => (i.status || 'Pending') === 'Pending');
              setUnreadIssuesCount(pending.length);
            } else {
              const lastSeenTime = parseInt(lastSeenStr, 10);
              const newUnseen = list.filter(i => {
                const createdTime = new Date(i.createdAt || 0).getTime();
                return createdTime > lastSeenTime && (i.status || 'Pending') === 'Pending';
              });
              setUnreadIssuesCount(newUnseen.length);
            }
            break;
          }
        } catch (e) {}
      }
    };

    fetchCount();
    const interval = setInterval(fetchCount, 30000);

    const socketUrls = ['http://localhost:5000', 'http://localhost:5000'];
    const sockets = [];
    socketUrls.forEach(sUrl => {
      try {
        const s = io(sUrl, { transports: ['websocket', 'polling'] });
        s.on('new_issue_report', (newIssue) => {
          if (window.location.pathname !== '/driver-issues') {
            setUnreadIssuesCount(prev => prev + 1);
          }
          if (newIssue) {
            setRecentNotifications(prev => [newIssue, ...prev.filter(x => x.issueId !== newIssue.issueId).slice(0, 5)]);
          }
        });
        s.on('new-issue-report', (newIssue) => {
          if (window.location.pathname !== '/driver-issues') {
            setUnreadIssuesCount(prev => prev + 1);
          }
          if (newIssue) {
            setRecentNotifications(prev => [newIssue, ...prev.filter(x => x.issueId !== newIssue.issueId).slice(0, 5)]);
          }
        });
        s.on('issue_updated', () => {
          fetchCount();
        });
        s.on('customer-fare-response', (data) => {
          setUnreadIssuesCount(prev => prev + 1);
          if (data) {
            setRecentNotifications(prev => [{ ...data, type: 'fare-response', notifId: Date.now() + Math.random() }, ...prev].slice(0, 5));
          }
        });
        s.on('admin-notification', (data) => {
          setUnreadIssuesCount(prev => prev + 1);
          if (data) {
            setRecentNotifications(prev => [{ ...data, type: 'fare-response', notifId: Date.now() + Math.random() }, ...prev].slice(0, 5));
          }
        });
        sockets.push(s);
      } catch (e) {}
    });

    return () => {
      clearInterval(interval);
      sockets.forEach(s => s.disconnect());
    };
  }, []);

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
              <NavLink 
                to="/driver-issues" 
                className={({isActive}) => isActive ? "nav-link active" : "nav-link"}
                onClick={markIssuesAsSeen}
              >
                <AlertTriangle size={18} />
                <span style={{ flex: 1 }}>Reported Issues</span>
                {unreadIssuesCount > 0 && (
                  <span className="nav-issue-counter">{unreadIssuesCount}</span>
                )}
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
            <div className="notification-bell-wrapper" ref={notifDropdownRef}>
              <button 
                className="icon-btn notification-bell-btn" 
                onClick={() => {
                  markIssuesAsSeen();
                  setIsNotificationOpen(prev => !prev);
                }}
                title={unreadIssuesCount > 0 ? `${unreadIssuesCount} new reported issues (click to view)` : 'Notifications'}
              >
                <Bell size={19} />
                {unreadIssuesCount > 0 && (
                  <span className="bell-badge">{unreadIssuesCount}</span>
                )}
              </button>

              {/* Notification Dropdown Menu */}
              {isNotificationOpen && (
                <div className="notification-dropdown fade-in">
                  <div className="notif-dropdown-header">
                    <div className="notif-dropdown-title">
                      <AlertTriangle size={16} className="text-warning mr-1" />
                      <span>Driver Issue Alerts</span>
                    </div>
                    <button 
                      className="notif-clear-btn"
                      onClick={() => {
                        markIssuesAsSeen();
                        setIsNotificationOpen(false);
                      }}
                    >
                      Clear Badge
                    </button>
                  </div>

                  <div className="notif-dropdown-body">
                    {recentNotifications.length === 0 ? (
                      <div className="notif-empty">No recent notifications.</div>
                    ) : (
                      recentNotifications.map((item, idx) => {
                        const isFareResponse = item.type === 'fare-response';
                        const isAccepted = item.action === 'ACCEPTED';
                        
                        if (isFareResponse) {
                          return (
                            <div 
                              key={item.notifId || item.rideId || idx}
                              className="notif-dropdown-item"
                              onClick={() => {
                                markIssuesAsSeen();
                                setIsNotificationOpen(false);
                                navigate('/ride-dispatch');
                              }}
                            >
                              <div className="notif-item-icon" style={{ color: isAccepted ? '#10B981' : '#EF4444' }}>
                                <Bell size={16} />
                              </div>
                              <div className="notif-item-info">
                                <div className="notif-item-top">
                                  <span className="notif-item-name">{item.title || (isAccepted ? '✅ Fare Approved' : '❌ Fare Rejected')}</span>
                                </div>
                                <div className="notif-item-desc" style={{ marginTop: '4px', color: '#64748B', fontSize: '0.8rem' }}>
                                  {item.message || `Customer ${item.customerName || ''} has ${item.action || 'responded'} to the fare ${item.fareFormatted || ''}.`}
                                </div>
                              </div>
                            </div>
                          );
                        }

                        // Original Driver Issue Notification
                        return (
                          <div 
                            key={item.issueId || item._id || idx}
                            className="notif-dropdown-item"
                            onClick={() => {
                              markIssuesAsSeen();
                              setIsNotificationOpen(false);
                              navigate('/driver-issues');
                            }}
                          >
                            <div className="notif-item-icon">
                              <AlertCircle size={16} />
                            </div>
                            <div className="notif-item-info">
                              <div className="notif-item-top">
                                <span className="notif-item-name">{item.driverName || 'Driver'}</span>
                                <span className={`notif-item-status ${(item.status || 'Pending').toLowerCase()}`}>
                                  {item.status || 'Pending'}
                                </span>
                              </div>
                              <div className="notif-item-reason">{item.reason || 'Road Issue'}</div>
                              {item.description && (
                                <div className="notif-item-desc">{item.description}</div>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <div className="notif-dropdown-footer">
                    <button 
                      className="notif-view-all-btn"
                      onClick={() => {
                        markIssuesAsSeen();
                        setIsNotificationOpen(false);
                        navigate('/driver-issues');
                      }}
                    >
                      View All in Reported Issues →
                    </button>
                  </div>
                </div>
              )}
            </div>

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
