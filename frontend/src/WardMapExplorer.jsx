import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import {
  Layers, RotateCcw, Info, CheckCircle2, ShieldAlert,
  Sparkles, X, ArrowRight, Flame, Waves, Droplets, TreePine,
  Thermometer, Wind, ChevronRight, ChevronLeft, ChevronDown, Activity,
  Heart, MapPin, CloudRain, Plus, Home, HardDrive, Folder, CheckSquare,
  Search, SlidersHorizontal, BarChart3,
} from 'lucide-react';

const API_BASE = '';

/* ── Palette: Climaid Brand + 3D Isometric GIS Layers ── */
const P = {
  brandBlue: '#00669E',
  riverBlue: '#0284C7',
  cyanWater: '#38BDF8',
  brandGreen: '#22C55E',
  foliage: '#16A34A',
  purpleRisk: '#8B5CF6',
  amberHeat: '#F59E0B',
  high: '#EF4444',
  mid: '#F59E0B',
  teal: '#0284C7',
  pastel: '#93C5FD',
  silver: '#E2E8F0',
  none: '#334155',
};

const PILOT_BOUNDS = [[18.44, 73.77], [18.63, 73.96]];
const PUNE_CENTER = [18.535, 73.855];

/* ── Choropleth colour matching the 4 GIS layers ───────────────── */
export function getChoroplethColor(v) {
  if (v == null || isNaN(v)) return P.none;
  if (v >= 75) return '#EF4444'; // Critical Concern (Red)
  if (v >= 60) return '#F59E0B'; // Moderate Concern (Amber / Layer 1)
  if (v >= 45) return '#0284C7'; // Some Concern (River Blue / Layer 2)
  return '#22C55E';             // Lower Concern (Lush Green / Layer 3)
}

/* ── Metric config ─────────────────────────────────────────────── */
export const METRIC_CONFIG = {
  composite: { label: 'Composite Vulnerability', shortLabel: 'Composite', icon: Sparkles, color: '#22C55E', desc: 'Weighted multi-factor screening: heat, drainage, water, green deficit.' },
  heat: { label: 'Heat Exposure', shortLabel: 'Heat', icon: Flame, color: '#F59E0B', desc: 'Surface temperature anomaly proxy from satellite thermals and building density.' },
  flood: { label: 'Flood & Drainage', shortLabel: 'Flood', icon: Waves, color: '#0284C7', desc: 'Runoff deficit proxy from stormwater inlet records and nalla proximity.' },
  water: { label: 'Water Stress', shortLabel: 'Water', icon: Droplets, color: '#38BDF8', desc: 'Supply pressure proxy from pipeline network and population density.' },
  green: { label: 'Green-Space Deficit', shortLabel: 'Green', icon: TreePine, color: '#16A34A', desc: 'Ecological gap: civic parks and mapped trees vs. ward population.' },
};

/* ── SVG div-icons for Leaflet ─────────────────────────────────── */
const makeIcon = (html, size = 20) => L.divIcon({ html, className: '', iconSize: [size, size], iconAnchor: [size / 2, size / 2] });

const TREE_ICON = makeIcon(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#22C55E" stroke="#14532D" stroke-width="1.5"><path d="M12 22v-7"/><path d="M9 12H5l7-10 7 10h-4"/><path d="M9 17h6"/></svg>`, 18);
const HEALTH_ICON = makeIcon(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#EF4444" stroke="white" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="4"/><path d="M12 7v10M7 12h10" stroke="white" stroke-width="2.5" stroke-linecap="round"/></svg>`, 18);
const PARK_ICON = makeIcon(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#16A34A" stroke="#86EFAC" stroke-width="1"><circle cx="12" cy="12" r="10"/><path d="M8 15s1.5 2 4 2 4-2 4-2" stroke="white" stroke-width="1.5" stroke-linecap="round" fill="none"/><circle cx="9" cy="10" r="1.5" fill="white"/><circle cx="15" cy="10" r="1.5" fill="white"/></svg>`, 16);

/* ── Vulnerability label ───────────────────────────────────────── */
function vulnLabel(s) {
  if (s >= 75) return { text: 'Higher Concern', color: '#EF4444' };
  if (s >= 60) return { text: 'Moderate Concern', color: '#F59E0B' };
  if (s >= 45) return { text: 'Some Concern', color: '#0284C7' };
  return { text: 'Lower Concern', color: '#22C55E' };
}

/* ── Contributing factors ──────────────────────────────────────── */
function getFactors(ward) {
  if (!ward) return [];
  const f = [];
  const swd = ward.evidence?.stormwater_drain_coverage_pct ?? 0;
  const heat = ward.indicators?.heat_exposure_proxy ?? 0;
  const water = ward.indicators?.water_stress_proxy ?? 0;
  const green = ward.indicators?.green_deficit_proxy ?? 0;
  const flood = ward.indicators?.flood_screening_proxy ?? 0;
  const temp = ward.evidence?.forecast_max_temp_c ?? null;
  if (swd < 30) f.push({ icon: Waves, color: '#0284C7', text: `Only ${swd.toFixed(1)}% stormwater drain coverage — elevated flash-runoff risk.` });
  if (heat >= 60) f.push({ icon: Flame, color: '#F59E0B', text: `High heat proxy (${heat}/100) — dense built-surface thermal absorption.` });
  if (water >= 60) f.push({ icon: Droplets, color: '#38BDF8', text: `Water supply stress (${water}/100) — distribution network sensitivity.` });
  if (green >= 60) f.push({ icon: TreePine, color: '#22C55E', text: `Canopy deficit (${green}/100) — reduced natural cooling buffer.` });
  if (flood >= 70) f.push({ icon: CloudRain, color: '#0284C7', text: `Drainage deficit score (${flood}/100) — stormwater system overload risk.` });
  if (temp != null && temp > 36)
    f.push({ icon: Thermometer, color: '#EF4444', text: `Forecast peak ${temp.toFixed(1)}°C — urban heat island compounding factor.` });
  if (!f.length) f.push({ icon: CheckCircle2, color: '#22C55E', text: `Moderate baseline. SWD: ${swd.toFixed(1)}%. Balanced municipal indicator profile.` });
  return f;
}

/* ── Layer definitions matching the 3D isometric stack ──────────── */
const LAYER_DEFS = [
  { key: 'wards', label: 'Ward boundaries', color: '#E2E8F0', icon: MapPin, desc: '76 electoral wards' },
  { key: 'nallas', label: 'Drainage nallas', color: '#0284C7', icon: Waves, desc: 'Natural channels' },
  { key: 'chambers', label: 'Stormwater inlets', color: '#8B5CF6', icon: Droplets, desc: '1,532 SWD chambers' },
  { key: 'waterbodies', label: 'Rivers & water', color: '#38BDF8', icon: Droplets, desc: 'PMC official data' },
  { key: 'parks', label: 'Parks & gardens', color: '#22C55E', icon: TreePine, desc: 'OSM civic green' },
  { key: 'hospitals', label: 'Healthcare', color: '#EF4444', icon: Heart, desc: 'OSM medical facilities' },
  { key: 'trees', label: 'Canopy trees', color: '#16A34A', icon: TreePine, desc: '5.7k mapped trees' },
  { key: 'pipes', label: 'SWD pipe network', color: '#A855F7', icon: Activity, desc: 'Viewport-loaded' },
];

/* ── Animated progress bar ─────────────────────────────────────── */
function AnimBar({ value, color, delay = 0 }) {
  const [w, setW] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setW(Math.min(100, Math.max(0, value))), 80 + delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return (
    <div style={{ width: '100%', height: 5, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' }}>
      <div style={{ width: `${w}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 700ms cubic-bezier(0.22,1,0.36,1)' }} />
    </div>
  );
}

/* ── Humidity ring ─────────────────────────────────────────────── */
function HumidityRing({ pct }) {
  const r = 18, circ = 2 * Math.PI * r, s = Math.min(100, Math.max(0, pct));
  return (
    <svg width={48} height={48} viewBox="0 0 48 48">
      <circle cx={24} cy={24} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={5} />
      <circle cx={24} cy={24} r={r} fill="none" stroke={P.teal} strokeWidth={5}
        strokeDasharray={`${(s / 100) * circ} ${circ}`} strokeLinecap="round"
        transform="rotate(-90 24 24)" style={{ transition: 'stroke-dasharray 900ms ease' }} />
      <text x={24} y={28} textAnchor="middle" fontSize={10} fill={P.pastel} fontWeight={700}>{Math.round(pct)}%</text>
    </svg>
  );
}

/* ── Temperature sparkline ─────────────────────────────────────── */
function TempSparkline({ data }) {
  if (!data || data.length < 2) return null;
  const maxT = Math.max(...data.map(d => d.temperature_2m_max));
  const minT = Math.min(...data.map(d => d.temperature_2m_min));
  const range = maxT - minT || 1;
  const W = 110, H = 34;
  const pts = data.map((d, i) => {
    const x = (i / (data.length - 1)) * W;
    const y = H - ((d.temperature_2m_max - minT) / range) * (H - 4) - 2;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={W} height={H} style={{ display: 'block', flexShrink: 0 }}>
      <polyline points={pts} fill="none" stroke="#F87171" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {data.map((d, i) => {
        const x = (i / (data.length - 1)) * W;
        const y = H - ((d.temperature_2m_max - minT) / range) * (H - 4) - 2;
        return <circle key={i} cx={x} cy={y} r={2.5} fill="#F87171" />;
      })}
    </svg>
  );
}
/* ── Hover HUD vulnerability badge ────────────────────────────── */
function HudVulnBadge({ ward }) {
  const comp = ward?.indicators?.composite_vulnerability_score ?? 0;
  const vl = vulnLabel(comp);
  return (
    <span style={{ fontSize: '0.66rem', fontWeight: 700, padding: '2px 8px', borderRadius: 12, background: `${vl.color}20`, border: `1px solid ${vl.color}55`, color: vl.color }}>
      {vl.text} · {comp}/100
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════ */
export default function WardMapExplorer({ wardData = [], selectedWard, onSelectWard, onClearWard }) {
  const navigate = useNavigate();
  const mapRef = useRef(null);
  const mapInst = useRef(null);
  const lgRef = useRef({});
  const canvas = useRef(null);
  const cache = useRef({});

  const [layers, setLayers] = useState({ wards: true, nallas: true, chambers: true, waterbodies: true, parks: false, hospitals: false, trees: false, pipes: false });
  const [loadingL, setLoadingL] = useState({});
  const [metric, setMetric] = useState('composite');
  const [zoom, setZoom] = useState(12);
  const [weather, setWeather] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [hoveredWard, setHoveredWard] = useState(null);
  const [showWardList, setShowWardList] = useState(false);
  const [wardSearch, setWardSearch] = useState('');
  const [sidebarTab, setSidebarTab] = useState(selectedWard ? 'ward' : 'layers');
  const [layersExpanded, setLayersExpanded] = useState(true);
  const [metricsExpanded, setMetricsExpanded] = useState(true);
  const activeHoverLayerRef = useRef(null);
  const geoJsonWardsRef = useRef(null);
  const selectedWardRef = useRef(selectedWard);
  const wardLookupRef = useRef(null);
  const metricRef = useRef(metric);
  const getValRef = useRef(null);

  useEffect(() => { selectedWardRef.current = selectedWard; }, [selectedWard]);
  useEffect(() => { metricRef.current = metric; }, [metric]);

  useEffect(() => {
    if (selectedWard) {
      setSidebarTab('ward');
    }
  }, [selectedWard]);

  /* Ward lookup */
  const wardLookup = useMemo(() => {
    const m = new Map();
    wardData.forEach(w => w.ward_num != null && m.set(Number(w.ward_num), w));
    return m;
  }, [wardData]);

  /* City-wide stats */
  const stats = useMemo(() => {
    if (!wardData.length) return null;
    const avg = arr => arr.reduce((a, b) => a + b, 0) / arr.length;
    const scores = wardData.map(w => w.indicators?.composite_vulnerability_score ?? 0);
    const temps = wardData.map(w => w.evidence?.forecast_max_temp_c ?? 0).filter(Boolean);
    const high = wardData.filter(w => (w.indicators?.composite_vulnerability_score ?? 0) >= 75).length;
    const mid = wardData.filter(w => { const s = w.indicators?.composite_vulnerability_score ?? 0; return s >= 60 && s < 75; }).length;
    return {
      avgComp: avg(scores).toFixed(1),
      avgHeat: avg(wardData.map(w => w.indicators?.heat_exposure_proxy ?? 0)).toFixed(1),
      avgFlood: avg(wardData.map(w => w.indicators?.flood_screening_proxy ?? 0)).toFixed(1),
      avgWater: avg(wardData.map(w => w.indicators?.water_stress_proxy ?? 0)).toFixed(1),
      avgGreen: avg(wardData.map(w => w.indicators?.green_deficit_proxy ?? 0)).toFixed(1),
      avgTemp: temps.length ? avg(temps).toFixed(1) : 'N/A',
      high, mid, low: wardData.length - high - mid, total: wardData.length,
    };
  }, [wardData]);

  /* Metric accessor */
  const getVal = useCallback((w, m) => {
    if (!w?.indicators) return 0;
    return { heat: w.indicators.heat_exposure_proxy, flood: w.indicators.flood_screening_proxy, water: w.indicators.water_stress_proxy, green: w.indicators.green_deficit_proxy }[m] ?? w.indicators.composite_vulnerability_score;
  }, []);

  /* Fetch weather once */
  useEffect(() => {
    fetch(`${API_BASE}/api/weather`).then(r => r.json()).then(setWeather).catch(() => { });
  }, []);

  useEffect(() => { wardLookupRef.current = wardLookup; }, [wardLookup]);
  useEffect(() => { getValRef.current = getVal; }, [getVal]);

  /* ResizeObserver: keep Leaflet informed of container size changes */
  useEffect(() => {
    if (!mapRef.current) return;
    const ro = new ResizeObserver(() => {
      if (mapInst.current) mapInst.current.invalidateSize({ animate: false });
    });
    ro.observe(mapRef.current);
    return () => ro.disconnect();
  }, []);

  /* Inject Leaflet tooltip CSS into <head> to eliminate dragging trails and ghost containers */
  useEffect(() => {
    const id = 'climaid-tt-styles';
    if (document.getElementById(id)) return;
    const s = document.createElement('style');
    s.id = id;
    s.textContent = `
      .leaflet-tooltip,
      .leaflet-tooltip.climaid-tt,
      .leaflet-tooltip.map-tt,
      .leaflet-zoom-animated.leaflet-tooltip,
      .leaflet-pane .leaflet-tooltip {
        background: transparent !important;
        border: none !important;
        padding: 0 !important;
        color: #CEE5D6 !important;
        box-shadow: none !important;
        font-family: 'Inter', sans-serif !important;
        pointer-events: none !important;
        white-space: normal !important;
        transition: none !important;
        -webkit-transition: none !important;
        -moz-transition: none !important;
        animation: none !important;
      }
      .leaflet-tooltip::before { display: none !important; }
      .leaflet-tooltip * { pointer-events: none !important; }
    `;
    document.head.appendChild(s);
    return () => { document.getElementById(id)?.remove(); };
  }, []);

  /* ── 1. Init Leaflet (Mount once) ───────────────────────────── */
  useEffect(() => {
    if (!mapRef.current || mapInst.current) return;
    const map = L.map(mapRef.current, { center: PUNE_CENTER, zoom: 12, minZoom: 11, maxZoom: 18, zoomControl: false });
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { attribution: '&copy; OSM &copy; CARTO', maxZoom: 19, subdomains: 'abcd' }).addTo(map);
    L.rectangle(PILOT_BOUNDS, { color: P.teal, weight: 1.5, dashArray: '6 5', fillOpacity: 0.02, interactive: false }).addTo(map);
    canvas.current = L.canvas({ padding: 0.5 });
    map.on('zoomend', () => setZoom(map.getZoom()));

    map.on('mouseout', () => {
      if (geoJsonWardsRef.current) {
        geoJsonWardsRef.current.eachLayer((other) => {
          const otherWnum = other._wardNum;
          const isSel = selectedWardRef.current && Number(selectedWardRef.current.ward_num) === otherWnum;
          if (!isSel) {
            const otherWi = wardLookupRef.current?.get(otherWnum);
            const valFn = getValRef.current;
            const m = metricRef.current;
            other.setStyle({
              fillColor: getChoroplethColor(otherWi && valFn ? valFn(otherWi, m) : 0),
              fillOpacity: 0.50,
              weight: 1.2,
              color: P.teal,
              opacity: 0.9,
            });
          }
          other.closeTooltip();
        });
      }
      if (activeHoverLayerRef.current) {
        activeHoverLayerRef.current.closeTooltip();
        activeHoverLayerRef.current = null;
      }
      map.closeTooltip();
      setHoveredWard(null);
    });

    mapInst.current = map;
    // Force Leaflet to recalculate container size after flex layout settles
    const t1 = setTimeout(() => { map.invalidateSize({ animate: false }); }, 100);
    const t2 = setTimeout(() => { map.invalidateSize({ animate: false }); }, 400);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      map.remove();
      mapInst.current = null;
    };
  }, []);

  /* ── 2. GeoJSON fetch/cache ──────────────────────────────────── */
  const fetchLayer = useCallback(async (key, ep) => {
    if (cache.current[key]) return cache.current[key];
    setLoadingL(p => ({ ...p, [key]: true }));
    try {
      const r = await fetch(`${API_BASE}/api/map-layers/${ep}`);
      if (!r.ok) throw new Error();
      const d = await r.json();
      cache.current[key] = d;
      setLoadingL(p => ({ ...p, [key]: false }));
      return d;
    } catch { setLoadingL(p => ({ ...p, [key]: false })); return null; }
  }, []);

  /* Helper to remove old layer */
  const removeL = (key) => {
    if (lgRef.current[key]) { mapInst.current?.removeLayer(lgRef.current[key]); lgRef.current[key] = null; }
    if (key === 'wards') { geoJsonWardsRef.current = null; }
  };

  /* ── 3. Ward choropleth ──────────────────────────────────────── */
  useEffect(() => {
    const map = mapInst.current; if (!map) return;
    if (!layers.wards) { removeL('wards'); return; }

    // If wards layer already exists, update polygon styles immediately without refetching
    if (geoJsonWardsRef.current) {
      geoJsonWardsRef.current.eachLayer((layer) => {
        const wnum = layer._wardNum;
        const wi = wardLookup.get(wnum);
        const val = wi ? getVal(wi, metric) : 0;
        const sel = selectedWard && Number(selectedWard.ward_num) === wnum;
        layer.setStyle({
          fillColor: getChoroplethColor(val),
          fillOpacity: sel ? 0.82 : 0.50,
          color: sel ? P.silver : P.teal,
          weight: sel ? 3 : 1.2,
          opacity: sel ? 1 : 0.9
        });
      });
      return;
    }

    let alive = true;
    (async () => {
      const data = await fetchLayer('wards', 'pune-electoral-wards');
      if (!data || !alive || !mapInst.current) return;
      removeL('wards');

      const wl = L.geoJSON(data, {
        style: (f) => {
          const p = f.properties || {};
          const wnum = Number(p.wardnum || p.ward_no || String(p.name || '').replace(/\D/g, ''));
          const wi = wardLookup.get(wnum);
          const val = wi ? getVal(wi, metric) : 0;
          const sel = selectedWard && Number(selectedWard.ward_num) === wnum;
          return { fillColor: getChoroplethColor(val), fillOpacity: sel ? 0.82 : 0.50, color: sel ? P.silver : P.teal, weight: sel ? 3 : 1.2, opacity: sel ? 1 : 0.9 };
        },
        onEachFeature: (f, layer) => {
          const p = f.properties || {};
          const wnum = Number(p.wardnum || p.ward_no || String(p.name || '').replace(/\D/g, ''));
          const wi = wardLookup.get(wnum);
          const title = wi?.ward_title || p.name || `Ward ${wnum}`;
          const comp = wi?.indicators?.composite_vulnerability_score ?? 0;
          const vl = vulnLabel(comp);
          const score = wi ? getVal(wi, metric) : 0;
          const swd = wi?.evidence?.stormwater_drain_coverage_pct ?? 0;
          const heat = wi?.indicators?.heat_exposure_proxy ?? 0;
          const flood = wi?.indicators?.flood_screening_proxy ?? 0;
          const temp = wi?.evidence?.forecast_max_temp_c ?? null;

          const wardItem = wi || {
            ward_num: wnum,
            ward_title: title,
            area_zone: p.area_zone || 'Pune Administrative Zone',
            indicators: { composite_vulnerability_score: comp, heat_exposure_proxy: heat, flood_screening_proxy: flood, water_stress_proxy: 50, green_deficit_proxy: 50 },
            evidence: { stormwater_drain_coverage_pct: swd, forecast_max_temp_c: temp }
          };

          const factors = getFactors(wardItem);
          const primeReason = factors[0]?.text || 'Moderate baseline risk screening profile.';

          const ttip = `
          <div style="background:#040D1A;border:1px solid #307B8E;border-radius:8px;padding:10px 12px;font-family:'Inter',sans-serif;min-width:210px;max-width:270px;box-shadow:0 8px 24px rgba(0,0,0,0.85);color:#CEE5D6;pointer-events:none;">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
              <span style="font-size:10px;font-weight:700;letter-spacing:0.08em;color:#307B8E;text-transform:uppercase;">Ward #${wnum}</span>
              <span style="font-size:9px;font-weight:700;padding:2px 6px;border-radius:10px;border:1px solid ${vl.color}50;background:${vl.color}20;color:${vl.color};">${vl.text}</span>
            </div>
            <div style="font-size:12px;font-weight:700;color:#FFFFFF;margin-bottom:6px;line-height:1.3;">${title}</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-bottom:6px;">
              <div style="background:#103A5740;border-radius:4px;padding:3px 6px;font-size:10px;color:#A9D3C5;display:flex;justify-content:space-between;"><span>Composite</span><strong style="color:#FFF;">${comp}</strong></div>
              <div style="background:#103A5740;border-radius:4px;padding:3px 6px;font-size:10px;color:#A9D3C5;display:flex;justify-content:space-between;"><span>${METRIC_CONFIG[metric]?.shortLabel}</span><strong style="color:#FFF;">${typeof score === 'number' ? score.toFixed(1) : score}</strong></div>
            </div>
            <div style="font-size:10px;line-height:1.4;color:#CEE5D6;border-top:1px solid #103A5780;padding-top:5px;margin-bottom:5px;">
              <span style="color:#F59E0B;font-weight:600;">Key Reason: </span>${primeReason}
            </div>
            ${temp != null ? `<div style="font-size:10px;color:#F87171;margin-bottom:4px;">📡 Forecast max: ${temp.toFixed(1)}°C</div>` : ''}
            <div style="font-size:9px;color:#64748B;font-style:italic;">Click ward for full action planning</div>
          </div>`;

          layer._wardNum = wnum;
          layer._wardItem = wardItem;

          layer.bindTooltip(ttip, {
            sticky: false,
            direction: 'auto',
            className: 'climaid-tt map-tt',
            offset: [0, 0]
          });

          layer.on({
            mouseover: (e) => {
              // Immediately reset all other polygons and close any lingering tooltips across the entire GeoJSON layer
              if (geoJsonWardsRef.current) {
                geoJsonWardsRef.current.eachLayer((other) => {
                  if (other !== e.target) {
                    const otherWnum = other._wardNum;
                    const isSel = selectedWard && Number(selectedWard.ward_num) === otherWnum;
                    if (!isSel) {
                      const otherWi = wardLookup.get(otherWnum);
                      other.setStyle({
                        fillColor: getChoroplethColor(otherWi ? getVal(otherWi, metric) : 0),
                        fillOpacity: 0.50,
                        weight: 1.2,
                        color: P.teal,
                        opacity: 0.9,
                      });
                    }
                    other.closeTooltip();
                  }
                });
              }
              if (mapInst.current) {
                mapInst.current.closeTooltip();
              }

              activeHoverLayerRef.current = e.target;
              setHoveredWard(wardItem);
              if (!selectedWard || Number(selectedWard.ward_num) !== wnum) {
                e.target.setStyle({ fillOpacity: 0.85, weight: 2.8, color: '#FFFFFF' });
              }
            },
            mouseout: (e) => {
              if (activeHoverLayerRef.current === e.target) {
                activeHoverLayerRef.current = null;
              }
              e.target.closeTooltip();
              setHoveredWard(curr => (curr?.ward_num === wnum ? null : curr));
              const sel = selectedWard && Number(selectedWard.ward_num) === wnum;
              if (!sel) {
                e.target.setStyle({
                  fillColor: getChoroplethColor(wi ? getVal(wi, metric) : 0),
                  fillOpacity: 0.50,
                  weight: 1.2,
                  color: P.teal,
                  opacity: 0.9
                });
              }
            },
            click: () => {
              onSelectWard?.(wardItem);
              try { sessionStorage.setItem('climaid_selected_ward', String(wardItem.ward_num)); } catch { }
              setDetailOpen(true);
            },
          });
        },
      });
      geoJsonWardsRef.current = wl;
      wl.addTo(mapInst.current);
      lgRef.current.wards = wl;
    })();
    return () => { alive = false; };
  }, [layers.wards, metric, wardLookup, selectedWard, getVal, fetchLayer]);

  /* ── 4-10. Other layers ──────────────────────────────────────── */
  /* Nallas */
  useEffect(() => {
    const map = mapInst.current; if (!map) return;
    if (!layers.nallas) { removeL('nallas'); return; }
    let a = true;
    (async () => {
      const d = await fetchLayer('nallas', 'nallas'); if (!d || !a || !mapInst.current) return;
      removeL('nallas');
      const l = L.geoJSON(d, { style: { color: '#0284C7', weight: 2, opacity: 0.85 }, onEachFeature: (f, l) => l.bindTooltip(`<strong>${f.properties?.name || 'Natural Nalla'}</strong><br/><span style="color:#93C5FD">Natural Drainage Channel</span>`, { sticky: false }) });
      l.addTo(mapInst.current); lgRef.current.nallas = l;
    })();
    return () => { a = false; };
  }, [layers.nallas, fetchLayer]);

  /* Chambers */
  useEffect(() => {
    const map = mapInst.current; if (!map) return;
    if (!layers.chambers) { removeL('chambers'); return; }
    let a = true;
    (async () => {
      const d = await fetchLayer('chambers', 'swd-chambers'); if (!d || !a || !mapInst.current) return;
      removeL('chambers');
      const l = L.geoJSON(d, { pointToLayer: (f, ll) => L.circleMarker(ll, { radius: 3.5, fillColor: '#8B5CF6', color: '#6D28D9', weight: 1, fillOpacity: 0.85, renderer: canvas.current }), onEachFeature: (f, l) => l.bindTooltip(`<strong>${f.properties?.name || 'SWD Inlet'}</strong><br/><span style="color:#C4B5FD">Stormwater Chamber</span>`, { sticky: false }) });
      l.addTo(mapInst.current); lgRef.current.chambers = l;
    })();
    return () => { a = false; };
  }, [layers.chambers, fetchLayer]);

  /* Waterbodies */
  useEffect(() => {
    const map = mapInst.current; if (!map) return;
    if (!layers.waterbodies) { removeL('waterbodies'); return; }
    let a = true;
    (async () => {
      const d = await fetchLayer('waterbodies', 'waterbodies-official'); if (!d || !a || !mapInst.current) return;
      removeL('waterbodies');
      const l = L.geoJSON(d, { style: { fillColor: '#0284C7', fillOpacity: 0.6, color: '#38BDF8', weight: 1.5 }, onEachFeature: (f, l) => l.bindTooltip(`<strong>${f.properties?.name || 'River'}</strong><br/><span style="color:#93C5FD">PMC Water Feature</span>`, { sticky: false }) });
      l.addTo(mapInst.current); lgRef.current.waterbodies = l;
    })();
    return () => { a = false; };
  }, [layers.waterbodies, fetchLayer]);

  /* Parks */
  useEffect(() => {
    const map = mapInst.current; if (!map) return;
    if (!layers.parks) { removeL('parks'); return; }
    let a = true;
    (async () => {
      const d = await fetchLayer('parks', 'parks'); if (!d || !a || !mapInst.current) return;
      removeL('parks');
      const l = L.geoJSON(d, { pointToLayer: (f, ll) => L.marker(ll, { icon: PARK_ICON }), style: { fillColor: '#22C55E', fillOpacity: 0.5, color: '#86EFAC', weight: 1.5 }, onEachFeature: (f, l) => l.bindTooltip(`<strong>${f.properties?.name || 'Civic Park'}</strong><br/><span style="color:#BBF7D0">Public Green Space</span>`, { sticky: false }) });
      l.addTo(mapInst.current); lgRef.current.parks = l;
    })();
    return () => { a = false; };
  }, [layers.parks, fetchLayer]);

  /* Hospitals */
  useEffect(() => {
    const map = mapInst.current; if (!map) return;
    if (!layers.hospitals) { removeL('hospitals'); return; }
    let a = true;
    (async () => {
      const d = await fetchLayer('hospitals', 'hospitals'); if (!d || !a || !mapInst.current) return;
      removeL('hospitals');
      const l = L.geoJSON(d, { pointToLayer: (f, ll) => L.marker(ll, { icon: HEALTH_ICON }), onEachFeature: (f, l) => l.bindTooltip(`<strong>${f.properties?.name || 'Healthcare'}</strong><br/><span style="color:#FECACA">Medical Centre</span>`, { sticky: false }) });
      l.addTo(mapInst.current); lgRef.current.hospitals = l;
    })();
    return () => { a = false; };
  }, [layers.hospitals, fetchLayer]);

  /* Trees */
  useEffect(() => {
    const map = mapInst.current; if (!map) return;
    if (!layers.trees) { removeL('trees'); return; }
    let a = true;
    (async () => {
      const d = await fetchLayer('trees', 'trees'); if (!d || !a || !mapInst.current) return;
      removeL('trees');
      const useIcon = zoom >= 15;
      const l = L.geoJSON(d, {
        pointToLayer: (f, ll) => useIcon ? L.marker(ll, { icon: TREE_ICON }) : L.circleMarker(ll, { radius: 2.5, fillColor: '#16A34A', color: '#22C55E', weight: 0.5, fillOpacity: 0.8, renderer: canvas.current }),
        onEachFeature: (f, l) => l.bindTooltip(`<strong>${f.properties?.species || 'Urban Tree'}</strong><br/><span style="color:#BBF7D0">Mapped Canopy Asset</span>`, { sticky: false }),
      });
      l.addTo(mapInst.current); lgRef.current.trees = l;
    })();
    return () => { a = false; };
  }, [layers.trees, zoom, fetchLayer]);

  /* Pipes (viewport-gated) */
  useEffect(() => {
    const map = mapInst.current; if (!map) return;
    if (!layers.pipes) { removeL('pipes'); return; }
    if (zoom < 13) return;
    let a = true; let abort = new AbortController();
    const load = async () => {
      if (!mapInst.current) return;
      const b = mapInst.current.getBounds();
      const bbox = `${b.getWest().toFixed(4)},${b.getSouth().toFixed(4)},${b.getEast().toFixed(4)},${b.getNorth().toFixed(4)}`;
      try {
        const r = await fetch(`${API_BASE}/api/map-layers/swd-pipes?bbox=${bbox}&limit=3500`, { signal: abort.signal });
        if (!r.ok) throw new Error();
        const d = await r.json();
        if (!d || !a || !mapInst.current) return;
        removeL('pipes');
        const l = L.geoJSON(d, { renderer: canvas.current, style: { color: '#A855F7', weight: 1.5, opacity: 0.7 }, onEachFeature: (f, l) => l.bindTooltip(`<strong>SWD Pipe</strong><br/><span style="color:#E9D5FF">${f.properties?.diameter || 'Municipal Drain'}</span>`, { sticky: false }) });
        l.addTo(mapInst.current); lgRef.current.pipes = l;
      } catch { }
    };
    load();
    const onMove = () => { if (layers.pipes && mapInst.current?.getZoom() >= 13) load(); };
    map.on('moveend', onMove);
    return () => { a = false; abort.abort(); map.off('moveend', onMove); };
  }, [layers.pipes, zoom, fetchLayer]);

  const resetView = () => mapInst.current?.fitBounds(PILOT_BOUNDS, { padding: [24, 24] });
  const cfg = METRIC_CONFIG[metric];
  const cur = weather?.current;
  const daily = weather?.daily_forecast || [];

  /* ═══ RENDER ═════════════════════════════════════════════════ */
  return (
    <div style={{ display: 'flex', flex: 1, alignSelf: 'stretch', minHeight: 0, minWidth: 0, background: '#030B14', position: 'relative', overflow: 'hidden' }}>

      {/* ══ SPACIOUS 40% CLIMAID SIDEBAR ════════════════════════════ */}
      <aside style={{
        width: '40%',
        minWidth: 380,
        maxWidth: 480,
        flexShrink: 0,
        height: '100%',
        background: '#040D1A',
        borderRight: '1px solid rgba(0, 102, 158, 0.28)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 500,
      }}>
        {/* ── Fixed Header ── */}
        <div style={{
          padding: '16px 18px 12px',
          borderBottom: '1px solid rgba(0, 102, 158, 0.22)',
          background: 'rgba(6, 18, 30, 0.95)',
          flexShrink: 0,
        }}>
          {/* Logo & title row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <img src="/images/climaid_logo.png" alt="Climaid" style={{ width: 30, height: 30, objectFit: 'contain' }} />
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: '0.92rem', fontWeight: 800, color: '#FFFFFF', letterSpacing: '0.02em' }}>CLIMAID</span>
                  <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: 'rgba(34,197,94,0.15)', color: '#22C55E', border: '1px solid rgba(34,197,94,0.3)' }}>PUNE</span>
                </div>
                <div style={{ fontSize: '0.7rem', color: '#94A3B8' }}>Ward Climate Vulnerability Explorer</div>
              </div>
            </div>
            <button
              onClick={resetView}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '5px 10px', borderRadius: 6,
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
                color: '#94A3B8', fontSize: '0.72rem', cursor: 'pointer', transition: 'all 150ms ease',
              }}
              title="Reset map view to Pune"
              onMouseEnter={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = '#0284C7'; }}
              onMouseLeave={e => { e.currentTarget.style.color = '#94A3B8'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; }}
            >
              <RotateCcw size={12} />
              <span>Reset</span>
            </button>
          </div>

          {/* Quick Browse / Search button */}
          <button
            onClick={() => setShowWardList(true)}
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: 8,
              background: 'rgba(0, 102, 158, 0.15)',
              border: '1px solid rgba(0, 102, 158, 0.35)',
              color: '#E2E8F0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontFamily: 'var(--font)',
              fontSize: '0.78rem',
              cursor: 'pointer',
              marginBottom: 12,
              transition: 'all 150ms ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0, 102, 158, 0.28)'; e.currentTarget.style.borderColor = '#38BDF8'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0, 102, 158, 0.15)'; e.currentTarget.style.borderColor = 'rgba(0, 102, 158, 0.35)'; }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Search size={14} style={{ color: '#38BDF8' }} />
              <span>{selectedWard ? `Selected: Ward #${selectedWard.ward_num} - ${selectedWard.ward_title || ''}` : 'Search or browse all 76 wards...'}</span>
            </div>
            <span style={{ fontSize: '0.68rem', color: '#38BDF8', fontWeight: 600 }}>Browse →</span>
          </button>

          {/* Two Navigation Tabs */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, background: 'rgba(2, 6, 14, 0.6)', padding: 3, borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)' }}>
            <button
              onClick={() => setSidebarTab('ward')}
              style={{
                padding: '7px 10px',
                borderRadius: 6,
                border: 'none',
                background: sidebarTab === 'ward' ? 'rgba(34, 197, 94, 0.2)' : 'transparent',
                color: sidebarTab === 'ward' ? '#FFFFFF' : '#94A3B8',
                fontWeight: sidebarTab === 'ward' ? 700 : 500,
                fontSize: '0.76rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                transition: 'all 150ms ease',
              }}
            >
              <MapPin size={13} style={{ color: sidebarTab === 'ward' ? '#22C55E' : '#64748B' }} />
              <span>Ward Details</span>
              {selectedWard && (
                <span style={{ fontSize: '0.62rem', background: '#22C55E', color: '#030B14', padding: '1px 5px', borderRadius: 10, fontWeight: 800 }}>
                  #{selectedWard.ward_num}
                </span>
              )}
            </button>

            <button
              onClick={() => setSidebarTab('layers')}
              style={{
                padding: '7px 10px',
                borderRadius: 6,
                border: 'none',
                background: sidebarTab === 'layers' ? 'rgba(2, 132, 199, 0.22)' : 'transparent',
                color: sidebarTab === 'layers' ? '#FFFFFF' : '#94A3B8',
                fontWeight: sidebarTab === 'layers' ? 700 : 500,
                fontSize: '0.76rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                transition: 'all 150ms ease',
              }}
            >
              <Layers size={13} style={{ color: sidebarTab === 'layers' ? '#38BDF8' : '#64748B' }} />
              <span>Map &amp; Layers</span>
            </button>
          </div>
        </div>

        {/* ── Scrollable Body ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {sidebarTab === 'ward' ? (
            /* ══ TAB 1: WARD DETAILS ══ */
            selectedWard ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* Ward title card */}
                <div style={{
                  padding: '12px 14px',
                  borderRadius: 10,
                  background: 'rgba(0, 102, 158, 0.12)',
                  border: '1px solid rgba(0, 102, 158, 0.3)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#38BDF8' }}>
                      Ward #{selectedWard.ward_num}
                    </span>
                    <button
                      onClick={() => onClearWard?.()}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#94A3B8',
                        cursor: 'pointer',
                        fontSize: '0.7rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 3,
                        padding: 0,
                      }}
                      title="Clear ward selection"
                    >
                      <X size={12} /> Clear
                    </button>
                  </div>
                  <h3 style={{ margin: '0 0 3px', fontSize: '1.05rem', fontWeight: 800, color: '#FFFFFF' }}>
                    {selectedWard.ward_title || `Ward ${selectedWard.ward_num}`}
                  </h3>
                  <div style={{ fontSize: '0.72rem', color: '#94A3B8' }}>
                    {selectedWard.area_zone || 'Pune Administrative Zone'}
                  </div>

                  {/* Vulnerability Pill & Score */}
                  {(() => {
                    const comp = selectedWard.indicators?.composite_vulnerability_score ?? 0;
                    const vl = vulnLabel(comp);
                    return (
                      <div style={{
                        marginTop: 10,
                        padding: '8px 12px',
                        borderRadius: 8,
                        background: `${vl.color}15`,
                        border: `1px solid ${vl.color}35`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}>
                        <div>
                          <div style={{ fontSize: '0.64rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#94A3B8' }}>
                            Composite Risk
                          </div>
                          <div style={{ fontSize: '1.35rem', fontWeight: 800, color: vl.color, lineHeight: 1.1 }}>
                            {comp}<span style={{ fontSize: '0.72rem', color: '#94A3B8', fontWeight: 400 }}> / 100</span>
                          </div>
                        </div>
                        <span style={{
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: 20,
                          background: `${vl.color}25`,
                          color: vl.color,
                          border: `1px solid ${vl.color}50`,
                        }}>
                          {vl.text}
                        </span>
                      </div>
                    );
                  })()}
                </div>

                {/* Key Driver / Reason callout */}
                <div style={{
                  padding: '10px 12px',
                  borderRadius: 8,
                  background: 'rgba(245, 158, 11, 0.08)',
                  border: '1px solid rgba(245, 158, 11, 0.28)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 8,
                }}>
                  <Info size={14} style={{ color: '#F59E0B', flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <span style={{ fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#F59E0B', display: 'block', marginBottom: 2 }}>
                      Primary Risk Driver
                    </span>
                    <p style={{ margin: 0, fontSize: '0.76rem', color: '#E2E8F0', lineHeight: 1.45 }}>
                      {getFactors(selectedWard)[0]?.text || 'Moderate screening baseline with balanced municipal indicator profile.'}
                    </p>
                  </div>
                </div>

                {/* 4 Vulnerability Indicators with Progress Bars */}
                <div>
                  <div style={{ fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#94A3B8', marginBottom: 8 }}>
                    Risk Indicators
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {[
                      { key: 'heat', label: 'Heat Exposure', val: selectedWard.indicators?.heat_exposure_proxy, color: '#F59E0B', Icon: Flame },
                      { key: 'flood', label: 'Flood & Drainage', val: selectedWard.indicators?.flood_screening_proxy, color: '#0284C7', Icon: Waves },
                      { key: 'water', label: 'Water Supply Stress', val: selectedWard.indicators?.water_stress_proxy, color: '#38BDF8', Icon: Droplets },
                      { key: 'green', label: 'Green Space Deficit', val: selectedWard.indicators?.green_deficit_proxy, color: '#22C55E', Icon: TreePine },
                    ].map((ind, i) => {
                      const sc = ind.val ?? 0;
                      return (
                        <div key={ind.key} style={{ padding: '8px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <ind.Icon size={13} style={{ color: ind.color }} />
                              <span style={{ fontSize: '0.76rem', color: '#E2E8F0', fontWeight: 500 }}>{ind.label}</span>
                            </div>
                            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: ind.color }}>{sc}<span style={{ fontSize: '0.64rem', color: '#64748B' }}>/100</span></span>
                          </div>
                          <AnimBar value={sc} color={ind.color} delay={i * 90} />
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Evidence Grid */}
                <div>
                  <div style={{ fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#94A3B8', marginBottom: 8 }}>
                    Field Evidence &amp; Infrastructure
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
                    {[
                      { label: 'SWD Coverage', val: `${(selectedWard.evidence?.stormwater_drain_coverage_pct ?? 0).toFixed(1)}%`, icon: Waves, color: '#0284C7' },
                      { label: 'Canopy Trees', val: `${selectedWard.evidence?.mapped_trees_osm ?? 0}`, icon: TreePine, color: '#22C55E' },
                      { label: 'Civic Parks', val: `${selectedWard.evidence?.mapped_parks_osm ?? 0}`, icon: TreePine, color: '#16A34A' },
                      { label: 'Hospitals', val: `${selectedWard.evidence?.hospitals_count ?? 0}`, icon: Heart, color: '#EF4444' },
                      { label: 'Forecast Temp', val: selectedWard.evidence?.forecast_max_temp_c != null ? `${selectedWard.evidence.forecast_max_temp_c.toFixed(1)}°C` : 'N/A', icon: Thermometer, color: '#F87171' },
                      { label: 'Precipitation', val: selectedWard.evidence?.forecast_precipitation_sum_mm != null ? `${selectedWard.evidence.forecast_precipitation_sum_mm.toFixed(1)}mm` : 'N/A', icon: CloudRain, color: '#38BDF8' },
                    ].map(ev => (
                      <div key={ev.label} style={{ padding: '7px 9px', borderRadius: 7, background: 'rgba(2,132,199,0.06)', border: '1px solid rgba(2,132,199,0.18)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
                          <ev.icon size={11} style={{ color: ev.color }} />
                          <span style={{ fontSize: '0.63rem', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{ev.label}</span>
                        </div>
                        <div style={{ fontSize: '0.86rem', fontWeight: 700, color: '#FFFFFF' }}>{ev.val}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Contributing factors bullets */}
                <div>
                  <div style={{ fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#94A3B8', marginBottom: 8 }}>
                    Contributing Stressors
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {getFactors(selectedWard).map((f, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 7, padding: '7px 9px', borderRadius: 7, background: `${f.color}10`, border: `1px solid ${f.color}25` }}>
                        <f.icon size={12} style={{ color: f.color, marginTop: 2, flexShrink: 0 }} />
                        <span style={{ fontSize: '0.73rem', color: '#E2E8F0', lineHeight: 1.45 }}>{f.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              /* Empty state when no ward selected */
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '24px 12px', gap: 14 }}>
                <div style={{
                  width: 52, height: 52, borderRadius: '50%',
                  background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <MapPin size={24} style={{ color: '#22C55E' }} />
                </div>
                <div>
                  <h4 style={{ margin: '0 0 6px', fontSize: '0.98rem', fontWeight: 700, color: '#FFFFFF' }}>
                    Select a Ward on the Map
                  </h4>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: '#94A3B8', lineHeight: 1.5 }}>
                    Click any electoral boundary on the map or select from the directory to inspect localized climate vulnerabilities, stormwater coverage, and generate a customized action plan.
                  </p>
                </div>

                {/* Quick high-concern ward recommendations */}
                <div style={{ width: '100%', marginTop: 8 }}>
                  <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#EF4444', marginBottom: 8, textAlign: 'left' }}>
                    High Vulnerability Wards (Top Priority)
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {wardData
                      .filter(w => (w.indicators?.composite_vulnerability_score ?? 0) >= 70)
                      .slice(0, 4)
                      .map(w => (
                        <div
                          key={w.ward_num}
                          onClick={() => {
                            onSelectWard?.(w);
                            try { sessionStorage.setItem('climaid_selected_ward', String(w.ward_num)); } catch { }
                            setSidebarTab('ward');
                          }}
                          style={{
                            padding: '8px 10px',
                            borderRadius: 7,
                            background: 'rgba(239, 68, 68, 0.08)',
                            border: '1px solid rgba(239, 68, 68, 0.25)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            cursor: 'pointer',
                            transition: 'all 150ms ease',
                          }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.18)'; e.currentTarget.style.borderColor = '#EF4444'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)'; e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.25)'; }}
                        >
                          <div style={{ textAlign: 'left' }}>
                            <span style={{ fontSize: '0.66rem', fontWeight: 800, color: '#EF4444' }}>Ward #{w.ward_num}</span>
                            <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#FFFFFF' }}>{w.ward_title || `Ward ${w.ward_num}`}</div>
                          </div>
                          <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#EF4444' }}>
                            {w.indicators?.composite_vulnerability_score}/100
                          </span>
                        </div>
                      ))}
                  </div>
                </div>

                <button
                  onClick={() => setShowWardList(true)}
                  style={{
                    width: '100%',
                    padding: '9px 14px',
                    borderRadius: 8,
                    background: 'rgba(34, 197, 94, 0.12)',
                    border: '1px solid rgba(34, 197, 94, 0.35)',
                    color: '#DCFCE7',
                    fontFamily: 'var(--font)',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    marginTop: 6,
                  }}
                >
                  Browse Full 76 Ward Directory
                </button>
              </div>
            )
          ) : (
            /* ══ TAB 2: LAYERS & CHECKLIST ══ */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Metric Selector Card */}
              <div style={{
                borderRadius: 10,
                background: 'rgba(0, 102, 158, 0.08)',
                border: '1px solid rgba(0, 102, 158, 0.25)',
                overflow: 'hidden',
              }}>
                <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(0, 102, 158, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <BarChart3 size={15} style={{ color: '#0284C7' }} />
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#FFFFFF' }}>Vulnerability Metric</span>
                  </div>
                  <span style={{ fontSize: '0.7rem', color: '#38BDF8', fontWeight: 600 }}>{cfg.shortLabel}</span>
                </div>
                <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {Object.entries(METRIC_CONFIG).map(([id, c]) => {
                    const act = metric === id;
                    return (
                      <button
                        key={id}
                        onClick={() => setMetric(id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          padding: '7px 10px',
                          borderRadius: 6,
                          border: act ? `1px solid ${c.color}` : '1px solid transparent',
                          background: act ? `${c.color}20` : 'rgba(255,255,255,0.02)',
                          color: act ? '#FFFFFF' : '#94A3B8',
                          cursor: 'pointer',
                          fontFamily: 'var(--font)',
                          fontSize: '0.78rem',
                          fontWeight: act ? 700 : 400,
                          textAlign: 'left',
                          width: '100%',
                          transition: 'all 120ms ease',
                        }}
                      >
                        <c.icon size={13} style={{ color: act ? c.color : '#64748B', flexShrink: 0 }} />
                        <span style={{ flex: 1 }}>{c.label}</span>
                        {act && <div style={{ width: 6, height: 6, borderRadius: '50%', background: c.color, flexShrink: 0 }} />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* GIS Feature Layers Checklist */}
              <div style={{
                borderRadius: 10,
                background: 'rgba(22, 163, 74, 0.08)',
                border: '1px solid rgba(22, 163, 74, 0.25)',
                overflow: 'hidden',
              }}>
                <div style={{
                  padding: '10px 14px',
                  background: 'rgba(22, 163, 74, 0.2)',
                  borderBottom: '1px solid rgba(22, 163, 74, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <Layers size={15} style={{ color: '#22C55E' }} />
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#FFFFFF' }}>Map Features Checklist</span>
                  </div>
                  <span style={{ fontSize: '0.68rem', color: '#86EFAC', fontWeight: 600 }}>
                    {Object.values(layers).filter(Boolean).length} / {LAYER_DEFS.length} Visible
                  </span>
                </div>
                <div style={{ padding: '6px 10px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {LAYER_DEFS.map(ld => {
                    const act = layers[ld.key];
                    const lding = loadingL[ld.key];
                    return (
                      <label
                        key={ld.key}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 9,
                          padding: '6px 9px',
                          borderRadius: 6,
                          background: act ? 'rgba(34, 197, 94, 0.1)' : 'transparent',
                          cursor: 'pointer',
                          transition: 'background 120ms ease',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={act}
                          onChange={e => setLayers(p => ({ ...p, [ld.key]: e.target.checked }))}
                          style={{ accentColor: '#22C55E', cursor: 'pointer', width: 14, height: 14, flexShrink: 0 }}
                        />
                        <ld.icon size={13} style={{ color: ld.color, flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ fontSize: '0.78rem', color: act ? '#DCFCE7' : '#94A3B8', fontWeight: act ? 600 : 400, display: 'block' }}>
                            {ld.label}
                          </span>
                          <span style={{ fontSize: '0.64rem', color: '#64748B' }}>{ld.desc}</span>
                        </div>
                        {lding && (
                          <div style={{ width: 8, height: 8, borderRadius: '50%', border: '2px solid #0284C7', borderTopColor: 'transparent', animation: 'spin 0.7s linear infinite', flexShrink: 0 }} />
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Live Pune Weather & Telemetry */}
              {cur && (
                <div style={{
                  padding: '12px 14px',
                  borderRadius: 10,
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid rgba(255, 255, 255, 0.07)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}>
                  <div>
                    <div style={{ fontSize: '0.64rem', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>
                      Live Telemetry · Pune
                    </div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#F87171', lineHeight: 1.1 }}>
                      {cur.temperature_2m_c?.toFixed(1)}°C
                    </div>
                    <div style={{ fontSize: '0.68rem', color: '#94A3B8', marginTop: 2 }}>
                      Wind {cur.wind_speed_10m_kmh?.toFixed(0) || 0} km/h · Rain {cur.precipitation_mm || 0}mm
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div title={`Humidity ${Math.round(cur.relative_humidity_2m_pct || 0)}%`}>
                      <HumidityRing pct={cur.relative_humidity_2m_pct || 0} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Fixed Bottom CTA ── */}
        <div style={{
          padding: '14px 18px',
          borderTop: '1px solid rgba(0, 102, 158, 0.25)',
          background: 'rgba(6, 18, 30, 0.98)',
          flexShrink: 0,
        }}>
          <button
            onClick={() => {
              if (selectedWard) {
                try { sessionStorage.setItem('climaid_selected_ward', String(selectedWard.ward_num)); } catch { }
                navigate(`/plan?ward=${selectedWard.ward_num}`);
              } else {
                navigate('/plan');
              }
            }}
            style={{
              width: '100%',
              padding: '12px 16px',
              borderRadius: 10,
              background: '#22C55E',
              border: 'none',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              fontFamily: 'var(--font)',
              fontSize: '0.86rem',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'background 150ms ease, transform 100ms ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#16A34A'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#22C55E'; }}
          >
            <span>{selectedWard ? `Generate Plan for Ward #${selectedWard.ward_num}` : 'Generate Adaptation Plan'}</span>
            <ArrowRight size={15} />
          </button>
        </div>
      </aside>

      {/* ══ MAP CANVAS ═══════════════════════════════════════════ */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', minWidth: 0, minHeight: 0 }}>
        <div ref={mapRef} style={{ width: '100%', height: '100%' }} />

        {/* Clear selection */}
        {selectedWard && (
          <button onClick={() => { onClearWard?.(); setDetailOpen(false); }}
            style={{ position: 'absolute', top: 12, right: 12, zIndex: 450, display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 20, background: '#061423', border: '1px solid rgba(0, 102, 158, 0.4)', color: '#E2E8F0', cursor: 'pointer', fontFamily: 'var(--font)', fontSize: '0.76rem', transition: 'all 150ms ease' }}>
            <X size={12} /> Clear selection
          </button>
        )}

        {/* ── IDLE HINT PILL (center top, only when nothing hovered) ── */}
        {!hoveredWard && (
          <div style={{
            position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
            zIndex: 420, pointerEvents: 'none',
            background: '#06121E',
            border: '1px solid rgba(0,102,158,0.3)', borderRadius: 9999,
            padding: '5px 14px', display: 'flex', alignItems: 'center', gap: 7,
            color: '#94A3B8', fontSize: '0.73rem',
          }}>
            <Sparkles size={12} style={{ color: '#22C55E' }} />
            <span>Hover over any ward to inspect · Click to analyze</span>
          </div>
        )}

        {/* ── HOVER WARD HUD CARD (top-left, only when ward hovered) ── */}
        {hoveredWard && (
          <div style={{
            position: 'absolute', top: 14, left: 14, zIndex: 430,
            width: 'calc(100% - 28px)', maxWidth: 480,
            background: '#061423',
            border: '1px solid #0284C7', borderRadius: 10,
            padding: '11px 15px',
            pointerEvents: 'auto',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 5 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#38BDF8' }}>
                  Ward #{hoveredWard.ward_num}
                </span>
                {hoveredWard.area_zone && (
                  <span style={{ fontSize: '0.68rem', color: '#94A3B8' }}>· {hoveredWard.area_zone}</span>
                )}
              </div>
              <HudVulnBadge ward={hoveredWard} />
            </div>

            <div style={{ fontSize: '0.94rem', fontWeight: 700, color: '#FFFFFF', marginBottom: 6 }}>
              {hoveredWard.ward_title || `Ward ${hoveredWard.ward_num}`}
            </div>

            <div style={{ fontSize: '0.75rem', color: '#E2E8F0', lineHeight: 1.45, marginBottom: 8, display: 'flex', alignItems: 'flex-start', gap: 7, background: 'rgba(0, 102, 158, 0.15)', padding: '6px 9px', borderRadius: 6, border: '1px solid rgba(0, 102, 158, 0.3)' }}>
              <Info size={13} style={{ color: '#38BDF8', flexShrink: 0, marginTop: 2 }} />
              <span>
                <strong style={{ color: '#F59E0B' }}>Reason: </strong>
                {getFactors(hoveredWard)[0]?.text || 'Moderate screening proxy profile with balanced infrastructure baseline.'}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, paddingTop: 6, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ fontSize: '0.68rem', color: '#94A3B8' }}>
                Heat: <strong style={{ color: '#F59E0B' }}>{hoveredWard.indicators?.heat_exposure_proxy ?? '—'}</strong>
              </div>
              <div style={{ fontSize: '0.68rem', color: '#94A3B8' }}>
                Flood: <strong style={{ color: '#0284C7' }}>{hoveredWard.indicators?.flood_screening_proxy ?? '—'}</strong>
              </div>
              <div style={{ fontSize: '0.68rem', color: '#94A3B8' }}>
                SWD: <strong style={{ color: '#22C55E' }}>{(hoveredWard.evidence?.stormwater_drain_coverage_pct ?? 0).toFixed(0)}%</strong>
              </div>
              <div
                style={{ fontSize: '0.68rem', color: '#22C55E', textAlign: 'right', cursor: 'pointer', fontWeight: 600 }}
                onClick={() => { onSelectWard?.(hoveredWard); setDetailOpen(true); }}
              >
                Details →
              </div>
            </div>
          </div>
        )}

        {/* ── BOTTOM-LEFT MAP INDEX (4 distinct layer colors) ── */}
        <div style={{
          position: 'absolute',
          bottom: 24,
          left: 14,
          zIndex: 410,
          background: '#061423',
          border: '1px solid rgba(0, 102, 158, 0.35)',
          borderRadius: 8,
          padding: '10px 14px',
          minWidth: 165,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
            <span style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#38BDF8' }}>
              Map Index
            </span>
            <span style={{ fontSize: '0.62rem', color: '#94A3B8' }}>{cfg.shortLabel}</span>
          </div>
          {[
            { color: '#EF4444', label: 'Higher Concern', range: '≥ 75', desc: 'Critical risk drivers' },
            { color: '#F59E0B', label: 'Moderate Concern', range: '60–74', desc: 'Elevated exposure' },
            { color: '#0284C7', label: 'Some Concern', range: '45–59', desc: 'Moderate buffer' },
            { color: '#22C55E', label: 'Lower Concern', range: '< 45', desc: 'Nature-buffered' }
          ].map(r => (
            <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
              <span style={{ width: 12, height: 12, borderRadius: 2, background: r.color, flexShrink: 0 }} />
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.72rem', color: '#E2E8F0', fontWeight: 500 }}>{r.label}</span>
                <span style={{ fontSize: '0.65rem', color: '#94A3B8', fontFamily: 'monospace' }}>{r.range}</span>
              </div>
            </div>
          ))}
        </div>

        {/* ── WARD DIRECTORY DRAWER (76 WARDS) ── */}
        {showWardList && (
          <div style={{
            position: 'absolute',
            inset: 0,
            zIndex: 600,
            background: 'rgba(2, 6, 14, 0.85)',
            display: 'flex',
            justifyContent: 'flex-end',
            animation: 'fadeIn 200ms ease',
          }}>
            <div style={{
              width: '100%',
              maxWidth: 460,
              height: '100%',
              background: '#040D1A',
              borderLeft: `1px solid ${P.teal}60`,
              display: 'flex',
              flexDirection: 'column',
              animation: 'slideInRight 260ms cubic-bezier(0.22, 1, 0.36, 1)',
            }}>
              {/* Header */}
              <div style={{ padding: '16px 18px', borderBottom: `1px solid ${P.prussian}80`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: `${P.prussian}25` }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#FFFFFF' }}>Pune Electoral Wards</h3>
                  <p style={{ margin: '3px 0 0', fontSize: '0.72rem', color: '#94A3B8' }}>76 Wards · Ranked by {cfg.label}</p>
                </div>
                <button onClick={() => setShowWardList(false)} style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: 6 }}>
                  <X size={18} />
                </button>
              </div>

              {/* Search */}
              <div style={{ padding: '12px 18px', borderBottom: `1px solid ${P.prussian}50` }}>
                <input
                  type="text"
                  placeholder="Search ward name or number..."
                  value={wardSearch}
                  onChange={e => setWardSearch(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    background: 'rgba(255,255,255,0.05)',
                    border: `1px solid ${P.prussian}90`,
                    borderRadius: 6,
                    color: '#FFFFFF',
                    fontFamily: 'var(--font)',
                    fontSize: '0.8rem',
                    outline: 'none',
                  }}
                />
              </div>

              {/* Ward list */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '12px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {wardData
                  .filter(w => {
                    if (!wardSearch) return true;
                    const q = wardSearch.toLowerCase();
                    return String(w.ward_num).includes(q) || (w.ward_title || '').toLowerCase().includes(q) || (w.area_zone || '').toLowerCase().includes(q);
                  })
                  .sort((a, b) => (getVal(b, metric) || 0) - (getVal(a, metric) || 0))
                  .map(w => {
                    const vl = vulnLabel(w.indicators?.composite_vulnerability_score ?? 0);
                    const factors = getFactors(w);
                    const isSel = selectedWard && Number(selectedWard.ward_num) === Number(w.ward_num);
                    return (
                      <div
                        key={w.ward_num}
                        onClick={() => {
                          onSelectWard?.(w);
                          setDetailOpen(true);
                          setShowWardList(false);
                        }}
                        style={{
                          padding: '10px 12px',
                          borderRadius: 8,
                          background: isSel ? `${P.teal}25` : 'rgba(255,255,255,0.02)',
                          border: `1px solid ${isSel ? P.teal : P.prussian + '60'}`,
                          cursor: 'pointer',
                          transition: 'all 150ms ease',
                        }}
                        onMouseEnter={e => e.currentTarget.style.borderColor = P.teal}
                        onMouseLeave={e => { if (!isSel) e.currentTarget.style.borderColor = P.prussian + '60'; }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: '0.68rem', fontWeight: 800, color: P.teal }}>Ward #{w.ward_num}</span>
                          <span style={{ fontSize: '0.66rem', fontWeight: 700, padding: '2px 6px', borderRadius: 10, background: `${vl.color}20`, color: vl.color, border: `1px solid ${vl.color}40` }}>
                            {vl.text} · {w.indicators?.composite_vulnerability_score}/100
                          </span>
                        </div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#FFFFFF', marginBottom: 4 }}>
                          {w.ward_title || `Ward ${w.ward_num}`}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#94A3B8', lineHeight: 1.4 }}>
                          <strong style={{ color: '#F59E0B' }}>Driver: </strong>
                          {factors[0]?.text || 'Moderate screening baseline'}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Global tooltip + animation styles ─────────────────────── */}
      <style>{`
        @keyframes spin { to { transform:rotate(360deg); } }
        @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
        @keyframes slideInRight { from { transform:translateX(100%); } to { transform:translateX(0); } }
        .map-tt, .climaid-tt { background:transparent!important; border:none!important; padding:0!important; box-shadow:none!important; pointer-events:none!important; }
        .map-tt::before, .climaid-tt::before { display:none!important; }
        .ward-tooltip { font-family:'Inter',sans-serif; min-width:170px; padding:10px 12px; }
      `}</style>
    </div>
  );
}
