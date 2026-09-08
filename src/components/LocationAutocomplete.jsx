import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Search, Loader2, X, Navigation } from 'lucide-react';
import './LocationAutocomplete.css';

const LOCATIONIQ_KEY = 'pk.215498a4e99268cde5c380624d981804';

// Popular Pakistani commute hubs, sectors, landmarks & routes (Instant inDrive/Uber style matching)
const POPULAR_LOCATIONS = [
  { name: 'Faizabad Interchange', city: 'Islamabad / Rawalpindi', display: 'Faizabad, Islamabad' },
  { name: 'Blue Area', city: 'Islamabad', display: 'Blue Area, Islamabad' },
  { name: 'Zero Point', city: 'Islamabad', display: 'Zero Point, Islamabad' },
  { name: 'F-10 Markaz', city: 'Islamabad', display: 'F-10 Markaz, Islamabad' },
  { name: 'F-11 Markaz', city: 'Islamabad', display: 'F-11 Markaz, Islamabad' },
  { name: 'F-6 Super Market', city: 'Islamabad', display: 'F-6 Super Market, Islamabad' },
  { name: 'F-7 Jinnah Super', city: 'Islamabad', display: 'F-7 Jinnah Super, Islamabad' },
  { name: 'F-8 Markaz', city: 'Islamabad', display: 'F-8 Markaz, Islamabad' },
  { name: 'G-11 Markaz', city: 'Islamabad', display: 'G-11 Markaz, Islamabad' },
  { name: 'G-9 Karachi Company', city: 'Islamabad', display: 'G-9 Karachi Company, Islamabad' },
  { name: 'G-10 Markaz', city: 'Islamabad', display: 'G-10 Markaz, Islamabad' },
  { name: 'G-13 Sector', city: 'Islamabad', display: 'G-13, Islamabad' },
  { name: 'G-15 / Tarnol', city: 'Islamabad', display: 'G-15, Islamabad' },
  { name: 'I-8 Markaz', city: 'Islamabad', display: 'I-8 Markaz, Islamabad' },
  { name: 'I-9 Industrial Area', city: 'Islamabad', display: 'I-9, Islamabad' },
  { name: 'I-10 Markaz', city: 'Islamabad', display: 'I-10 Markaz, Islamabad' },
  { name: 'E-11 / Multi Gardens', city: 'Islamabad', display: 'E-11, Islamabad' },
  { name: 'H-12 NUST University', city: 'Islamabad', display: 'NUST H-12, Islamabad' },
  { name: 'Islamabad International Airport', city: 'Islamabad', display: 'Islamabad Airport' },
  { name: 'Bahria Town Phase 1-8', city: 'Rawalpindi / Islamabad', display: 'Bahria Town, Rawalpindi' },
  { name: 'DHA Phase 1 & 2', city: 'Islamabad / Rawalpindi', display: 'DHA, Islamabad' },
  { name: 'Saddar Market', city: 'Rawalpindi', display: 'Saddar, Rawalpindi' },
  { name: 'Commercial Market', city: 'Satellite Town, Rawalpindi', display: 'Commercial Market, Rawalpindi' },
  { name: 'Chandni Chowk', city: 'Murree Road, Rawalpindi', display: 'Chandni Chowk, Rawalpindi' },
  { name: 'Shamsabad', city: 'Rawalpindi', display: 'Shamsabad, Rawalpindi' },
  { name: '6th Road', city: 'Rawalpindi', display: '6th Road, Rawalpindi' },
  { name: 'Pirwadhai Bus Stand', city: 'Rawalpindi', display: 'Pirwadhai, Rawalpindi' },
  { name: 'Gulberg Greens', city: 'Islamabad', display: 'Gulberg Greens, Islamabad' },
  { name: 'PWD Housing Society', city: 'Islamabad', display: 'PWD Society, Islamabad' },
  { name: 'Soan Gardens', city: 'Islamabad', display: 'Soan Gardens, Islamabad' },
  { name: 'Bahria Enclave', city: 'Islamabad', display: 'Bahria Enclave, Islamabad' },
  { name: 'Islamabad - Rawalpindi Commute', city: 'Twin Cities Route', display: 'Islamabad - Rawalpindi' },
  { name: 'Islamabad - Lahore Motorway (M-2)', city: 'Intercity Route', display: 'Islamabad - Lahore' },
  { name: 'Islamabad - Peshawar Motorway (M-1)', city: 'Intercity Route', display: 'Islamabad - Peshawar' },
  { name: 'Gulberg III', city: 'Lahore', display: 'Gulberg, Lahore' },
  { name: 'DHA Phase 5 & 6', city: 'Lahore', display: 'DHA, Lahore' },
  { name: 'Johar Town', city: 'Lahore', display: 'Johar Town, Lahore' },
  { name: 'Mall Road', city: 'Lahore', display: 'Mall Road, Lahore' },
  { name: 'Thokar Niaz Baig', city: 'Lahore', display: 'Thokar Niaz Baig, Lahore' },
  { name: 'Allama Iqbal Town', city: 'Lahore', display: 'Iqbal Town, Lahore' },
  { name: 'Clifton & Defense', city: 'Karachi', display: 'Clifton, Karachi' },
  { name: 'Gulshan-e-Iqbal', city: 'Karachi', display: 'Gulshan-e-Iqbal, Karachi' },
  { name: 'University Road', city: 'Peshawar', display: 'University Road, Peshawar' },
  { name: 'Cantt', city: 'Peshawar', display: 'Cantt, Peshawar' },
  { name: 'Katchery Chowk', city: 'Multan', display: 'Katchery Chowk, Multan' },
  { name: 'D-Ground', city: 'Faisalabad', display: 'D-Ground, Faisalabad' }
];

const LocationAutocomplete = ({
  value = '',
  onChange,
  onSelect,
  placeholder = 'Search location (e.g. Faizabad, Blue Area, F-10, Saddar)...',
  className = '',
  disabled = false
}) => {
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Format messy API addresses into concise inDrive-style titles
  const formatConciseLocation = (item) => {
    if (item.display) return { title: item.name, subtitle: item.city, clean: item.display };

    const placeName = item.display_place || item.address?.name || item.name || '';
    const city = item.address?.city || item.address?.county || item.address?.state || 'Pakistan';
    
    // Clean string tokens
    let rawTitle = placeName;
    if (!rawTitle && item.display_name) {
      rawTitle = item.display_name.split(',')[0].trim();
    }
    
    // Remove non-Latin characters if English name available
    const cleanTitle = rawTitle.replace(/[\u0600-\u06FF]/g, '').trim() || rawTitle;
    const cleanCity = (city || '').replace(/[\u0600-\u06FF]/g, '').trim() || 'Pakistan';

    const cleanDisplay = cleanCity && cleanCity !== 'Pakistan' 
      ? `${cleanTitle}, ${cleanCity}` 
      : cleanTitle;

    return {
      title: cleanTitle || 'Location',
      subtitle: item.display_name ? item.display_name.split(',').slice(0, 3).join(', ') : cleanCity,
      clean: cleanDisplay
    };
  };

  // Instant local matching + LocationIQ API search
  useEffect(() => {
    if (!query || query.trim().length === 0) {
      setSuggestions([]);
      setIsLoading(false);
      return;
    }

    const qLower = query.toLowerCase().trim();
    
    // 1. Instant local matching (0ms inDrive responsiveness)
    const localMatches = POPULAR_LOCATIONS.filter(loc => 
      loc.name.toLowerCase().includes(qLower) ||
      loc.city.toLowerCase().includes(qLower) ||
      loc.display.toLowerCase().includes(qLower) ||
      // Fuzzy prefix matching (e.g. "faizabads" -> matches "faizabad")
      qLower.startsWith(loc.name.toLowerCase().substring(0, 4))
    ).map(loc => ({
      ...loc,
      isLocal: true,
      title: loc.name,
      subtitle: loc.city,
      clean: loc.display
    }));

    if (localMatches.length > 0) {
      setSuggestions(localMatches.slice(0, 6));
      setIsOpen(true);
    }

    // 2. Debounced LocationIQ API query for specific streets / addresses
    const timer = setTimeout(async () => {
      if (query.trim().length < 2) return;
      setIsLoading(true);
      try {
        const url = `https://api.locationiq.com/v1/autocomplete?key=${LOCATIONIQ_KEY}&q=${encodeURIComponent(query.trim())}&limit=6&countrycodes=pk`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            const apiFormatted = data.map(item => {
              const formatted = formatConciseLocation(item);
              return {
                ...item,
                ...formatted,
                isLocal: false
              };
            });

            // Merge local matches on top + API matches
            const combined = [...localMatches, ...apiFormatted];
            // Deduplicate by clean name
            const seen = new Set();
            const unique = combined.filter(item => {
              const k = (item.clean || item.title || '').toLowerCase();
              if (seen.has(k)) return false;
              seen.add(k);
              return true;
            });

            setSuggestions(unique.slice(0, 6));
            setIsOpen(true);
          }
        }
      } catch (err) {
        console.error('LocationIQ fetch error:', err.message);
      } finally {
        setIsLoading(false);
      }
    }, 280);

    return () => clearTimeout(timer);
  }, [query]);

  const handleInputChange = (e) => {
    const newVal = e.target.value;
    setQuery(newVal);
    if (onChange) onChange(newVal);
    if (!isOpen && newVal.length > 0) setIsOpen(true);
  };

  const handleSelectSuggestion = (item) => {
    const chosen = item.clean || item.title || query;
    setQuery(chosen);
    setIsOpen(false);
    if (onChange) onChange(chosen);
    if (onSelect) onSelect(item, chosen);
  };

  const handleClear = () => {
    setQuery('');
    setSuggestions([]);
    setIsOpen(false);
    if (onChange) onChange('');
  };

  return (
    <div className={`location-autocomplete-wrapper ${className}`} ref={dropdownRef}>
      <div className="location-input-box">
        <MapPin size={16} className="location-pin-icon" />
        <input
          type="text"
          className="location-input"
          value={query}
          onChange={handleInputChange}
          onFocus={() => {
            if (query.trim().length > 0 && suggestions.length > 0) {
              setIsOpen(true);
            } else if (!query) {
              // Show popular suggestions on empty focus
              const defaultPopular = POPULAR_LOCATIONS.slice(0, 5).map(l => ({
                ...l,
                title: l.name,
                subtitle: l.city,
                clean: l.display
              }));
              setSuggestions(defaultPopular);
              setIsOpen(true);
            }
          }}
          placeholder={placeholder}
          disabled={disabled}
        />
        {isLoading && <Loader2 size={15} className="location-spinner" />}
        {!isLoading && query && (
          <button type="button" className="location-clear-btn" onClick={handleClear}>
            <X size={14} />
          </button>
        )}
      </div>

      {isOpen && suggestions.length > 0 && (
        <ul className="location-suggestions-dropdown fade-in">
          {suggestions.map((item, index) => (
            <li
              key={item.place_id || index}
              className="location-suggestion-item"
              onClick={() => handleSelectSuggestion(item)}
            >
              <div className="suggestion-icon">
                <Navigation size={14} />
              </div>
              <div className="suggestion-text">
                <span className="suggestion-main">{item.title || item.clean}</span>
                <span className="suggestion-sub">{item.subtitle}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default LocationAutocomplete;
