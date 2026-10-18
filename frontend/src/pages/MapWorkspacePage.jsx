/**
 * MapWorkspacePage.jsx — Page 3: Interactive Pune map workspace
 * Full-height split layout: sidebar layers + Leaflet map canvas + ward detail panel.
 * Reuses the existing WardMapExplorer Leaflet implementation wholesale.
 */
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../services/api';
import WardMapExplorer from '../WardMapExplorer';
import Header from '../components/Header';
import { AlertTriangle, Info } from 'lucide-react';

export default function MapWorkspacePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [wardData, setWardData] = useState([]);
  const [selectedWard, setSelectedWard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showDataNotice, setShowDataNotice] = useState(true);

  useEffect(() => {
    api.indicators()
      .then(data => {
        if (data?.wards) {
          setWardData(data.wards);
          const requestedWardNum = searchParams.get('ward');
          if (requestedWardNum) {
            const found = data.wards.find(w => String(w.ward_num) === String(requestedWardNum));
            setSelectedWard(found || null);
          } else {
            setSelectedWard(null);
          }
        }
      })
      .catch(() => setError('Could not load ward indicator data from the backend.'))
      .finally(() => setLoading(false));
  }, [searchParams]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#030B14', overflow: 'hidden' }}>
      {/* ── Top navigation bar ── */}
      <Header variant="workspace" />

      {/* ── Body: WardMapExplorer fills the rest ── */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', display: 'flex', minHeight: 0 }}>

        {loading && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 50,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: '#030B14',
          }}>
            <div style={{ textAlign: 'center' }}>
              <div className="spinner" style={{ margin: '0 auto var(--sp-4)' }} />
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-muted)' }}>Loading ward data…</p>
            </div>
          </div>
        )}

        {error && (
          <div style={{
            position: 'absolute', top: 'var(--sp-5)', left: '50%', transform: 'translateX(-50%)',
            zIndex: 50, background: 'var(--surface)', borderRadius: 'var(--r-md)',
            padding: 'var(--sp-4) var(--sp-6)', display: 'flex', alignItems: 'center', gap: 'var(--sp-3)',
            maxWidth: 480,
          }}>
            <AlertTriangle size={16} style={{ color: 'var(--heat-color)', flexShrink: 0 }} />
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--ink)' }}>{error}</span>
          </div>
        )}

        {/* WardMapExplorer takes full flex space */}
        {!loading && (
          <div style={{ flex: 1, display: 'flex', minHeight: 0, minWidth: 0 }}>
            <WardMapExplorer
              wardData={wardData}
              selectedWard={selectedWard}
              onSelectWard={setSelectedWard}
              onClearWard={() => setSelectedWard(null)}
            />
          </div>
        )}

        {/* ── Data quality notice (dismissible) ── */}
        {showDataNotice && (
          <div style={{
            position: 'absolute', bottom: 'var(--sp-5)', right: 'var(--sp-5)',
            zIndex: 500, background: '#071523', border: '1px solid rgba(0,102,158,0.35)',
            borderRadius: 10, padding: 'var(--sp-4)', maxWidth: 340,
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--sp-3)' }}>
              <Info size={14} style={{ color: '#38BDF8', flexShrink: 0, marginTop: 2 }} />
              <div>
                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: '#FFFFFF', marginBottom: 'var(--sp-2)' }}>
                  Data and methodology
                </div>
                <div style={{ fontSize: 'var(--text-xs)', color: '#94A3B8', lineHeight: 1.6 }}>
                  Vulnerability scores are spatial screening proxies derived from municipal infrastructure datasets — not calibrated hydraulic or epidemiological models. Weather data is city-level, not ward-level. Census data is 2011 baseline.
                </div>
                <button
                  onClick={() => setShowDataNotice(false)}
                  style={{ marginTop: 'var(--sp-3)', fontSize: 'var(--text-xs)', color: '#64748B', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'var(--font)' }}
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
