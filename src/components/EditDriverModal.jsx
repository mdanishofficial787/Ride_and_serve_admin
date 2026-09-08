import React, { useState } from 'react';
import { X, Save, User, Car, MapPin, Shield, CheckCircle, AlertCircle, Plus, Trash2 } from 'lucide-react';
import LocationAutocomplete from './LocationAutocomplete';
import { BACKEND_URL } from '../utils/api';
import './EditDriverModal.css';

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

const EditDriverModal = ({ driver, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    name: driver.personalInfo?.name || '',
    phone: driver.personalInfo?.phone || '',
    email: driver.personalInfo?.email || '',
    city: driver.personalInfo?.city || 'Islamabad',
    cnic: driver.personalInfo?.cnic || '',
    license: driver.personalInfo?.license || '',
    verificationStatus: driver.status === 'Approved' ? 'Verified' : (driver.status === 'Rejected' ? 'Rejected' : 'Pending'),
    routes: (driver.preferences?.routes || []).map(formatRouteString).filter(Boolean).length > 0
      ? (driver.preferences?.routes || []).map(formatRouteString).filter(Boolean)
      : ['Islamabad - Rawalpindi'],
    vehicleMake: driver.vehicleInfo?.make || 'Toyota',
    vehicleModel: driver.vehicleInfo?.model || 'Corolla',
    vehicleYear: driver.vehicleInfo?.year || '2023',
    vehicleColor: driver.vehicleInfo?.color || 'White',
    plateNumber: driver.vehicleInfo?.plateNumber || 'ISB-1234',
    category: driver.vehicleInfo?.category || 'Sedan',
    seats: driver.vehicleInfo?.seats || (driver.vehicleInfo?.make?.toLowerCase().includes('bolan') ? 7 : 4),
    ac: driver.vehicleInfo?.ac !== false
  });

  const [newRoute, setNewRoute] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleAddRoute = () => {
    if (!newRoute.trim()) return;
    if (!formData.routes.includes(newRoute.trim())) {
      setFormData(prev => ({ ...prev, routes: [...prev.routes, newRoute.trim()] }));
    }
    setNewRoute('');
  };

  const handleRemoveRoute = (indexToRemove) => {
    setFormData(prev => ({
      ...prev,
      routes: prev.routes.filter((_, idx) => idx !== indexToRemove)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!formData.name.trim() || !formData.phone.trim()) {
      setErrorMsg('Driver name and phone number are required.');
      return;
    }

    setIsSubmitting(true);
    try {
      const token = localStorage.getItem('admin_token');
      const payload = {
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        email: formData.email.trim(),
        city: formData.city.trim(),
        cnic: formData.cnic.trim(),
        license: formData.license.trim(),
        preferredRoutes: formData.routes,
        verificationStatus: formData.verificationStatus,
        vehicleInfo: {
          make: formData.vehicleMake.trim(),
          model: formData.vehicleModel.trim(),
          year: formData.vehicleYear.trim(),
          color: formData.vehicleColor.trim(),
          plateNumber: formData.plateNumber.trim(),
          category: formData.category,
          numberOfSeats: parseInt(formData.seats, 10) || 4,
          ac: formData.ac
        }
      };

      const res = await fetch(`${BACKEND_URL}/admin/driver/${driver._id || driver.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (data.success) {
        if (onSuccess) onSuccess(data.data?.driver || payload);
      } else {
        setErrorMsg(data.message || 'Failed to update driver profile.');
      }
    } catch (err) {
      console.error('Driver update error:', err);
      setErrorMsg('Network error while updating driver profile.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay fade-in" style={{ zIndex: 10000 }} onClick={onClose}>
      <div className="edit-driver-modal-card" onClick={e => e.stopPropagation()}>
        <div className="edit-modal-header">
          <div className="d-flex align-items-center gap-2">
            <User size={20} className="text-primary" />
            <div>
              <h2 className="edit-modal-title">Edit Driver Profile</h2>
              <p className="edit-modal-subtitle">{driver.id} • Unrestricted Admin Control</p>
            </div>
          </div>
          <button className="icon-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {errorMsg && (
          <div className="edit-modal-error">
            <AlertCircle size={16} />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="edit-modal-form">
          <div className="edit-modal-scroll-body">
            {/* Section 1: Personal Details */}
            <div className="edit-form-section">
              <h4 className="section-title">
                <User size={15} /> Personal Information
              </h4>
              <div className="form-grid-2">
                <div className="form-group">
                  <label>Full Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Phone Number *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Email Address</label>
                  <input
                    type="email"
                    className="form-input"
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>City</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.city}
                    onChange={e => setFormData({ ...formData, city: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>CNIC Number</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.cnic}
                    onChange={e => setFormData({ ...formData, cnic: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>License Number</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.license}
                    onChange={e => setFormData({ ...formData, license: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Verification Status */}
            <div className="edit-form-section mt-3">
              <h4 className="section-title">
                <Shield size={15} /> Verification Status
              </h4>
              <div className="status-radio-group">
                {['Pending', 'Verified', 'Rejected'].map((st) => (
                  <label key={st} className={`status-radio-label ${formData.verificationStatus === st ? 'active' : ''}`}>
                    <input
                      type="radio"
                      name="verificationStatus"
                      value={st}
                      checked={formData.verificationStatus === st}
                      onChange={e => setFormData({ ...formData, verificationStatus: e.target.value })}
                    />
                    <span>{st === 'Verified' ? 'Approved (Verified)' : st}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Section 3: Vehicle Information */}
            <div className="edit-form-section mt-3">
              <h4 className="section-title">
                <Car size={15} /> Vehicle Details
              </h4>
              <div className="form-grid-3">
                <div className="form-group">
                  <label>Vehicle Make</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.vehicleMake}
                    onChange={e => setFormData({ ...formData, vehicleMake: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Vehicle Model</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.vehicleModel}
                    onChange={e => setFormData({ ...formData, vehicleModel: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Number Plate</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.plateNumber}
                    onChange={e => setFormData({ ...formData, plateNumber: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Category</label>
                  <select
                    className="form-input"
                    value={formData.category}
                    onChange={e => setFormData({ ...formData, category: e.target.value })}
                  >
                    <option value="Sedan">Sedan</option>
                    <option value="SUV">SUV</option>
                    <option value="Hatchback">Hatchback</option>
                    <option value="Van">Van / Carry Bolan</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Seat Capacity (Max Physical)</label>
                  <input
                    type="number"
                    min="1"
                    max="14"
                    className="form-input"
                    value={formData.seats}
                    onChange={e => setFormData({ ...formData, seats: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Air Conditioning (AC)</label>
                  <select
                    className="form-input"
                    value={formData.ac ? 'true' : 'false'}
                    onChange={e => setFormData({ ...formData, ac: e.target.value === 'true' })}
                  >
                    <option value="true">AC (Fitted & Working)</option>
                    <option value="false">Non-AC</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Vehicle Color</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.vehicleColor}
                    onChange={e => setFormData({ ...formData, vehicleColor: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Year</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.vehicleYear}
                    onChange={e => setFormData({ ...formData, vehicleYear: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* Section 4: Assigned Routes */}
            <div className="edit-form-section mt-3">
              <h4 className="section-title">
                <MapPin size={15} /> Assigned Preferred Routes
              </h4>
              <div className="routes-editor">
                <div className="routes-chips-list">
                  {formData.routes.map((rt, idx) => (
                    <span key={idx} className="route-chip">
                      {formatRouteString(rt)}
                      <button type="button" className="chip-del-btn" onClick={() => handleRemoveRoute(idx)}>
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                  {formData.routes.length === 0 && (
                    <span className="text-secondary" style={{ fontSize: '0.8rem' }}>No routes assigned</span>
                  )}
                </div>
                <div className="add-route-input-row mt-2">
                  <div style={{ flex: 1 }}>
                    <LocationAutocomplete
                      value={newRoute}
                      onChange={val => setNewRoute(val)}
                      onSelect={(item, cleanVal) => {
                        setNewRoute(cleanVal);
                      }}
                      placeholder="Search location (e.g. Faizabad, Blue Area, F-10, Saddar)..."
                    />
                  </div>
                  <button type="button" className="add-chip-btn" onClick={handleAddRoute}>
                    <Plus size={15} /> Add Route
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="edit-modal-footer">
            <button type="button" className="secondary-btn" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className="primary-btn" disabled={isSubmitting}>
              <Save size={16} /> {isSubmitting ? 'Saving Changes...' : 'Save Driver Profile'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditDriverModal;
