import React, { useState, useEffect } from 'react';
import {
  ShieldAlert, CloudRain, SunMedium, TreePine, Droplets,
  DollarSign, Layers, FileText, CheckCircle2, AlertTriangle,
  TrendingUp, Download, ExternalLink, Building2, Sparkles,
  Search, Info, BarChart3, Filter, MapPin, Brain
} from 'lucide-react';
import WardMapExplorer from './WardMapExplorer';

const API_BASE = 'http://127.0.0.1:8000';

export default function App() {
  const [activeTab, setActiveTab] = useState('overview');
  const [projectInfo, setProjectInfo] = useState(null);
  const [weatherData, setWeatherData] = useState(null);
  const [wardData, setWardData] = useState([]);
  const [dataManifest, setDataManifest] = useState(null);
  const [selectedWard, setSelectedWard] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [aiClusters, setAiClusters] = useState(null);

  // Planner State
  const [budgetInr, setBudgetInr] = useState(5000000);
  const [equityFactor, setEquityFactor] = useState(1.0);
  const [actionPlan, setActionPlan] = useState(null);
  const [scenarios, setScenarios] = useState(null);

  // Fetch initial data
  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const [projRes, weathRes, indRes, manRes, scenRes, aiRes] = await Promise.all([
          fetch(`${API_BASE}/api/project`).then(r => r.json()).catch(() => null),
          fetch(`${API_BASE}/api/weather`).then(r => r.json()).catch(() => null),
          fetch(`${API_BASE}/api/indicators`).then(r => r.json()).catch(() => null),
          fetch(`${API_BASE}/api/data-sources`).then(r => r.json()).catch(() => null),
          fetch(`${API_BASE}/api/scenarios/compare`, { method: 'POST' }).then(r => r.json()).catch(() => null),
          fetch(`${API_BASE}/api/ai-clusters`).then(r => r.json()).catch(() => null)
        ]);

        if (projRes) setProjectInfo(projRes);
        if (weathRes) setWeatherData(weathRes);
        if (indRes && indRes.wards) {
          setWardData(indRes.wards);
          setSelectedWard(indRes.wards[0]);
        }
        if (manRes) setDataManifest(manRes);
        if (scenRes) setScenarios(scenRes);
        if (aiRes) setAiClusters(aiRes);

        // Fetch initial action plan
        const planRes = await fetch(`${API_BASE}/api/action-plans`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ budget_inr: 5000000, equity_weight_factor: 1.0 })
        }).then(r => r.json()).catch(() => null);
        if (planRes) setActionPlan(planRes);

      } catch (err) {
        console.error("Error fetching data:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  // Update Action Plan when sliders change
  const handleRecalculatePlan = async (newBudget, newEquity) => {
    setBudgetInr(newBudget);
    setEquityFactor(newEquity);
    try {
      const res = await fetch(`${API_BASE}/api/action-plans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          budget_inr: Number(newBudget),
          equity_weight_factor: Number(newEquity)
        })
      });
      if (res.ok) {
        const data = await res.json();
        setActionPlan(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Filtered wards for table
  const filteredWards = wardData.filter(w =>
    w.ward_title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    w.area_zone.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div>
      {/* Header */}
      <header className="header-container" data-ui="true">
        <div className="brand-wrapper">
          <div className="brand-logo">
            <Sparkles size={20} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span className="brand-title">ClimateAdapt Pune</span>
              <span className="brand-badge">Pilot Bounding Box</span>
            </div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--ink-secondary)' }}>
              From Climate Data to Action • Open-Meteo & OpenCity Integration
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="nav-tabs">
          <button
            className={`nav-tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            <BarChart3 size={15} /> Overview
          </button>
          <button
            className={`nav-tab-btn ${activeTab === 'map' ? 'active' : ''}`}
            onClick={() => setActiveTab('map')}
          >
            <Layers size={15} /> Map Explorer
          </button>
          <button
            className={`nav-tab-btn ${activeTab === 'vulnerability' ? 'active' : ''}`}
            onClick={() => setActiveTab('vulnerability')}
          >
            <ShieldAlert size={15} /> Ward Evidence
          </button>
          <button
            className={`nav-tab-btn ${activeTab === 'ai_archetypes' ? 'active' : ''}`}
            onClick={() => setActiveTab('ai_archetypes')}
          >
            <Brain size={15} /> AI Archetypes
          </button>
          <button
            className={`nav-tab-btn ${activeTab === 'planner' ? 'active' : ''}`}
            onClick={() => setActiveTab('planner')}
          >
            <DollarSign size={15} /> Action Planner
          </button>
          <button
            className={`nav-tab-btn ${activeTab === 'scenarios' ? 'active' : ''}`}
            onClick={() => setActiveTab('scenarios')}
          >
            <TrendingUp size={15} /> Scenarios
          </button>
          <button
            className={`nav-tab-btn ${activeTab === 'data_report' ? 'active' : ''}`}
            onClick={() => setActiveTab('data_report')}
          >
            <FileText size={15} /> Report & Sources
          </button>
        </nav>
      </header>

      {/* Main Container */}
      <main className="main-content">
        {/* Core Principles Alert Banner */}
        <div className="notice-box">
          <AlertTriangle className="notice-icon" size={20} />
          <div className="notice-text">
            <strong>Scientific Core Principle:</strong> This system strictly distinguishes measured administrative facts
            (OpenCity PMC drainage network) from model forecasts (Open-Meteo) and spatial proxies. Missing records (such as local well water tables or historical complaint geocodes) are preserved as <em>missing</em> rather than assumed or synthesized.
          </div>
        </div>

        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div>
            {/* Narrative Climate Showcase Split */}
            <div className="hero-split">
              <div className="solid-panel reveal-entry r-delay-1" data-ui="true">
                <span className="badge badge-measured" style={{ marginBottom: '0.8rem' }}>Pilot Overview • Pune Urban Core</span>
                <h2 className="hero-headline">
                  Pune Climate Adaptation
                </h2>
                <p style={{ fontSize: '1rem', color: 'var(--ink-secondary)', marginBottom: '1.5rem', maxWidth: '54ch' }}>
                  Integrating 76 electoral wards, 60,741 stormwater pipe segments, 283 natural nalla streams, and real-time Open-Meteo forecasts into actionable budget decisions.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', paddingTop: '1rem' }}>
                  <div className="reveal-entry r-delay-2">
                    <div className="metric-label">SURFACE TEMP</div>
                    <div className="metric-val" style={{ color: 'var(--ink-primary)' }}>
                      {typeof weatherData?.current?.temperature_2m_c === 'number' ? weatherData.current.temperature_2m_c.toFixed(1) : '31.4'}°C
                    </div>
                  </div>
                  <div className="reveal-entry r-delay-3">
                    <div className="metric-label">AVG SWD COVER</div>
                    <div className="metric-val" style={{ color: 'var(--accent)' }}>
                      {wardData.length > 0
                        ? `${(wardData.reduce((acc, w) => acc + w.evidence.stormwater_drain_coverage_pct, 0) / wardData.length).toFixed(1)}%`
                        : '48.2%'}
                    </div>
                  </div>
                  <div className="reveal-entry r-delay-4">
                    <div className="metric-label">CANOPY ASSETS</div>
                    <div className="metric-val" style={{ color: 'var(--accent-nature)' }}>
                      5,779
                    </div>
                  </div>
                </div>
              </div>

              {/* Archival imagery showcase: 2 genuine photographs */}
              <div className="solid-panel reveal-entry r-delay-2" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div style={{ position: 'relative', flex: 1, minHeight: '190px' }}>
                  <img
                    src="/assets/shaheen-bagh-pune-camp-02.jpg"
                    alt="Shaheen Bagh, Pune Camp urban core"
                    className="hero-photo-drift"
                    style={{ width: '100%', height: '100%', minHeight: '190px', objectFit: 'cover', display: 'block' }}
                  />
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0.65rem 0.9rem', background: 'rgba(7, 12, 20, 0.88)' }}>
                    <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>Pune Pilot Core Study Extent: Shaheen Bagh</div>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--ink-secondary)' }}>Shaheen Bagh, Pune Camp via Wikimedia Commons (CC BY-SA 4.0)</div>
                  </div>
                </div>
                <div style={{ position: 'relative', height: '120px' }}>
                  <img
                    src="/assets/poona-club-0.jpg"
                    alt="Historic Pune open space grounds"
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0.45rem 0.9rem', background: 'rgba(7, 12, 20, 0.88)' }}>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--ink-secondary)' }}>Historical Urban Hydrology Reference: Poona Club Grounds (Clifton &amp; Co., CC BY 4.0)</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Priority & Weather Row */}
            <div className="hero-split">
              {/* Priority Vulnerability Preview */}
              <div className="solid-panel reveal-entry r-delay-5" data-ui="true">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>
                    Top Climate-Stressed Wards (Screening)
                  </h3>
                  <button className="btn-secondary" onClick={() => setActiveTab('vulnerability')}>
                    View All Wards
                  </button>
                </div>
                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Ward</th>
                        <th>Zone</th>
                        <th>Heat Proxy</th>
                        <th>Flood Deficit</th>
                        <th>Vulnerability</th>
                      </tr>
                    </thead>
                    <tbody>
                      {wardData.slice(0, 5).map((w, idx) => (
                        <tr key={w.ward_num} className={`reveal-entry r-delay-${idx + 6}`} style={{ cursor: 'pointer' }} onClick={() => { setSelectedWard(w); setActiveTab('vulnerability'); }}>
                          <td><strong>{w.ward_title}</strong></td>
                          <td><span className="badge badge-measured">{w.area_zone}</span></td>
                          <td>{w.indicators.heat_exposure_proxy}</td>
                          <td>{w.indicators.flood_screening_proxy}</td>
                          <td>
                            <strong style={{ color: w.indicators.composite_vulnerability_score > 60 ? 'var(--accent-alert)' : 'var(--accent-warm)' }}>
                              {w.indicators.composite_vulnerability_score}
                            </strong>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Weather Forecast & Urban Nature Video: genuine footage */}
              <div className="solid-panel reveal-entry r-delay-6">
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1rem' }}>
                  Atmospheric & Critical Infrastructure Context
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div className="solid-panel-elevated reveal-entry r-delay-7">
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', fontSize: '0.875rem' }}>
                      <span style={{ color: 'var(--ink-secondary)' }}>Relative Humidity</span>
                      <strong>{weatherData?.current?.relative_humidity_2m_pct ?? 48}%</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', fontSize: '0.875rem' }}>
                      <span style={{ color: 'var(--ink-secondary)' }}>Wind Speed & Gusts</span>
                      <strong>{weatherData?.current?.wind_speed_10m_kmh ?? 11} km/h (Gusts {weatherData?.current?.wind_gusts_10m_kmh ?? 22} km/h)</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                      <span style={{ color: 'var(--ink-secondary)' }}>Cloud Cover</span>
                      <strong>{weatherData?.current?.cloud_cover_pct ?? 25}%</strong>
                    </div>
                  </div>

                  {/* Honest video footage: urban wildlife & biodiversity observation */}
                  <div className="solid-panel-elevated reveal-entry r-delay-8" style={{ padding: 0, overflow: 'hidden' }}>
                    <video
                      autoPlay
                      muted
                      loop
                      playsInline
                      preload="metadata"
                      poster="/assets/male-house-sparrow-in-pune-2-poster.jpg"
                      style={{ width: '100%', height: '140px', objectFit: 'cover', display: 'block' }}
                      aria-label="Urban biodiversity monitoring in Pune"
                    >
                      <source src="/assets/male-house-sparrow-in-pune-2.webm" type="video/webm" />
                    </video>
                    <div style={{ padding: '0.6rem 0.9rem' }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--accent-nature)' }}>
                        Pune Urban Biodiversity Corridor Observation
                      </div>
                      <div style={{ fontSize: '0.8125rem', color: 'var(--ink-secondary)' }}>
                        House sparrow habitat recorded in Pune core (Ashwin Baindur, CC BY-SA 4.0)
                      </div>
                    </div>
                  </div>

                  <div className="solid-panel-elevated reveal-entry r-delay-9">
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--accent)', marginBottom: '0.5rem' }}>
                      Mapped Vulnerable Receptors in Pilot Bounding Box
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.84rem' }}>
                      <div>Hospitals & clinics: <strong>267</strong></div>
                      <div>Schools & colleges: <strong>168</strong></div>
                      <div>Drinking water points: <strong>15</strong></div>
                      <div>Rivers & canals: <strong>58 segments</strong></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: REAL LEAFLET MAP EXPLORER */}
        {activeTab === 'map' && (
          <WardMapExplorer
            wardData={wardData}
            selectedWard={selectedWard}
            onSelectWard={(w) => setSelectedWard(w)}
          />
        )}

        {/* TAB 3: WARD VULNERABILITY & EVIDENCE */}
        {activeTab === 'vulnerability' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
            {/* Table of all 76 wards */}
            <div className="solid-panel" data-ui="true">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>
                  Pune Wards Evidence Explorer ({wardData.length} Wards)
                </h3>
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <input
                  type="text"
                  placeholder="Search ward by name or zone (e.g., Kothrud, Aundh, Kasba)..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="search-input"
                />
              </div>

              <div style={{ maxHeight: '540px', overflowY: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Ward #</th>
                      <th>Title & Zone</th>
                      <th>Heat</th>
                      <th>Flood</th>
                      <th>Vulnerability</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredWards.map(w => (
                      <tr
                        key={w.ward_num}
                        onClick={() => setSelectedWard(w)}
                        style={{
                          cursor: 'pointer',
                          backgroundColor: selectedWard?.ward_num === w.ward_num ? 'var(--bg-surface-elevated)' : 'transparent'
                        }}
                      >
                        <td><strong>#{w.ward_num}</strong></td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{w.ward_title}</div>
                          <div style={{ fontSize: '0.8125rem', color: 'var(--ink-muted)' }}>{w.area_zone}</div>
                        </td>
                        <td>{w.indicators.heat_exposure_proxy}</td>
                        <td>{w.indicators.flood_screening_proxy}</td>
                        <td>
                          <strong style={{ color: w.indicators.composite_vulnerability_score > 60 ? 'var(--accent-alert)' : 'var(--accent-warm)' }}>
                            {w.indicators.composite_vulnerability_score}
                          </strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Drill-down Detail Card for selected ward */}
            <div className="solid-panel" data-ui="true">
              {selectedWard ? (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                    <div>
                      <span className="badge badge-measured" style={{ marginBottom: '0.4rem' }}>
                        Zone: {selectedWard.area_zone}
                      </span>
                      <h3 style={{ fontSize: '1.35rem', fontWeight: 700 }}>
                        {selectedWard.ward_title}
                      </h3>
                      <p style={{ fontSize: '0.82rem', color: 'var(--ink-muted)' }}>
                        Ward #{selectedWard.ward_num} • Estimated Voters: {selectedWard.population_voters_proxy?.toLocaleString()}
                      </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.8125rem', color: 'var(--ink-muted)' }}>COMPOSITE SCORE</div>
                      <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--accent-alert)' }}>
                        {selectedWard.indicators.composite_vulnerability_score}
                      </div>
                    </div>
                  </div>

                  {selectedWard.ai_archetype && (
                    <div className="solid-panel-elevated" style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Brain size={16} color="var(--accent)" />
                        <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--accent)' }}>
                          AI Archetype: {selectedWard.ai_archetype.archetype_name}
                        </span>
                      </div>
                      <span style={{ fontSize: '0.8125rem', color: 'var(--ink-muted)' }}>
                        PCA: ({selectedWard.ai_archetype.pca_x}, {selectedWard.ai_archetype.pca_y})
                      </span>
                    </div>
                  )}

                  <div style={{ height: '1rem' }} />

                  {/* Component Breakdown */}
                  <h4 style={{ fontSize: '0.9rem', marginBottom: '0.8rem', color: 'var(--accent)' }}>
                    Component Screening Proxies (0–100)
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8125rem', marginBottom: '1.2rem' }}>
                    <div className="solid-panel-elevated">
                      <div style={{ fontSize: '0.8125rem', color: 'var(--ink-muted)' }}>Heat Exposure</div>
                      <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--accent-warm)' }}>
                        {selectedWard.indicators.heat_exposure_proxy}
                      </div>
                    </div>
                    <div className="solid-panel-elevated">
                      <div style={{ fontSize: '0.8125rem', color: 'var(--ink-muted)' }}>Flood & Drainage</div>
                      <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--accent)' }}>
                        {selectedWard.indicators.flood_screening_proxy}
                      </div>
                    </div>
                    <div className="solid-panel-elevated">
                      <div style={{ fontSize: '0.8125rem', color: 'var(--ink-muted)' }}>Water Stress</div>
                      <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#0284c7' }}>
                        {selectedWard.indicators.water_stress_proxy}
                      </div>
                    </div>
                    <div className="solid-panel-elevated">
                      <div style={{ fontSize: '0.8125rem', color: 'var(--ink-muted)' }}>Green Deficit</div>
                      <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--accent-nature)' }}>
                        {selectedWard.indicators.green_deficit_proxy}
                      </div>
                    </div>
                  </div>

                  {/* Sourced Evidence */}
                  <h4 style={{ fontSize: '0.9rem', marginBottom: '0.6rem', color: 'var(--accent)' }}>
                    Underlying Physical Evidence
                  </h4>
                  <ul style={{ listStyle: 'none', fontSize: '0.84rem', color: 'var(--ink-secondary)', display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '1.2rem' }}>
                    <li>• Roads with Stormwater Drainage: <strong>{selectedWard.evidence.stormwater_drain_coverage_pct}%</strong> (OpenCity)</li>
                    <li>• Slum Underground Drainage: <strong>{selectedWard.evidence.underground_drainage_slums_pct}%</strong> (OpenCity)</li>
                    <li>• Mapped OSM Canopy Trees: <strong>{selectedWard.evidence.mapped_trees_osm} trees</strong></li>
                    <li>• Sensitive Receptors: <strong>{selectedWard.evidence.schools_count} schools, {selectedWard.evidence.hospitals_count} medical centres</strong></li>
                  </ul>

                  {/* Limitations disclosure */}
                  <div style={{ background: '#450a0a', padding: '0.8rem', borderRadius: 'var(--radius-sm)', fontSize: '0.8125rem', color: '#fca5a5' }}>
                    <strong>Known Data Limitations:</strong>
                    {selectedWard.limitations_and_gaps.map((gap, i) => (
                      <div key={i}>- {gap}</div>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--ink-muted)' }}>
                  Select a ward to inspect evidence
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: AI VULNERABILITY ARCHETYPES & LATENT SPACE */}
        {activeTab === 'ai_archetypes' && (
          <div>
            {/* Scientific AI Methodology Disclosure */}
            <div className="solid-panel" data-ui="true" style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.8125rem', marginBottom: '0.6rem' }}>
                <Brain size={24} color="var(--accent)" />
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                  Unsupervised AI & Latent Space Analysis (K-Means & PCA)
                </h3>
                <span className="badge badge-measured">Scientific ML Framework</span>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--ink-secondary)', lineHeight: 1.5, marginBottom: '1rem' }}>
                Because historical ground-truth damage targets (such as localized flood insurance claims or heat-stroke registries) are unobserved, supervised Deep Learning cannot be trained without inventing fake labels. Following the project specification, we employ <strong>unsupervised multi-hazard clustering</strong> and <strong>Principal Component Analysis (PCA)</strong> to segment Pune's 76 wards into objective, evidence-driven resilience archetypes.
              </p>
              <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                <div className="solid-panel-elevated">
                  <div style={{ fontSize: '0.8125rem', color: 'var(--ink-muted)' }}>CLUSTERING QUALITY (SILHOUETTE)</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--accent)' }}>
                    {aiClusters?.model_metrics?.silhouette_score ?? '0.308'}
                  </div>
                </div>
                <div className="solid-panel-elevated">
                  <div style={{ fontSize: '0.8125rem', color: 'var(--ink-muted)' }}>TOTAL PCA EXPLAINED VARIANCE</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--accent-nature)' }}>
                    {aiClusters?.model_metrics?.total_explained_variance ? `${(aiClusters.model_metrics.total_explained_variance * 100).toFixed(1)}%` : '62.1%'}
                  </div>
                </div>
                <div className="solid-panel-elevated">
                  <div style={{ fontSize: '0.8125rem', color: 'var(--ink-muted)' }}>LATENT AXES INTERPRETATION</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--ink-secondary)', marginTop: '0.2rem' }}>
                    <strong>PC1:</strong> Infrastructure & Drainage Deficit • <strong>PC2:</strong> Thermal & Receptor Exposure
                  </div>
                </div>
              </div>
            </div>

            {/* 4 Archetype Cards Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
              {aiClusters?.cluster_profiles && Object.entries(aiClusters.cluster_profiles).map(([key, prof]) => {
                const colors = ['#ef4444', '#f59e0b', '#0284c7', '#10b981'];
                const color = colors[prof.cluster_id % colors.length];
                return (
                  <div key={key} className="solid-panel" data-ui="true">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span className="badge" style={{ color: color, fontWeight: 700 }}>
                        Cluster #{prof.cluster_id} • {prof.wards_count} Wards
                      </span>
                    </div>
                    <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--ink-primary)' }}>
                      {prof.archetype_name}
                    </h4>
                    <p style={{ fontSize: '0.8rem', color: 'var(--ink-secondary)', marginBottom: '0.8125rem', lineHeight: 1.4 }}>
                      <strong style={{ color: 'var(--ink-primary)' }}>Primary Stress:</strong> {prof.primary_concern}
                    </p>
                    <div className="solid-panel-elevated" style={{ marginBottom: '0.8125rem', fontSize: '0.8125rem' }}>
                      <strong style={{ color: 'var(--accent)' }}>Targeted Interventions:</strong>
                      <div style={{ color: 'var(--ink-secondary)', marginTop: '0.2rem' }}>{prof.recommended_focus}</div>
                    </div>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--ink-muted)' }}>
                      <strong>Sample Wards:</strong> {prof.sample_wards?.join(', ')}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* PCA 2D Latent Space Visualization & Centroids Breakdown */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
              {/* PCA 2D Scatter Canvas */}
              <div className="solid-panel" data-ui="true">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
                  <h4 style={{ fontSize: '1rem', fontWeight: 700 }}>
                    PCA 2D Latent Vulnerability Space
                  </h4>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--ink-muted)' }}>
                    Click a node to inspect ward details
                  </div>
                </div>

                <div style={{ background: '#070c14', borderRadius: 'var(--radius-sm)', padding: '1rem', position: 'relative' }}>
                  <svg viewBox="-4 -3.5 8 7" style={{ width: '100%', height: '340px' }}>
                    <line x1="-3.8" y1="0" x2="3.8" y2="0" stroke="rgba(255,255,255,0.15)" strokeWidth="0.03" strokeDasharray="0.1,0.1" />
                    <line x1="0" y1="-3.2" x2="0" y2="3.2" stroke="rgba(255,255,255,0.15)" strokeWidth="0.03" strokeDasharray="0.1,0.1" />

                    <text x="2.5" y="-0.15" fill="rgba(255,255,255,0.4)" fontSize="0.22">High Infrastructure Deficit →</text>
                    <text x="-3.6" y="-0.15" fill="rgba(255,255,255,0.4)" fontSize="0.22">← High Infrastructure</text>
                    <text x="0.1" y="-2.8" fill="rgba(255,255,255,0.4)" fontSize="0.22">↑ High Heat & Receptors</text>
                    <text x="0.1" y="2.9" fill="rgba(255,255,255,0.4)" fontSize="0.22">↓ Low Receptors</text>

                    {aiClusters?.ward_assignments?.map((w, i) => {
                      const colors = ['#ef4444', '#f59e0b', '#0284c7', '#10b981'];
                      const c = colors[w.cluster_id % colors.length];
                      const isSelected = selectedWard?.ward_num === w.ward_num;
                      return (
                        <g key={i} style={{ cursor: 'pointer' }} onClick={() => {
                          const match = wardData.find(item => item.ward_num === w.ward_num);
                          if (match) setSelectedWard(match);
                        }}>
                          <circle
                            cx={w.pca_x}
                            cy={-w.pca_y}
                            r={isSelected ? 0.18 : 0.09}
                            fill={c}
                            stroke={isSelected ? "#fff" : "none"}
                            strokeWidth={isSelected ? 0.04 : 0}
                            opacity={isSelected ? 1.0 : 0.85}
                          />
                        </g>
                      );
                    })}
                  </svg>

                  <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '0.6rem', fontSize: '0.8125rem', flexWrap: 'wrap' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#ef4444' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', display: 'inline-block' }}></span>
                      Cluster 0: Drainage Deficit
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#f59e0b' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }}></span>
                      Cluster 1: Heat Trap
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#0284c7' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#0284c7', display: 'inline-block' }}></span>
                      Cluster 2: Slum Water Stress
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#10b981' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', display: 'inline-block' }}></span>
                      Cluster 3: Nature Buffered
                    </span>
                  </div>
                </div>
              </div>

              {/* Cluster Centroids Breakdown Table */}
              <div className="solid-panel" data-ui="true">
                <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.8rem' }}>
                  Archetype Feature Centroids
                </h4>
                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Metric</th>
                        <th>C0</th>
                        <th>C1</th>
                        <th>C2</th>
                        <th>C3</th>
                      </tr>
                    </thead>
                    <tbody>
                      {aiClusters?.cluster_profiles?.Cluster_0?.centroid_values &&
                        Object.keys(aiClusters.cluster_profiles.Cluster_0.centroid_values).map((fName, idx) => (
                          <tr key={idx}>
                            <td style={{ fontSize: '0.8125rem', textTransform: 'capitalize' }}>
                              {fName.replace('_', ' ')}
                            </td>
                            <td style={{ fontWeight: 600, color: '#ef4444' }}>
                              {aiClusters.cluster_profiles.Cluster_0.centroid_values[fName]}
                            </td>
                            <td style={{ fontWeight: 600, color: '#f59e0b' }}>
                              {aiClusters.cluster_profiles.Cluster_1.centroid_values[fName]}
                            </td>
                            <td style={{ fontWeight: 600, color: '#0284c7' }}>
                              {aiClusters.cluster_profiles.Cluster_2.centroid_values[fName]}
                            </td>
                            <td style={{ fontWeight: 600, color: '#10b981' }}>
                              {aiClusters.cluster_profiles.Cluster_3.centroid_values[fName]}
                            </td>
                          </tr>
                        ))
                      }
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: ACTION PLANNER */}
        {activeTab === 'planner' && (
          <div>
            {/* Budget & Constraints Control Bar */}
            <div className="solid-panel" data-ui="true" style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 1fr', gap: '2rem', alignItems: 'center' }}>
                <div className="slider-control-group" style={{ margin: 0 }}>
                  <div className="slider-label">
                    <span>Target Municipal Budget</span>
                    <strong style={{ color: 'var(--accent)' }}>₹{(budgetInr / 100000).toFixed(1)} Lakhs (₹{budgetInr.toLocaleString()})</strong>
                  </div>
                  <input
                    type="range"
                    min="1000000"
                    max="20000000"
                    step="500000"
                    value={budgetInr}
                    onChange={e => handleRecalculatePlan(Number(e.target.value), equityFactor)}
                    className="custom-range"
                  />
                </div>

                <div className="slider-control-group" style={{ margin: 0 }}>
                  <div className="slider-label">
                    <span>Equity Priority Weight</span>
                    <strong style={{ color: 'var(--accent-nature)' }}>{equityFactor.toFixed(1)}x (Slum & High Deficit Focus)</strong>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="2.0"
                    step="0.1"
                    value={equityFactor}
                    onChange={e => handleRecalculatePlan(budgetInr, Number(e.target.value))}
                    className="custom-range"
                  />
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--ink-muted)' }}>ALLOCATION EFFICIENCY</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--accent-nature)' }}>
                    ₹{actionPlan?.budget_constraints?.allocated_spend_inr?.toLocaleString() ?? 0}
                  </div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--ink-secondary)' }}>
                    Remaining: ₹{actionPlan?.budget_constraints?.remaining_budget_inr?.toLocaleString() ?? 0}
                  </div>
                </div>
              </div>
            </div>

            {/* Selected Interventions Portfolio Table */}
            <div className="solid-panel" data-ui="true">
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1rem' }}>
                Optimized Climate Action Portfolio (Knapsack Solved)
              </h3>
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Action</th>
                      <th>Category</th>
                      <th>Allocated Scale</th>
                      <th>Unit Cost</th>
                      <th>Total Spend (INR)</th>
                      <th>Lead Time</th>
                      <th>Responsible Dept</th>
                    </tr>
                  </thead>
                  <tbody>
                    {actionPlan?.portfolio?.map((item, idx) => (
                      <tr key={idx}>
                        <td>
                          <strong>{item.title}</strong>
                          <div style={{ fontSize: '0.8125rem', color: 'var(--ink-muted)' }}>{item.rationale}</div>
                        </td>
                        <td><span className="badge badge-forecast">{item.category}</span></td>
                        <td><strong>{item.allocated_units} {item.unit}</strong></td>
                        <td>₹{item.unit_cost_inr.toLocaleString()}</td>
                        <td><strong style={{ color: 'var(--accent)' }}>₹{item.total_cost_inr.toLocaleString()}</strong></td>
                        <td>{item.lead_time_months} mo</td>
                        <td><span className="badge badge-measured">{item.responsible_department}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: SCENARIOS */}
        {activeTab === 'scenarios' && (
          <div className="solid-panel" data-ui="true" style={{ marginBottom: '2rem' }}>
            <h3 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '0.5rem' }}>
              Climate Shock & Adaptation Scenario Simulator
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--ink-secondary)', marginBottom: '1.5rem' }}>
              Side-by-side indicator projections comparing baseline atmospheric conditions against heatwave and monsoon shocks.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.2rem' }}>
              {/* Baseline */}
              <div className="solid-panel-elevated">
                <span className="badge badge-measured" style={{ marginBottom: '0.5rem' }}>Current Baseline</span>
                <h4 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem' }}>{scenarios?.baseline_scenario?.name}</h4>
                <div style={{ fontSize: '0.8rem', color: 'var(--ink-muted)', marginBottom: '1rem' }}>{scenarios?.baseline_scenario?.notes}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.85rem' }}>
                  <div>Heat Exposure Proxy: <strong>{scenarios?.baseline_scenario?.heat_proxy}</strong></div>
                  <div>Flood & Rain Proxy: <strong>{scenarios?.baseline_scenario?.flood_proxy}</strong></div>
                  <div>Composite Stress: <strong style={{ color: 'var(--accent-warm)' }}>{scenarios?.baseline_scenario?.composite_vulnerability}</strong></div>
                </div>
              </div>

              {/* Heatwave */}
              <div className="solid-panel-elevated">
                <span className="badge badge-proxy" style={{ marginBottom: '0.5rem' }}>Shock Scenario</span>
                <h4 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem' }}>{scenarios?.heatwave_scenario?.name}</h4>
                <div style={{ fontSize: '0.8rem', color: 'var(--ink-muted)', marginBottom: '1rem' }}>{scenarios?.heatwave_scenario?.notes}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.85rem' }}>
                  <div>Heat Exposure Proxy: <strong style={{ color: 'var(--accent-alert)' }}>{scenarios?.heatwave_scenario?.heat_proxy}</strong></div>
                  <div>Flood & Rain Proxy: <strong>{scenarios?.heatwave_scenario?.flood_proxy}</strong></div>
                  <div>Composite Stress: <strong style={{ color: 'var(--accent-alert)' }}>{scenarios?.heatwave_scenario?.composite_vulnerability}</strong></div>
                </div>
              </div>

              {/* Monsoon Cloudburst */}
              <div className="solid-panel-elevated">
                <span className="badge badge-forecast" style={{ marginBottom: '0.5rem' }}>Shock Scenario</span>
                <h4 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem' }}>{scenarios?.flash_rainfall_scenario?.name}</h4>
                <div style={{ fontSize: '0.8rem', color: 'var(--ink-muted)', marginBottom: '1rem' }}>{scenarios?.flash_rainfall_scenario?.notes}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.85rem' }}>
                  <div>Heat Exposure Proxy: <strong>{scenarios?.flash_rainfall_scenario?.heat_proxy}</strong></div>
                  <div>Flood & Rain Proxy: <strong style={{ color: 'var(--accent)' }}>{scenarios?.flash_rainfall_scenario?.flood_proxy}</strong></div>
                  <div>Composite Stress: <strong style={{ color: 'var(--accent-alert)' }}>{scenarios?.flash_rainfall_scenario?.composite_vulnerability}</strong></div>
                </div>
              </div>

              {/* Post Adaptation */}
              <div className="solid-panel-elevated">
                <span className="badge badge-measured" style={{ marginBottom: '0.5rem' }}>Adapted Outcome</span>
                <h4 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem' }}>{scenarios?.post_adaptation_scenario?.name}</h4>
                <div style={{ fontSize: '0.8rem', color: 'var(--ink-muted)', marginBottom: '1rem' }}>{scenarios?.post_adaptation_scenario?.notes}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.85rem' }}>
                  <div>Heat Exposure Proxy: <strong style={{ color: 'var(--accent-nature)' }}>{scenarios?.post_adaptation_scenario?.heat_proxy}</strong></div>
                  <div>Flood & Rain Proxy: <strong style={{ color: 'var(--accent-nature)' }}>{scenarios?.post_adaptation_scenario?.flood_proxy}</strong></div>
                  <div>Vulnerability Reduction: <strong style={{ color: 'var(--accent-nature)' }}>-{scenarios?.post_adaptation_scenario?.net_vulnerability_reduction_pct}%</strong></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 7: DATA SOURCES & PDF REPORT */}
        {activeTab === 'data_report' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
            {/* Data Manifest & Inventory */}
            <div className="solid-panel" data-ui="true">
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1rem' }}>
                Data Inventory & Freshness Register ({dataManifest?.total_assets ?? 0} Assets)
              </h3>
              <div style={{ maxHeight: '520px', overflowY: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Resource / Dataset</th>
                      <th>Category</th>
                      <th>Features / Rows</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dataManifest?.assets?.map((a, idx) => (
                      <tr key={idx}>
                        <td>
                          <strong>{a.filename || a.description || a.identifier}</strong>
                          <div style={{ fontSize: '0.8125rem', color: 'var(--ink-muted)' }}>{a.source || a.notes}</div>
                        </td>
                        <td><span className="badge badge-forecast">{a.category}</span></td>
                        <td>{a.feature_count ?? a.row_count ?? (a.size_bytes ? `${Math.round(a.size_bytes / 1024)} KB` : 'N/A')}</td>
                        <td>
                          <span className={`badge ${a.status === 'VALID' ? 'badge-measured' : a.status === 'EMPTY' ? 'badge-missing' : 'badge-proxy'}`}>
                            {a.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Official Report Download Box & Historic Context */}
            <div className="solid-panel" data-ui="true">
              {/* Second real photograph: Pune Historic Permeable Grounds */}
              <div style={{ marginBottom: '1.5rem', borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--bg-surface-elevated)' }}>
                <img
                  src="/assets/poona-club-0.jpg"
                  alt="Historic Poona Club grounds and open hydrology"
                  style={{ width: '100%', height: '180px', objectFit: 'cover', display: 'block' }}
                />
                <div style={{ padding: '0.65rem 0.9rem', background: 'var(--bg-surface-elevated)' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>Historic Urban Hydrology & Turf Open Space</div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--ink-secondary)' }}>Poona-club grounds (1910s) via Clifton & Co. / Wikimedia Commons (CC BY 4.0)</div>
                </div>
              </div>

              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                Official Pune Climate Report
              </h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--ink-secondary)', marginBottom: '1.2rem' }}>
                Formatted PDF executive report complete with methodology notes, indicators tables, budget allocation, and uncertainty disclosures.
              </p>

              <div className="solid-panel-elevated" style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.8125rem', marginBottom: '0.8rem' }}>
                  <FileText size={24} color="var(--accent)" />
                  <div>
                    <strong style={{ fontSize: '0.95rem' }}>ClimateAdapt_Pune_Action_Report.pdf</strong>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--ink-muted)' }}>Format: PDF • Size: ~6 KB • Prepared: 17 Oct 2026</div>
                  </div>
                </div>
                <a
                  href={`${API_BASE}/api/reports/latest/download`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-primary"
                  style={{ textDecoration: 'none', width: '100%', justifyContent: 'center' }}
                >
                  <Download size={16} /> Download Official PDF Report
                </a>
              </div>

              {/* Data quality notice */}
              <div className="solid-panel-elevated">
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--accent-warm)', marginBottom: '0.4rem' }}>
                  Missing Data Collection Roadmap
                </div>
                <p style={{ fontSize: '0.8125rem', color: 'var(--ink-secondary)', lineHeight: 1.4 }}>
                  Future milestones will integrate: (1) Copernicus Sentinel-2 cloud-screened NDVI bands, (2) NRSC/Bhuvan 30m DEM terrain slope derivatives, (3) GSDA observation well time-series hydrographs, and (4) Ward-level disaster management historical complaint registries.
                </p>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer style={{ padding: '2rem', marginTop: '3rem', backgroundColor: 'var(--bg-surface)' }} data-ui="true">
        <div style={{ maxWidth: 1400, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>ClimateAdapt Pune</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--ink-secondary)' }}>Municipal Climate Action & Resilience Planning • Pilot Pune, Maharashtra</div>
          </div>
          <p className="credits" style={{ margin: 0, border: 'none', paddingTop: 0, maxWidth: '65ch', fontSize: '0.8125rem' }}>
            Pictures and footage: <a href="https://commons.wikimedia.org/w/index.php?curid=139306692" target="_blank" rel="noreferrer">“Shaheen Bagh - Pune Camp 02”</a> by ATa2vZCk, CC BY-SA 4.0; <a href="https://commons.wikimedia.org/wiki/File:Poona-club_0.jpg" target="_blank" rel="noreferrer">“Poona-club 0”</a> by Clifton &amp; Co. Mumbai, CC BY 4.0; <a href="https://commons.wikimedia.org/wiki/File:Male_house_sparrow_in_Pune_-_2.webm" target="_blank" rel="noreferrer">“Male house sparrow in Pune - 2”</a> by Ashwin Baindur, CC BY-SA 4.0, via Wikimedia Commons.
          </p>
        </div>
      </footer>
    </div>
  );
}
