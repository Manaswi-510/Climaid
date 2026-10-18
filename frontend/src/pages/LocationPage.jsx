/**
 * LocationPage.jsx — Page 2: Location selection
 * Leaflet map + search + supported-region detection.
 * Pune is the only supported prototype region.
 */
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import Header from '../components/Header';
import { Search, MapPin, CheckCircle2, AlertTriangle, ArrowRight, X } from 'lucide-react';

const PUNE_CENTER = [18.535, 73.855];
const PUNE_ZOOM = 12;
const PUNE_BBOX = [[18.50, 73.80], [18.60, 73.90]];

// Curated city list for simple search
const CITIES = [
  { name: 'Pune, Maharashtra, India', supported: true, center: PUNE_CENTER, zoom: PUNE_ZOOM },
  { name: 'Mumbai, Maharashtra, India', supported: false, center: [19.076, 72.877], zoom: 11 },
  { name: 'Bangalore, Karnataka, India', supported: false, center: [12.972, 77.594], zoom: 11 },
  { name: 'Delhi, India', supported: false, center: [28.614, 77.209], zoom: 10 },
  { name: 'Chennai, Tamil Nadu, India', supported: false, center: [13.083, 80.270], zoom: 11 },
  { name: 'Hyderabad, Telangana, India', supported: false, center: [17.385, 78.487], zoom: 11 },
  { name: 'Ahmedabad, Gujarat, India', supported: false, center: [23.022, 72.571], zoom: 11 },
  { name: 'London, United Kingdom', supported: false, center: [51.509, -0.118], zoom: 11 },
  { name: 'New York, USA', supported: false, center: [40.712, -74.005], zoom: 11 },
  { name: 'Nairobi, Kenya', supported: false, center: [-1.286, 36.820], zoom: 11 },
];

export default function LocationPage() {
  const navigate = useNavigate();
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const highlightRef = useRef(null);

  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [selected, setSelected] = useState(null);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Init Leaflet map
  useEffect(() => {
    if (mapInstanceRef.current) return;
    const map = L.map(mapRef.current, {
      center: [20, 78],
      zoom: 5,
      zoomControl: true,
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 18,
    }).addTo(map);
    mapInstanceRef.current = map;
    return () => { map.remove(); mapInstanceRef.current = null; };
  }, []);

  // Filter suggestions
  useEffect(() => {
    if (query.length < 2) { setSuggestions([]); setShowSuggestions(false); return; }
    const results = CITIES.filter(c =>
      c.name.toLowerCase().includes(query.toLowerCase())
    );
    setSuggestions(results);
    setShowSuggestions(true);
  }, [query]);

  const selectCity = (city) => {
    setSelected(city);
    setQuery(city.name);
    setShowSuggestions(false);

    const map = mapInstanceRef.current;
    if (!map) return;

    // Fly map
    map.flyTo(city.center, city.zoom, { duration: 1.2 });

    // Remove old marker
    if (markerRef.current) { markerRef.current.remove(); markerRef.current = null; }
    if (highlightRef.current) { highlightRef.current.remove(); highlightRef.current = null; }

    // Marker
    const icon = L.divIcon({
      className: '',
      html: `<div style="
        width:18px;height:18px;border-radius:50%;
        background:${city.supported ? '#1D6A4E' : '#C44B2A'};
        border:3px solid white;
        box-shadow:0 2px 6px rgba(0,0,0,0.2);
      "></div>`,
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    });
    markerRef.current = L.marker(city.center, { icon }).addTo(map);

    // For Pune, draw the study-area bounding box
    if (city.supported) {
      highlightRef.current = L.rectangle(PUNE_BBOX, {
        color: '#1D6A4E',
        weight: 2,
        fillColor: '#1D6A4E',
        fillOpacity: 0.06,
        dashArray: '6 4',
      }).addTo(map);
    }
  };

  const handleConfirm = () => {
    if (!selected || !selected.supported) return;
    navigate('/map');
  };

  const clearSelection = () => {
    setQuery('');
    setSelected(null);
    setSuggestions([]);
    if (markerRef.current) { markerRef.current.remove(); markerRef.current = null; }
    if (highlightRef.current) { highlightRef.current.remove(); highlightRef.current = null; }
  };

  return (
    <div style={{ background: 'rgba(3, 11, 20, 0.45)', minHeight: '100svh', position: 'relative', zIndex: 1 }}>
      <Header variant="landing" />

      <div className="location-page" style={{ paddingTop: 60 }}>
        {/* ── Sidebar ── */}
        <aside className="location-sidebar">
          <div>
            <h1 className="location-heading" style={{ marginBottom: 'var(--sp-3)' }}>
              Choose your location
            </h1>
            <p className="location-desc">
              Search for a city or region to explore climate vulnerabilities and build adaptation plans. Pune, Maharashtra, India is the current prototype region.
            </p>
          </div>

          {/* Search */}
          <div>
            <label className="form-label" htmlFor="city-search">Search city or region</label>
            <div className="location-search-wrap" style={{ position: 'relative' }}>
              <Search
                size={16}
                style={{ position: 'absolute', left: 'var(--sp-4)', top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-muted)', pointerEvents: 'none' }}
              />
              <input
                id="city-search"
                className="form-input"
                style={{ paddingLeft: '2.75rem', paddingRight: selected ? '2.5rem' : undefined }}
                type="text"
                placeholder="e.g. Pune, Maharashtra, India"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => suggestions.length && setShowSuggestions(true)}
                autoComplete="off"
              />
              {selected && (
                <button
                  onClick={clearSelection}
                  style={{ position: 'absolute', right: 'var(--sp-3)', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-muted)', padding: 0 }}
                  aria-label="Clear selection"
                >
                  <X size={15} />
                </button>
              )}

              {/* Suggestions dropdown */}
              {showSuggestions && suggestions.length > 0 && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0,
                  background: 'var(--surface)', borderRadius: 'var(--r-md)',
                  border: '1px solid var(--surface-3)',
                  zIndex: 100, marginTop: 4, overflow: 'hidden',
                }}>
                  {suggestions.map((city) => (
                    <button
                      key={city.name}
                      onClick={() => selectCity(city)}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        width: '100%', padding: 'var(--sp-3) var(--sp-4)',
                        background: 'none', border: 'none', cursor: 'pointer',
                        fontFamily: 'var(--font)', fontSize: 'var(--text-sm)',
                        color: 'var(--ink)', textAlign: 'left',
                        borderBottom: '1px solid var(--surface-3)',
                      }}
                      onMouseOver={(e) => e.currentTarget.style.background = 'var(--ground)'}
                      onMouseOut={(e) => e.currentTarget.style.background = 'none'}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
                        <MapPin size={13} style={{ color: city.supported ? 'var(--accent)' : 'var(--ink-muted)', flexShrink: 0 }} />
                        {city.name}
                      </span>
                      {city.supported
                        ? <span className="badge badge-green">Available</span>
                        : <span className="badge">Preview only</span>
                      }
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Selected result panel */}
          {selected && (
            <div className="location-result-panel">
              <div className="location-result-name">{selected.name}</div>
              <div className="location-result-meta">
                {selected.supported
                  ? 'Supported prototype region'
                  : 'Not available in this prototype'}
              </div>

              {selected.supported ? (
                <div className="location-result-notice">
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--sp-2)' }}>
                    <CheckCircle2 size={14} style={{ flexShrink: 0, marginTop: 2 }} />
                    <span>
                      Pune is the currently supported prototype region. Ward-level vulnerability data, drainage infrastructure, and adaptation planning are available.
                    </span>
                  </div>
                </div>
              ) : (
                <div className="location-not-supported">
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--sp-2)' }}>
                    <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 2 }} />
                    <span>
                      This location is not yet available in the prototype. Detailed climate data and adaptation planning are not available outside the Pune study area.
                    </span>
                  </div>
                </div>
              )}

              <button
                className="btn btn-primary btn-full"
                onClick={handleConfirm}
                disabled={!selected.supported}
                id="confirm-location"
              >
                Explore this area
                <ArrowRight size={16} />
              </button>
            </div>
          )}

          {/* Hint when nothing searched */}
          {!selected && (
            <div style={{ padding: 'var(--sp-5)', background: 'var(--surface)', borderRadius: 'var(--r-md)' }}>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-muted)', lineHeight: 1.6 }}>
                Try searching for <strong style={{ color: 'var(--ink)' }}>Pune</strong> to start exploring the prototype. Additional cities will be supported in future versions.
              </p>
            </div>
          )}

          <div style={{ marginTop: 'auto', paddingTop: 'var(--sp-6)' }}>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-muted)', lineHeight: 1.6 }}>
              Map data: © OpenStreetMap contributors. City search uses a local list of cities — no geocoding API key required for the prototype.
            </p>
          </div>
        </aside>

        {/* ── Map ── */}
        <div className="location-map-area">
          <div
            ref={mapRef}
            style={{ width: '100%', height: '100%' }}
            id="location-leaflet-map"
          />
        </div>
      </div>
    </div>
  );
}
