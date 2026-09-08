import React from 'react';
import { Clock, Calendar, Zap, CheckCircle2, XCircle, AlertCircle, Info } from 'lucide-react';
import './DriverAvailability.css';

const ALL_DAYS = [
  { key: 'Mon', label: 'Mon' },
  { key: 'Tue', label: 'Tue' },
  { key: 'Wed', label: 'Wed' },
  { key: 'Thu', label: 'Thu' },
  { key: 'Fri', label: 'Fri' },
  { key: 'Sat', label: 'Sat' },
  { key: 'Sun', label: 'Sun' }
];

const DriverAvailability = ({ availability }) => {
  if (!availability || !availability.slots || availability.slots.length === 0) {
    return (
      <div className="availability-card-wrap empty-availability-state">
        <div className="availability-card-header">
          <div className="header-title-flex">
            <Clock size={18} className="text-secondary" />
            <h4 className="availability-main-title">Driver Working Schedule & Availability</h4>
          </div>
          <span className="not-configured-tag">Not Configured</span>
        </div>
        <p className="no-availability-text">
          No custom availability slots set by this driver yet. Driver operates on standard on-demand transit.
        </p>
      </div>
    );
  }

  const { scheduleType = 'same', specificDays = [], slots = [] } = availability;
  const isSameEveryDay = scheduleType === 'same';

  return (
    <div className="availability-card-wrap">
      {/* Header */}
      <div className="availability-card-header">
        <div className="header-title-flex">
          <Clock size={18} className="text-primary" />
          <h4 className="availability-main-title">Driver Working Schedule & Availability</h4>
        </div>
        <span className={`schedule-type-badge ${isSameEveryDay ? 'badge-same-day' : 'badge-diff-day'}`}>
          {isSameEveryDay ? '● Same Slots Every Day' : '● Different Slots Per Day'}
        </span>
      </div>

      {/* Specific Days Matrix (Circles Matching Mobile App UI) */}
      <div className="availability-days-section">
        <div className="days-section-header">
          <span className="section-mini-label">APPLY TO SPECIFIC DAYS</span>
          <span className="days-status-hint">
            {isSameEveryDay ? 'Applies to all working days' : `${specificDays.length} specific day(s) selected`}
          </span>
        </div>
        <div className="days-circles-row">
          {ALL_DAYS.map(day => {
            const isDayActive = isSameEveryDay 
              ? (specificDays && specificDays.length > 0 ? specificDays.includes(day.key) : true)
              : (specificDays && specificDays.includes(day.key));
            return (
              <div 
                key={day.key} 
                className={`day-circle-pill ${isDayActive ? 'day-circle-active' : 'day-circle-inactive'}`}
                title={isDayActive ? `${day.label}: Active on shift` : `${day.label}: Day Off`}
              >
                <span className="day-name">{day.label}</span>
                {isDayActive && <span className="active-dot" />}
              </div>
            );
          })}
        </div>
      </div>

      {/* Time Slots List */}
      <div className="availability-slots-section">
        <div className="slots-header-row">
          <span className="section-mini-label">YOUR AVAILABLE TIME SLOTS</span>
          <span className="slots-count-pill">{slots.length} Slot{slots.length > 1 ? 's' : ''} Added</span>
        </div>
        <p className="slots-subtext">Configured time windows when driver is active to accept rides.</p>

        <div className="slots-grid-list">
          {slots.map((slot, idx) => {
            const isFlex = slot.isFlexible || 
              slot.timeText?.toLowerCase().includes('flexible') || 
              slot.timeText?.toLowerCase().includes('drop-off');
            const isActive = slot.isActive !== false;

            return (
              <div 
                key={slot._id || slot.id || idx} 
                className={`time-slot-card ${isFlex ? 'flexible-slot-card' : ''} ${!isActive ? 'inactive-slot-card' : ''}`}
              >
                <div className="slot-card-top-row">
                  <div className="slot-card-left">
                    <div className={`slot-icon-box ${isFlex ? 'icon-flex' : 'icon-standard'}`}>
                      {isFlex ? <Zap size={18} /> : <Clock size={18} />}
                    </div>
                    <div className="slot-meta-text">
                      <span className="slot-time-string">{slot.timeText || 'Standard Shift'}</span>
                      <span className="slot-index-label">Slot {idx + 1}</span>
                    </div>
                  </div>

                  <div className="slot-badges-right">
                    {isFlex && (
                      <span className="slot-badge badge-flexible">
                        <Zap size={11} />
                        <span>Flexible</span>
                      </span>
                    )}
                    {isActive ? (
                      <span className="slot-badge badge-active">
                        <CheckCircle2 size={11} />
                        <span>Active</span>
                      </span>
                    ) : (
                      <span className="slot-badge badge-inactive">
                        <XCircle size={11} />
                        <span>Inactive</span>
                      </span>
                    )}
                  </div>
                </div>

                {isFlex && (
                  <div className="flex-auto-info-note">
                    <Info size={13} className="flex-info-icon" />
                    <span>Automatically available right after completing current ride</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default DriverAvailability;
