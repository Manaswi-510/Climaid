import React, { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import {
  Layers, Filter, Eye, EyeOff, RotateCcw, AlertTriangle,
  Info, Loader2, CheckCircle2, ShieldAlert, Sparkles, MapPin
} from 'lucide-react';

const API_BASE = 'http://127.0.0.1:8000';

// Pilot Area Bounding Box for Pune Core
const PILOT_BOUNDS = [
  [18.50, 73.80],
  [18.60, 73.90]
];
const PUNE_CENTER = [18.535, 73.855];

// Graduated Color Scale based on screening scores (0-100)
function getChoroplethColor(value) {
  if (value === null || value === undefined || isNaN(value)) return '#64748b';
  if (value >= 75) return '#ef4444'; // Severe (Crimson)
  if (value >= 60) return '#f59e0b'; // High (Amber)
  if (value >= 45) return '#0284c7'; // Moderate (Sky Blue)
  return '#10b981'; // Low (Emerald)
}

export default function WardMapExplorer({ wardData = [], selectedWard, onSelectWard }) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const layersGroupRef = useRef({});
  const canvasRendererRef = useRef(null);
  const geojsonCacheRef = useRef({});

  // Layer Visibility State
  const [layers, setLayers] = useState({
    wards: true,
    nallas: true,
    chambers: true,
    waterways: true,
    waterbodies: true,
    hospitals: false,
    parks: false,
    trees: false,
    pipes: false,
  });

  // Layer loading & error tracking
  const [loadingLayers, setLoadingLayers] = useState({});
  const [layerErrors, setLayerErrors] = useState({});
  const [emptyLayers, setEmptyLayers] = useState({});
  const [activeMetric, setActiveMetric] = useState('composite'); // composite | heat | flood | water | green
  const [currentZoom, setCurrentZoom] = useState(13);
  const [pipeForceRender, setPipeForceRender] = useState(false);
  const [pipeLoadingProgress, setPipeLoadingProgress] = useState(null);

  // Fast lookup mapping ward_num -> ward data
  const wardLookup = useMemo(() => {
    const map = new Map();
    for (const w of wardData) {
      if (w.ward_num !== undefined) {
        map.set(Number(w.ward_num), w);
      }
    }
    return map;
  }, [wardData]);

  // Metric accessor helper
  const getWardMetricValue = (wardObj, metric) => {
    if (!wardObj || !wardObj.indicators) return 0;
    switch (metric) {
      case 'heat':
        return wardObj.indicators.heat_exposure_proxy;
      case 'flood':
        return wardObj.indicators.flood_screening_proxy;
      case 'water':
        return wardObj.indicators.water_stress_proxy;
      case 'green':
        return wardObj.indicators.green_deficit_proxy;
      case 'composite':
      default:
        return wardObj.indicators.composite_vulnerability_score;
    }
  };

  // 1. Initialize Leaflet Map Instance
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return; // Prevent double init

    const map = L.map(mapContainerRef.current, {
      center: PUNE_CENTER,
      zoom: 13,
      minZoom: 11,
      maxZoom: 18,
      zoomControl: true,
      preferCanvas: true,
    });

    // Dark-mode CartoDB tile layer
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      maxZoom: 19,
      subdomains: 'abcd',
    }).addTo(map);

    // Pilot Study Bounding Box outline
    L.rectangle(PILOT_BOUNDS, {
      color: '#22d3ee',
      weight: 1.5,
      dashArray: '6, 6',
      fillOpacity: 0.02,
      interactive: false,
    }).addTo(map);

    // Canvas renderer for high-density vectors (e.g. 60k pipes)
    canvasRendererRef.current = L.canvas({ padding: 0.5 });

    map.on('zoomend', () => {
      setCurrentZoom(map.getZoom());
    });

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // 2. Fetch GeoJSON helper with in-memory caching
  const fetchLayerGeoJSON = async (layerKey, endpoint) => {
    if (geojsonCacheRef.current[layerKey]) {
      return geojsonCacheRef.current[layerKey];
    }
    setLoadingLayers(prev => ({ ...prev, [layerKey]: true }));
    setLayerErrors(prev => ({ ...prev, [layerKey]: null }));

    try {
      const res = await fetch(`${API_BASE}/api/map-layers/${endpoint}`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      const data = await res.json();
      if (!data.features || data.features.length === 0) {
        setEmptyLayers(prev => ({ ...prev, [layerKey]: true }));
      }
      geojsonCacheRef.current[layerKey] = data;
      setLoadingLayers(prev => ({ ...prev, [layerKey]: false }));
      return data;
    } catch (err) {
      console.error(`Failed to load layer ${layerKey}:`, err);
      setLayerErrors(prev => ({ ...prev, [layerKey]: err.message }));
      setLoadingLayers(prev => ({ ...prev, [layerKey]: false }));
      return null;
    }
  };

  // 3. Render Electoral Wards Choropleth Layer
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (!layers.wards) {
      if (layersGroupRef.current.wards) {
        map.removeLayer(layersGroupRef.current.wards);
        layersGroupRef.current.wards = null;
      }
      return;
    }

    let isMounted = true;

    async function loadWards() {
      const data = await fetchLayerGeoJSON('wards', 'pune-electoral-wards');
      if (!data || !isMounted || !mapInstanceRef.current) return;

      if (layersGroupRef.current.wards) {
        mapInstanceRef.current.removeLayer(layersGroupRef.current.wards);
      }

      const wardLayer = L.geoJSON(data, {
        style: (feature) => {
          const props = feature.properties || {};
          const wnum = Number(props.wardnum || props.ward_no || String(props.name || '').replace(/\D/g, ''));
          const wardInfo = wardLookup.get(wnum);
          const val = wardInfo ? getWardMetricValue(wardInfo, activeMetric) : 0;
          const isSelected = selectedWard && Number(selectedWard.ward_num) === wnum;

          return {
            fillColor: getChoroplethColor(val),
            fillOpacity: isSelected ? 0.75 : 0.45,
            color: isSelected ? '#22d3ee' : '#cbd5e1',
            weight: isSelected ? 3 : 1.2,
            dashArray: isSelected ? '' : '2',
            opacity: isSelected ? 1 : 0.7,
          };
        },
        onEachFeature: (feature, layer) => {
          const props = feature.properties || {};
          const wnum = Number(props.wardnum || props.ward_no || String(props.name || '').replace(/\D/g, ''));
          const wardInfo = wardLookup.get(wnum);

          const title = wardInfo?.ward_title || props.name || `Ward ${wnum}`;
          const zone = wardInfo?.area_zone || 'Pune Pilot';
          const score = wardInfo ? getWardMetricValue(wardInfo, activeMetric) : 'N/A';
          const compScore = wardInfo?.indicators?.composite_vulnerability_score ?? 'N/A';
          const swdCov = wardInfo?.evidence?.stormwater_drain_coverage_pct ?? 'N/A';

          const tooltipContent = `
            <div style="font-family: inherit; font-size: 12px; line-height: 1.4;">
              <strong style="color: #22d3ee;">Ward #${wnum}: ${title}</strong><br/>
              <span style="color: #94a3b8;">Zone: ${zone}</span><br/>
              <span style="color: #f8fafc;">${activeMetric.toUpperCase()} Score: <strong>${score}</strong></span><br/>
              <span style="color: #cbd5e1;">Composite Risk: <strong>${compScore}</strong> • SWD Cover: <strong>${swdCov}%</strong></span>
            </div>
          `;
          layer.bindTooltip(tooltipContent, {
            sticky: true,
            className: 'custom-leaflet-tooltip'
          });

          layer.on({
            mouseover: (e) => {
              const l = e.target;
              if (!selectedWard || Number(selectedWard.ward_num) !== wnum) {
                l.setStyle({ fillOpacity: 0.65, weight: 2, color: '#f8fafc' });
              }
            },
            mouseout: (e) => {
              const l = e.target;
              const isSelected = selectedWard && Number(selectedWard.ward_num) === wnum;
              if (!isSelected) {
                const val = wardInfo ? getWardMetricValue(wardInfo, activeMetric) : 0;
                l.setStyle({
                  fillColor: getChoroplethColor(val),
                  fillOpacity: 0.45,
                  weight: 1.2,
                  color: '#cbd5e1',
                  dashArray: '2'
                });
              }
            },
            click: () => {
              if (wardInfo && onSelectWard) {
                onSelectWard(wardInfo);
              }
            }
          });
        }
      });

      wardLayer.addTo(mapInstanceRef.current);
      layersGroupRef.current.wards = wardLayer;
    }

    loadWards();

    return () => { isMounted = false; };
  }, [layers.wards, activeMetric, wardLookup, selectedWard]);

  // 4. Render Nallas (Natural Drainage Streams)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (!layers.nallas) {
      if (layersGroupRef.current.nallas) {
        map.removeLayer(layersGroupRef.current.nallas);
        layersGroupRef.current.nallas = null;
      }
      return;
    }

    let isMounted = true;
    async function loadNallas() {
      const data = await fetchLayerGeoJSON('nallas', 'nallas');
      if (!data || !isMounted || !mapInstanceRef.current) return;

      if (layersGroupRef.current.nallas) {
        mapInstanceRef.current.removeLayer(layersGroupRef.current.nallas);
      }

      const layer = L.geoJSON(data, {
        style: {
          color: '#06b6d4', // Vibrant Cyan stream
          weight: 2.2,
          opacity: 0.85,
        },
        onEachFeature: (feature, l) => {
          const name = feature.properties?.name || 'Natural Drainage Nalla';
          l.bindTooltip(`<strong>${name}</strong><br/><span style="color:#94a3b8;">Natural Drainage Corridor (OpenCity)</span>`, { sticky: true });
        }
      });

      layer.addTo(mapInstanceRef.current);
      layersGroupRef.current.nallas = layer;
    }

    loadNallas();
    return () => { isMounted = false; };
  }, [layers.nallas]);

  // 5. Render SWD Utility Chambers (1,532 Inlets)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (!layers.chambers) {
      if (layersGroupRef.current.chambers) {
        map.removeLayer(layersGroupRef.current.chambers);
        layersGroupRef.current.chambers = null;
      }
      return;
    }

    let isMounted = true;
    async function loadChambers() {
      const data = await fetchLayerGeoJSON('chambers', 'swd-chambers');
      if (!data || !isMounted || !mapInstanceRef.current) return;

      if (layersGroupRef.current.chambers) {
        mapInstanceRef.current.removeLayer(layersGroupRef.current.chambers);
      }

      const layer = L.geoJSON(data, {
        pointToLayer: (feature, latlng) => {
          return L.circleMarker(latlng, {
            radius: 3.5,
            fillColor: '#f59e0b',
            color: '#78350f',
            weight: 1,
            opacity: 0.9,
            fillOpacity: 0.8,
            renderer: canvasRendererRef.current,
          });
        },
        onEachFeature: (feature, l) => {
          const name = feature.properties?.name || 'Stormwater Chamber Inlet';
          l.bindTooltip(`<strong>${name}</strong><br/><span style="color:#94a3b8;">Municipal SWD Inlet Chamber</span>`, { sticky: true });
        }
      });

      layer.addTo(mapInstanceRef.current);
      layersGroupRef.current.chambers = layer;
    }

    loadChambers();
    return () => { isMounted = false; };
  }, [layers.chambers]);

  // 6. Render Rivers & Waterbodies (Official PMC)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (!layers.waterbodies) {
      if (layersGroupRef.current.waterbodies) {
        map.removeLayer(layersGroupRef.current.waterbodies);
        layersGroupRef.current.waterbodies = null;
      }
      return;
    }

    let isMounted = true;
    async function loadWaterbodies() {
      const data = await fetchLayerGeoJSON('waterbodies', 'waterbodies-official');
      if (!data || !isMounted || !mapInstanceRef.current) return;

      if (layersGroupRef.current.waterbodies) {
        mapInstanceRef.current.removeLayer(layersGroupRef.current.waterbodies);
      }

      const layer = L.geoJSON(data, {
        style: {
          fillColor: '#0284c7',
          fillOpacity: 0.6,
          color: '#38bdf8',
          weight: 1.5,
        },
        onEachFeature: (feature, l) => {
          const name = feature.properties?.name || 'Waterbody / River Channel';
          l.bindTooltip(`<strong>${name}</strong><br/><span style="color:#94a3b8;">Official Water Body (PMC/OpenCity)</span>`, { sticky: true });
        }
      });

      layer.addTo(mapInstanceRef.current);
      layersGroupRef.current.waterbodies = layer;
    }

    loadWaterbodies();
    return () => { isMounted = false; };
  }, [layers.waterbodies]);

  // 7. Render OSM Parks & Gardens
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (!layers.parks) {
      if (layersGroupRef.current.parks) {
        map.removeLayer(layersGroupRef.current.parks);
        layersGroupRef.current.parks = null;
      }
      return;
    }

    let isMounted = true;
    async function loadParks() {
      const data = await fetchLayerGeoJSON('parks', 'parks');
      if (!data || !isMounted || !mapInstanceRef.current) return;

      if (layersGroupRef.current.parks) {
        mapInstanceRef.current.removeLayer(layersGroupRef.current.parks);
      }

      const layer = L.geoJSON(data, {
        pointToLayer: (feature, latlng) => {
          return L.circleMarker(latlng, {
            radius: 5,
            fillColor: '#10b981',
            color: '#064e3b',
            weight: 1,
            fillOpacity: 0.85,
          });
        },
        style: {
          fillColor: '#10b981',
          fillOpacity: 0.5,
          color: '#059669',
          weight: 1.5,
        },
        onEachFeature: (feature, l) => {
          const name = feature.properties?.name || 'Public Park / Garden';
          l.bindTooltip(`<strong>${name}</strong><br/><span style="color:#94a3b8;">Civic Green Space (OSM)</span>`, { sticky: true });
        }
      });

      layer.addTo(mapInstanceRef.current);
      layersGroupRef.current.parks = layer;
    }

    loadParks();
    return () => { isMounted = false; };
  }, [layers.parks]);

  // 8. Render OSM Hospitals & Clinics
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (!layers.hospitals) {
      if (layersGroupRef.current.hospitals) {
        map.removeLayer(layersGroupRef.current.hospitals);
        layersGroupRef.current.hospitals = null;
      }
      return;
    }

    let isMounted = true;
    async function loadHospitals() {
      const data = await fetchLayerGeoJSON('hospitals', 'hospitals');
      if (!data || !isMounted || !mapInstanceRef.current) return;

      if (layersGroupRef.current.hospitals) {
        mapInstanceRef.current.removeLayer(layersGroupRef.current.hospitals);
      }

      const layer = L.geoJSON(data, {
        pointToLayer: (feature, latlng) => {
          return L.circleMarker(latlng, {
            radius: 4.5,
            fillColor: '#ef4444',
            color: '#ffffff',
            weight: 1,
            fillOpacity: 0.9,
          });
        },
        style: {
          fillColor: '#ef4444',
          fillOpacity: 0.5,
          color: '#b91c1c',
          weight: 1.5,
        },
        onEachFeature: (feature, l) => {
          const name = feature.properties?.name || 'Medical Center / Hospital';
          l.bindTooltip(`<strong>${name}</strong><br/><span style="color:#94a3b8;">Sensitive Health Receptor (OSM)</span>`, { sticky: true });
        }
      });

      layer.addTo(mapInstanceRef.current);
      layersGroupRef.current.hospitals = layer;
    }

    loadHospitals();
    return () => { isMounted = false; };
  }, [layers.hospitals]);

  // 9. Render OSM Trees (5,779 points)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (!layers.trees) {
      if (layersGroupRef.current.trees) {
        map.removeLayer(layersGroupRef.current.trees);
        layersGroupRef.current.trees = null;
      }
      return;
    }

    let isMounted = true;
    async function loadTrees() {
      const data = await fetchLayerGeoJSON('trees', 'trees');
      if (!data || !isMounted || !mapInstanceRef.current) return;

      if (layersGroupRef.current.trees) {
        mapInstanceRef.current.removeLayer(layersGroupRef.current.trees);
      }

      const layer = L.geoJSON(data, {
        pointToLayer: (feature, latlng) => {
          return L.circleMarker(latlng, {
            radius: 2.5,
            fillColor: '#22c55e',
            color: '#14532d',
            weight: 0.5,
            fillOpacity: 0.7,
            renderer: canvasRendererRef.current,
          });
        },
        onEachFeature: (feature, l) => {
          const species = feature.properties?.species || feature.properties?.['species:en'] || 'Urban Tree';
          l.bindTooltip(`<strong>${species}</strong><br/><span style="color:#94a3b8;">Mapped Tree Asset (OSM)</span>`, { sticky: true });
        }
      });

      layer.addTo(mapInstanceRef.current);
      layersGroupRef.current.trees = layer;
    }

    loadTrees();
    return () => { isMounted = false; };
  }, [layers.trees]);

  // 10. Render Stormwater Pipes (60,741 segments) — Canvas Optimized & Viewport-Gated
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (!layers.pipes) {
      if (layersGroupRef.current.pipes) {
        map.removeLayer(layersGroupRef.current.pipes);
        layersGroupRef.current.pipes = null;
      }
      return;
    }

    const shouldRender = currentZoom >= 13 || pipeForceRender;

    if (!shouldRender) {
      if (layersGroupRef.current.pipes) {
        map.removeLayer(layersGroupRef.current.pipes);
        layersGroupRef.current.pipes = null;
      }
      return;
    }

    let isMounted = true;
    let abortController = new AbortController();

    async function loadPipesForView() {
      if (!isMounted || !mapInstanceRef.current) return;

      let endpoint = 'swd-pipes';
      if (!pipeForceRender) {
        const b = mapInstanceRef.current.getBounds();
        const bboxStr = `${b.getWest().toFixed(4)},${b.getSouth().toFixed(4)},${b.getEast().toFixed(4)},${b.getNorth().toFixed(4)}`;
        endpoint = `swd-pipes?bbox=${bboxStr}&limit=3500`;
        setPipeLoadingProgress(`Loading local pipes for viewport (zoom ${currentZoom})...`);
      } else {
        setPipeLoadingProgress('Downloading all 60,741 pipes across Pune (64 MB)...');
      }

      try {
        const res = await fetch(`${API_BASE}/api/map-layers/${endpoint}`, { signal: abortController.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setPipeLoadingProgress(null);

        if (!data || !isMounted || !mapInstanceRef.current) return;

        if (layersGroupRef.current.pipes) {
          mapInstanceRef.current.removeLayer(layersGroupRef.current.pipes);
        }

        const layer = L.geoJSON(data, {
          renderer: canvasRendererRef.current,
          style: {
            color: '#38bdf8',
            weight: 1.5,
            opacity: 0.75,
          },
          onEachFeature: (feature, l) => {
            const props = feature.properties || {};
            const diameter = props.diameter || props.size || 'Municipal SWD';
            const material = props.material || 'Reinforced Concrete Pipe';
            l.bindTooltip(`<strong>SWD Drain Pipe</strong><br/><span style="color:#94a3b8;">${diameter} • ${material}</span>`, { sticky: true });
          }
        });

        layer.addTo(mapInstanceRef.current);
        layersGroupRef.current.pipes = layer;
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('Failed to load pipe segments:', err);
          setPipeLoadingProgress(null);
        }
      }
    }

    loadPipesForView();

    // Re-fetch viewport pipes on pan/zoom if zoom >= 13 and not force rendering all
    const onMoveEnd = () => {
      if (layers.pipes && !pipeForceRender && map.getZoom() >= 13) {
        loadPipesForView();
      }
    };

    map.on('moveend', onMoveEnd);

    return () => {
      isMounted = false;
      abortController.abort();
      map.off('moveend', onMoveEnd);
    };
  }, [layers.pipes, currentZoom, pipeForceRender]);

  // 11. Reset Map View
  const handleResetView = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.fitBounds(PILOT_BOUNDS, { padding: [20, 20] });
    }
  };

  return (
    <div className="solid-panel" data-ui="true" style={{ marginBottom: '2rem' }}>
      {/* Header and Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>
              Pune Spatial Vulnerability & Infrastructure Explorer
            </h3>
            <span className="badge badge-measured">76 Real Electoral Wards</span>
          </div>
          <p style={{ fontSize: '0.84rem', color: 'var(--ink-secondary)', marginTop: '0.3rem', marginBottom: 0 }}>
            Interactive vector GIS clipped to Pune Urban Pilot extent (18.50–18.60°N, 73.80–73.90°E).
          </p>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Choropleth Metric Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', background: 'var(--bg-surface-elevated)', padding: '0.25rem 0.5rem', borderRadius: 'var(--radius-sm)' }}>
            <Filter size={14} color="var(--accent)" />
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--ink-muted)', marginRight: '0.2rem' }}>METRIC:</span>
            <select
              value={activeMetric}
              onChange={(e) => setActiveMetric(e.target.value)}
              style={{
                background: 'transparent',
                color: 'var(--ink-primary)',
                border: 'none',
                fontSize: '0.8125rem',
                fontWeight: 600,
                cursor: 'pointer',
                outline: 'none'
              }}
            >
              <option value="composite" style={{ background: '#0f1726' }}>Composite Vulnerability (0–100)</option>
              <option value="heat" style={{ background: '#0f1726' }}>Heat Exposure Proxy</option>
              <option value="flood" style={{ background: '#0f1726' }}>Flood & Drainage Deficit</option>
              <option value="water" style={{ background: '#0f1726' }}>Water Stress Proxy</option>
              <option value="green" style={{ background: '#0f1726' }}>Green Cover Deficit</option>
            </select>
          </div>

          <button
            onClick={handleResetView}
            className="btn-outline"
            style={{ padding: '0.35rem 0.75rem', fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
            title="Reset map view to Pune pilot bounds"
          >
            <RotateCcw size={13} /> Reset Extent
          </button>
        </div>
      </div>

      {/* Layer Toggle Badges */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1rem', padding: '0.6rem 0.8rem', background: 'var(--bg-surface-elevated)', borderRadius: 'var(--radius-sm)' }}>
        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--ink-secondary)', marginRight: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          <Layers size={14} /> LAYERS:
        </span>

        {/* Wards Boundary */}
        <label className="badge" style={{ cursor: 'pointer', userSelect: 'none', background: layers.wards ? '#1e293b' : 'transparent', border: layers.wards ? '1px solid #38bdf8' : '1px solid #334155' }}>
          <input
            type="checkbox"
            checked={layers.wards}
            onChange={e => setLayers({ ...layers, wards: e.target.checked })}
            style={{ marginRight: '0.35rem' }}
          />
          Wards (76)
        </label>

        {/* Natural Nallas */}
        <label className="badge" style={{ cursor: 'pointer', userSelect: 'none', background: layers.nallas ? '#083344' : 'transparent', border: layers.nallas ? '1px solid #06b6d4' : '1px solid #334155' }}>
          <input
            type="checkbox"
            checked={layers.nallas}
            onChange={e => setLayers({ ...layers, nallas: e.target.checked })}
            style={{ marginRight: '0.35rem' }}
          />
          Nallas (283)
        </label>

        {/* SWD Chambers */}
        <label className="badge" style={{ cursor: 'pointer', userSelect: 'none', background: layers.chambers ? '#451a03' : 'transparent', border: layers.chambers ? '1px solid #f59e0b' : '1px solid #334155' }}>
          <input
            type="checkbox"
            checked={layers.chambers}
            onChange={e => setLayers({ ...layers, chambers: e.target.checked })}
            style={{ marginRight: '0.35rem' }}
          />
          Chambers (1.5k)
        </label>

        {/* Waterbodies */}
        <label className="badge" style={{ cursor: 'pointer', userSelect: 'none', background: layers.waterbodies ? '#0c4a6e' : 'transparent', border: layers.waterbodies ? '1px solid #0284c7' : '1px solid #334155' }}>
          <input
            type="checkbox"
            checked={layers.waterbodies}
            onChange={e => setLayers({ ...layers, waterbodies: e.target.checked })}
            style={{ marginRight: '0.35rem' }}
          />
          Waterbodies (12)
        </label>

        {/* Parks */}
        <label className="badge" style={{ cursor: 'pointer', userSelect: 'none', background: layers.parks ? '#064e3b' : 'transparent', border: layers.parks ? '1px solid #10b981' : '1px solid #334155' }}>
          <input
            type="checkbox"
            checked={layers.parks}
            onChange={e => setLayers({ ...layers, parks: e.target.checked })}
            style={{ marginRight: '0.35rem' }}
          />
          Parks (179)
        </label>

        {/* Hospitals */}
        <label className="badge" style={{ cursor: 'pointer', userSelect: 'none', background: layers.hospitals ? '#450a0a' : 'transparent', border: layers.hospitals ? '1px solid #ef4444' : '1px solid #334155' }}>
          <input
            type="checkbox"
            checked={layers.hospitals}
            onChange={e => setLayers({ ...layers, hospitals: e.target.checked })}
            style={{ marginRight: '0.35rem' }}
          />
          Hospitals (267)
        </label>

        {/* Trees */}
        <label className="badge" style={{ cursor: 'pointer', userSelect: 'none', background: layers.trees ? '#14532d' : 'transparent', border: layers.trees ? '1px solid #22c55e' : '1px solid #334155' }}>
          <input
            type="checkbox"
            checked={layers.trees}
            onChange={e => setLayers({ ...layers, trees: e.target.checked })}
            style={{ marginRight: '0.35rem' }}
          />
          Trees (5.7k)
        </label>

        {/* Stormwater Pipes (60.7k) */}
        <label className="badge" style={{ cursor: 'pointer', userSelect: 'none', background: layers.pipes ? '#075985' : 'transparent', border: layers.pipes ? '1px solid #38bdf8' : '1px solid #334155' }}>
          <input
            type="checkbox"
            checked={layers.pipes}
            onChange={e => setLayers({ ...layers, pipes: e.target.checked })}
            style={{ marginRight: '0.35rem' }}
          />
          SWD Pipes (60.7k)
        </label>
      </div>

      {/* Stormwater Pipes Status / Warning Bar when toggled */}
      {layers.pipes && (
        <div style={{ background: '#082f49', padding: '0.5rem 0.8rem', borderRadius: 'var(--radius-sm)', marginBottom: '0.8rem', fontSize: '0.78rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#7dd3fc' }}>
            <Info size={14} />
            {pipeLoadingProgress ? (
              <span><strong>{pipeLoadingProgress}</strong></span>
            ) : currentZoom < 13 && !pipeForceRender ? (
              <span>Pipes layer loaded (60,741 segments). Currently zoomed to level {currentZoom}. <strong>Zoom to level 13+</strong> to inspect street details without clutter.</span>
            ) : (
              <span>High-density Canvas rendering active (60,741 pipe segments visible).</span>
            )}
          </div>
          {currentZoom < 13 && !pipeForceRender && !pipeLoadingProgress && (
            <button
              onClick={() => setPipeForceRender(true)}
              style={{ background: '#0284c7', color: '#fff', border: 'none', padding: '0.2rem 0.5rem', borderRadius: '3px', fontSize: '0.75rem', cursor: 'pointer' }}
            >
              Force Render All (Low Zoom)
            </button>
          )}
          {pipeForceRender && (
            <button
              onClick={() => setPipeForceRender(false)}
              style={{ background: '#334155', color: '#cbd5e1', border: 'none', padding: '0.2rem 0.5rem', borderRadius: '3px', fontSize: '0.75rem', cursor: 'pointer' }}
            >
              Enable Zoom Filter
            </button>
          )}
        </div>
      )}

      {/* Layer errors or warnings */}
      {Object.entries(layerErrors).some(([_, err]) => Boolean(err)) && (
        <div style={{ background: '#450a0a', padding: '0.5rem 0.8rem', borderRadius: 'var(--radius-sm)', marginBottom: '0.8rem', fontSize: '0.8rem', color: '#fca5a5' }}>
          <AlertTriangle size={14} style={{ display: 'inline', marginRight: '0.4rem', verticalAlign: '-2px' }} />
          Some spatial layers could not be loaded: {Object.entries(layerErrors).filter(([_, e]) => Boolean(e)).map(([k, e]) => `${k} (${e})`).join(', ')}
        </div>
      )}

      {/* Active Selected Ward Notification Banner */}
      {selectedWard && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0.8rem', background: 'var(--bg-surface-subtle)', borderRadius: 'var(--radius-sm)', marginBottom: '0.8rem', fontSize: '0.82rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <MapPin size={15} color="var(--accent)" />
            <span>Selected Ward: <strong style={{ color: 'var(--accent)' }}>#{selectedWard.ward_num} {selectedWard.ward_title}</strong> ({selectedWard.area_zone})</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span>Composite Risk: <strong style={{ color: selectedWard.indicators?.composite_vulnerability_score > 60 ? 'var(--accent-alert)' : 'var(--accent-warm)' }}>{selectedWard.indicators?.composite_vulnerability_score}</strong></span>
            <span>SWD Cover: <strong>{selectedWard.evidence?.stormwater_drain_coverage_pct}%</strong></span>
          </div>
        </div>
      )}

      {/* Leaflet Map DOM Container */}
      <div style={{ position: 'relative', width: '100%', height: '560px', borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--bg-surface-elevated)' }}>
        <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />

        {/* Map Legend Overlay */}
        <div style={{
          position: 'absolute',
          bottom: '16px',
          right: '16px',
          background: 'rgba(15, 23, 38, 0.92)',
          backdropFilter: 'blur(6px)',
          border: '1px solid var(--bg-surface-elevated)',
          padding: '0.75rem 0.9rem',
          borderRadius: 'var(--radius-sm)',
          fontSize: '0.75rem',
          color: 'var(--ink-secondary)',
          zIndex: 1000,
          boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
          minWidth: '180px'
        }}>
          <div style={{ fontWeight: 700, color: 'var(--ink-primary)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {activeMetric.toUpperCase()} INDEX SCALE
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ width: 12, height: 12, background: '#ef4444', borderRadius: 2 }}></span>
                Severe Risk
              </span>
              <strong>&ge; 75</strong>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ width: 12, height: 12, background: '#f59e0b', borderRadius: 2 }}></span>
                High Risk
              </span>
              <strong>60 – 74</strong>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ width: 12, height: 12, background: '#0284c7', borderRadius: 2 }}></span>
                Moderate
              </span>
              <strong>45 – 59</strong>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ width: 12, height: 12, background: '#10b981', borderRadius: 2 }}></span>
                Low / Buffered
              </span>
              <strong>&lt; 45</strong>
            </div>
          </div>
          <div style={{ borderTop: '1px solid #334155', marginTop: '0.5rem', paddingTop: '0.4rem', fontSize: '0.7rem', color: 'var(--ink-muted)' }}>
            Click any ward polygon to inspect detailed evidence.
          </div>
        </div>

        {/* Zoom & Extent Info in Top-Left */}
        <div style={{
          position: 'absolute',
          top: '12px',
          left: '52px',
          background: 'rgba(15, 23, 38, 0.85)',
          padding: '0.3rem 0.6rem',
          borderRadius: 'var(--radius-sm)',
          fontSize: '0.72rem',
          color: 'var(--ink-muted)',
          zIndex: 1000,
          pointerEvents: 'none'
        }}>
          Zoom: {currentZoom} • Pilot Core (lat: 18.50–18.60, lon: 73.80–73.90)
        </div>
      </div>
    </div>
  );
}
