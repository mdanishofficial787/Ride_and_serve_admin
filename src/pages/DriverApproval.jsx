import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  Users, CheckCircle, XCircle, Activity, Plus, Eye, ChevronLeft,
  ZoomIn, ZoomOut, RotateCw, ExternalLink, Download, Maximize2, FileText, Image as ImageIcon, X, AlertTriangle,
  Search, Filter, Edit3, SlidersHorizontal, RotateCcw
} from 'lucide-react';
import AddDriverForm from '../components/AddDriverForm';
import EditDriverModal from '../components/EditDriverModal';
import DriverAvailability from '../components/DriverAvailability';
import { BACKEND_URL } from '../utils/api';
import './DriverApproval.css';

const DriverApproval = () => {
  const [drivers, setDrivers] = useState([]);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [isAddDriverOpen, setIsAddDriverOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [previewImage, setPreviewImage] = useState(null); // { title: '', url: '' }
  const [zoomLevel, setZoomLevel] = useState(1);
  const [rotation, setRotation] = useState(0);
  
  const [activeTab, setActiveTab] = useState('Pending');
  const [confirmApproveModal, setConfirmApproveModal] = useState(false);

  // Search & Multi-Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRoute, setFilterRoute] = useState('All');
  const [filterAC, setFilterAC] = useState('All');
  const [filterVehicleType, setFilterVehicleType] = useState('All');

  // Robust helper to extract image URL from String, Object, or Array
  const getImageUrl = (img) => {
    if (!img) return null;
    if (typeof img === 'string') {
      const trimmed = img.trim();
      return trimmed.startsWith('http') || trimmed.startsWith('data:') || trimmed.startsWith('/') ? trimmed : null;
    }
    if (typeof img === 'object') {
      if (img.url && typeof img.url === 'string') return img.url.trim();
      if (img.secure_url && typeof img.secure_url === 'string') return img.secure_url.trim();
      if (img.uri && typeof img.uri === 'string') return img.uri.trim();
      if (img.path && typeof img.path === 'string') return img.path.trim();
      if (img.front) return getImageUrl(img.front);
      if (img.frontView) return getImageUrl(img.frontView);
      if (img.back) return getImageUrl(img.back);
      if (img.backView) return getImageUrl(img.backView);
      if (Array.isArray(img) && img.length > 0) return getImageUrl(img[0]);
    }
    return null;
  };

  const handleOpenPreview = (title, url) => {
    if (!url) return;
    setZoomLevel(1);
    setRotation(0);
    setPreviewImage({ title, url });
  };

  // Safe helper to convert any route (string or {startPoint, endPoint}) to string
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

  const pendingCount = drivers.filter(d => d.status === 'Pending').length;
  const approvedCount = drivers.filter(d => d.status === 'Approved').length;
  const rejectedCount = drivers.filter(d => d.status === 'Rejected').length;
  const approvalRate = drivers.length > 0 ? Math.round((approvedCount / (approvedCount + rejectedCount || 1)) * 100) : 100;

  // Extract all unique routes for route filter dropdown (guaranteed strings)
  const allRoutes = Array.from(new Set(
    drivers.flatMap(d => (d.preferences?.routes || []).map(formatRouteString)).filter(Boolean)
  ));

  const filteredDrivers = drivers.filter(d => {
    // 1. Tab filter
    if (d.status !== activeTab) return false;

    // 2. Search query (Name, Phone, ID, Plate, City)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const name = (d.personalInfo?.name || '').toLowerCase();
      const phone = (d.personalInfo?.phone || '').toLowerCase();
      const id = (d.id || '').toLowerCase();
      const plate = (d.vehicleInfo?.plateNumber || '').toLowerCase();
      const city = (d.personalInfo?.city || '').toLowerCase();
      if (!name.includes(q) && !phone.includes(q) && !id.includes(q) && !plate.includes(q) && !city.includes(q)) {
        return false;
      }
    }

    // 3. Route filter
    if (filterRoute !== 'All') {
      const routes = (d.preferences?.routes || []).map(formatRouteString);
      const city = d.personalInfo?.city || '';
      const matchRoute = routes.some(r => r.toLowerCase().includes(filterRoute.toLowerCase())) ||
                         city.toLowerCase().includes(filterRoute.toLowerCase());
      if (!matchRoute) return false;
    }

    // 4. AC / Non-AC filter
    if (filterAC === 'AC' && d.vehicleInfo?.ac === false) return false;
    if (filterAC === 'Non-AC' && d.vehicleInfo?.ac !== false) return false;

    // 5. Vehicle Type filter
    if (filterVehicleType !== 'All') {
      const vCat = (d.vehicleInfo?.category || '').toLowerCase();
      const vMake = (d.vehicleInfo?.make || '').toLowerCase();
      const fType = filterVehicleType.toLowerCase();
      if (!vCat.includes(fType) && !vMake.includes(fType)) return false;
    }

    return true;
  });

  // Fetch Drivers from DB
  const fetchDrivers = async () => {
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(`${BACKEND_URL}/admin/driver`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      
      if (data.success && data.data && data.data.drivers) {
        // Map DB driver structure to UI structure
        const mapped = data.data.drivers.map(dbDriver => {
          const vStatus = dbDriver.verificationStatus || (dbDriver.status === 'APPROVED' ? 'Verified' : (dbDriver.status === 'REJECTED' ? 'Rejected' : 'Pending'));
          const displayStatus = vStatus === 'Verified' ? 'Approved' : (vStatus === 'Rejected' ? 'Rejected' : 'Pending');

          const vData = dbDriver.vehicleData || dbDriver.vehicle || {};

          // Extract all document images with fallback keys
          const driverPhoto = getImageUrl(
            dbDriver.driverPhoto || dbDriver.profilePhoto || dbDriver.photo || dbDriver.avatar || dbDriver.image || dbDriver.DriverPhoto
          );
          const cnicFront = getImageUrl(
            dbDriver.CnicFront || dbDriver.cnicFront || dbDriver.cnic_front || dbDriver.CNICFront || dbDriver.cnic?.front || dbDriver.idCardFront
          );
          const cnicBack = getImageUrl(
            dbDriver.CnicBack || dbDriver.cnicBack || dbDriver.cnic_back || dbDriver.CNICBack || dbDriver.cnic?.back || dbDriver.idCardBack
          );
          const licenseFront = getImageUrl(
            dbDriver.LicenseFront || dbDriver.licenseFront || dbDriver.license_front || dbDriver.drivingLicenseFront || dbDriver.license?.front || dbDriver.License
          );
          const licenseBack = getImageUrl(
            dbDriver.LicenseBack || dbDriver.licenseBack || dbDriver.license_back || dbDriver.drivingLicenseBack || dbDriver.license?.back
          );

          // Vehicle Card (Registration / ID card) Front & Back
          const vehicleCardFront = getImageUrl(
            vData.registrationBook?.front || 
            vData.registrationBook || 
            vData.registrationCardFront || 
            vData.VehicleCardFront || 
            vData.vehicleCardFront || 
            vData.vehicleIdentificationCardFront || 
            vData.vehicleIdCardFront || 
            vData.cardFront || 
            dbDriver.VehicleCardFront || 
            dbDriver.vehicleCardFront || 
            dbDriver.registrationBook?.front || 
            dbDriver.registrationBook || 
            dbDriver.vehicleIdentificationCardFront
          );

          const vehicleCardBack = getImageUrl(
            vData.registrationBook?.back || 
            vData.registrationCardBack || 
            vData.VehicleCardBack || 
            vData.vehicleCardBack || 
            vData.vehicleIdentificationCardBack || 
            vData.vehicleIdCardBack || 
            vData.cardBack || 
            dbDriver.VehicleCardBack || 
            dbDriver.vehicleCardBack || 
            dbDriver.registrationBook?.back || 
            dbDriver.vehicleIdentificationCardBack || 
            (vData.registrationBook && !vData.registrationBook.front ? vData.registrationBook : null)
          );

          // Vehicle Images (Front View & Back View)
          const vehicleFrontView = getImageUrl(
            vData.vehicleImages?.frontView || 
            vData.vehicleImages?.front || 
            vData.vehicleImages || 
            vData.VehicleFront || 
            vData.vehicleFront || 
            vData.vehicleFrontView || 
            vData.vehiclePhoto || 
            vData.photo || 
            dbDriver.VehicleFront || 
            dbDriver.vehicleFront || 
            dbDriver.vehicleFrontView || 
            dbDriver.vehicleImages?.frontView || 
            dbDriver.vehicleImages?.front || 
            dbDriver.vehicleImages
          );

          const vehicleBackView = getImageUrl(
            vData.vehicleImages?.backView || 
            vData.vehicleImages?.back || 
            vData.VehicleBack || 
            vData.vehicleBack || 
            vData.vehicleBackView || 
            dbDriver.VehicleBack || 
            dbDriver.vehicleBack || 
            dbDriver.vehicleBackView || 
            dbDriver.vehicleImages?.backView || 
            dbDriver.vehicleImages?.back
          );

          // Track missing documents
          const missingDocuments = [];
          if (!driverPhoto) missingDocuments.push('Profile Photo');
          if (!cnicFront) missingDocuments.push('CNIC Front');
          if (!cnicBack) missingDocuments.push('CNIC Back');
          if (!licenseFront) missingDocuments.push('License Front');
          if (!licenseBack) missingDocuments.push('License Back');
          if (!vehicleCardFront) missingDocuments.push('Vehicle ID Card (Front)');
          if (!vehicleCardBack) missingDocuments.push('Vehicle ID Card (Back)');
          if (!vehicleFrontView) missingDocuments.push('Vehicle Front View');

          return {
            _id: dbDriver._id,
            id: dbDriver.driverReferenceId || dbDriver.driverId || dbDriver._id,
            status: displayStatus,
            personalInfo: {
              name: dbDriver.Name || dbDriver.name || 'Unknown',
              phone: dbDriver.PhoneNumber ? `${dbDriver.CountryCode || '+92'} ${dbDriver.PhoneNumber}` : (dbDriver.phone || 'N/A'),
              email: dbDriver.Email || dbDriver.email || 'N/A',
              city: dbDriver.city || 'Islamabad',
              cnic: dbDriver.CnicNumber || 'N/A',
              license: dbDriver.License || 'N/A',
              joinDate: dbDriver.createdAt ? new Date(dbDriver.createdAt).toLocaleDateString('en-GB') : 'Today'
            },
            vehicleInfo: {
              make: vData.vehicleMake || dbDriver.vehicleDetails?.make || 'Toyota',
              model: vData.vehicleModel || dbDriver.vehicleDetails?.model || 'Corolla',
              year: dbDriver.vehicleDetails?.year || '2023',
              color: vData.vehicleColor || dbDriver.vehicleDetails?.color || 'White',
              category: dbDriver.vehicleDetails?.category || 'Sedan',
              ac: dbDriver.vehicleDetails?.ac !== false,
              plateNumber: vData.registrationNumber || dbDriver.vehicleDetails?.plateNumber || dbDriver.License || 'ABC-123'
            },
            documents: {
              license: licenseFront ? 'Verified' : 'Pending Review',
              idCard: cnicFront ? 'Verified' : 'Pending Review',
              vehicleCard: vehicleCardFront ? 'Uploaded' : 'Pending Review',
              backgroundCheck: dbDriver.backgroundCheckConsent ? 'Consented' : 'Pending Review'
            },
            missingDocuments,
            isComplete: missingDocuments.length === 0,
            images: {
              driverPhoto,
              cnicFront,
              cnicBack,
              licenseFront,
              licenseBack,
              vehicleCardFront,
              vehicleCardBack,
              vehicleFrontView,
              vehicleBackView
            },
            performance: {
              rating: dbDriver.rating || 5.0,
              totalRides: dbDriver.performance?.totalTrips || 0,
              cancellationRate: '0%'
            },
            availabilitySchedule: (typeof dbDriver.availability === 'object' && dbDriver.availability !== null) 
              ? dbDriver.availability 
              : null,
            availability: typeof dbDriver.availability === 'string' 
              ? dbDriver.availability 
              : (dbDriver.liveStatus || 'Available'),
            preferences: {
              routes: (() => {
                const raw = Array.isArray(dbDriver.preferredRoutes) 
                  ? dbDriver.preferredRoutes 
                  : (dbDriver.preferredRoutes ? [dbDriver.preferredRoutes] : []);
                const formatted = raw.map(formatRouteString).filter(Boolean);
                return formatted.length > 0 ? formatted : [`${dbDriver.city || 'Islamabad'} - Rawalpindi`];
              })()
            }
          };
        });
        setDrivers(mapped);
      } else {
        // If unauthorized or failed, clear local state
        console.error("API Error:", data.message);
        if (data.message && data.message.includes('Not authorized')) {
           setToastMessage("Session expired. Please log out and log in again.");
        }
      }
    } catch (err) {
      console.error("Failed to fetch drivers from API:", err);
    }
  };

  useEffect(() => {
    fetchDrivers();
  }, []);

  // Handle Approve / Reject via API
  const handleAction = async (id, _id, action) => {
    try {
      const token = localStorage.getItem('admin_token');
      const newStatus = action === 'approve' ? 'Verified' : 'Rejected';
      
      await fetch(`${BACKEND_URL}/admin/driver/${_id}/verification`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ verificationStatus: newStatus })
      });
      
      setToastMessage(`Driver ${action === 'approve' ? 'approved' : 'rejected'}.`);
      setTimeout(() => setToastMessage(''), 3000);
      setSelectedDriver(null);
      fetchDrivers(); // Refresh data from DB
    } catch (err) {
      console.error("Failed to update driver status:", err);
    }
  };

  const renderKPIs = () => (
    <div className="driver-kpi-grid">
      <div className={`driver-kpi-card ${activeTab === 'Pending' ? 'active' : ''}`} onClick={() => setActiveTab('Pending')}>
        <div className="kpi-content">
          <div className="kpi-label">Pending Applications</div>
          <div className="kpi-value text-warning">{pendingCount}</div>
        </div>
        <div className="kpi-icon-soft bg-warning-light text-warning">
          <Users size={20} />
        </div>
      </div>
      
      <div className={`driver-kpi-card ${activeTab === 'Approved' ? 'active' : ''}`} onClick={() => setActiveTab('Approved')}>
        <div className="kpi-content">
          <div className="kpi-label">Approved Drivers</div>
          <div className="kpi-value text-success">{approvedCount}</div>
        </div>
        <div className="kpi-icon-soft bg-success-light text-success">
          <CheckCircle size={20} />
        </div>
      </div>
      
      <div className={`driver-kpi-card ${activeTab === 'Rejected' ? 'active' : ''}`} onClick={() => setActiveTab('Rejected')}>
        <div className="kpi-content">
          <div className="kpi-label">Rejected Drivers</div>
          <div className="kpi-value text-danger">{rejectedCount}</div>
        </div>
        <div className="kpi-icon-soft bg-danger-light text-danger">
          <XCircle size={20} />
        </div>
      </div>

      <div className="driver-kpi-card">
        <div className="kpi-content">
          <div className="kpi-label">Approval Rate</div>
          <div className="kpi-value text-primary">{approvalRate}%</div>
        </div>
        <div className="kpi-icon-soft bg-primary-light text-primary">
          <Activity size={20} />
        </div>
      </div>
    </div>
  );

  const renderList = () => (
    <div className="driver-list-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Driver Approval</h1>
          <p className="page-subtitle">Review, verify, approve, or reject driver applications.</p>
        </div>
        <button className="primary-btn" onClick={() => setIsAddDriverOpen(true)}>
          <Plus size={16} />
          <span>Register Driver</span>
        </button>
      </div>

      {renderKPIs()}

      <div className="table-container-card">
        <div className="table-tabs">
          <button 
            className={`tab-btn ${activeTab === 'Pending' ? 'active' : ''}`}
            onClick={() => setActiveTab('Pending')}
          >
            Pending <span className="badge">{pendingCount}</span>
          </button>
          <button 
            className={`tab-btn ${activeTab === 'Approved' ? 'active' : ''}`}
            onClick={() => setActiveTab('Approved')}
          >
            Approved <span className="badge" style={{background: 'var(--success-bg)', color: 'var(--success)'}}>{approvedCount}</span>
          </button>
          <button 
            className={`tab-btn ${activeTab === 'Rejected' ? 'active' : ''}`}
            onClick={() => setActiveTab('Rejected')}
          >
            Rejected <span className="badge" style={{background: 'var(--danger-bg)', color: 'var(--danger)'}}>{rejectedCount}</span>
          </button>
        </div>

        {/* ── Driver Search & Multi-Filters Bar ── */}
        <div className="driver-filters-bar">
          <div className="driver-search-box">
            <Search size={16} className="search-icon" />
            <input 
              type="text" 
              placeholder="Search by name, phone, plate, ID, city..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button className="clear-search-btn" onClick={() => setSearchQuery('')}>
                <X size={14} />
              </button>
            )}
          </div>

          <div className="driver-filters-controls">
            <div className="filter-item">
              <label><Filter size={13} /> Route:</label>
              <select value={filterRoute} onChange={(e) => setFilterRoute(e.target.value)}>
                <option value="All">All Routes</option>
                {allRoutes.map((rt, idx) => (
                  <option key={idx} value={rt}>{rt}</option>
                ))}
              </select>
            </div>

            <div className="filter-item">
              <label>AC:</label>
              <select value={filterAC} onChange={(e) => setFilterAC(e.target.value)}>
                <option value="All">All AC Types</option>
                <option value="AC">AC Vehicles</option>
                <option value="Non-AC">Non-AC</option>
              </select>
            </div>

            <div className="filter-item">
              <label>Vehicle:</label>
              <select value={filterVehicleType} onChange={(e) => setFilterVehicleType(e.target.value)}>
                <option value="All">All Categories</option>
                <option value="Sedan">Sedan</option>
                <option value="SUV">SUV</option>
                <option value="Hatchback">Hatchback</option>
                <option value="Van">Van / Bolan</option>
              </select>
            </div>

            {(searchQuery || filterRoute !== 'All' || filterAC !== 'All' || filterVehicleType !== 'All') && (
              <button 
                className="reset-filters-btn"
                onClick={() => {
                  setSearchQuery('');
                  setFilterRoute('All');
                  setFilterAC('All');
                  setFilterVehicleType('All');
                }}
                title="Reset all filters"
              >
                <RotateCcw size={13} /> Reset
              </button>
            )}
          </div>
        </div>

        <div className="table-content">
          {filteredDrivers.length === 0 ? (
            <div className="empty-state">
              <p>No {activeTab.toLowerCase()} drivers found.</p>
            </div>
          ) : (
            <table className="clean-table">
              <colgroup>
                <col style={{width: '110px'}} />
                <col style={{width: '220px'}} />
                <col style={{width: '110px'}} />
                <col style={{width: '150px'}} />
                <col style={{width: '120px'}} />
                <col style={{width: '110px'}} />
              </colgroup>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Driver Name</th>
                  <th>City</th>
                  <th>Registration Date</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredDrivers.map(driver => (
                  <tr key={driver.id}>
                    <td className="fw-500">{driver.id}</td>
                    <td>
                      <div className="driver-name-cell">
                        {driver.images?.driverPhoto ? (
                          <div 
                            className="avatar-sm avatar-has-img" 
                            onClick={(e) => { e.stopPropagation(); handleOpenPreview(`${driver.personalInfo.name} - Profile Photo`, driver.images.driverPhoto); }}
                            title="Click to preview profile photo"
                          >
                            <img src={driver.images.driverPhoto} alt={driver.personalInfo.name} />
                          </div>
                        ) : (
                          <div className="avatar-sm">{driver.personalInfo.name.charAt(0)}</div>
                        )}
                        <div>
                          <div className="name">{driver.personalInfo.name}</div>
                          <div className="subtext">{driver.personalInfo.phone}</div>
                        </div>
                      </div>
                    </td>
                    <td>{driver.personalInfo.city}</td>
                    <td>{driver.personalInfo.joinDate}</td>
                    <td>
                      <span className={`status-badge ${driver.status.toLowerCase()}`}>
                        {driver.status}
                      </span>
                    </td>
                    <td>
                      <button 
                        className="action-btn text-primary" 
                        onClick={() => setSelectedDriver(driver)}
                        title="View Details"
                      >
                        <Eye size={16} />
                        <span>View Details</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );

  const renderDetails = () => (
    <div className="driver-details-container">
      <div className="details-top-bar">
        <button className="back-btn" onClick={() => setSelectedDriver(null)}>
          <ChevronLeft size={18} />
          Back to Approvals
        </button>
        <button className="edit-driver-btn" onClick={() => setIsEditModalOpen(true)}>
          <Edit3 size={15} />
          <span>Edit Driver Profile</span>
        </button>
      </div>

      <div className="details-card">
        {/* ── Profile Header ── */}
        <div className="details-header">
          <div className="driver-profile-main">
            {selectedDriver.images?.driverPhoto ? (
              <div 
                className="avatar-lg avatar-has-img clickable"
                onClick={() => handleOpenPreview(`${selectedDriver.personalInfo.name} - Profile Photo`, selectedDriver.images.driverPhoto)}
                title="Click to inspect profile photo"
              >
                <img src={selectedDriver.images.driverPhoto} alt={selectedDriver.personalInfo.name} />
                <div className="avatar-preview-badge">
                  <Eye size={13} />
                </div>
              </div>
            ) : (
              <div className="avatar-lg">{selectedDriver.personalInfo.name.charAt(0)}</div>
            )}
            <div>
              <h2>{selectedDriver.personalInfo.name}</h2>
              <p>{selectedDriver.id} &bull; {selectedDriver.personalInfo.city}</p>
            </div>
          </div>
          <span className={`status-badge lg ${selectedDriver.status.toLowerCase()}`}>
            {selectedDriver.status}
          </span>
        </div>

        {/* ── Document Completeness Alert Banner ── */}
        {selectedDriver.missingDocuments && selectedDriver.missingDocuments.length > 0 && (
          <div className="incomplete-docs-banner">
            <div className="d-flex align-items-center gap-2">
              <AlertTriangle size={18} className="text-warning flex-shrink-0" />
              <div>
                <strong className="text-warning">Incomplete Documents ({selectedDriver.missingDocuments.length} Missing):</strong>
                <span className="ms-2 text-secondary" style={{fontSize: '0.82rem'}}>
                  {selectedDriver.missingDocuments.join(' • ')}
                </span>
              </div>
            </div>
            <span className="badge bg-warning-light text-warning">Verification Incomplete</span>
          </div>
        )}

        {/* ── Performance Stats Row ── */}
        <div className="driver-stats-row">
          <div className="driver-stat-item">
            <span className="stat-label">Rating</span>
            <span className="stat-value text-warning">⭐ {selectedDriver.performance.rating}</span>
          </div>
          <div className="driver-stat-item">
            <span className="stat-label">Total Rides</span>
            <span className="stat-value text-primary">{selectedDriver.performance.totalRides}</span>
          </div>
          <div className="driver-stat-item">
            <span className="stat-label">Cancellation Rate</span>
            <span className="stat-value text-danger">{selectedDriver.performance.cancellationRate}</span>
          </div>
          <div className="driver-stat-item">
            <span className="stat-label">Availability</span>
            <span className={`stat-value ${selectedDriver.availability === 'Available' ? 'text-success' : 'text-warning'}`}>
              {selectedDriver.availability}
            </span>
          </div>
        </div>

        {/* ── Info Sections Grid ── */}
        <div className="details-grid">
          <div className="details-section">
            <h3>Personal Information</h3>
            <div className="info-list">
              <div className="info-item">
                <span className="label">Phone</span>
                <span className="value">{selectedDriver.personalInfo.phone}</span>
              </div>
              <div className="info-item">
                <span className="label">Email</span>
                <span className="value">{selectedDriver.personalInfo.email}</span>
              </div>
              <div className="info-item">
                <span className="label">City</span>
                <span className="value">{selectedDriver.personalInfo.city}</span>
              </div>
              <div className="info-item">
                <span className="label">Join Date</span>
                <span className="value">{selectedDriver.personalInfo.joinDate}</span>
              </div>
            </div>
          </div>

          <div className="details-section">
            <h3>Vehicle Information</h3>
            <div className="info-list">
              <div className="info-item">
                <span className="label">Make & Model</span>
                <span className="value">{selectedDriver.vehicleInfo.make} {selectedDriver.vehicleInfo.model}</span>
              </div>
              <div className="info-item">
                <span className="label">Year</span>
                <span className="value">{selectedDriver.vehicleInfo.year}</span>
              </div>
              <div className="info-item">
                <span className="label">Color</span>
                <span className="value">{selectedDriver.vehicleInfo.color}</span>
              </div>
              <div className="info-item">
                <span className="label">Category</span>
                <span className="value">{selectedDriver.vehicleInfo.category} {selectedDriver.vehicleInfo.ac ? '(AC)' : '(Non-AC)'}</span>
              </div>
              <div className="info-item">
                <span className="label">Plate No.</span>
                <span className="value">{selectedDriver.vehicleInfo.plateNumber}</span>
              </div>
            </div>
          </div>

          <div className="details-section">
            <h3>Documents Status</h3>
            <div className="info-list">
              <div className="info-item">
                <span className="label">License</span>
                <div className="d-flex align-items-center gap-2">
                  <span className="value text-success">{selectedDriver.documents.license}</span>
                  {selectedDriver.images?.licenseFront && (
                    <button 
                      type="button"
                      className="preview-mini-btn"
                      onClick={() => handleOpenPreview('Driver License (Front)', selectedDriver.images.licenseFront)}
                      title="Preview License"
                    >
                      <Eye size={12} /> View
                    </button>
                  )}
                </div>
              </div>
              <div className="info-item">
                <span className="label">ID Card</span>
                <div className="d-flex align-items-center gap-2">
                  <span className="value text-success">{selectedDriver.documents.idCard}</span>
                  {selectedDriver.images?.cnicFront && (
                    <button 
                      type="button"
                      className="preview-mini-btn"
                      onClick={() => handleOpenPreview('CNIC Card (Front)', selectedDriver.images.cnicFront)}
                      title="Preview CNIC"
                    >
                      <Eye size={12} /> View
                    </button>
                  )}
                </div>
              </div>
              <div className="info-item">
                <span className="label">Vehicle Card</span>
                <div className="d-flex align-items-center gap-2">
                  <span className="value text-success">{selectedDriver.documents.vehicleCard || 'Uploaded'}</span>
                  {selectedDriver.images?.vehicleCardFront && (
                    <button 
                      type="button"
                      className="preview-mini-btn"
                      onClick={() => handleOpenPreview('Vehicle ID Card (Front)', selectedDriver.images.vehicleCardFront)}
                      title="Preview Vehicle Card"
                    >
                      <Eye size={12} /> View
                    </button>
                  )}
                </div>
              </div>
              <div className="info-item">
                <span className="label">Background</span>
                <span className="value text-success">{selectedDriver.documents.backgroundCheck}</span>
              </div>
            </div>

            <h3 style={{marginTop: '1.5rem'}}>Preferred Routes</h3>
            <div className="info-list">
              {selectedDriver.preferences.routes.map((r, i) => (
                <div key={i} className="info-item">
                  <span className="label">Route {i + 1}</span>
                  <span className="value">{formatRouteString(r)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Uploaded Documents & Photos ── */}
        <div className="details-section docs-full-section" style={{padding: '1.75rem 2rem', borderTop: '1px solid var(--border-color)'}}>
          <div className="d-flex justify-content-between align-items-center mb-3">
            <div>
              <h3 style={{marginBottom: '0.2rem', borderBottom: 'none', paddingBottom: 0}}>Uploaded Documents & Photos</h3>
              <p style={{fontSize: '0.8rem', color: 'var(--text-secondary)'}}>Click any document below to inspect or preview high-resolution image</p>
            </div>
          </div>

          {/* Sub-section 1: Driver Identity & License */}
          <div className="doc-category-block">
            <h4 className="doc-category-title">🪪 Driver Identity &amp; License</h4>
            <div className="driver-docs-grid">
              {/* Profile Photo */}
              <div 
                className={`driver-doc-card ${selectedDriver.images?.driverPhoto ? 'clickable' : ''}`}
                onClick={() => selectedDriver.images?.driverPhoto && handleOpenPreview('Driver Profile Photo', selectedDriver.images.driverPhoto)}
              >
                <div className="doc-img-placeholder">
                  {selectedDriver.images?.driverPhoto ? (
                    <img src={selectedDriver.images.driverPhoto} alt="Profile" />
                  ) : (
                    <span>👤</span>
                  )}
                  {selectedDriver.images?.driverPhoto && (
                    <div className="doc-hover-overlay">
                      <Eye size={18} />
                      <span>Preview</span>
                    </div>
                  )}
                </div>
                <div className="doc-card-info">
                  <span className="doc-card-label">Profile Photo</span>
                  <span className={`doc-status-tag ${selectedDriver.images?.driverPhoto ? 'uploaded' : 'missing'}`}>
                    {selectedDriver.images?.driverPhoto ? '✓ Uploaded' : 'Missing'}
                  </span>
                </div>
              </div>

              {/* CNIC Front */}
              <div 
                className={`driver-doc-card ${selectedDriver.images?.cnicFront ? 'clickable' : ''}`}
                onClick={() => selectedDriver.images?.cnicFront && handleOpenPreview('CNIC Front Side', selectedDriver.images.cnicFront)}
              >
                <div className="doc-img-placeholder">
                  {selectedDriver.images?.cnicFront ? (
                    <img src={selectedDriver.images.cnicFront} alt="CNIC Front" />
                  ) : (
                    <span>📋</span>
                  )}
                  {selectedDriver.images?.cnicFront && (
                    <div className="doc-hover-overlay">
                      <Eye size={18} />
                      <span>Preview</span>
                    </div>
                  )}
                </div>
                <div className="doc-card-info">
                  <span className="doc-card-label">CNIC Front</span>
                  <span className={`doc-status-tag ${selectedDriver.images?.cnicFront ? 'uploaded' : 'missing'}`}>
                    {selectedDriver.images?.cnicFront ? '✓ Uploaded' : 'Missing'}
                  </span>
                </div>
              </div>

              {/* CNIC Back */}
              <div 
                className={`driver-doc-card ${selectedDriver.images?.cnicBack ? 'clickable' : ''}`}
                onClick={() => selectedDriver.images?.cnicBack && handleOpenPreview('CNIC Back Side', selectedDriver.images.cnicBack)}
              >
                <div className="doc-img-placeholder">
                  {selectedDriver.images?.cnicBack ? (
                    <img src={selectedDriver.images.cnicBack} alt="CNIC Back" />
                  ) : (
                    <span>📋</span>
                  )}
                  {selectedDriver.images?.cnicBack && (
                    <div className="doc-hover-overlay">
                      <Eye size={18} />
                      <span>Preview</span>
                    </div>
                  )}
                </div>
                <div className="doc-card-info">
                  <span className="doc-card-label">CNIC Back</span>
                  <span className={`doc-status-tag ${selectedDriver.images?.cnicBack ? 'uploaded' : 'missing'}`}>
                    {selectedDriver.images?.cnicBack ? '✓ Uploaded' : 'Missing'}
                  </span>
                </div>
              </div>

              {/* License Front */}
              <div 
                className={`driver-doc-card ${selectedDriver.images?.licenseFront ? 'clickable' : ''}`}
                onClick={() => selectedDriver.images?.licenseFront && handleOpenPreview('Driver License (Front)', selectedDriver.images.licenseFront)}
              >
                <div className="doc-img-placeholder">
                  {selectedDriver.images?.licenseFront ? (
                    <img src={selectedDriver.images.licenseFront} alt="License Front" />
                  ) : (
                    <span>🪪</span>
                  )}
                  {selectedDriver.images?.licenseFront && (
                    <div className="doc-hover-overlay">
                      <Eye size={18} />
                      <span>Preview</span>
                    </div>
                  )}
                </div>
                <div className="doc-card-info">
                  <span className="doc-card-label">License Front</span>
                  <span className={`doc-status-tag ${selectedDriver.images?.licenseFront ? 'uploaded' : 'missing'}`}>
                    {selectedDriver.images?.licenseFront ? '✓ Uploaded' : 'Missing'}
                  </span>
                </div>
              </div>

              {/* License Back */}
              <div 
                className={`driver-doc-card ${selectedDriver.images?.licenseBack ? 'clickable' : ''}`}
                onClick={() => selectedDriver.images?.licenseBack && handleOpenPreview('Driver License (Back)', selectedDriver.images.licenseBack)}
              >
                <div className="doc-img-placeholder">
                  {selectedDriver.images?.licenseBack ? (
                    <img src={selectedDriver.images.licenseBack} alt="License Back" />
                  ) : (
                    <span>🪪</span>
                  )}
                  {selectedDriver.images?.licenseBack && (
                    <div className="doc-hover-overlay">
                      <Eye size={18} />
                      <span>Preview</span>
                    </div>
                  )}
                </div>
                <div className="doc-card-info">
                  <span className="doc-card-label">License Back</span>
                  <span className={`doc-status-tag ${selectedDriver.images?.licenseBack ? 'uploaded' : 'missing'}`}>
                    {selectedDriver.images?.licenseBack ? '✓ Uploaded' : 'Missing'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Sub-section 2: Vehicle Identification Card */}
          <div className="doc-category-block mt-4">
            <h4 className="doc-category-title">🚗 Vehicle Identification Card</h4>
            <div className="driver-docs-grid">
              {/* Vehicle ID Card Front */}
              <div 
                className={`driver-doc-card ${selectedDriver.images?.vehicleCardFront ? 'clickable' : ''}`}
                onClick={() => selectedDriver.images?.vehicleCardFront && handleOpenPreview('Vehicle ID Card (Front Side)', selectedDriver.images.vehicleCardFront)}
              >
                <div className="doc-img-placeholder">
                  {selectedDriver.images?.vehicleCardFront ? (
                    <img src={selectedDriver.images.vehicleCardFront} alt="Vehicle Card Front" />
                  ) : (
                    <span>📄</span>
                  )}
                  {selectedDriver.images?.vehicleCardFront && (
                    <div className="doc-hover-overlay">
                      <Eye size={18} />
                      <span>Preview</span>
                    </div>
                  )}
                </div>
                <div className="doc-card-info">
                  <span className="doc-card-label">Front Side</span>
                  <span className={`doc-status-tag ${selectedDriver.images?.vehicleCardFront ? 'uploaded' : 'missing'}`}>
                    {selectedDriver.images?.vehicleCardFront ? '✓ Uploaded' : 'Missing'}
                  </span>
                </div>
              </div>

              {/* Vehicle ID Card Back */}
              <div 
                className={`driver-doc-card ${selectedDriver.images?.vehicleCardBack ? 'clickable' : ''}`}
                onClick={() => selectedDriver.images?.vehicleCardBack && handleOpenPreview('Vehicle ID Card (Back Side)', selectedDriver.images.vehicleCardBack)}
              >
                <div className="doc-img-placeholder">
                  {selectedDriver.images?.vehicleCardBack ? (
                    <img src={selectedDriver.images.vehicleCardBack} alt="Vehicle Card Back" />
                  ) : (
                    <span>📄</span>
                  )}
                  {selectedDriver.images?.vehicleCardBack && (
                    <div className="doc-hover-overlay">
                      <Eye size={18} />
                      <span>Preview</span>
                    </div>
                  )}
                </div>
                <div className="doc-card-info">
                  <span className="doc-card-label">Back Side</span>
                  <span className={`doc-status-tag ${selectedDriver.images?.vehicleCardBack ? 'uploaded' : 'missing'}`}>
                    {selectedDriver.images?.vehicleCardBack ? '✓ Uploaded' : 'Missing'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Sub-section 3: Vehicle Images */}
          <div className="doc-category-block mt-4">
            <h4 className="doc-category-title">📸 Vehicle Images</h4>
            <div className="driver-docs-grid">
              {/* Vehicle Front View */}
              <div 
                className={`driver-doc-card ${selectedDriver.images?.vehicleFrontView ? 'clickable' : ''}`}
                onClick={() => selectedDriver.images?.vehicleFrontView && handleOpenPreview('Vehicle Front View Photo', selectedDriver.images.vehicleFrontView)}
              >
                <div className="doc-img-placeholder">
                  {selectedDriver.images?.vehicleFrontView ? (
                    <img src={selectedDriver.images.vehicleFrontView} alt="Vehicle Front View" />
                  ) : (
                    <span>🚘</span>
                  )}
                  {selectedDriver.images?.vehicleFrontView && (
                    <div className="doc-hover-overlay">
                      <Eye size={18} />
                      <span>Preview</span>
                    </div>
                  )}
                </div>
                <div className="doc-card-info">
                  <span className="doc-card-label">Front View</span>
                  <span className={`doc-status-tag ${selectedDriver.images?.vehicleFrontView ? 'uploaded' : 'missing'}`}>
                    {selectedDriver.images?.vehicleFrontView ? '✓ Uploaded' : 'Missing'}
                  </span>
                </div>
              </div>

              {/* Vehicle Back View (if uploaded) */}
              {selectedDriver.images?.vehicleBackView && (
                <div 
                  className="driver-doc-card clickable"
                  onClick={() => handleOpenPreview('Vehicle Back View Photo', selectedDriver.images.vehicleBackView)}
                >
                  <div className="doc-img-placeholder">
                    <img src={selectedDriver.images.vehicleBackView} alt="Vehicle Back View" />
                    <div className="doc-hover-overlay">
                      <Eye size={18} />
                      <span>Preview</span>
                    </div>
                  </div>
                  <div className="doc-card-info">
                    <span className="doc-card-label">Back View</span>
                    <span className="doc-status-tag uploaded">✓ Uploaded</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Driver Availability Schedule Section ── */}
          <DriverAvailability availability={selectedDriver.availabilitySchedule || (typeof selectedDriver.availability === 'object' ? selectedDriver.availability : null)} />
        </div>

        {/* ── Action Buttons ── */}
        <div className="details-actions">
          {selectedDriver.status === 'Pending' && (
            <>
              <button className="reject-btn" onClick={() => handleAction(selectedDriver.id, selectedDriver._id, 'reject')}>
                <XCircle size={16} /> Reject Application
              </button>
              <button 
                className="approve-btn" 
                onClick={() => {
                  if (selectedDriver.missingDocuments && selectedDriver.missingDocuments.length > 0) {
                    setConfirmApproveModal(true);
                  } else {
                    handleAction(selectedDriver.id, selectedDriver._id, 'approve');
                  }
                }}
              >
                <CheckCircle size={16} /> Approve Driver
              </button>
            </>
          )}
          {selectedDriver.status === 'Approved' && (
            <button className="reject-btn" onClick={() => handleAction(selectedDriver.id, selectedDriver._id, 'reject')}>
              <XCircle size={16} /> Revoke / Reject Driver
            </button>
          )}
          {selectedDriver.status === 'Rejected' && (
            <button className="approve-btn" onClick={() => handleAction(selectedDriver.id, selectedDriver._id, 'approve')}>
              <CheckCircle size={16} /> Re-Approve Driver
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="module-container fade-in">
      {toastMessage && (
        <div className="toast-notification fade-in">
          <CheckCircle size={20} />
          {toastMessage}
        </div>
      )}
      
      {!selectedDriver && !isAddDriverOpen && renderList()}
      {selectedDriver && !isAddDriverOpen && renderDetails()}
      
      {isAddDriverOpen && (
        <AddDriverForm 
          onClose={() => setIsAddDriverOpen(false)}
          onSuccess={async (data) => {
            setIsAddDriverOpen(false);
            
            try {
              // Hit the public register endpoint
              await fetch(`${BACKEND_URL}/api/drivers`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  name: data.fullName || 'New Driver',
                  phone: data.phone || '000-000-0000',
                  email: data.email || 'N/A',
                  vehicleType: 'Sedan',
                  source: 'MANUAL',
                  city: 'Islamabad',
                  vehicleDetails: {
                    make: data.make || 'Toyota',
                    model: data.model || 'Corolla',
                    year: new Date().getFullYear().toString(),
                    color: data.color || 'White',
                    category: 'Sedan',
                    ac: true,
                    plateNumber: data.plate || 'ABC-1234'
                  }
                })
              });

              setToastMessage('New driver successfully registered to database!');
              setTimeout(() => setToastMessage(''), 3000);
              
              // Refresh the list from the database
              fetchDrivers();
            } catch (err) {
              console.error("Failed to save driver to DB:", err);
            }
          }}
        />
      )}

      {/* ── Global Interactive Document Preview Lightbox Modal (Rendered via Portal to Viewport Center) ── */}
      {previewImage && createPortal(
        <div className="doc-lightbox-overlay" onClick={() => setPreviewImage(null)}>
          <div className="doc-lightbox-card" onClick={e => e.stopPropagation()}>
            <div className="doc-lightbox-header">
              <div className="d-flex align-items-center gap-2">
                <FileText size={18} className="text-primary" />
                <span className="doc-lightbox-title">{previewImage.title}</span>
                {selectedDriver && (
                  <span className="doc-lightbox-driver-tag">{selectedDriver.personalInfo.name}</span>
                )}
              </div>
              <div className="preview-header-controls">
                <button 
                  type="button" 
                  className="preview-tool-btn" 
                  onClick={() => setZoomLevel(prev => Math.min(prev + 0.25, 3))}
                  title="Zoom In (+)"
                >
                  <ZoomIn size={15} />
                </button>
                <button 
                  type="button" 
                  className="preview-tool-btn" 
                  onClick={() => setZoomLevel(prev => Math.max(prev - 0.25, 0.5))}
                  title="Zoom Out (-)"
                >
                  <ZoomOut size={15} />
                </button>
                <button 
                  type="button" 
                  className="preview-tool-btn" 
                  onClick={() => setRotation(prev => (prev + 90) % 360)}
                  title="Rotate (90°)"
                >
                  <RotateCw size={15} />
                </button>
                <button 
                  type="button" 
                  className="preview-tool-btn" 
                  onClick={() => { setZoomLevel(1); setRotation(0); }}
                  title="Reset (100%)"
                >
                  ⟲
                </button>
                <button 
                  type="button" 
                  className="preview-close-btn" 
                  onClick={() => setPreviewImage(null)}
                  title="Close (Esc)"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
            <div className="doc-lightbox-body">
              <img 
                src={previewImage.url} 
                alt={previewImage.title} 
                className="doc-lightbox-img"
                style={{
                  transform: `scale(${zoomLevel}) rotate(${rotation}deg)`,
                  transition: 'transform 0.2s ease-in-out'
                }}
              />
            </div>
            <div className="doc-lightbox-footer">
              <div className="preview-meta-info">
                <span>Scale: {Math.round(zoomLevel * 100)}%</span>
                {rotation !== 0 && <span className="ms-2">• Rotation: {rotation}°</span>}
              </div>
              <div className="d-flex gap-2">
                <a href={previewImage.url} target="_blank" rel="noopener noreferrer" className="secondary-btn btn-sm">
                  <ExternalLink size={13} /> Open Original ↗
                </a>
                <button className="primary-btn btn-sm" onClick={() => setPreviewImage(null)}>
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
      {/* ── Confirm Approve with Incomplete Documents Modal ── */}
      {confirmApproveModal && selectedDriver && createPortal(
        <div className="doc-lightbox-overlay" onClick={() => setConfirmApproveModal(false)}>
          <div className="doc-lightbox-card" style={{maxWidth: '520px'}} onClick={e => e.stopPropagation()}>
            <div className="doc-lightbox-header">
              <div className="d-flex align-items-center gap-2">
                <AlertTriangle size={18} className="text-warning" />
                <span className="doc-lightbox-title">Warning: Incomplete Documents</span>
              </div>
              <button className="preview-close-btn" onClick={() => setConfirmApproveModal(false)}>
                <X size={16} />
              </button>
            </div>
            <div style={{padding: '1.5rem', background: '#020617', color: '#f8fafc'}}>
              <p style={{marginBottom: '0.75rem', fontSize: '0.95rem', fontWeight: '600'}}>
                This driver has <span style={{color: '#f87171'}}>{selectedDriver.missingDocuments?.length} missing document(s)</span>:
              </p>
              <ul style={{paddingLeft: '1.25rem', marginBottom: '1.25rem', color: '#fca5a5', fontSize: '0.88rem', display: 'flex', flexDirection: 'column', gap: '0.25rem'}}>
                {selectedDriver.missingDocuments?.map((doc, idx) => (
                  <li key={idx}>{doc}</li>
                ))}
              </ul>
              <p style={{fontSize: '0.84rem', color: '#94a3b8', lineHeight: '1.4'}}>
                Do you still want to approve <strong>{selectedDriver.personalInfo.name}</strong>, or would you prefer to reject the application until documents are uploaded?
              </p>
            </div>
            <div className="doc-lightbox-footer" style={{justifyContent: 'space-between'}}>
              <button 
                className="reject-btn btn-sm" 
                onClick={() => {
                  setConfirmApproveModal(false);
                  handleAction(selectedDriver.id, selectedDriver._id, 'reject');
                }}
              >
                Reject Application
              </button>
              <div className="d-flex gap-2">
                <button className="secondary-btn btn-sm" onClick={() => setConfirmApproveModal(false)}>
                  Cancel
                </button>
                <button 
                  className="approve-btn btn-sm" 
                  onClick={() => {
                    setConfirmApproveModal(false);
                    handleAction(selectedDriver.id, selectedDriver._id, 'approve');
                  }}
                >
                  Yes, Approve Anyway
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
      {/* ── Edit Driver Modal (Full Admin Control) ── */}
      {isEditModalOpen && selectedDriver && (
        <EditDriverModal
          driver={selectedDriver}
          onClose={() => setIsEditModalOpen(false)}
          onSuccess={(updatedData) => {
            setIsEditModalOpen(false);
            setToastMessage('Driver profile updated successfully.');
            setTimeout(() => setToastMessage(''), 3500);
            fetchDrivers();
            
            // Reactively update selected driver without page refresh
            setSelectedDriver(prev => ({
              ...prev,
              personalInfo: {
                ...prev.personalInfo,
                name: updatedData.name || updatedData.Name || prev.personalInfo.name,
                phone: updatedData.phone || updatedData.PhoneNumber || prev.personalInfo.phone,
                email: updatedData.email !== undefined ? updatedData.email : prev.personalInfo.email,
                city: updatedData.city || prev.personalInfo.city,
                cnic: updatedData.cnic || updatedData.CnicNumber || prev.personalInfo.cnic,
                license: updatedData.license || updatedData.License || prev.personalInfo.license
              },
              vehicleInfo: {
                ...prev.vehicleInfo,
                make: updatedData.vehicleInfo?.make || prev.vehicleInfo.make,
                model: updatedData.vehicleInfo?.model || prev.vehicleInfo.model,
                year: updatedData.vehicleInfo?.year || prev.vehicleInfo.year,
                color: updatedData.vehicleInfo?.color || prev.vehicleInfo.color,
                plateNumber: updatedData.vehicleInfo?.plateNumber || prev.vehicleInfo.plateNumber,
                category: updatedData.vehicleInfo?.category || prev.vehicleInfo.category,
                seats: updatedData.vehicleInfo?.numberOfSeats || prev.vehicleInfo.seats,
                ac: updatedData.vehicleInfo?.ac !== undefined ? updatedData.vehicleInfo.ac : prev.vehicleInfo.ac
              },
              preferences: {
                ...prev.preferences,
                routes: updatedData.preferredRoutes || prev.preferences.routes
              },
              status: updatedData.verificationStatus === 'Verified' ? 'Approved' : (updatedData.verificationStatus === 'Rejected' ? 'Rejected' : (updatedData.verificationStatus || prev.status))
            }));
          }}
        />
      )}
    </div>
  );
};

export default DriverApproval;
