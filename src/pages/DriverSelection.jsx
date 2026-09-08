import React, { useState } from 'react';
import { 
  Search, Filter, MapPin, User, Car, Star, CheckCircle, ChevronRight 
} from 'lucide-react';
import './DriverSelection.css';

const DriverSelection = () => {
  const [drivers, setDrivers] = useState([]);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [toastMessage, setToastMessage] = useState('');

  // Filtering state
  const [filters, setFilters] = useState({
    route: '',
    category: '',
    ac: ''
  });

  const handleFilterChange = (e) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };

  const filteredDrivers = drivers.filter(driver => {
    return (
      (filters.category === '' || driver.vehicleInfo.category === filters.category) &&
      (filters.ac === '' || (filters.ac === 'Yes' ? driver.vehicleInfo.ac : !driver.vehicleInfo.ac))
    );
  });

  const assignDriver = (driver) => {
    setToastMessage(`${driver.personalInfo.name} has been assigned to the ride!`);
    setTimeout(() => setToastMessage(''), 3000);
    setSelectedDriver(null);
  };

  return (
    <div className="module-container fade-in">
      {toastMessage && (
        <div className="toast-notification fade-in">
          <CheckCircle size={20} />
          {toastMessage}
        </div>
      )}

      <div className="page-header">
        <div>
          <h1 className="page-title">Ride Dispatch</h1>
          <p className="page-subtitle">Find and assign the most suitable driver for a specific route.</p>
        </div>
      </div>

      <div className="dispatch-layout">
        {/* Left Side: Ride Details & Filters */}
        <div className="dispatch-sidebar">
          <div className="glass-panel p-4 mb-4">
            <h3 className="section-title mb-3">Ride Request Details</h3>
            <div className="form-group mb-3">
              <label>Pickup Location</label>
              <div className="input-group-alt">
                <MapPin size={16} className="text-secondary" />
                <input type="text" placeholder="e.g. Islamabad" />
              </div>
            </div>
            <div className="form-group mb-4">
              <label>Drop-off Location</label>
              <div className="input-group-alt">
                <MapPin size={16} className="text-secondary" />
                <input type="text" placeholder="e.g. Lahore" />
              </div>
            </div>
            <button className="primary-btn w-100 justify-content-center">
              Search Suitable Drivers
            </button>
          </div>

          <div className="glass-panel p-4">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h3 className="section-title">Filters</h3>
              <Filter size={16} className="text-secondary" />
            </div>
            
            <div className="form-group mb-3">
              <label>Vehicle Type</label>
              <select name="category" value={filters.category} onChange={handleFilterChange} className="form-input">
                <option value="">Any Category</option>
                <option value="Executive">Executive</option>
                <option value="Sedan">Sedan</option>
                <option value="Mini">Mini</option>
              </select>
            </div>

            <div className="form-group mb-0">
              <label>AC Preference</label>
              <select name="ac" value={filters.ac} onChange={handleFilterChange} className="form-input">
                <option value="">Any</option>
                <option value="Yes">AC Required</option>
                <option value="No">Non-AC</option>
              </select>
            </div>
          </div>
        </div>

        {/* Right Side: Driver Results */}
        <div className="dispatch-results">
          <div className="results-header">
            <h4>Available Drivers ({filteredDrivers.length})</h4>
          </div>

          <div className="driver-cards-grid">
            {filteredDrivers.length === 0 ? (
              <div className="empty-state w-100">
                <p>No drivers found matching these criteria.</p>
              </div>
            ) : (
              filteredDrivers.map(driver => (
                <div key={driver.id} className="driver-select-card glass-panel">
                  <div className="card-top">
                    <div className="avatar-md bg-primary-light text-primary">
                      {driver.personalInfo.name.charAt(0)}
                    </div>
                    <div className="driver-basic-info">
                      <div className="d-flex justify-content-between align-items-center">
                        <h4 className="name">{driver.personalInfo.name}</h4>
                        <span className="rating-badge">
                          <Star size={12} className="star-icon" /> {driver.performance.rating}
                        </span>
                      </div>
                      <p className="subtext">{driver.personalInfo.phone}</p>
                    </div>
                  </div>

                  <div className="card-middle">
                    <div className="info-pill">
                      <Car size={14} />
                      <span>{driver.vehicleInfo.make} {driver.vehicleInfo.model}</span>
                    </div>
                    <div className="info-pill">
                      <span>{driver.vehicleInfo.category}</span>
                      {driver.vehicleInfo.ac && <span className="ac-tag">AC</span>}
                    </div>
                  </div>

                  <div className="card-bottom">
                    <div className="stats-row">
                      <div className="stat">
                        <span className="stat-val">{driver.performance.totalRides}</span>
                        <span className="stat-label">Rides</span>
                      </div>
                      <div className="stat">
                        <span className="stat-val">{driver.performance.cancellationRate}</span>
                        <span className="stat-label">Cancels</span>
                      </div>
                    </div>
                    <button className="primary-btn sm-btn" onClick={() => assignDriver(driver)}>
                      Assign <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DriverSelection;
